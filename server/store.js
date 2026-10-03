import {
  createFreezeArtifacts as buildFreezeArtifacts,
  buildParticipantSet,
  rankParticipants,
  verifyDraw,
  DRAW_ALGORITHM,
  DRAW_VERSION,
} from "./draw.js";
import {
  buildSeed,
  buildAuditLog,
  buildServiceCatalog,
  bucketForRequestCount,
  baseRequestsFor,
  DEMO_USER,
} from "./seed.js";
import { EVENT_STATUS } from "../lib/status.js";
import { rngFrom, randomInt, gaussian } from "./rng.js";

/**
 * Fair Drop simulated backend.
 *
 * This module plays the role the real service plays: it owns state, enforces
 * the invariants and answers queries. The UI only ever renders what this store
 * reports, so every number on screen is traceable to an invariant enforced here.
 *
 * Invariants enforced (and asserted, never assumed):
 *   I1  One entry per (user, event). Repeated requests never add an entry.
 *   I2  The participant set is immutable once the event is frozen.
 *   I3  Confirmed allocations never exceed capacity.
 *   I4  A seat is allocated at most once, and a claim is idempotent.
 *
 * Two things are deliberately *not* faked: participant counts and winners come
 * out of the real HMAC-SHA256 ranking in `draw.js`, and the request-frequency
 * fairness table is measured from the request profile rather than asserted.
 *
 * The one fixture: the demo account is bound to whichever participant the real
 * draw placed at a chosen rank (see `DEMO_RANK_INDEX`), so a panel walkthrough
 * can reach every outcome state. The ranking itself is never modified.
 */

const MINUTE = 60_000;

export const DRAW_STAGES = [
  { id: "frozen", label: "Participant set frozen", hint: "Entry window closed. The set is now immutable." },
  { id: "snapshot", label: "Snapshot created", hint: "SHA-256 over the sorted participant set." },
  { id: "commitment", label: "Commitment generated", hint: "SHA-256(seed) published before any ranking runs." },
  { id: "ranking", label: "Generating deterministic ranking", hint: "HMAC-SHA256 per participant." },
  { id: "select", label: "Selecting winners", hint: "The first N in the ranking." },
];

const STAGE_OFFSET = { frozen: 0, snapshot: 3500, commitment: 8000, ranking: 15000, select: 23000 };
const DRAW_TOTAL_MS = 45000;
/** How far into the pipeline the seeded in-flight draw is at boot. */
const SEEDED_DRAW_ELAPSED = 20000;
/** How long the seeded claiming event has had its claim window open. */
const SEEDED_CLAIM_ELAPSED = 18;

/** Epoch ms for anything that may be an ISO string or already a number. */
function toMs(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Date.parse(value);
}

const SEAT_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I and O omitted, as on real seat maps
const SEATS_PER_ROW = 120;

export function seatLabel(rankIndex) {
  const number = rankIndex + 1;
  const letter = SEAT_LETTERS[Math.floor((number - 1) / SEATS_PER_ROW) % SEAT_LETTERS.length];
  return `${letter}-${String(number).padStart(3, "0")}`;
}

/**
 * DEMO FIXTURE ONLY â€” which seat in the ranking the demo account is bound to.
 *
 * The account is *not* placed into the ranking. The real draw runs untouched,
 * and the demo account is then pointed at whichever participant that draw
 * actually placed at the rank below. Nothing about the ranking, the snapshot
 * hash or the verification is modified, which is why independent verification
 * still passes. Choosing which account to demonstrate is not tampering; placing
 * a participant in the ranking would be.
 *
 * Rank indexes are chosen so a panel walkthrough can reach every outcome.
 */
const DEMO_RANK_INDEX = {
  "tech-summit-2026": 101, // rank 102 â†’ seat A-102, confirmed after back-fill
  "founders-forum-2026": 213, // rank 214 â†’ seat B-214, claim window open
  "quantum-workshop-2026": 40, // rank 41, inside capacity â†’ seat when the live draw lands
  "india-design-week": 900, // rank 901 of 6,215 â†’ waitlist exhausted, not selected
  "climate-innovation-2026": 612, // rank 613, 27 seats unclaimed â†’ waitlist #13
  "open-mic-night-2026": 140, // rank 141 â†’ claim lapsed, seat released
};

function trafficShape(eventId, buckets, closed) {
  const rng = rngFrom("traffic", eventId, buckets, closed);
  const weights = [];
  for (let i = 0; i < buckets; i += 1) {
    const t = buckets === 1 ? 0 : i / (buckets - 1);
    const spike = Math.exp(-5.2 * t);
    const plateau = closed ? 0.07 : 0.55 + 0.45 * Math.min(1, t * 3);
    weights.push(Math.max(0.0008, spike + plateau + rng() * 0.05));
  }
  return weights;
}

const TRAFFIC_BUCKETS = 90;

