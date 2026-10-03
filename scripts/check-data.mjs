/**
 * Data integrity harness.
 *
 * Runs the simulated backend outside Next.js and asserts the invariants the UI
 * depends on. If a number on screen cannot be reproduced here, it should not be
 * on screen.
 *
 *   npm run check:data
 */

import {
  getStore,
  getEvent,
  listEvents,
  getDraw,
  getVerification,
  getFairness,
  getPlatformMetrics,
  getUserHistory,
  demoOutcomeFor,
  joinEvent,
  claimSeat,
  applyLifecycle,
  drawProgress,
  completeDraw,
  claimWindow,
  getAllocationFor,
  getSystemHealth,
  getTraffic,
} from "../server/store.js";

let failures = 0;
let checks = 0;

function ok(label, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n ?? 0);

section("Catalog");
const events = listEvents();
ok("12 events seeded", events.length === 12, `got ${events.length}`);
console.log(
  events
    .map(
      (e) =>
        `        ${e.id.padEnd(26)} ${e.state.padEnd(9)} cap ${String(e.capacity).padStart(4)}  ` +
        `ppl ${fmt(e.participants).padStart(8)}  req ${fmt(e.joinRequests).padStart(11)}  ` +
        `sel ${String(e.selected).padStart(4)}  conf ${String(e.confirmed).padStart(4)}  exp ${e.expiredClaims}`
    )
    .join("\n")
);

section("I2 — participant set is immutable once frozen");
const flagship = getEvent("tech-summit-2026");
ok("flagship pool is 50,000", flagship.participants === 50000, fmt(flagship.participants));
ok("flagship capacity is 500", flagship.capacity === 500);
const draw = getDraw("tech-summit-2026");
ok("snapshot hash is a 64-char SHA-256", /^[0-9a-f]{64}$/.test(draw.snapshotHash));
ok("commitment hash published", /^[0-9a-f]{64}$/.test(draw.commitmentHash));
ok("seed revealed after the draw", Boolean(draw.revealedSeed));

section("Draw correctness");
const verify = getVerification("tech-summit-2026");
ok("independent verification passes", verify.verification.verified === true);
for (const check of verify.verification.checks) {
  ok(`  check: ${check.label}`, check.state === "pass", check.state);
}
ok("selected count equals capacity", verify.selectedCount === 500, String(verify.selectedCount));
ok("demo account is selected at rank 102", verify.user.rank === 102, `rank ${verify.user.rank}`);
ok("demo seat is A-102", verify.user.seat === "A-102", String(verify.user.seat));

section("Re-running verification from published values only");
const store = getStore();
const arts = store.artifacts["tech-summit-2026"];
const second = getVerification("tech-summit-2026");
ok("snapshot hash is stable across calls", second.snapshotHash === arts.snapshotHash);
ok("selection is stable across calls", second.user.rank === verify.user.rank);

section("Fairness metrics are measured, not asserted");
const fairness = getFairness("tech-summit-2026");
console.log(
  `        join requests ${fmt(fairness.httpJoinRequests)} | unique users ${fmt(fairness.uniqueVerifiedUsers)} | ` +
    `entries ${fmt(fairness.validEntries)} | duplicates ${fmt(fairness.duplicateAttempts)}`
);
ok("join requests == measured request profile", fairness.measuredRequests === fairness.httpJoinRequests,
  `${fairness.measuredRequests} vs ${fairness.httpJoinRequests}`);
ok("duplicate attempts = requests - entries",
  fairness.duplicateAttempts === fairness.httpJoinRequests - fairness.validEntries);
ok("bucket users sum to the pool",
  fairness.requestFrequency.reduce((s, b) => s + b.users, 0) === fairness.uniqueVerifiedUsers);
ok("bucket winners sum to the selection",
  fairness.requestFrequency.reduce((s, b) => s + b.winners, 0) === fairness.selectedUsers);
ok("bucket requests sum to the request total",
  fairness.requestFrequency.reduce((s, b) => s + b.requests, 0) === fairness.httpJoinRequests);
console.log("        requests-per-user buckets");
for (const bucket of fairness.requestFrequency) {
  console.log(
    `          ${bucket.label.padEnd(9)} users ${fmt(bucket.users).padStart(7)}  ` +
      `requests ${fmt(bucket.requests).padStart(11)}  winners ${String(bucket.winners).padStart(4)}  ` +
      `win rate ${bucket.winRate.toFixed(2)}%`
  );
}
const base = (fairness.selectedUsers / fairness.uniqueVerifiedUsers) * 100;
for (const bucket of fairness.requestFrequency) {
  // Binomial 3-sigma bound. A bucket win rate is allowed to wobble this far and
  // no further: any larger gap would mean request volume actually mattered.
  const expectedWinners = (bucket.users * fairness.selectedUsers) / fairness.uniqueVerifiedUsers;
  const sigma = Math.sqrt(expectedWinners * (1 - base / 100)) || 1;
  const deviation = Math.abs(bucket.winners - expectedWinners);
  ok(
    `bucket ${bucket.label}: winners within 3σ of expectation`,
    deviation <= 3 * sigma,
    `observed ${bucket.winners}, expected ${expectedWinners.toFixed(1)}, 3σ = ${(3 * sigma).toFixed(1)}`
  );
  ok(
    `bucket ${bucket.label}: win rate within 1pp of the base rate`,
    Math.abs(bucket.winRate - base) < 1,
    `${bucket.winRate.toFixed(2)}% vs base ${base.toFixed(2)}%`
  );
}

