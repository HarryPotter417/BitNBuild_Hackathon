import Link from "next/link";
import {
  getEvent,
  getFairness,
  getPlatformMetrics,
  getVerification,
  listEvents,
  liveTraffic,
} from "../server/data.js";
import { eventStatus } from "../lib/status";
import { formatCompact, formatNumber, formatPercent, truncateHash } from "../lib/format";
import { Badge, Button, Card, Dot, Section, Stat, StatCell, StatGrid } from "../components/ui";
import { AreaChart, HBarChart } from "../components/charts";
import { EventCard } from "../components/event-card";
import { EventArt } from "../components/event-art";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Enter once",
    body: "One entry per verified account, keyed on the server. Hit the endpoint as many times as you like — the counter goes up, the entry count does not.",
  },
  {
    n: "02",
    title: "The set freezes",
    body: "When entries close, the participant set is hashed. From that moment nobody can add, remove or reorder a single participant.",
  },
  {
    n: "03",
    title: "Commit, then draw",
    body: "The organiser publishes SHA-256(seed) before ranking runs. The seed is revealed afterwards, so the result cannot be chosen in advance.",
  },
  {
    n: "04",
    title: "Claim or be released",
    body: "Winners get a claim window. Let it lapse and the seat is back-filled from the waitlist automatically — nobody quietly disappears.",
  },
];