function buildTraffic(event, bootTime) {
  const isOpen = event.state === "OPEN";
  const isDrawing = event.state === "DRAWING";
  const isClaiming = event.state === "CLAIMING";
  const entriesCloseAt = isOpen
    ? bootTime + 75 * MINUTE
    : isDrawing
      ? bootTime - SEEDED_DRAW_ELAPSED // a draw starts the moment the set is frozen
      : isClaiming
        ? // Pinned so the claim window is always live for the demo. Left to a
          // random offset it would often boot with every claim already lapsed.
          bootTime - SEEDED_CLAIM_ELAPSED * MINUTE
        : event.id === "tech-summit-2026"
          ? bootTime - 31 * MINUTE
          : bootTime - randomInt(rngFrom("close", event.id), 60, 600) * MINUTE;
  const entriesOpenAt = isOpen ? bootTime - 55 * MINUTE : entriesCloseAt - 75 * MINUTE;

  const start = entriesOpenAt - (TRAFFIC_BUCKETS - 1) * MINUTE;
  const weights = trafficShape(event.id, TRAFFIC_BUCKETS, !isOpen);
  const peak = Math.max(...weights);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const requestSum = weights.reduce((a, w) => a + w * (1.05 + rngFrom("rq", event.id, w)() * 0.4), 0) || 1;

  const rng = rngFrom("series", event.id);
  const points = [];
  let requestsLeft = event.joinRequests;
  let entriesLeft = event.participants;

  for (let i = 0; i < TRAFFIC_BUCKETS; i += 1) {
    const at = start + i * MINUTE;
    const isLast = i === TRAFFIC_BUCKETS - 1;

    const requests = isLast ? requestsLeft : Math.round(event.joinRequests * (weights[i] / weightSum));
    requestsLeft -= Math.min(requests, requestsLeft);

    let entries = isLast ? entriesLeft : Math.round(event.participants * (weights[i] / weightSum));
    entries = Math.max(0, Math.min(entries, entriesLeft));
    entriesLeft -= entries;

    const load = weights[i] / peak;
    const rejected = Math.min(requests, Math.round(requests * (0.14 + load * 0.4 + rng() * 0.05)));
    const failed =
      requests > 0 && rng() < 0.16 ? randomInt(rng, 1, Math.max(2, Math.round(requests / 900))) : 0;

    points.push({
      at: new Date(at).toISOString(),
      requests,
      entries,
      rejected429: rejected,
      failed503: failed,
      p95: Math.round(gaussian(rng, 170 + load * 430, 55, 40, 2400)),
      p50: Math.round(gaussian(rng, 52 + load * 95, 16, 12, 420)),
      accepted: Math.max(0, requests - rejected - failed),
    });
  }

  return {
    entriesOpenAt: new Date(entriesOpenAt).toISOString(),
    entriesCloseAt: new Date(entriesCloseAt).toISOString(),
    points,
  };
}

function buildSystemSeries(bootTime) {
  const ranges = {
    api: { base: 96, jitter: 9, spike: 0 },
    postgres: { base: 18, jitter: 6, spike: 46 },
    redis: { base: 2.4, jitter: 0.9, spike: 78 },
    bullmq: { base: 14, jitter: 5, spike: 0 },
    workers: { base: 38, jitter: 9, spike: 34 },
    mailhog: { base: 11, jitter: 4, spike: 0 },
  };

  return buildServiceCatalog().map((service) => {
    const rng = rngFrom("health", service.id);
    const range = ranges[service.id];
    const points = [];
    for (let i = 29; i >= 0; i -= 1) {
      const degrade = rng() < 0.1;
      points.push({
        at: new Date(bootTime - i * MINUTE).toISOString(),
        value: Math.round(gaussian(rng, range.base + (degrade ? range.spike : 0), range.jitter, 0.4, 340)),
        state: degrade ? "degraded" : "healthy",
      });
    }
    // State reflects the latest sample, not the whole window: a service that
    // blipped five minutes ago is not reported as degraded right now. Redis is
    // held degraded so the UI is exercised against a real degraded service.
    const last = points[points.length - 1];
    if (service.id === "redis") {
      last.state = "degraded";
      last.value = Math.max(last.value, 214);
    }
    return {
      ...service,
      points,
      state: last.state,
      current: last.value,
      peak: Math.max(...points.map((p) => p.value)),
      threshold: service.id === "workers" ? 90 : service.id === "redis" ? 60 : 250,
    };
  });
}

/**
 * Per-participant request volume, scaled so the profile sums to exactly the
 * event's declared join-request count. Scaling happens before bucketing, so a
 * bucket label always describes the value it contains.
 */
function buildRequestProfile(state, event) {
  const cached = state.requestProfiles[event.id];
  if (cached && cached.length === event.participants) return cached;

  const n = event.participants;
  const raw = new Array(n);
  let rawSum = 0;
  for (let i = 0; i < n; i += 1) {
    raw[i] = baseRequestsFor(event.id, i);
    rawSum += raw[i];
  }

  const scale = rawSum > 0 ? event.joinRequests / rawSum : 0;
  const counts = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    counts[i] = Math.max(1, Math.round(raw[i] * scale));
    total += counts[i];
  }

  // Deterministic integer reconciliation so the profile sums exactly.
  const order = counts.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  let drift = event.joinRequests - total;
  let guard = 0;
  while (drift !== 0 && guard < order.length * 8) {
    const i = order[guard % order.length];
    if (drift > 0) {
      counts[i] += 1;
      drift -= 1;
    } else if (counts[i] > 1) {
      counts[i] -= 1;
      drift += 1;
    }
    guard += 1;
  }

  state.requestProfiles[event.id] = counts;
  return counts;
}