section("Integrity counters");
ok("duplicate entries = 0", fairness.integrity.duplicateEntries === 0);
ok("duplicate allocations = 0", fairness.integrity.duplicateAllocations === 0);
ok("oversold seats = 0", fairness.integrity.oversoldSeats === 0);
ok("confirmed within capacity", fairness.integrity.confirmedWithinCapacity === true);

section("Allocation back-fill");
ok("expired claims released seats", getEvent("tech-summit-2026").expiredClaims === 18);
ok("every seat is confirmed after back-fill", flagship.confirmed === 500, String(flagship.confirmed));

section("Demo account reaches every product state");
const history = getUserHistory();
for (const row of history) {
  console.log(`        ${row.title.padEnd(28)} ${row.status.padEnd(13)} ${row.seat ?? row.waitlistRank ?? ""}`);
}
const statuses = new Set(history.map((r) => r.status));
for (const expected2 of ["CONFIRMED", "SELECTED", "WAITLISTED", "NOT_SELECTED", "EXPIRED"]) {
  ok(`reachable state: ${expected2}`, statuses.has(expected2));
}

section("I1 — one entry per user, however many requests");
const before = getEvent("ai-summit-2026").participants;
const first = joinEvent("ai-summit-2026");
ok("first join creates the entry", first.ok && first.duplicate === false);
const afterFirst = getEvent("ai-summit-2026").participants;
ok("the first join adds exactly one entry", afterFirst === before + 1, `${before} -> ${afterFirst}`);
for (let i = 0; i < 25; i += 1) joinEvent("ai-summit-2026");
const afterRepeats = getEvent("ai-summit-2026").participants;
ok("25 repeat joins add 0 further entries", afterRepeats === afterFirst, `${afterFirst} -> ${afterRepeats}`);
ok("repeat join reports duplicate=true", joinEvent("ai-summit-2026").duplicate === true);
ok("repeat requests are still counted", joinEvent("ai-summit-2026").requestCount > 25);

section("I4 — claims are idempotent");
const key = "idem_test_key_001";
const c1 = claimSeat("founders-forum-2026", undefined, key);
const c2 = claimSeat("founders-forum-2026", undefined, key);
const c3 = claimSeat("founders-forum-2026", undefined, "a_different_key");
ok("first claim allocates seat B-214", c1.allocation.seat === "B-214", c1.allocation?.seat);
ok("replay with same key returns the same seat", c2.allocation.seat === c1.allocation.seat);
ok("replay is flagged", c2.replay === true);
ok("a different key still cannot double-allocate", c3.allocation.seat === c1.allocation.seat);

section("I3 — capacity is never exceeded");
const claimable = events.find((e) => e.state === "CLAIMING");
ok("a claimable event exists", Boolean(claimable));
if (claimable) {
  const confirmed = getEvent(claimable.id).confirmed;
  ok("confirmed never exceeds capacity", confirmed <= claimable.capacity, `${confirmed}/${claimable.capacity}`);
}

section("Draw pipeline advances on real state");
// Anchored to the draw's own start rather than "now": the seeded draw finishes on
// its own after 45s, so an assertion phrased against the wall clock would pass or
// fail depending on how long this script took to get here.
const inFlight = getDraw("quantum-workshop-2026");
const at = Date.parse(inFlight.drawStartedAt) + 22_000;
const progress = drawProgress("quantum-workshop-2026", at);
ok("pipeline is running", progress.running === true, `${progress.elapsed}ms in`);
ok("first stage is already done (frozen at entry close)", progress.stages[0].status === "done");
ok("later stages are still pending", progress.stages.at(-1).status === "pending");
ok("progress ratio is between 0 and 1", progress.ratio > 0 && progress.ratio <= 1, progress.ratio.toFixed(3));

const midway = drawProgress("quantum-workshop-2026", Date.parse(inFlight.drawStartedAt) + 40_000);
ok("a stage is active mid-pipeline", midway.stages.some((s) => s.status === "active"));
ok("the ratio only grows as the pipeline runs", midway.ratio > progress.ratio,
  `${progress.ratio.toFixed(3)} -> ${midway.ratio.toFixed(3)}`);

