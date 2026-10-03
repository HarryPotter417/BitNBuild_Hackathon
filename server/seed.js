import { rngFrom, randomInt, longTail } from "./rng.js";

/**
 * Seeded Fair Drop dataset.
 *
 * Everything here is *inputs*, never conclusions. Participant counts, request
 * counts and per-user request distributions are generated; winners, buckets,
 * win rates, allocations and integrity counters are all derived from the real
 * draw algorithm in `draw.js`. Nothing on any screen is a hand-written metric.
 */

export const DEMO_USER = {
  id: "usr_7c1f9a20b4e3",
  name: "Aarav Sharma",
  email: "aarav.sharma@fairdrop.dev",
  initials: "AS",
  memberSince: "2025-11-04T09:12:00.000Z",
  verified: true,
  emailDomain: "fairdrop.dev",
};

/** Flagship draw + the events that exercise every product state. */
const EVENT_CATALOG = [
  {
    id: "tech-summit-2026",
    title: "Tech Summit 2026",
    tagline: "Innovation, Community, Impact",
    category: "Conference",
    city: "Bengaluru",
    venue: "Bengaluru International Exhibition Centre",
    startsAt: "2026-03-15T09:00:00.000Z",
    capacity: 500,
    participants: 50000,
    joinRequests: 1284321,
    state: "SOLD_OUT",
    expiredClaims: 18,
    promotedFromWaitlist: 18, // every lapsed seat is back-filled, so 500 stay confirmed
    demoOutcome: { status: "CONFIRMED", seat: "A-102", confirmedAt: "2026-03-15T10:42:04.000Z" },
    accent: ["#3f45e0", "#7b83f7"],
    about:
      "Two days of engineering leadership, applied AI and platform architecture. One stage, twelve sessions, and a room built for people who ship.",
    agenda: [
      { time: "09:00", title: "Registration and cold coffee", track: "Lobby" },
      { time: "10:00", title: "Keynote: systems that stay honest under load", track: "Main" },
      { time: "11:30", title: "Panel: allocation under extreme contention", track: "Main" },
      { time: "14:00", title: "Workshop: verifiable randomness in practice", track: "Studio A" },
      { time: "16:30", title: "Closing and Fair Drop draw debrief", track: "Main" },
    ],
  },
  {
    id: "ai-summit-2026",
    title: "AI Summit 2026",
    tagline: "Models, Agents, and Accountability",
    category: "Conference",
    city: "Bengaluru",
    venue: "Bharat Mandapam, Hall 3",
    startsAt: "2026-04-22T09:30:00.000Z",
    capacity: 300,
    participants: 50000,
    joinRequests: 1180447,
    state: "OPEN",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "WAITING" },
    accent: ["#0b7fd4", "#4bb8f5"],
    about:
      "A working summit on applied machine learning, agent reliability and the governance questions that arrive with them.",
    agenda: [
      { time: "09:30", title: "Doors and demo hall", track: "Expo" },
      { time: "10:30", title: "Opening: what we can actually verify", track: "Main" },
      { time: "13:00", title: "Agent evaluation in the wild", track: "Main" },
      { time: "15:30", title: "Roundtable: policy, safety, shipping", track: "Studio B" },
    ],
  },
  {
    id: "founders-forum-2026",
    title: "Founders Forum 2026",
    tagline: "Operators, Capital, Hard Truths",
    category: "Forum",
    city: "Bengaluru",
    venue: "The Residency, Ballroom",
    startsAt: "2026-03-28T18:00:00.000Z",
    capacity: 250,
    participants: 12480,
    joinRequests: 214908,
    state: "CLAIMING",
    expiredClaims: 19,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "SELECTED", seat: "B-214" },
    accent: ["#0f9d6f", "#34d39e"],
    about:
      "An evening of unfiltered operating stories from founders who have already made the expensive mistakes.",
    agenda: [
      { time: "18:00", title: "Drinks and introductions", track: "Lounge" },
      { time: "18:45", title: "Three founder fire stories", track: "Ballroom" },
      { time: "20:00", title: "Open mic and Q&A", track: "Ballroom" },
    ],
  },
  {
    id: "quantum-workshop-2026",
    title: "Quantum Systems Workshop",
    tagline: "Hardware, Cryogenics, Real Qubits",
    category: "Workshop",
    city: "Hyderabad",
    venue: "Quantum Park, Lab 2",
    startsAt: "2026-03-21T10:00:00.000Z",
    capacity: 120,
    participants: 4180,
    joinRequests: 96442,
    state: "DRAWING",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "WAITING" },
    accent: ["#7c3aed", "#a78bfa"],
    about:
      "A hands-on day with dilution refrigerators, pulse-level control and the unglamorous parts of bringing a qubit online.",
    agenda: [
      { time: "10:00", title: "Safety briefing and lab tour", track: "Lab" },
      { time: "11:00", title: "Hands-on: pulse sequences", track: "Lab" },
      { time: "15:00", title: "Debrief and open Q&A", track: "Seminar" },
    ],
  },
  {
    id: "india-design-week",
    title: "India Design Week",
    tagline: "Craft, Systems, and Public Good",
    category: "Festival",
    city: "Mumbai",
    venue: " Kala Ghoda Art District",
    startsAt: "2026-02-06T11:00:00.000Z",
    capacity: 400,
    participants: 6215,
    joinRequests: 88764,
    state: "CLOSED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NOT_SELECTED" },
    accent: ["#c2410c", "#fb923c"],
    about:
      "Five days of exhibitions, critiques and public installations across South Mumbai.",
    agenda: [
      { time: "11:00", title: "Opening exhibition", track: "District" },
      { time: "13:00", title: "Craft and tooling critique", track: "Studio 3" },
      { time: "16:00", title: "Public installations walk", track: "District" },
    ],
  },
  {
    id: "climate-innovation-2026",
    title: "Climate Innovation Summit",
    tagline: "Adaptation, Capital, Deployment",
    category: "Summit",
    city: "Delhi",
    venue: "Bhawan, Pragati Maidan",
    startsAt: "2026-01-19T09:00:00.000Z",
    capacity: 600,
    participants: 11730,
    joinRequests: 203558,
    state: "CLOSED",
    expiredClaims: 27,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "WAITLISTED", waitlistRank: 13 },
    accent: ["#0e7490", "#22d3ee"],
    about:
      "Adaptation finance, grid-scale storage and what it actually takes to deploy.",
    agenda: [
      { time: "09:00", title: "Registration", track: "Lobby" },
      { time: "10:00", title: "Adaptation economics", track: "Hall 1" },
      { time: "13:30", title: "Deployment bottlenecks panel", track: "Hall 1" },
    ],
  },
  {
    id: "open-mic-night-2026",
    title: "Open Mic Night: Systems Edition",
    tagline: "Ninety Seconds, No Slides",
    category: "Meetup",
    city: "Pune",
    venue: "Yaar, Kalyani Nagar",
    startsAt: "2026-01-08T19:00:00.000Z",
    capacity: 150,
    participants: 3180,
    joinRequests: 41637,
    state: "CLOSED",
    expiredClaims: 18,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "EXPIRED", seat: "A-141" },
    accent: ["#be123c", "#fb7185"],
    about:
      "Short talks, hard questions, and a room where everyone is expected to talk.",
    agenda: [
      { time: "19:00", title: "Doors", track: "Bar" },
      { time: "19:30", title: "Lightning talks", track: "Main" },
      { time: "21:00", title: "Open floor", track: "Main" },
    ],
  },
  {
    id: "design-assembly-2026",
    title: "Design Assembly 2026",
    tagline: "Interfaces for Everyone",
    category: "Conference",
    city: "Mumbai",
    venue: "Nehru Centre, Worli",
    startsAt: "2026-06-11T10:00:00.000Z",
    capacity: 300,
    participants: 0,
    joinRequests: 0,
    state: "SCHEDULED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NONE" },
    accent: ["#4c1d95", "#8b5cf6"],
    about:
      "A one-day assembly on accessible interfaces, design systems and multilingual typography.",
    agenda: [{ time: "10:00", title: "Opening session", track: "Auditorium" }],
  },
  {
    id: "robotics-open-day",
    title: "Robotics Open Day",
    tagline: "Bring a Charger",
    category: "Open Day",
    city: "Bengaluru",
    venue: "IISc Autonomous Systems Lab",
    startsAt: "2026-05-09T10:00:00.000Z",
    capacity: 250,
    participants: 0,
    joinRequests: 0,
    state: "SCHEDULED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NONE" },
    accent: ["#1d4ed8", "#60a5fa"],
    about: "Open lab floors, live demos and a lot of robots that fall over.",
    agenda: [{ time: "10:00", title: "Lab tour", track: "Campus" }],
  },
  {
    id: "healthtech-forum-2026",
    title: "HealthTech Forum 2026",
    tagline: "Clinical Trial, Real World Data",
    category: "Forum",
    city: "Hyderabad",
    venue: "HITEC City, Convention Centre",
    startsAt: "2026-07-02T09:00:00.000Z",
    capacity: 400,
    participants: 0,
    joinRequests: 0,
    state: "SCHEDULED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NONE" },
    accent: ["#065f46", "#10b981"],
    about: "Trial design, real-world evidence and the gap between approval and practice.",
    agenda: [{ time: "09:00", title: "Registration", track: "Lobby" }],
  },
  {
    id: "space-symposium-2026",
    title: "Space Systems Symposium",
    tagline: "Orbits, Telemetry, Budgets",
    category: "Symposium",
    city: "Bengaluru",
    venue: "ISRO Satellite Centre, Auditorium",
    startsAt: "2026-08-14T09:30:00.000Z",
    capacity: 180,
    participants: 0,
    joinRequests: 0,
    state: "SCHEDULED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NONE" },
    accent: ["#334155", "#94a3b8"],
    about: "Telemetry pipelines, launch economics and ground-station reality.",
    agenda: [{ time: "09:30", title: "Opening", track: "Auditorium" }],
  },
  {
    id: "build-in-bengaluru-2026",
    title: "Build in Bengaluru 2026",
    tagline: "City-scale Hack Weekend",
    category: "Hackathon",
    city: "Bengaluru",
    venue: "Bengaluru Palace Grounds",
    startsAt: "2026-09-05T08:00:00.000Z",
    capacity: 500,
    participants: 0,
    joinRequests: 0,
    state: "SCHEDULED",
    expiredClaims: 0,
    promotedFromWaitlist: 0,
    demoOutcome: { status: "NONE" },
    accent: ["#7e22ce", "#c084fc"],
    about: "Fifty hours, open mentors, and hardware you can actually break.",
    agenda: [{ time: "08:00", title: "Check-in and team formation", track: "Grounds" }],
  },
];