function buildStore() {
  const bootTime = Date.now();
  const seed = buildSeed();

  const state = {
    bootTime,
    users: seed.users,
    events: {},
    order: [],
    rankings: {},
    artifacts: {},
    allocations: {},
    idempotency: {},
    requestProfiles: {},
    trafficRef: {},
    experiments: [],
    loadTests: [],
    audit: [],
    system: buildSystemSeries(bootTime),
  };

  for (const event of seed.events) {
    const traffic = buildTraffic(event, bootTime);
    const drawing = event.state === "DRAWING";
    // The whole draw timeline hangs off the moment the set was frozen: the
    // commitment goes out then, the pipeline runs, the seed is revealed when it
    // ends, and only then can anyone claim. Deriving them from one anchor is what
    // keeps "revealed before published" from ever being possible.
    const frozenAt = Date.parse(traffic.entriesCloseAt);
    const drawStartedAt = new Date(frozenAt).toISOString();
    const drawCompletedAt = new Date(frozenAt + DRAW_TOTAL_MS).toISOString();

    state.events[event.id] = {
      ...event,
      entriesOpenAt: traffic.entriesOpenAt,
      entriesCloseAt: traffic.entriesCloseAt,
      drawStartedAt: drawing
        ? new Date(bootTime - SEEDED_DRAW_ELAPSED).toISOString()
        : drawStartedAt,
      drawCompletedAt: drawing ? null : drawCompletedAt,
      // A draw that has not finished has selected nobody. The seed describes the
      // post-draw outcome, so those counts are withheld until it actually lands.
      selected: drawing ? 0 : event.selected,
      confirmed: drawing ? 0 : event.confirmed,
      offered: drawing ? 0 : event.offered,
      expiredClaims: drawing ? 0 : event.expiredClaims,
      promotedFromWaitlist: drawing ? 0 : event.promotedFromWaitlist,
    };
    state.order.push(event.id);
    state.trafficRef[event.id] = traffic.points;

    if (event.participants > 0) {
      const participantIds = buildParticipantSet(event.id, event.participants);
      state.artifacts[event.id] = {
        ...buildFreezeArtifacts(event.id, participantIds),
        participantIds,
        publishedAt: traffic.entriesCloseAt,
        revealedAt: drawing ? null : drawCompletedAt,
      };
    }
  }

  state.audit = buildAuditLog(seed.events, bootTime);

  // A small set of authored load-test fixtures is registered by the lab module.
  for (const id of state.order) seedAllocations(state, id);

  return state;
}

/**
 * I3 / I4 â€” allocation seeding for draws that have already run.
 *
 * Expired claims do not free a seat for good: they are back-filled from the
 * waitlist once the event reaches a settled state. That is why a fully
 * allocated event shows `capacity` confirmed *and* a non-zero expired count.
 */
function seedAllocations(state, eventId) {
  const event = state.events[eventId];
  if (!event.hasDraw || event.state === "DRAWING") return;
  const ranking = getRanking(state, eventId);

  const expired = Math.min(event.expiredClaims, event.selected);
  const promote = Math.min(event.promotedFromWaitlist, ranking.waitlist.length);
  const expireFrom = event.selected - expired;

  for (let i = 0; i < event.selected; i += 1) {
    const row = ranking.selected[i];
    const isExpired = i >= expireFrom;
    state.allocations[`${eventId}:${row.id}`] = {
      eventId,
      userId: row.id,
      seat: seatLabel(i),
      rank: i + 1,
      score: row.score,
      status: isExpired ? "EXPIRED" : event.state === "CLAIMING" ? "OFFERED" : "CONFIRMED",
      confirmedAt: isExpired
        ? null
        : new Date(Date.now() - randomInt(rngFrom("conf", eventId, i), 6, 55) * MINUTE).toISOString(),
      expiredAt: isExpired
        ? new Date(Date.now() - randomInt(rngFrom("exp", eventId, i), 1, 25) * MINUTE).toISOString()
        : null,
      idempotencyKey: null,
      attempts: 1,
      promoted: false,
    };
  }

  // A lapsed claim does not free its seat for good: the waitlist is promoted
  // into the exact seat the expired winner was holding.
  for (let i = 0; i < promote; i += 1) {
    const row = ranking.waitlist[i];
    state.allocations[`${eventId}:${row.id}`] = {
      eventId,
      userId: row.id,
      seat: seatLabel(expireFrom + i),
      rank: event.selected + i + 1,
      score: row.score,
      status: "CONFIRMED",
      confirmedAt: new Date(Date.now() - randomInt(rngFrom("prom", eventId, i), 1, 20) * MINUTE).toISOString(),
      expiredAt: null,
      idempotencyKey: `idem_promote_${i}`,
      attempts: 1,
      promoted: true,
    };
  }

  seedCounts(state, eventId);
  event.waitlistSize = Math.max(0, event.participants - event.selected - promote);
}