section("Draw timeline is causally ordered");
for (const event of events.filter((e) => e.hasDraw)) {
  const d = getDraw(event.id);
  if (!d) continue;

  if (event.state === "DRAWING") {
    ok(`${event.id}: an unfinished draw has revealed nothing`, d.revealedAt === null);
    ok(`${event.id}: an unfinished draw has not completed`, d.drawCompletedAt === null);
    continue;
  }

  ok(`${event.id}: the commitment was published before the seed was revealed`,
    Date.parse(d.publishedAt) <= Date.parse(d.revealedAt),
    `${d.publishedAt} -> ${d.revealedAt}`);
  ok(`${event.id}: the draw finished after the set was frozen`,
    Date.parse(d.drawStartedAt) <= Date.parse(d.drawCompletedAt));
  ok(`${event.id}: the seed was revealed when the draw finished`,
    d.revealedAt === d.drawCompletedAt);
}

const claiming = events.find((e) => e.state === "CLAIMING");
const window = claimWindow(claiming.id);
ok("the claiming event's window is anchored to draw completion, not entry close",
  window.startedAt === getDraw(claiming.id).drawCompletedAt,
  `${window.startedAt} vs ${getDraw(claiming.id).drawCompletedAt}`);
ok("the seeded claim window is still open on arrival",
  Date.parse(window.expiresAt) > Date.now(),
  `${Math.round((Date.parse(window.expiresAt) - Date.now()) / 60000)}m left`);

section("Platform aggregates");
const platform = getPlatformMetrics();
console.log(
  `        active ${platform.activeEvents}/${platform.totalEvents} | users ${fmt(platform.totalUsers)} | ` +
    `requests ${fmt(platform.joinAttempts)} | entries ${fmt(platform.uniqueEntries)} | ` +
    `dupes ${fmt(platform.duplicateAttempts)} | selected ${fmt(platform.selectedWinners)} | ` +
    `confirmed ${fmt(platform.confirmedAllocations)} | expired ${platform.expiredClaims}`
);
ok("entries never exceed join attempts", platform.uniqueEntries <= platform.joinAttempts);
ok("confirmed never exceeds total capacity", platform.confirmedAllocations <= platform.totalCapacity);

section("Traffic series is internally consistent");
for (const event of events) {
  const traffic = getTraffic(event.id);
  if (!traffic || traffic.points.length === 0) continue;
  const requests = traffic.points.reduce((s, p) => s + p.requests, 0);
  const entries = traffic.points.reduce((s, p) => s + p.entries, 0);
  ok(`${event.id}: traffic requests sum to the declared total`, requests === event.joinRequests,
    `${fmt(requests)} vs ${fmt(event.joinRequests)}`);
  ok(`${event.id}: traffic entries sum to the declared pool`, entries === event.participants,
    `${fmt(entries)} vs ${fmt(event.participants)}`);
  const accepted = traffic.points.reduce((s, p) => s + p.accepted, 0);
  ok(`${event.id}: accepted + rejected never exceeds requests`,
    traffic.points.every((p) => p.accepted + p.rejected429 + p.failed503 <= p.requests));
  // An event that has not opened yet legitimately has zero successful requests.
  if (event.joinRequests > 0) ok(`${event.id}: at least some requests succeeded`, accepted > 0);
}

section("System health");
const health = getSystemHealth();
ok("six services reported", health.services.length === 6);
for (const service of health.services) {
  ok(`  ${service.name}: 30 samples`, service.points.length === 30, service.state);
}

section("Lifecycle guards");
const invalid = applyLifecycle("tech-summit-2026", "open");
ok("cannot open a settled event", invalid.ok === false && invalid.code === 409, invalid.message);
const valid = applyLifecycle("design-assembly-2026", "open");
ok("can open a scheduled event", valid.ok === true);

// The in-flight draw must land on its own: the waiting-room screen polls this
// and flips to a seat when it completes, so the hand-off is asserted, not hoped.
section("Live draw lands without operator action");
const live = getEvent("quantum-workshop-2026");
ok("the event has not selected anyone yet", live.state === "DRAWING" && live.selected === 0);
const queued = demoOutcomeFor("quantum-workshop-2026");
ok("the demo account is waiting on that draw", queued.status === "WAITING" && queued.inDraw === true);

const midFlight = drawProgress("quantum-workshop-2026", Date.now() + 60_000);
ok("the pipeline is finished once its duration elapses", midFlight.running === false);
ok("every stage is reported done", midFlight.stages.every((s) => s.status === "done"));

const landed = completeDraw("quantum-workshop-2026");
ok("completing the draw opens the claim window", landed.state === "CLAIMING");
ok("exactly capacity seats are offered", landed.offeredCount === live.capacity, `${landed.offeredCount}`);
const seat = getAllocationFor("quantum-workshop-2026");
ok("the demo account now holds a seat", Boolean(seat?.seat) && seat.status === "OFFERED", seat?.seat);
const verified = getVerification("quantum-workshop-2026");
ok("the freshly completed draw still verifies", verified.verification.verified === true);
ok("the seed is revealed only after the draw", Boolean(verified.revealedSeed));
ok("nothing was allocated before the seed was revealed",
  getEvent("quantum-workshop-2026").confirmed === 0);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} — ${checks} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
