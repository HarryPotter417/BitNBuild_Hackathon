import Link from "next/link";
import { getUserHistory, listEvents } from "../../../server/data.js";
import { Badge, Button, Card, EmptyState, PageHeader, Stat, StatGrid, Table } from "../../../components/ui";
import { OutcomeBadge, RankChip, SeatChip } from "../../../components/event-card";
import { formatDate, formatDateTime, formatNumber } from "../../../lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Allocation history" };

export default async function HistoryPage() {
  const [history,allEvents] = await Promise.all([getUserHistory(),listEvents()]);
  const eventById=Object.fromEntries(allEvents.map((event)=>[event.id,event]));

  const confirmed = history.filter((h) => h.status === "CONFIRMED");
  const waiting = history.filter((h) => h.status === "SELECTED" || h.status === "WAITING");
  const missed = history.filter((h) =>
    ["NOT_SELECTED", "WAITLISTED", "EXPIRED"].includes(h.status)
  );
  const rate = history.length ? (confirmed.length / history.length) * 100 : 0;

  const rows = history.map((h) => ({
    event: (
      <div className="min-w-0">
      <Link href={`/events/${h.eventId}`} className="fd-body-sm text-ink font-medium hover:text-primary">
        {h.title}
      </Link>
      <p className="fd-caption text-ink-muted">
        {h.city} · {formatDate(h.date)}
      </p>
      </div>
    ),
    outcome: <OutcomeBadge status={h.status} />,
    position: h.seat ? (
      <SeatChip seat={h.seat} />
    ) : h.rank ? (
      <RankChip rank={h.rank} label={h.waitlistRank ? "Queue" : "Rank"} />
    ) : (
      <span className="fd-caption text-ink-muted">—</span>
    ),
    confirmed: (
      <span className="fd-caption text-ink-muted">
        {h.confirmedAt ? formatDateTime(h.confirmedAt) : "—"}
      </span>
    ),
    action: (
      <Link
      href={
        h.status === "WAITING"
          ? `/me/waiting-room/${h.eventId}`
          : h.status === "SELECTED"
            ? `/me/claim/${h.eventId}`
            : eventById[h.eventId]?.hasDraw
              ? `/me/verify/${h.eventId}`
              : `/events/${h.eventId}`
      }
      className="fd-caption text-primary font-semibold hover:underline"
      >
        {h.status === "WAITING"
          ? "Watch"
          : h.status === "SELECTED"
            ? "Claim"
          : eventById[h.eventId]?.hasDraw
              ? "Verify"
              : "Details"}
      </Link>
    ),
  }));

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-12 sm:px-7">
      <PageHeader
        eyebrow="Your record"
        title="Allocation history"
        subtitle="Every entry you have made, with the outcome that actually happened. Nothing here is re-rolled: a loss is recorded as a loss."
        actions={
          <Button href="/events" variant="secondary">
            Find another event
          </Button>
        }
      />

      <StatGrid className="mb-6">
        <Stat label="Entries" value={formatNumber(history.length)} sub="lifetime" />
        <Stat label="Confirmed" value={formatNumber(confirmed.length)} toneName="success" sub="seats held" />
        <Stat label="In play" value={formatNumber(waiting.length)} toneName="primary" sub="awaiting outcome" />
        <Stat label="Conversion" value={`${rate.toFixed(0)}%`} toneName="neutral" sub="confirmed / entries" />
      </StatGrid>

      {missed.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="fd-caption text-ink-muted">
            Not selected in {formatNumber(missed.length)}:
          </span>
          {missed.map((h) => (
            <Link key={h.eventId} href={`/events/${h.eventId}`}>
              <Badge toneName="neutral" size="sm" className="hover:bg-surface-muted">
                {h.title}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}

      <Card>
        {history.length ? (
          <Table
            columns={[
              { key: "event", header: "Event" },
              { key: "outcome", header: "Outcome" },
              { key: "position", header: "Position" },
              { key: "confirmed", header: "Confirmed" },
              { key: "action", header: "" },
            ]}
            rows={rows}
          />
        ) : (
          <EmptyState
            title="No entries yet"
            body="Once you enter an event it shows up here with its result, whether that result is a seat or not."
            action={
              <Button href="/events" size="sm">
                Browse events
              </Button>
            }
          />
        )}
      </Card>

      <p className="fd-caption text-ink-muted mt-5 max-w-2xl">
        A fair draw produces losses. If your conversion rate ever looks suspiciously perfect, the
        ranking is probably broken in your favour — check the verifier before you trust it.
      </p>
    </div>
  );
}