export const DEMO_TRAFFIC_SEED = 20260315;

/**
 * Baseline request volume for one participant, before per-event scaling.
 * A long tail: most people try once or twice, a handful try thousands of times.
 */
export function baseRequestsFor(eventId, index) {
  const rng = rngFrom("reqfreq", eventId, index);
  const roll = rng();
  if (roll < 0.52) return longTail(rng, 1, 2, 1); // 1–2
  if (roll < 0.81) return randomInt(rng, 3, 10); // 3–10
  if (roll < 0.94) return randomInt(rng, 11, 100); // 11–100
  if (roll < 0.99) return randomInt(rng, 101, 1000); // 101–1000
  return randomInt(rng, 1001, 4200); // 1000+
}

export const REQUEST_BUCKETS = [
  { id: "b1", label: "1–2", min: 1, max: 2 },
  { id: "b2", label: "3–10", min: 3, max: 10 },
  { id: "b3", label: "11–100", min: 11, max: 100 },
  { id: "b4", label: "101–1000", min: 101, max: 1000 },
  { id: "b5", label: "1000+", min: 1001, max: Infinity },
];

export function bucketForRequestCount(count) {
  return REQUEST_BUCKETS.find((b) => count >= b.min && count <= b.max) || REQUEST_BUCKETS[0];
}