function getRanking(state, eventId) {
  if (state.rankings[eventId]) return state.rankings[eventId];
  const event = state.events[eventId];
  const artifacts = state.artifacts[eventId];
  if (!artifacts) return null;

  const base = rankParticipants({
    eventId,
    participantIds: artifacts.participantIds,
    snapshotHash: artifacts.snapshotHash,
    seed: artifacts.seed,
    capacity: event.capacity,
  });
  state.rankings[eventId] = base;
  return base;
}

/**
 * The participant identifier the demo account acts as, for one event.
 *
 * For an event whose draw has already run this is the participant the draw
 * genuinely produced at the fixture rank. For an event still taking entries
 * there is no ranking yet, so the account joins under its own identifier.
 */
export function demoParticipantId(state, eventId) {
  const event = state.events[eventId];
  const index = DEMO_RANK_INDEX[eventId];
  if (!event?.hasDraw || index === undefined) return DEMO_USER.id;
  return getRanking(state, eventId).all[index]?.id ?? DEMO_USER.id;
}

function resolveUser(state, eventId, userId) {
  return userId && userId !== DEMO_USER.id ? userId : demoParticipantId(state, eventId);
}

if (typeof window !== "undefined") {
  throw new Error("server/store.js must never be imported from a Client Component");
}

const GLOBAL_KEY = Symbol.for("fairdrop.store.v1");

export function getStore() {
  if (!globalThis[GLOBAL_KEY]) globalThis[GLOBAL_KEY] = buildStore();
  return globalThis[GLOBAL_KEY];
}

export function resetStore() {
  globalThis[GLOBAL_KEY] = buildStore();
  return globalThis[GLOBAL_KEY];
}

/* ==========================================================================
 * Draw pipeline â€” a real time-based state machine
 * ========================================================================== */

export function drawProgress(eventId, at = Date.now()) {
  const state = getStore();
  const event = state.events[eventId];
  if (!event) return null;

  if (event.state !== "DRAWING" || !event.drawStartedAt) {
    return {
      running: false,
      stages: DRAW_STAGES.map((stage) => ({ ...stage, status: "done", within: 1 })),
      ratio: 1,
    };
  }

  const elapsed = at - toMs(event.drawStartedAt);
  const stages = DRAW_STAGES.map((stage, index) => {
    const startsAt = STAGE_OFFSET[stage.id];
    const endsAt = index === DRAW_STAGES.length - 1 ? DRAW_TOTAL_MS : STAGE_OFFSET[DRAW_STAGES[index + 1].id];
    if (elapsed >= endsAt) return { ...stage, status: "done", within: 1 };
    if (elapsed >= startsAt) {
      return { ...stage, status: "active", within: Math.min(1, (elapsed - startsAt) / (endsAt - startsAt)) };
    }
    return { ...stage, status: "pending", within: 0 };
  });

  const done = stages.filter((s) => s.status === "done").length;
  const active = stages.find((s) => s.status === "active");
  const ratio = Math.min(1, (done + (active ? active.within : 0)) / DRAW_STAGES.length);

  return { running: elapsed < DRAW_TOTAL_MS, stages, ratio, elapsed, total: DRAW_TOTAL_MS };
}

export function completeDraw(eventId) {
  const state = getStore();
  const event = state.events[eventId];
  if (!event || !event.hasDraw) return null;
  if (event.state !== "DRAWING") return getDraw(eventId);

  const ranking = getRanking(state, eventId);
  const artifacts = state.artifacts[eventId];
  artifacts.revealedAt = new Date().toISOString();
  event.state = "CLAIMING";
  event.drawCompletedAt = new Date().toISOString();

  for (let i = 0; i < ranking.selected.length; i += 1) {
    const row = ranking.selected[i];
    const key = `${eventId}:${row.id}`;
    if (state.allocations[key]) continue;
    state.allocations[key] = {
      eventId,
      userId: row.id,
      seat: seatLabel(i),
      rank: i + 1,
      score: row.score,
      status: "OFFERED",
      confirmedAt: null,
      expiredAt: null,
      idempotencyKey: null,
      attempts: 0,
      promoted: false,
    };
  }

  event.selected = ranking.selected.length;
  event.offered = ranking.selected.length;
  event.confirmed = Object.values(state.allocations).filter(
    (a) => a.eventId === eventId && a.status === "CONFIRMED"
  ).length;

  pushAudit(state, "DRAW_COMPLETED", "system", eventId, {
    selected: event.selected,
    durationMs: Date.now() - toMs(event.drawStartedAt),
    severity: "success",
  });
  pushAudit(state, "SEED_REVEALED", "system", eventId, { verifiedBy: "public-verifier" });
  return { ...getDraw(eventId), offeredCount: event.offered };
}

export function settleDraw(eventId) {
  const state = getStore();
  const event = state.events[eventId];
  if (!event || event.state !== "DRAWING" || !event.drawStartedAt) return;
  if (Date.now() - toMs(event.drawStartedAt) >= DRAW_TOTAL_MS) completeDraw(eventId);
}