export default async function HomePage() {
  const [events,metrics,flagship,fairness,verification,traffic] = await Promise.all([
    listEvents(),getPlatformMetrics(),getEvent("tech-summit-2026"),getFairness("tech-summit-2026"),getVerification("tech-summit-2026"),liveTraffic(60),
  ]);
  if (!flagship || !fairness || !verification) return <div className="mx-auto max-w-5xl px-5 py-20"><h1 className="fd-page-title">Fair Drop</h1><p className="fd-body text-ink-muted mt-3">Events and draw proofs will appear here when the platform is configured.</p><Button href="/events" className="mt-6">Browse events</Button></div>;

  const featured = events
    .filter((e) => ["OPEN", "DRAWING", "CLAIMING"].includes(e.state))
    .slice(0, 3);

  const baseRate = (fairness.selectedUsers / fairness.uniqueVerifiedUsers) * 100;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="fd-grid-bg absolute inset-0 opacity-70" aria-hidden="true" />
        <div
          className="absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--fd-primary) 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-5 py-20 sm:px-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-fd-sm">
              <Dot toneName="success" pulse />
              <span className="fd-caption text-ink-secondary">
                {formatNumber(metrics.totalUsers)} verified people · {metrics.activeEvents} live events
              </span>
            </div>

            <h1 className="fd-hero text-ink">
              Every entry counts.
              <br />
              <span className="text-primary">Every draw is provable.</span>
            </h1>

            <p className="fd-lede mt-6 max-w-xl">
              When 50,000 people want 500 seats, the draw is the product. Fair Drop freezes the
              participant set, commits to a seed before ranking, and publishes everything needed to
              re-run the draw and get the same answer.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/events" size="lg">
                Browse events
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
              <Button href="/me/verify/tech-summit-2026" variant="secondary" size="lg">
                Verify the flagship draw
              </Button>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-7">
              {[
                ["Join attempts", formatCompact(metrics.joinAttempts)],
                ["Actual entries", formatCompact(metrics.uniqueEntries)],
                ["Duplicates absorbed", formatCompact(metrics.duplicateAttempts)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="fd-caption text-ink-muted">{label}</dt>
                  <dd className="fd-metric-sm text-ink mt-1.5">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live proof card */}
          <div className="relative">
            <Card raised className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Dot toneName="success" pulse />
                  <span className="fd-eyebrow text-ink-secondary">Draw verification · recomputed</span>
                </div>
                <Badge toneName={verification.verification.verified ? "success" : "warning"} size="sm" dot>
                  {verification.verification.verified ? "Verified" : "Pending"}
                </Badge>
              </div>

              <div className="px-5 py-5">
                <p className="fd-card-title text-ink">{flagship.title}</p>
                <p className="fd-caption text-ink-muted mt-1">
                  {formatNumber(verification.participantCount)} participants →{" "}
                  {formatNumber(verification.selectedCount)} winners
                </p>

                <dl className="mt-5 space-y-3">
                  {[
                    ["Participant set (SHA-256)", verification.snapshotHash],
                    ["Commitment (SHA-256 of seed)", verification.commitmentHash],
                    ["Revealed seed", verification.revealedSeed],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="fd-caption text-ink-muted">{label}</dt>
                      <dd className="fd-hash text-ink-secondary mt-1">{truncateHash(value, 22, 8)}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="mt-5 space-y-2 border-t border-line pt-4">
                  {verification.verification.checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-2.5">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                        <circle cx="8" cy="8" r="7" fill="var(--fd-success-soft)" stroke="var(--fd-success-line)" />
                        <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="var(--fd-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="fd-caption text-ink-secondary">{check.label}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/me/verify/${flagship.id}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Re-run this verification yourself
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* LIVE EVENTS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-[1240px] space-y-20 px-5 py-20 sm:px-7">
        <Section
          title="Happening right now"
          subtitle="Events in the middle of their lifecycle — entries open, a draw running, or a claim window counting down."
          action={
            <Button href="/events" variant="secondary" size="sm">
              All {events.length} events
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* THE HEADLINE ARGUMENT                                            */}
        {/* ---------------------------------------------------------------- */}
        <Section
          title="Spamming the endpoint does not help"
          subtitle={`Win rates for ${flagship.title}, grouped by request frequency in the seeded simulation. The rates stay near the ${formatPercent(baseRate, 2)} base rate; extra requests do not create extra entries.`}
        >
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <Card className="p-5">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="fd-card-title text-ink">Win rate by requests per user</h3>
                  <p className="fd-caption text-ink-muted mt-1">
                    {formatNumber(fairness.measuredRequests)} requests ·{" "}
                    {formatNumber(fairness.uniqueVerifiedUsers)} verified users ·{" "}
                    {formatNumber(fairness.duplicateAttempts)} duplicates discarded
                  </p>
                </div>
                <Badge toneName="info" size="sm">
                  Simulated entries · HMAC draw
                </Badge>
              </div>

              <HBarChart
                reference={baseRate}
                format={(v) => `${v.toFixed(2)}%`}
                data={fairness.requestFrequency.map((b) => ({
                  label: `${b.label} requests`,
                  value: b.winRate,
                  color: "primary",
                }))}
              />

              <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
                <span className="inline-block h-3 w-px bg-ink-muted" aria-hidden="true" />
                <span className="fd-caption text-ink-muted">
                  Marker shows the base rate across all {formatNumber(fairness.uniqueVerifiedUsers)} users.
                </span>
              </div>
            </Card>

            <div className="grid gap-5">
              <Card className="p-5">
                <h3 className="fd-card-title text-ink">Integrity counters</h3>
                <p className="fd-caption text-ink-muted mt-1 mb-4">
                  Counted from live allocation state, not reported by the organiser.
                </p>
                <div className="space-y-3.5">
                  {[
                    ["Duplicate entries", fairness.integrity.duplicateEntries, "A person holding two seats."],
                    ["Duplicate allocations", fairness.integrity.duplicateAllocations, "One seat, two winners."],
                    ["Oversold seats", fairness.integrity.oversoldSeats, "Confirmed beyond capacity."],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="fd-body-sm text-ink font-medium">{label}</p>
                        <p className="fd-caption text-ink-muted">{hint}</p>
                      </div>
                      <Badge toneName={value === 0 ? "success" : "danger"} size="sm">
                        {value === 0 ? "0 — clean" : value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="fd-card-title text-ink">Amplification, neutralised</h3>
                <p className="fd-body-sm text-ink-muted mt-2 leading-relaxed">
                  {formatNumber(fairness.httpJoinRequests)} join requests were sent to the flagship
                  event. They produced {formatNumber(fairness.validEntries)} entries — one per verified
                  account. Entry amplification is{" "}
                  <span className="font-semibold text-ink">{fairness.entryAmplification.toFixed(2)}×</span>,
                  and {formatNumber(fairness.duplicateAttempts)} duplicate attempts were absorbed
                  without touching the participant set.
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* HOW IT WORKS                                                      */}
        {/* ---------------------------------------------------------------- */}
        <Section id="how-it-works" title="How an allocation actually runs">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <Card key={step.n} className="relative overflow-hidden p-5">
                <span
                  className="absolute right-4 top-3 text-5xl font-bold leading-none tracking-tighter"
                  style={{ color: "var(--fd-grid-line)" }}
                  aria-hidden="true"
                >
                  {step.n}
                </span>
                <h3 className="fd-card-title text-ink relative">{step.title}</h3>
                <p className="fd-body-sm text-ink-muted mt-2 relative leading-relaxed">{step.body}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* TRAFFIC + PLATFORM                                                */}
        {/* ---------------------------------------------------------------- */}
        <Section
          title="Built for the stampede"
          subtitle="Seeded demo traffic across events, grouped into 60 time buckets."
        >
          <Card className="p-5">
            <AreaChart
              height={230}
              series={[
                {
                  name: "Join requests",
                  toneName: "primary",
                  values: traffic.map((t) => t.requests),
                },
                {
                  name: "Entries created",
                  toneName: "success",
                  values: traffic.map((t) => t.entries),
                },
                {
                  name: "Rejected (429)",
                  toneName: "warning",
                  values: traffic.map((t) => t.rejected429),
                },
              ]}
            />
          </Card>

          <StatGrid columns={4} className="mt-5">
            <StatCell>
              <Stat label="Verified users" value={formatCompact(metrics.totalUsers)} sub="accounts with a verified email" />
            </StatCell>
            <StatCell>
              <Stat label="Total capacity" value={formatNumber(metrics.totalCapacity)} sub="seats across all events" />
            </StatCell>
            <StatCell>
              <Stat label="Confirmed seats" value={formatNumber(metrics.confirmedAllocations)} sub={`${formatNumber(metrics.expiredClaims)} claims lapsed`} />
            </StatCell>
            <StatCell>
              <Stat label="Live events" value={`${metrics.activeEvents}/${metrics.totalEvents}`} sub="not yet closed or cancelled" />
            </StatCell>
          </StatGrid>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* EVENT STATES                                                      */}
        {/* ---------------------------------------------------------------- */}
        <Section
          title="Every state an event can be in"
          subtitle="The same event states are used on event pages, waiting rooms, and allocation history."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {events
              .filter((e, i, arr) => arr.findIndex((x) => x.state === e.state) === i)
              .slice(0, 8)
              .map((event) => (
                <Link
                  key={event.state}
                  href={`/events/${event.id}`}
                  className="fd-card flex items-center gap-3.5 p-4 transition-all hover:shadow-fd-md hover:border-line-strong"
                >
                  <EventArt event={event} rounded="rounded-lg" className="size-11 shrink-0" />
                  <div className="min-w-0">
                    <Badge toneName={eventStatus(event.state).tone} size="sm" dot>
                      {eventStatus(event.state).label}
                    </Badge>
                    <p className="fd-caption text-ink-muted mt-1.5 truncate">{event.title}</p>
                  </div>
                </Link>
              ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* CTA                                                               */}
        {/* ---------------------------------------------------------------- */}
        <Card raised className="overflow-hidden">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.2fr_auto] lg:items-center">
            <div>
              <h2 className="fd-display text-ink" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
                Check a draw before you trust it
              </h2>
              <p className="fd-body text-ink-secondary mt-3 max-w-xl">
                Pick any drawn event and the verification page re-runs the ranking from the published
                snapshot hash, commitment and seed — in your browser, not on our server. If a single
                participant had been added, removed or reordered, it would say so.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/me/verify/india-design-week" size="lg">
                Open a verifier
              </Button>
              <Button href="/me" variant="secondary" size="lg">
                My entries
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
