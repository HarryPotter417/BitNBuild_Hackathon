import { notFound } from "next/navigation";
import Link from "next/link";
import {
  claimWindow,
  getOutcome,
  getDraw,
  getEvent,
  getFairness,
  getTraffic,
  getVerification,
} from "../../../server/data.js";
import { EVENT_STATUS, eventStatus } from "../../../lib/status";
import {
  formatCompact,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  truncateHash,
} from "../../../lib/format";
import {
  Badge,
  Breadcrumb,
  Button,
  Callout,
  Card,
  CardHeader,
  Hash,
  KeyValue,
  Meter,
  PageHeader,
  Section,
  Stat,
  StatCell,
  StatGrid,
} from "../../../components/ui";
import { AreaChart, Donut } from "../../../components/charts";
import { EventArt } from "../../../components/event-art";
import { OutcomeBadge, RankChip, SeatChip } from "../../../components/event-card";
import { JoinButton } from "../../../components/join-button";
import { DrawProgress } from "../../../components/draw-progress";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: `${event.tagline} · ${event.city} · ${formatNumber(event.capacity)} seats allocated by a provable draw.`,
  };
}

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const status = eventStatus(event.state);
  const [outcome,draw,verification,traffic,fairness,window] = await Promise.all([
    getOutcome(id),event.hasDraw?getDraw(id):null,event.hasDraw?getVerification(id):null,getTraffic(id),event.hasDraw?getFairness(id):null,claimWindow(id),
  ]);

  const lifecycle = ["SCHEDULED", "OPEN", "FROZEN", "DRAWING", "CLAIMING", "CLOSED"];
  const terminal = ["SOLD_OUT", "CANCELLED"];
  const currentStep = terminal.includes(event.state) ? 5 : EVENT_STATUS[event.state].step;

  const amplification = event.participants > 0 ? event.joinRequests / event.participants : 0;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* HERO                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative border-b border-line">
        <EventArt event={event} rounded="rounded-none" className="absolute inset-0 h-full w-full opacity-[0.22]" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/85 to-bg" aria-hidden="true" />

        <div className="relative mx-auto max-w-[1240px] px-5 pt-8 pb-12 sm:px-7">
          <Breadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/events", label: "Events" },
              { label: event.title },
            ]}
          />

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge toneName={status.tone} dot>
                  {status.label}
                </Badge>
                <Badge toneName="neutral" size="sm">
                  {event.category}
                </Badge>
                {outcome.status !== "NONE" ? <OutcomeBadge status={outcome.status} size="sm" /> : null}
              </div>

              <h1 className="fd-display text-ink">{event.title}</h1>
              <p className="fd-lede mt-3 max-w-2xl">{event.tagline}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 fd-body-sm text-ink-secondary">
                <span className="inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <rect x="1.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4 1.5v3M10 1.5v3M1.5 6.5h11" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  {formatDate(event.startsAt, { weekday: "long" })} · {formatTime(event.startsAt)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 1.5c-3 0-5 2.3-5 5.2C2 10 7 12.5 7 12.5S12 10 12 6.7C12 3.8 10 1.5 7 1.5Z" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="7" cy="6" r="1.9" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  {event.venue}, {event.city}
                </span>
              </div>

              <p className="fd-body text-ink-secondary mt-7 max-w-2xl leading-relaxed">{event.about}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <JoinButton event={event} outcome={outcome} />
                {outcome.status === "SELECTED" ? (
                  <Button href={`/me/claim/${event.id}`} size="lg">
                    Claim seat {outcome.seat}
                  </Button>
                ) : null}
                {outcome.status === "WAITING" ? (
                  <Button href={`/me/waiting-room/${event.id}`} variant="secondary" size="lg">
                    Open waiting room
                  </Button>
                ) : null}
                {event.hasDraw ? (
                  <Button href={`/me/verify/${event.id}`} variant="ghost" size="lg">
                    Verify this draw
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card raised className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="fd-eyebrow text-ink-muted">Allocation</div>
                    <div className="fd-metric mt-2 text-ink">
                      {formatCompact(event.participants)}
                      <span className="text-base text-ink-muted font-normal"> / {formatNumber(event.capacity)}</span>
                    </div>
                  </div>
                  <Donut
                    size={78}
                    thickness={9}
                    segments={[
                      { label: "Confirmed", value: event.confirmed, color: "success" },
                      { label: "Offered", value: Math.max(0, event.offered - event.confirmed), color: "warning" },
                      {
                        label: "Remaining",
                        value: Math.max(0, event.capacity - event.offered),
                        color: "neutral",
                      },
                    ]}
                    centerValue={`${Math.round((event.participants / event.capacity) * 100)}%`}
                    centerLabel="demand"
                  />
                </div>

                <Meter value={event.participants} max={event.capacity} className="mt-4" />

                <dl className="mt-5 space-y-3 border-t border-line pt-4">
                  {[
                    ["Join attempts", formatNumber(event.joinRequests)],
                    ["Duplicates absorbed", formatNumber(event.duplicateAttempts)],
                    ["Requests per entry", amplification.toFixed(1)],
                    ["Entry amplification", "1.00×"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3">
                      <dt className="fd-caption text-ink-muted">{label}</dt>
                      <dd className="fd-caption text-ink font-semibold fd-tabular">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              {event.entriesCloseAt ? (
                <Card className="p-5">
                  <h3 className="fd-card-title text-ink">Entry window</h3>
                  <dl className="mt-3.5 space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="fd-caption text-ink-muted">Opened</dt>
                      <dd className="fd-caption text-ink">{formatDateTime(event.entriesOpenAt)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="fd-caption text-ink-muted">Closed</dt>
                      <dd className="fd-caption text-ink">{formatDateTime(event.entriesCloseAt)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="fd-caption text-ink-muted">{status.joinable ? "Closes in" : "Closed"}</dt>
                      <dd className="fd-caption text-ink font-semibold">
                        {formatRelative(event.entriesCloseAt)}
                      </dd>
                    </div>
                  </dl>
                  {status.frozen ? (
                    <p className="fd-caption text-ink-muted mt-4 border-t border-line pt-3.5">
                      The participant set is frozen. Nobody can add, remove or reorder a participant
                      from this point.
                    </p>
                  ) : null}
                </Card>
              ) : null}

              {window ? (
                <Card className="border-warning-line bg-warning-soft/40 p-5">
                  <div className="flex items-center gap-2">
                    <Badge toneName="warning" dot size="sm">
                      Claim window open
                    </Badge>
                  </div>
                  <p className="fd-body-sm text-ink-secondary mt-2.5">
                    Unclaimed seats are released to the waitlist. {window.windowMinutes} minutes from
                    draw completion.
                  </p>
                  <p className="fd-caption text-ink-muted mt-2">
                    Expires {formatTime(window.expiresAt)} · {formatRelative(window.expiresAt)}
                  </p>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] space-y-16 px-5 py-14 sm:px-7">
        {/* -------------------------------------------------------------- */}
        {/* LIFECYCLE                                                      */}
        {/* -------------------------------------------------------------- */}
        <Section title="Where this event is">
          <Card className="p-5">
            <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {lifecycle.map((step, i) => {
                const done = i < currentStep;
                const current = i === currentStep && !terminal.includes(event.state);
                return (
                  <li
                    key={step}
                    className={`relative rounded-xl border px-4 py-3.5 transition-colors ${
                      current
                        ? "border-primary bg-primary-soft"
                        : done
                          ? "border-line bg-surface-muted"
                          : "border-line bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                          current
                            ? "bg-primary text-primary-contrast"
                            : done
                              ? "bg-success text-white"
                              : "bg-surface-sunken text-ink-muted"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span
                        className={`text-[0.8125rem] font-semibold ${
                          current ? "text-primary" : done ? "text-ink" : "text-ink-muted"
                        }`}
                      >
                        {EVENT_STATUS[step].label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {terminal.includes(event.state) ? (
              <p className="fd-caption text-ink-muted mt-4">
                This event reached <span className="font-semibold text-ink">{status.label}</span> and
                sits at the end of the lifecycle.
              </p>
            ) : null}
          </Card>
        </Section>

        {/* -------------------------------------------------------------- */}
        {/* YOUR OUTCOME                                                   */}
        {/* -------------------------------------------------------------- */}
        {outcome.status !== "NONE" ? (
          <Section title="Where you stand">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
                <div className="flex items-center gap-3">
                  <OutcomeBadge status={outcome.status} />
                  {outcome.seat ? <SeatChip seat={outcome.seat} /> : null}
                  {outcome.rank ? <RankChip rank={outcome.rank} /> : null}
                </div>
                {outcome.status === "SELECTED" ? (
                  <Button href={`/me/claim/${event.id}`} size="sm">
                    Claim now
                  </Button>
                ) : outcome.status === "WAITING" ? (
                  <Button href={`/me/waiting-room/${event.id}`} size="sm" variant="secondary">
                    Waiting room
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Status" value={outcome.status === "NONE" ? "—" : outcomeStatusLabel(outcome.status)} mono={false} />
                <Stat label="Rank" value={outcome.rank ? `#${formatNumber(outcome.rank)}` : "—"} sub={outcome.rank ? `of ${formatNumber(event.participants)}` : "not ranked yet"} />
                <Stat label="Seat" value={outcome.seat || "—"} sub={outcome.promoted ? "promoted from waitlist" : "from the published ranking"} />
                <Stat
                  label="Requests you sent"
                  value={outcome.requestCount ? formatNumber(outcome.requestCount) : "1"}
                  sub="entries created: 1"
                />
              </div>

              {outcome.status === "WAITLISTED" ? (
                <div className="border-t border-line px-5 py-4">
                  <Callout toneName="info" title="Waitlist position">
                    You are number {formatNumber(outcome.waitlistRank)} on the waitlist.{" "}
                    {formatNumber(Math.max(0, event.capacity - event.confirmed))} seat
                    {event.capacity - event.confirmed === 1 ? " is" : "s are"} still unconfirmed, so the
                    queue is live. If a winner lets their claim lapse, the seat is offered to the next
                    person in order.
                  </Callout>
                </div>
              ) : null}

              {outcome.status === "EXPIRED" ? (
                <div className="border-t border-line px-5 py-4">
                  <Callout toneName="danger" title="Claim window lapsed">
                    Seat {outcome.seat} was held for you and the window closed without a claim. The
                    seat was released to the waitlist. Your entry and rank stay on the record — nothing
                    was deleted.
                  </Callout>
                </div>
              ) : null}
            </Card>
          </Section>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* DRAW                                                           */}
        {/* -------------------------------------------------------------- */}
        {draw ? (
          <Section
            title="The draw"
            subtitle="Everything needed to re-run this ranking independently. Nothing here is computed for you — it is all published."
            action={
              <Button href={`/me/verify/${event.id}`} variant="secondary" size="sm">
                Open full verifier
              </Button>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
              <Card>
                <CardHeader
                  title="Published values"
                  subtitle={`${draw.algorithm} · v${draw.version}`}
                  action={
                    <Badge toneName={verification?.verification.verified ? "success" : "warning"} dot size="sm">
                      {verification?.verification.verified ? "Verified" : "Seed not revealed"}
                    </Badge>
                  }
                />
                <div className="px-5 pb-5">
                  <KeyValue
                    columns={2}
                    items={[
                      ["Participants", formatNumber(draw.participantCount)],
                      ["Capacity", formatNumber(draw.capacity)],
                      ["Winners selected", formatNumber(draw.selectedCount)],
                      [
                        "Commitment published",
                        draw.publishedAt ? formatRelative(draw.publishedAt) : "—",
                      ],
                      ["Seed revealed", draw.revealedAt ? formatRelative(draw.revealedAt) : "not yet"],
                    ]}
                  />

                  <dl className="mt-5 space-y-4 border-t border-line pt-5">
                    {[
                      ["Snapshot hash", draw.snapshotHash, "SHA-256 over the sorted participant set"],
                      ["Commitment", draw.commitmentHash, "SHA-256 of the seed, published before ranking"],
                      ["Revealed seed", draw.revealedSeed, "Published only after the ranking finished"],
                    ].map(([label, value, hint]) => (
                      <div key={label}>
                        <dt className="fd-caption text-ink-muted">{label}</dt>
                        <dd className="mt-1">
                          <Hash value={value} head={26} tail={10} className="text-ink" />
                        </dd>
                        <dd className="fd-caption text-ink-muted mt-0.5">{hint}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardHeader title="Pipeline" subtitle="Live state of the draw, not a progress animation." />
                  <div className="px-5 pb-5">
                    <DrawProgress progress={draw.progress} />
                  </div>
                </Card>

                {verification ? (
                  <Card>
                    <CardHeader title="Verification checks" subtitle="Each one re-computed from published values." />
                    <ul className="space-y-3 px-5 pb-5">
                      {verification.verification.checks.map((check) => (
                        <li key={check.id} className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                              check.state === "pass"
                                ? "bg-success-soft text-success"
                                : check.state === "fail"
                                  ? "bg-danger-soft text-danger"
                                  : "bg-surface-sunken text-ink-muted"
                            }`}
                          >
                            {check.state === "pass" ? "✓" : check.state === "fail" ? "✕" : "…"}
                          </span>
                          <div className="min-w-0">
                            <p className="fd-body-sm text-ink font-medium">{check.label}</p>
                            <p className="fd-caption text-ink-muted">{check.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </div>
            </div>
          </Section>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* TRAFFIC                                                        */}
        {/* -------------------------------------------------------------- */}
        {traffic && traffic.points.some((p) => p.requests > 0) ? (
          <Section title="Join traffic" subtitle="Seeded demo traffic profile for the entry window; not production API telemetry.">
            <Card className="p-5">
              <AreaChart
                height={220}
                labels={traffic.points.map((p) => formatTime(p.at))}
                series={[
                  { name: "Requests", toneName: "primary", values: traffic.points.map((p) => p.requests) },
                  { name: "Entries", toneName: "success", values: traffic.points.map((p) => p.entries) },
                  { name: "Rejected 429", toneName: "warning", values: traffic.points.map((p) => p.rejected429) },
                  { name: "Failed 503", toneName: "danger", values: traffic.points.map((p) => p.failed503) },
                ]}
              />
            </Card>

            <StatGrid columns={4} className="mt-5">
              <StatCell>
                <Stat label="Peak p95" value={`${formatNumber(Math.max(...traffic.points.map((p) => p.p95)))}ms`} sub="during the spike" />
              </StatCell>
              <StatCell>
                <Stat
                  label="Rejected"
                  value={formatCompact(traffic.points.reduce((s, p) => s + p.rejected429, 0))}
                  sub="rate limited"
                />
              </StatCell>
              <StatCell>
                <Stat
                  label="Failed"
                  value={formatCompact(traffic.points.reduce((s, p) => s + p.failed503, 0))}
                  sub="returned 503"
                />
              </StatCell>
              <StatCell>
                <Stat
                  label="Capture rate"
                  value={formatPercent((event.participants / event.joinRequests) * 100, 2)}
                  sub="requests that became entries"
                />
              </StatCell>
            </StatGrid>
          </Section>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* FAIRNESS                                                       */}
        {/* -------------------------------------------------------------- */}
        {fairness ? (
          <Section
            title="Fairness report"
            subtitle="Win rate grouped by how many times each participant hit the join endpoint. Flat is the point."
          >
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h3 className="fd-card-title text-ink">Requests per user vs win rate</h3>
                <p className="fd-caption text-ink-muted mt-1">
                  Base rate {formatPercent((fairness.selectedUsers / fairness.uniqueVerifiedUsers) * 100, 2)} ·
                  counted from the published ranking, not modelled
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {["Requests", "Users", "Share of users", "Requests", "Share of traffic", "Winners", "Win rate"].map(
                        (h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`fd-eyebrow text-ink-muted px-4 py-2.5 font-semibold ${i > 0 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {fairness.requestFrequency.map((bucket) => (
                      <tr key={bucket.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-ink font-medium">{bucket.label}</td>
                        <td className="fd-tabular px-4 py-3 text-right text-ink-secondary">
                          {formatNumber(bucket.users)}
                        </td>
                        <td className="fd-tabular px-4 py-3 text-right text-ink-secondary">
                          {formatPercent(bucket.shareOfUsers)}
                        </td>
                        <td className="fd-tabular px-4 py-3 text-right text-ink-secondary">
                          {formatNumber(bucket.requests)}
                        </td>
                        <td className="fd-tabular px-4 py-3 text-right text-ink-secondary">
                          {formatPercent(bucket.shareOfRequests)}
                        </td>
                        <td className="fd-tabular px-4 py-3 text-right text-ink font-semibold">
                          {formatNumber(bucket.winners)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="fd-tabular font-semibold"
                            style={{
                              color:
                                Math.abs(bucket.winRate - (fairness.selectedUsers / fairness.uniqueVerifiedUsers) * 100) < 0.5
                                  ? "var(--fd-success)"
                                  : "var(--fd-text)",
                            }}
                          >
                            {formatPercent(bucket.winRate, 2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Duplicate entries", fairness.integrity.duplicateEntries],
                ["Duplicate allocations", fairness.integrity.duplicateAllocations],
                ["Oversold seats", fairness.integrity.oversoldSeats],
                ["Lapsed claims", fairness.expiredClaims],
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="fd-caption text-ink-muted">{label}</span>
                    <span
                      className="fd-metric-sm"
                      style={{ color: value === 0 ? "var(--fd-success)" : "var(--fd-warning)" }}
                    >
                      {value}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* AGENDA                                                         */}
        {/* -------------------------------------------------------------- */}
        {event.agenda?.length ? (
          <Section title="Agenda" subtitle={`${event.agenda.length} scheduled items.`}>
            <Card className="divide-y divide-line">
              {event.agenda.map((item, i) => (
                <div key={`${item.time}-${i}`} className="flex items-baseline gap-5 px-5 py-3.5">
                  <span className="fd-caption text-primary w-14 shrink-0 font-semibold fd-tabular">{item.time}</span>
                  <span className="fd-body-sm text-ink flex-1">{item.title}</span>
                  {item.track ? (
                    <span className="fd-caption text-ink-muted hidden sm:block">{item.track}</span>
                  ) : null}
                </div>
              ))}
            </Card>
          </Section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
          <p className="fd-caption text-ink-muted">
            Snapshot {truncateHash(draw?.snapshotHash, 12, 6)} ·{" "}
            {status.frozen ? "participant set frozen" : "participant set still open"}
          </p>
          <Link href="/events" className="fd-body-sm font-semibold text-primary hover:underline">
            ← Back to all events
          </Link>
        </div>
      </div>
    </div>
  );
}

function outcomeStatusLabel(status) {
  return (
    {
      WAITING: "In the draw",
      SELECTED: "Selected",
      CONFIRMED: "Confirmed",
      WAITLISTED: "Waitlisted",
      NOT_SELECTED: "Not selected",
      EXPIRED: "Expired",
    }[status] || status
  );
}
