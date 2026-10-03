import Link from "next/link";
import { cn } from "../lib/cn";
import { formatCompact, formatDate, formatNumber } from "../lib/format";
import { entryStatus, eventStatus } from "../lib/status";
import { Badge, Meter } from "./ui";
import { EventArt } from "./event-art";

/** Small square seat/position chip used on cards and tables. */
export function RankChip({ rank, label = "Rank" }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md bg-surface-sunken px-2 py-1">
      <span className="fd-eyebrow text-ink-muted">{label}</span>
      <span className="fd-caption text-ink font-semibold fd-tabular">#{formatNumber(rank)}</span>
    </span>
  );
}

export function SeatChip({ seat }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 ring-1 ring-inset ring-success-line">
      <span className="fd-eyebrow text-success">Seat</span>
      <span className="font-mono text-[0.8125rem] font-bold text-success tracking-tight">{seat}</span>
    </span>
  );
}

export function OutcomeBadge({ status, className }) {
  const s = entryStatus(status);
  return (
    <Badge toneName={s.tone} dot className={className}>
      {s.label}
    </Badge>
  );
}

/**
 * Catalog card. `outcome` is the signed-in account's state for this event and is
 * only rendered when supplied — the catalog is public, the outcome is not.
 */
export function EventCard({ event, outcome, href, compact = false }) {
  const status = eventStatus(event.state);
  const url = href || `/events/${event.id}`;
  const demand = event.capacity > 0 ? (event.participants / event.capacity) * 100 : 0;

  return (
    <Link
      href={url}
      className="group fd-card overflow-hidden transition-all duration-200 hover:shadow-fd-md hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <EventArt event={event} className={compact ? "h-24" : "h-32"} />

      <div className="p-4.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <Badge toneName={status.tone} dot size="sm">
            {status.label}
          </Badge>
          {outcome && outcome.status !== "NONE" ? (
            <OutcomeBadge status={outcome.status} size="sm" />
          ) : null}
        </div>

        <h3 className="fd-card-title text-ink transition-colors group-hover:text-primary">{event.title}</h3>

        {!compact ? (
          <p className="fd-caption text-ink-muted mt-1.5 line-clamp-2">{event.tagline}</p>
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 fd-caption text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5v11M7 1.5C5 1.5 2 3.4 2 6.2c0 3.4 5 6.3 5 6.3s5-2.9 5-6.3C12 3.4 9 1.5 7 1.5Z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {event.city}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 1.5v3M10 1.5v3M1.5 6.5h11" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {formatDate(event.startsAt, { year: undefined })}
          </span>
        </div>

        <div className="mt-4 border-t border-line pt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="fd-caption text-ink-muted">
              {formatCompact(event.participants)} entries · {formatNumber(event.capacity)} seats
            </span>
            {status.joinable ? (
              <span className="fd-caption text-primary font-semibold">Open →</span>
            ) : (
              <span className="fd-caption text-ink-muted fd-tabular">
                {demand >= 100 ? `${formatCompact(demand)}× demand` : `${Math.round(demand)}% full`}
              </span>
            )}
          </div>
          <Meter value={event.participants} max={event.capacity} className="mt-2" />
        </div>
      </div>
    </Link>
  );
}

/** Wide row used in dashboards and "your entries" lists. */
export function EventRow({ event, outcome, right, className }) {
  const status = eventStatus(event.state);
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3.5", className)}>
      <EventArt event={event} rounded="rounded-lg" className="hidden size-14 shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/${event.id}`}
            className="fd-card-title text-ink truncate hover:text-primary transition-colors"
          >
            {event.title}
          </Link>
          <Badge toneName={status.tone} size="sm" dot>
            {status.label}
          </Badge>
          {outcome && outcome.status !== "NONE" ? (
            <OutcomeBadge status={outcome.status} size="sm" />
          ) : null}
        </div>
        <p className="fd-caption text-ink-muted mt-1">
          {event.city} · {formatDate(event.startsAt)} · {formatCompact(event.participants)} entries ·{" "}
          {formatNumber(event.capacity)} seats
        </p>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}