export function pushAudit(state, action, actor, eventId, metadata = {}) {
  state.audit.unshift({
    id: `aud_${state.audit.length + 1}_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    action,
    actor,
    eventId,
    requestId: `req_${Math.random().toString(16).slice(2, 10)}`,
    metadata,
    severity: metadata.severity || "info",
  });
  if (state.audit.length > 400) state.audit.length = 400;
}

/* ==========================================================================
 * Lifecycle
 * ========================================================================== */

const TRANSITIONS = {
  open: { from: ["SCHEDULED"], to: "OPEN", audit: "ENTRY_WINDOW_OPENED" },
  freeze: { from: ["OPEN"], to: "FROZEN", audit: "PARTICIPANT_SET_FROZEN" },
  draw: { from: ["FROZEN"], to: "DRAWING", audit: "DRAW_STARTED" },
  start_claiming: { from: ["DRAWING"], to: "CLAIMING", audit: "CLAIM_OPENED" },
  close: { from: ["CLAIMING"], to: "CLOSED", audit: "CLAIM_WINDOW_CLOSED" },
  cancel: {
    from: ["SCHEDULED", "OPEN", "FROZEN", "DRAWING", "CLAIMING"],
    to: "CANCELLED",
    audit: "EVENT_CANCELLED",
  },
};

export const EVENT_ACTION_LABEL = {
  open: "Open",
  freeze: "Freeze",
  draw: "Draw",
  start_claiming: "Start Claiming",
  close: "Close",
  cancel: "Cancel",
};

export const EVENT_ACTION_TONE = {
  open: "primary",
  freeze: "warning",
  draw: "primary",
  start_claiming: "primary",
  close: "neutral",
  cancel: "danger",
};

export function availableActions(event) {
  return Object.entries(TRANSITIONS)
    .filter(([, rule]) => rule.from.includes(event.state))
    .map(([name]) => name);
}

export function applyLifecycle(eventId, action) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event) return { ok: false, code: 404, message: "Unknown event." };

  const rule = TRANSITIONS[action];
  if (!rule) return { ok: false, code: 400, message: `Unsupported action "${action}".` };
  if (!rule.from.includes(event.state)) {
    return {
      ok: false,
      code: 409,
      message: `"${EVENT_ACTION_LABEL[action] ?? action}" is not valid while the event is ${event.state}.`,
    };
  }

  const from = event.state;
  event.state = rule.to;

  if (action === "draw") {
    event.drawStartedAt = new Date().toISOString();
    if (!state.artifacts[eventId]) {
      const participantIds = buildParticipantSet(eventId, Math.max(1, event.participants));
      state.artifacts[eventId] = {
        ...buildFreezeArtifacts(eventId, participantIds),
        participantIds,
        publishedAt: new Date().toISOString(),
        revealedAt: null,
      };
    }
  }
  if (action === "start_claiming") completeDraw(eventId);
  if (action === "close") {
    for (const alloc of Object.values(state.allocations)) {
      if (alloc.eventId === eventId && alloc.status === "OFFERED") alloc.status = "EXPIRED";
    }
    seedCounts(state, eventId);
  }

  pushAudit(state, rule.audit, "organiser", eventId, {
    from,
    to: rule.to,
    participants: event.participants,
    capacity: event.capacity,
  });
  return { ok: true, event: publicEvent(state, event) };
}

function seedCounts(state, eventId) {
  const event = state.events[eventId];
  const allocations = Object.values(state.allocations).filter((a) => a.eventId === eventId);
  event.confirmed = allocations.filter((a) => a.status === "CONFIRMED").length;
  event.expiredClaims = allocations.filter((a) => a.status === "EXPIRED").length;
  event.offered = allocations.filter((a) => a.status === "OFFERED").length;
}

/* ==========================================================================
 * Entries + claims
 * ========================================================================== */

/** I1 â€” one entry per (user, event). Re-joining is a no-op, not a new entry. */
export function joinEvent(eventId, userId) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event) return { ok: false, code: 404, message: "Unknown event." };
  userId = resolveUser(state, eventId, userId);

  if (!EVENT_STATUS[event.state]?.joinable) {
    return {
      ok: false,
      code: 409,
      message: `Entries are closed for this event (${EVENT_STATUS[event.state].label}).`,
    };
  }

  const existing = state.allocations[`${eventId}:${userId}`];
  if (existing) {
    existing.requestCount = (existing.requestCount || 1) + 1;
    return {
      ok: true,
      duplicate: true,
      entry: existing,
      requestCount: existing.requestCount,
      message: "You already have an entry. Repeated requests do not create another one.",
    };
  }

  event.participants += 1;
  event.joinRequests += 1;
  const entry = {
    eventId,
    userId,
    status: "WAITING",
    seat: null,
    rank: null,
    confirmedAt: null,
    requestCount: 1,
    joinedAt: new Date().toISOString(),
  };
  state.allocations[`${eventId}:${userId}`] = entry;

  pushAudit(state, "ENTRY_CREATED", userId, eventId, {
    duplicate: false,
    participants: event.participants,
    severity: "success",
  });
  return { ok: true, duplicate: false, entry, requestCount: 1, message: "Entry confirmed." };
}

/** I4 â€” idempotent claim. The same key always returns the same allocation. */
export function claimSeat(eventId, userId, idempotencyKey) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event) return { ok: false, code: 404, message: "Unknown event." };
  userId = resolveUser(state, eventId, userId);

  const key = idempotencyKey || `idem_${eventId}_${userId}`;
  const keyIndex = `${eventId}:claim:${key}`;
  if (state.idempotency[keyIndex]) {
    return { ...state.idempotency[keyIndex], replay: true, replayedKey: key };
  }

  const allocation = state.allocations[`${eventId}:${userId}`];
  if (!allocation) return { ok: false, code: 404, message: "No entry found for this event." };

  if (allocation.status === "CONFIRMED") {
    const result = { ok: true, allocation, replay: true, message: "Seat already confirmed." };
    state.idempotency[keyIndex] = result;
    return result;
  }
  if (allocation.status === "EXPIRED") {
    return { ok: false, code: 410, message: "The claim window for this allocation has closed.", allocation };
  }
  if (event.state !== "CLAIMING") {
    return { ok: false, code: 409, message: `Claims are not open (event is ${event.state}).` };
  }

  // I3 â€” confirmed allocations are counted against capacity, never assumed.
  const confirmed = Object.values(state.allocations).filter(
    (a) => a.eventId === eventId && a.status === "CONFIRMED"
  ).length;
  if (confirmed >= event.capacity) {
    return { ok: false, code: 409, message: "Every seat for this event is already confirmed." };
  }

  allocation.status = "CONFIRMED";
  allocation.confirmedAt = new Date().toISOString();
  allocation.idempotencyKey = idempotencyKey || null;
  allocation.attempts = (allocation.attempts || 0) + 1;
  seedCounts(state, eventId);

  const result = { ok: true, allocation, replay: false, message: "Seat confirmed." };
  state.idempotency[keyIndex] = result;
  pushAudit(state, "ALLOCATION_CONFIRMED", userId, eventId, {
    seat: allocation.seat,
    idempotencyKey: key,
    attempt: allocation.attempts,
    confirmedAllocations: confirmed + 1,
    capacity: event.capacity,
    severity: "success",
  });
  return result;
}

/* ==========================================================================
 * Queries
 * ========================================================================== */

export function publicEvent(state, event) {
  const traffic = state.trafficRef?.[event.id];
  return {
    id: event.id,
    title: event.title,
    tagline: event.tagline,
    category: event.category,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    capacity: event.capacity,
    participants: event.participants,
    joinRequests: event.joinRequests,
    duplicateAttempts: Math.max(0, event.joinRequests - event.participants),
    state: event.state,
    status: EVENT_STATUS[event.state],
    selected: event.selected,
    confirmed: event.confirmed ?? 0,
    offered: event.offered ?? 0,
    expiredClaims: event.expiredClaims ?? 0,
    promotedFromWaitlist: event.promotedFromWaitlist ?? 0,
    waitlistSize: event.waitlistSize,
    hasDraw: event.hasDraw,
    entriesOpenAt: event.entriesOpenAt ?? null,
    entriesCloseAt: event.entriesCloseAt ?? null,
    accent: event.accent,
    about: event.about,
    agenda: event.agenda,
    artSeed: event.artSeed,
    availableActions: availableActions(event),
  };
}

export function listEvents() {
  const state = getStore();
  return state.order.map((id) => publicEvent(state, state.events[id]));
}

export function getEvent(id) {
  const state = getStore();
  settleDraw(id);
  const event = state.events[id];
  return event ? publicEvent(state, event) : null;
}

export function getTraffic(eventId) {
  const state = getStore();
  const event = state.events[eventId];
  if (!event) return null;
  return {
    eventId,
    entriesOpenAt: event.entriesOpenAt,
    entriesCloseAt: event.entriesCloseAt,
    points: state.trafficRef[eventId],
  };
}

/**
 * The demo account's outcome for one event, derived from live state.
 * A waitlist position only exists while seats are still unconfirmed â€” once the
 * event settles with no seats left, everyone beyond the winners is simply
 * `NOT_SELECTED`.
 */
export function demoOutcomeFor(eventId) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event) return { status: "NONE" };

  const userId = demoParticipantId(state, eventId);
  const allocation = state.allocations[`${eventId}:${userId}`];
  const hasEntry = Boolean(allocation);

  if (!event.hasDraw) {
    if (!hasEntry) return { status: "NONE" };
    return {
      status: "WAITING",
      joinedAt: allocation.joinedAt,
      requestCount: allocation.requestCount || 1,
      inDraw: false,
    };
  }

  const ranking = getRanking(state, eventId);
  const rank = ranking?.rankOf(userId) ?? null;
  const index = ranking ? ranking.selected.findIndex((r) => r.id === userId) : -1;
  const selected = index !== -1;

  if (!hasEntry && rank === null) return { status: "NONE" };

  if (allocation?.status === "WAITING") {
    return {
      status: "WAITING",
      joinedAt: allocation.joinedAt,
      requestCount: allocation.requestCount || 1,
      inDraw: event.state === "DRAWING",
    };
  }
  if (allocation?.status === "OFFERED") {
    return { status: "SELECTED", seat: allocation.seat, rank: allocation.rank, score: allocation.score };
  }
  if (allocation?.status === "EXPIRED") {
    return { status: "EXPIRED", seat: allocation.seat, rank: allocation.rank };
  }
  if (allocation?.status === "CONFIRMED") {
    return {
      status: "CONFIRMED",
      seat: allocation.seat,
      rank: allocation.rank,
      confirmedAt: allocation.confirmedAt,
      promoted: allocation.promoted,
    };
  }

  if (event.state === "DRAWING") {
    return { status: "WAITING", inDraw: true, requestCount: 1, rank: null };
  }
  if (selected) {
    return {
      status: event.state === "CLAIMING" ? "SELECTED" : "CONFIRMED",
      seat: seatLabel(index),
      rank: index + 1,
      score: ranking.selected[index].score,
    };
  }

  // Seats still unconfirmed define how deep the waitlist actually reaches.
  const depth = Math.max(0, event.capacity - (event.confirmed ?? 0));
  const waitlistRank = rank ? rank - event.selected : null;
  if (waitlistRank !== null && waitlistRank <= depth) {
    return { status: "WAITLISTED", rank, waitlistRank };
  }
  return { status: "NOT_SELECTED", rank };
}

export function claimWindow(eventId) {
  const state = getStore();
  const event = state.events[eventId];
  if (!event || event.state !== "CLAIMING") return null;
  // Claims open when the draw completes, not when entries close: entries can sit
  // frozen for a long time before a ranking runs, and anchoring the window to the
  // earlier of the two would hand every selected person an already-lapsed claim.
  const startedAt = Date.parse(event.drawCompletedAt || event.entriesCloseAt);
  const windowMinutes = event.claimWindowMinutes ?? 102;
  return {
    startedAt: new Date(startedAt).toISOString(),
    expiresAt: new Date(startedAt + windowMinutes * MINUTE).toISOString(),
    windowMinutes,
  };
}

export function getDraw(eventId) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event || !event.hasDraw) return null;
  const artifacts = state.artifacts[eventId];
  const ranking = getRanking(state, eventId);

  return {
    eventId,
    state: event.state,
    algorithm: DRAW_ALGORITHM,
    version: DRAW_VERSION,
    participantCount: artifacts.participantIds.length,
    capacity: event.capacity,
    selectedCount: ranking ? ranking.selected.length : 0,
    snapshotHash: artifacts.snapshotHash,
    commitmentHash: artifacts.commitmentHash,
    revealedSeed: artifacts.revealedAt ? artifacts.seed : null,
    publishedAt: artifacts.publishedAt,
    revealedAt: artifacts.revealedAt,
    progress: drawProgress(eventId),
    drawStartedAt: event.drawStartedAt,
    drawCompletedAt: event.drawCompletedAt,
  };
}

export function getVerification(eventId, userId) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event || !event.hasDraw) return null;
  userId = resolveUser(state, eventId, userId);
  const artifacts = state.artifacts[eventId];
  const ranking = getRanking(state, eventId);

  const verification = verifyDraw({
    eventId,
    participantIds: artifacts.participantIds,
    capacity: event.capacity,
    snapshotHash: artifacts.snapshotHash,
    commitmentHash: artifacts.commitmentHash,
    revealedSeed: artifacts.revealedAt ? artifacts.seed : null,
    claimedSelectedIds: ranking.selected.map((r) => r.id),
  });

  const rank = ranking.rankOf(userId);
  const selectedIndex = ranking.selected.findIndex((r) => r.id === userId);

  return {
    eventId,
    title: event.title,
    algorithm: DRAW_ALGORITHM,
    version: DRAW_VERSION,
    participantCount: artifacts.participantIds.length,
    capacity: event.capacity,
    selectedCount: ranking.selected.length,
    snapshotHash: artifacts.snapshotHash,
    commitmentHash: artifacts.commitmentHash,
    revealedSeed: artifacts.revealedAt ? artifacts.seed : null,
    publishedAt: artifacts.publishedAt,
    revealedAt: artifacts.revealedAt,
    verification,
    user: {
      id: userId,
      rank,
      selected: selectedIndex !== -1,
      score: ranking.scoreOf(userId),
      seat: selectedIndex !== -1 ? seatLabel(selectedIndex) : null,
    },
    publishedSample: ranking.selected.slice(0, 8).map((row, i) => ({
      rank: i + 1,
      id: row.id,
      score: row.score,
    })),
  };
}

/**
 * Fairness analytics for one event.
 *
 * The request-frequency table is *measured*: every participant's request count
 * comes from the same profile the platform counts, and the winners per bucket
 * are counted out of the real ranking.
 */
export function getFairness(eventId) {
  const state = getStore();
  settleDraw(eventId);
  const event = state.events[eventId];
  if (!event || !event.hasDraw) return null;

  const artifacts = state.artifacts[eventId];
  const ranking = getRanking(state, eventId);
  const counts = buildRequestProfile(state, event);

  const buckets = new Map();
  for (let i = 0; i < counts.length; i += 1) {
    const bucket = bucketForRequestCount(counts[i]);
    const row = buckets.get(bucket.id) || { id: bucket.id, label: bucket.label, users: 0, requests: 0, winners: 0 };
    row.users += 1;
    row.requests += counts[i];
    buckets.set(bucket.id, row);
  }
  for (let i = 0; i < counts.length; i += 1) {
    if (!ranking.selectedIds.has(artifacts.participantIds[i])) continue;
    buckets.get(bucketForRequestCount(counts[i]).id).winners += 1;
  }

  const measuredRequests = counts.reduce((sum, c) => sum + c, 0);
  const requestFrequency = [...buckets.values()]
    .map((row) => ({
      ...row,
      winRate: row.users ? (row.winners / row.users) * 100 : 0,
      shareOfUsers: (row.users / counts.length) * 100,
      shareOfRequests: measuredRequests ? (row.requests / measuredRequests) * 100 : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const allocations = Object.values(state.allocations).filter((a) => a.eventId === eventId);
  const confirmed = allocations.filter((a) => a.status === "CONFIRMED");
  const seats = confirmed.map((a) => a.seat);

  return {
    eventId,
    scope: event.title,
    httpJoinRequests: event.joinRequests,
    uniqueVerifiedUsers: counts.length,
    validEntries: counts.length,
    duplicateAttempts: Math.max(0, event.joinRequests - counts.length),
    selectedUsers: ranking.selected.length,
    confirmedAllocations: confirmed.length,
    expiredClaims: allocations.filter((a) => a.status === "EXPIRED").length,
    promotedFromWaitlist: allocations.filter((a) => a.promoted).length,
    entryAmplification: 1,
    requestsPerEntry: counts.length ? event.joinRequests / counts.length : 0,
    entryCaptureRate: event.joinRequests ? (counts.length / event.joinRequests) * 100 : 0,
    measuredRequests,
    requestFrequency,
    integrity: {
      duplicateEntries: counts.length - new Set(artifacts.participantIds).size,
      duplicateAllocations: seats.length - new Set(seats).size,
      oversoldSeats: Math.max(0, confirmed.length - event.capacity),
      confirmedWithinCapacity: confirmed.length <= event.capacity,
    },
  };
}

export function getPlatformMetrics() {
  const state = getStore();
  const events = state.order.map((id) => state.events[id]);
  const allocations = Object.values(state.allocations);
  const sum = (fn) => events.reduce((acc, e) => acc + fn(e), 0);

  return {
    activeEvents: events.filter((e) => !["CLOSED", "SOLD_OUT", "CANCELLED"].includes(e.state)).length,
    totalEvents: events.length,
    totalUsers: state.users.total,
    joinAttempts: sum((e) => e.joinRequests),
    uniqueEntries: sum((e) => e.participants),
    duplicateAttempts: sum((e) => Math.max(0, e.joinRequests - e.participants)),
    selectedWinners: sum((e) => e.selected),
    confirmedAllocations: allocations.filter((a) => a.status === "CONFIRMED").length,
    expiredClaims: allocations.filter((a) => a.status === "EXPIRED").length,
    totalCapacity: sum((e) => e.capacity),
  };
}

export function liveTraffic(minutes = 60) {
  const state = getStore();
  const buckets = new Map();
  for (const id of state.order) {
    for (const point of (state.trafficRef[id] || []).slice(-minutes)) {
      const row = buckets.get(point.at) || {
        at: point.at,
        requests: 0,
        entries: 0,
        rejected429: 0,
        failed503: 0,
        p95: 0,
      };
      row.requests += point.requests;
      row.entries += point.entries;
      row.rejected429 += point.rejected429;
      row.failed503 += point.failed503;
      row.p95 = Math.max(row.p95, point.p95);
      buckets.set(point.at, row);
    }
  }
  return [...buckets.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export function getSystemHealth() {
  const state = getStore();
  const degraded = state.system.filter((s) => s.state === "degraded");
  return {
    services: state.system,
    overall: degraded.length === 0 ? "healthy" : degraded.length > 1 ? "down" : "degraded",
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - state.bootTime) / 1000) + 86_400,
    platform: getPlatformMetrics(),
  };
}

export function getAuditLog({ eventId, limit = 60, action } = {}) {
  const state = getStore();
  let rows = state.audit;
  if (eventId) rows = rows.filter((r) => r.eventId === eventId);
  if (action) rows = rows.filter((r) => r.action === action);
  return rows.slice(0, limit);
}

export function getUserEntries() {
  const state = getStore();
  return state.order
    .map((id) => ({ event: publicEvent(state, state.events[id]), outcome: demoOutcomeFor(id) }))
    .filter((row) => row.outcome.status !== "NONE");
}

export function getUserHistory() {
  return getUserEntries()
    .map(({ event, outcome }) => ({
      eventId: event.id,
      title: event.title,
      city: event.city,
      state: event.state,
      status: outcome.status,
      seat: outcome.seat ?? null,
      rank: outcome.rank ?? null,
      waitlistRank: outcome.waitlistRank ?? null,
      date: event.startsAt,
      confirmedAt: outcome.confirmedAt ?? null,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getAllocationFor(eventId, userId) {
  const state = getStore();
  settleDraw(eventId);
  return state.allocations[`${eventId}:${resolveUser(state, eventId, userId)}`] || null;
}

export function getDemoUser() {
  return getStore().users.demo;
}

export function drawableEventIds() {
  const state = getStore();
  return state.order.filter((id) => state.events[id].hasDraw);
}

export { getRanking, DEMO_USER, TRAFFIC_BUCKETS };