function withDerived(event) {
  const rng = rngFrom("meta", event.id);
  const hasDraw = ["DRAWING", "CLAIMING", "CLOSED", "SOLD_OUT"].includes(event.state);
  const selected = hasDraw ? Math.min(event.capacity, event.participants) : 0;
  const expiredClaims = hasDraw ? Math.min(event.expiredClaims, selected) : 0;
  const promotedFromWaitlist = hasDraw ? Math.min(event.promotedFromWaitlist, Math.max(0, event.participants - selected)) : 0;

  return {
    ...event,
    hasDraw,
    selected,
    expiredClaims,
    promotedFromWaitlist,
    confirmed: Math.max(0, selected - expiredClaims + promotedFromWaitlist),
    waitlistSize: hasDraw ? Math.max(0, event.participants - selected) : 0,
    // Drives the generated cover art so cards look distinct but stay coherent.
    artSeed: randomInt(rng, 1, 9999),
  };
}

export function buildSeed() {
  return {
    users: {
      total: 50000,
      verified: 50000,
      demo: DEMO_USER,
    },
    events: EVENT_CATALOG.map(withDerived),
  };
}

/* ---------------------------------------------------------------------------
 * Audit trail — chronological, immutable, every entry carries a request id.
 * ------------------------------------------------------------------------- */

