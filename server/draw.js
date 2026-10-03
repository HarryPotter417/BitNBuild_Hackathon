import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Fair Drop draw — commit / reveal, verifiable by anyone.
 *
 * Protocol
 * ────────
 *  1. FREEZE    The participant set is frozen and sorted.
 *  2. SNAPSHOT  snapshotHash = SHA-256(eventId | join('\n', sortedParticipantIds))
 *               Published immediately. Nobody can add or drop a participant
 *               without changing this hash.
 *  3. COMMIT    The organiser draws a 32-byte seed and publishes
 *               commitmentHash = SHA-256(seed) *before* the ranking runs.
 *               After this point the seed is fixed and cannot be chosen to
 *               favour anybody.
 *  4. RANK      score(p) = HMAC-SHA256(seed, snapshotHash + ':' + p)
 *               Participants are ordered by score ascending. Because HMAC is a
 *               PRF, no participant can be predicted, favoured or brute-forced
 *               before the seed is committed.
 *  5. REVEAL    The seed is published. Anyone recomputes steps 1–4 with the
 *               three published values and gets the identical ranking.
 *  6. SELECT    The first `capacity` participants in the ranking win.
 *
 * This module is the real algorithm. The seeded dataset feeds it real inputs,
 * so every hash on the verification screen is genuinely computed here.
 */

export const DRAW_ALGORITHM = "HMAC-SHA256";
export const DRAW_VERSION = "1.0";

export function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function commitSeed(seed) {
  return sha256Hex(seed);
}

/** Deterministic, regenerable participant identifiers for the seeded dataset. */
export function participantIdFor(eventId, index) {
  return `usr_${sha256Hex(`${eventId}#${index}`).slice(0, 12)}`;
}

export function buildParticipantSet(eventId, count) {
  const ids = new Array(count);
  for (let i = 0; i < count; i += 1) ids[i] = participantIdFor(eventId, i);
  return ids.sort();
}

export function computeSnapshotHash(eventId, participantIds) {
  const sorted = [...participantIds].sort();
  return sha256Hex(`${eventId}\n${sorted.join("\n")}`);
}

/**
 * Publish-time artefacts. Generated at freeze, before any seed exists in the
 * clear — exactly like the real protocol.
 */
export function createFreezeArtifacts(eventId, participantIds) {
  const snapshotHash = computeSnapshotHash(eventId, participantIds);
  const seed = randomBytes(32).toString("hex");
  return {
    snapshotHash,
    seed,
    commitmentHash: commitSeed(seed),
    participantCount: participantIds.length,
  };
}

function scoreFor(seed, snapshotHash, participantId) {
  return createHmac("sha256", seed)
    .update(`${snapshotHash}:${participantId}`, "utf8")
    .digest("hex");
}

/**
 * Full deterministic ranking. Memoised per event by the store because it is
 * the one genuinely expensive operation in the simulation (50k HMACs).
 */
export function rankParticipants({ eventId, participantIds, snapshotHash, seed, capacity }) {
  const scored = participantIds.map((id) => ({
    id,
    score: scoreFor(seed, snapshotHash, id),
  }));
  scored.sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0));

  const selected = scored.slice(0, capacity);
  const waitlist = scored.slice(capacity);
  return {
    all: scored,
    selected,
    waitlist,
    selectedIds: new Set(selected.map((s) => s.id)),
    rankOf(participantId) {
      const index = scored.findIndex((s) => s.id === participantId);
      return index === -1 ? null : index + 1;
    },
    scoreOf(participantId) {
      const found = scored.find((s) => s.id === participantId);
      return found ? found.score : null;
    },
  };
}

/**
 * Independent verifier used by the Draw Verification screen. It deliberately
 * rebuilds everything from the three published artefacts and ignores any
 * cached state, so a mismatch would actually surface as a mismatch.
 */
export function verifyDraw({
  eventId,
  participantIds,
  capacity,
  snapshotHash,
  commitmentHash,
  revealedSeed,
  claimedSelectedIds,
}) {
  const checks = [];

  const commitmentOk = revealedSeed
    ? commitSeed(revealedSeed) === commitmentHash
    : null;
  checks.push({
    id: "commitment",
    label: "Commitment matches revealed seed",
    detail: revealedSeed
      ? commitmentOk
        ? "SHA-256(seed) equals the published commitment."
        : "Recomputed commitment does not match."
      : "Seed not revealed yet — commitment cannot be checked yet.",
    state: revealedSeed ? (commitmentOk ? "pass" : "fail") : "pending",
  });

  const snapshotOk = computeSnapshotHash(eventId, participantIds) === snapshotHash;
  checks.push({
    id: "snapshot",
    label: "Snapshot hash matches the frozen participant set",
    detail: snapshotOk
      ? "Recomputed from the frozen set; no participant was added or removed."
      : "Recomputed snapshot differs from the published value.",
    state: snapshotOk ? "pass" : "fail",
  });

  let recomputedOk = null;
  let recomputedCount = null;
  if (revealedSeed && snapshotOk) {
    const ranking = rankParticipants({
      eventId,
      participantIds,
      snapshotHash,
      seed: revealedSeed,
      capacity,
    });
    recomputedCount = ranking.selected.length;
    recomputedOk =
      Array.isArray(claimedSelectedIds) &&
      claimedSelectedIds.length === ranking.selected.length &&
      claimedSelectedIds.every((id, i) => ranking.selected[i].id === id);
    checks.push({
      id: "ranking",
      label: "Deterministic ranking reproduces the same winners",
      detail: recomputedOk
        ? `Re-ran HMAC-SHA256 over ${participantIds.length.toLocaleString("en-IN")} participants; the first ${capacity} match the published selection, in the same order.`
        : "Recomputed selection does not match the published one.",
      state: recomputedOk ? "pass" : "fail",
    });
  } else {
    checks.push({
      id: "ranking",
      label: "Deterministic ranking reproduces the same winners",
      detail: "Waiting for the seed to be revealed.",
      state: "pending",
    });
  }

  const hasFailure = checks.some((c) => c.state === "fail");
  const allPass = !hasFailure && checks.every((c) => c.state === "pass");

  return {
    verified: allPass,
    awaitingReveal: !revealedSeed,
    checks,
    recomputedSelectedCount: recomputedCount,
  };
}
