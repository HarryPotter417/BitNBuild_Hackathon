import Link from "next/link";
import { getUserEntries, getPlatformMetrics, getCurrentUser, listEvents } from "../../server/data.js";
import { eventStatus } from "../../lib/status";
import { formatCompact, formatNumber } from "../../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  StatCell,
  StatGrid,
} from "../../components/ui";
import { EventRow, RankChip, SeatChip } from "../../components/event-card";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All", states: null },
  { key: "open", label: "Open", states: ["OPEN"] },
  { key: "in-draw", label: "In draw", states: ["FROZEN", "DRAWING"] },
  { key: "claiming", label: "Claiming", states: ["CLAIMING"] },
  { key: "settled", label: "Settled", states: ["CLOSED", "SOLD_OUT"] },
];

const NEXT_STEP = {
  WAITING: { label: "View waiting room", href: (id) => `/me/waiting-room/${id}` },
  SELECTED: { label: "Claim your seat", href: (id) => `/me/claim/${id}` },
  EXPIRED: { label: "See what happened", href: (id) => `/me/claim/${id}` },
};

export default async function MyEntriesPage() {
  const [entries,metrics,allEvents,user] = await Promise.all([getUserEntries(),getPlatformMetrics(),listEvents(),getCurrentUser()]);

  const counts = entries.reduce((acc, { outcome }) => {
    acc[outcome.status] = (acc[outcome.status] || 0) + 1;
    return acc;
  }, {});

  const actionable = entries.filter((e) => NEXT_STEP[e.outcome.status]);

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
      <PageHeader
        eyebrow={user ? `Signed in as ${user.name}` : "Your Fair Drop account"}
        title="My entries"
        subtitle="Every event you have entered, and exactly where you stand. One account, one entry per event — no matter how many times you hit the button."
        actions={
          <>
            <Button href="/events" variant="secondary">
              Find more events
            </Button>
            <Button href="/me/history" variant="ghost">
              Allocation history
            </Button>
          </>
        }
      />

      <StatGrid columns={5} className="mb-8">
        <StatCell>
          <Stat label="Events entered" value={entries.length} sub={`of ${allEvents.length} on the platform`} />
        </StatCell>
        <StatCell>
          <Stat label="Confirmed" value={counts.CONFIRMED || 0} toneName="success" sub="seat in hand" />
        </StatCell>
        <StatCell>
          <Stat label="Claim pending" value={counts.SELECTED || 0} toneName="warning" sub="action needed" />
        </StatCell>
        <StatCell>
          <Stat label="Waitlisted" value={(counts.WAITLISTED || 0) + (counts.WAITING || 0)} toneName="info" sub="in the draw or queue" />
        </StatCell>
        <StatCell>
          <Stat label="Not selected" value={(counts.NOT_SELECTED || 0) + (counts.EXPIRED || 0)} sub="including lapsed claims" />
        </StatCell>
      </StatGrid>

      {actionable.length ? (
        <Card className="mb-8 border-warning-line bg-warning-soft/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="fd-card-title text-ink">Needs your attention</h2>
              <p className="fd-body-sm text-ink-secondary mt-1">
                {actionable.length === 1
                  ? "One entry is waiting on you."
                  : `${actionable.length} entries are waiting on you.`}{" "}
                Claim windows are time-boxed — an unclaimed seat is released to the waitlist.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionable.map(({ event, outcome }) => (
                <Button
                  key={event.id}
                  href={NEXT_STEP[outcome.status].href(event.id)}
                  size="sm"
                  variant={outcome.status === "SELECTED" ? "primary" : "secondary"}
                >
                  {event.title}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No entries yet"
            body="Once you enter an event it shows up here with live status — waiting room, claim window, confirmed seat or waitlist position."
            action={<Button href="/events">Browse events</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <span className="fd-eyebrow text-ink-muted">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="divide-y divide-line">
            {entries.map(({ event, outcome }) => {
              const status = eventStatus(event.state);
              const next = NEXT_STEP[outcome.status];
              return (
                <EventRow
                  key={event.id}
                  event={event}
                  outcome={outcome}
                  right={
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {outcome.seat ? <SeatChip seat={outcome.seat} /> : null}
                        {outcome.rank ? (
                          <RankChip
                            rank={outcome.rank}
                            label={outcome.waitlistRank ? "Queue" : "Rank"}
                          />
                        ) : null}
                        {outcome.waitlistRank ? (
                          <span className="fd-caption text-ink-muted">
                            waitlist #{formatNumber(outcome.waitlistRank)}
                          </span>
                        ) : null}
                        {!outcome.seat && !outcome.rank && outcome.status === "WAITING" ? (
                          <Badge toneName="info" size="sm">
                            in draw
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {next ? (
                          <Link
                            href={next.href(event.id)}
                            className="fd-caption font-semibold text-primary hover:underline"
                          >
                            {next.label} →
                          </Link>
                        ) : (
                          <Link
                            href={`/me/verify/${event.id}`}
                            className="fd-caption text-ink-muted hover:text-primary"
                          >
                            Verify draw
                          </Link>
                        )}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mt-8 p-5">
        <h2 className="fd-card-title text-ink">Your footprint across the platform</h2>
        <p className="fd-body-sm text-ink-muted mt-1.5 mb-4">
          These are platform-wide counters, shown for context.
        </p>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            ["Join attempts handled", formatCompact(metrics.joinAttempts)],
            ["Entries actually created", formatCompact(metrics.uniqueEntries)],
            ["Duplicate attempts absorbed", formatCompact(metrics.duplicateAttempts)],
          ].map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </div>
      </Card>
    </div>
  );
}