export function buildAuditLog(events, now) {
  const minutes = (n) => new Date(now - n * 60_000).toISOString();
  const rows = [];
  let seq = 4820;

  const push = (at, action, actor, eventId, metadata) => {
    seq += 1;
    rows.push({
      id: `aud_${seq}`,
      at,
      action,
      actor,
      eventId,
      requestId: `req_${(seq * 7919).toString(16).padStart(8, "0")}`,
      metadata,
      severity: metadata?.severity || "info",
    });
  };

  const flagship = events.find((e) => e.id === "tech-summit-2026");
  const claiming = events.find((e) => e.id === "founders-forum-2026");
  const drawing = events.find((e) => e.id === "quantum-workshop-2026");

  push(minutes(52), "ALLOCATION_CONFIRMED", "system", claiming.id, {
    seat: "B-188",
    idempotencyKey: "idem_7f21c9",
    attempt: 1,
    severity: "success",
  });
  push(minutes(48), "CLAIM_EXPIRED", "system", claiming.id, {
    seat: "B-206",
    gracePeriodSeconds: 0,
    requeuedToWaitlist: true,
    severity: "warning",
  });
  push(minutes(45), "CLAIM_OPENED", "organiser", claiming.id, {
    windowMinutes: 120,
    offeredSeats: 250,
  });
  push(minutes(41), "PARTICIPANT_SET_FROZEN", "system", drawing.id, {
    participants: 4180,
    capacity: 120,
    severity: "info",
  });
  push(minutes(39), "SNAPSHOT_CREATED", "system", drawing.id, {
    snapshotHash: null,
  });
  push(minutes(36), "COMMITMENT_GENERATED", "system", drawing.id, {
    algorithm: "HMAC-SHA256",
  });
  push(minutes(34), "DRAW_STARTED", "system", drawing.id, {
    rankingStrategy: "ascending-hmac",
  });
  push(minutes(31), "ENTRY_WINDOW_CLOSED", "organiser", flagship.id, {
    participants: flagship.participants,
    joinRequests: flagship.joinRequests,
    duplicateAttempts: flagship.duplicateAttempts,
  });
  push(minutes(29), "PARTICIPANT_SET_FROZEN", "system", flagship.id, {
    participants: flagship.participants,
    capacity: flagship.capacity,
  });
  push(minutes(27), "SNAPSHOT_CREATED", "system", flagship.id, { algorithm: "SHA-256" });
  push(minutes(24), "COMMITMENT_GENERATED", "system", flagship.id, {
    algorithm: "HMAC-SHA256",
    published: true,
  });
  push(minutes(22), "DRAW_STARTED", "system", flagship.id, {
    participants: flagship.participants,
    capacity: flagship.capacity,
  });
  push(minutes(18), "DRAW_COMPLETED", "system", flagship.id, {
    selected: flagship.selected,
    durationMs: 1840,
    severity: "success",
  });
  push(minutes(17), "SEED_REVEALED", "system", flagship.id, { verifiedBy: "public-verifier" });
  push(minutes(16), "CLAIM_OPENED", "organiser", flagship.id, { windowMinutes: 120 });
  push(minutes(14), "CLAIM_EXPIRED", "system", flagship.id, {
    seat: "A-077",
    requeuedToWaitlist: true,
    severity: "warning",
  });
  push(minutes(11), "ALLOCATION_CONFIRMED", "system", flagship.id, {
    seat: "A-102",
    idempotencyKey: "idem_3ab8d1",
    attempt: 1,
    severity: "success",
  });
  push(minutes(9), "WAITLIST_PROMOTED", "system", flagship.id, {
    fromRank: 118,
    seat: "A-077",
  });
  push(minutes(6), "RATE_LIMIT_TRIPPED", "edge", flagship.id, {
    scope: "join",
    windowSeconds: 1,
    threshold: 40,
    severity: "warning",
  });
  push(minutes(4), "HEALTHCHECK_DEGRADED", "system", flagship.id, {
    service: "redis",
    detail: "p99 latency above 250ms for 30s",
    severity: "warning",
  });
  push(minutes(2), "ADVERSARIAL_RUN_COMPLETED", "operator", flagship.id, {
    scenario: "Duplicate Claim",
    durationSeconds: 120,
    severity: "success",
  });
  push(minutes(1), "ALLOCATION_CONFIRMED", "system", flagship.id, {
    seat: "A-118",
    idempotencyKey: "idem_9c02ee",
    attempt: 2,
    replay: true,
    severity: "success",
  });

  return rows.reverse();
}

export function buildServiceCatalog() {
  return [
    { id: "api", name: "API", role: "Next.js route handlers", unit: "ms" },
    { id: "postgres", name: "PostgreSQL", role: "Primary datastore", unit: "ms" },
    { id: "redis", name: "Redis", role: "Rate limits and locks", unit: "ms" },
    { id: "bullmq", name: "BullMQ", role: "Draw and claim workers", unit: "ms" },
    { id: "workers", name: "Workers", role: "Allocation processors", unit: "%" },
    { id: "mailhog", name: "MailHog", role: "Transactional mail", unit: "ms" },
  ];
}

export { EVENT_CATALOG };
