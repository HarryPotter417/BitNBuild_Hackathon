import { notFound } from "next/navigation";
import Link from "next/link";
import { getOutcome, getDraw, getEvent, getVerification } from "../../../../server/data.js";
import { Badge, Breadcrumb, Button, Card, PageHeader } from "../../../../components/ui";
import { OutcomeBadge, RankChip, SeatChip } from "../../../../components/event-card";
import { EventArt } from "../../../../components/event-art";
import { WaitingRoom } from "../../../../components/waiting-room";
import { formatDateTime, formatNumber } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Waiting room Â· ${event.title}` : "Waiting room" };
}

export default async function WaitingRoomPage({ params }) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) notFound();

  const [outcome,draw,verification] = await Promise.all([getOutcome(id),getDraw(id),event.hasDraw?getVerification(id):null]);

  if (outcome.status === "NONE") {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-16 sm:px-7">
        <Card className="p-10 text-center">
          <h1 className="fd-page-title text-ink">You have no entry here</h1>
          <p className="fd-body text-ink-muted mt-3">
            The waiting room only appears once you have entered an event and its participant set has
            been frozen.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href={`/events/${event.id}`}>Back to {event.title}</Button>
            <Button href="/events" variant="secondary">
              Browse events
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const settled = outcome.status !== "WAITING";

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-12 sm:px-7">
      <Breadcrumb
        items={[
          { href: "/me", label: "My entries" },
          { href: `/events/${event.id}`, label: event.title },
          { label: "Waiting room" },
        ]}
      />

      <div className="mt-6">
        <EventArt event={event} className="mb-8 h-28" rounded="rounded-2xl" />
      </div>

      <PageHeader
        eyebrow={settled ? "Your result is in" : "Draw in progress"}
        title={settled ? `${outcomeLabel(outcome.status)}` : "Hang tight â€” the draw is running"}
        subtitle={
          settled
            ? `The draw for ${event.title} has finished. Here is exactly where you landed, and what you can do about it.`
            : `Your entry is locked in for ${event.title}. This page polls the live pipeline, so what you see is the real state of the draw â€” not a scripted animation.`
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <OutcomeBadge status={outcome.status} />
              {outcome.seat ? <SeatChip seat={outcome.seat} /> : null}
              {outcome.rank && outcome.status !== "WAITING" ? (
                <RankChip rank={outcome.rank} label={outcome.waitlistRank ? "Queue" : "Rank"} />
              ) : null}
            </div>
            {!settled ? <Badge toneName="primary" size="sm" dot>Polling</Badge> : null}
          </div>

          <div className="px-5 py-5">
            <WaitingRoom
              eventId={event.id}
              initialOutcome={outcome}
              initialStages={draw?.progress?.stages ?? []}
              initialRatio={draw?.progress?.ratio ?? null}
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="fd-card-title text-ink">Your entry</h2>
            <dl className="mt-4 space-y-3">
              {[
                ["Entry status", outcomeLabel(outcome.status)],
                ["Requests you sent", formatNumber(outcome.requestCount || 1)],
                ["Entries created", "1"],
                ["Rank", outcome.rank ? `#${formatNumber(outcome.rank)}` : "assigned when the draw lands"],
                [
                  "Participant set frozen",
                  event.entriesCloseAt ? formatDateTime(event.entriesCloseAt) : "â€”",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="fd-caption text-ink-muted">{label}</dt>
                  <dd className="fd-caption text-ink text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="fd-card-title text-ink">What happens next</h2>
            <ol className="mt-4 space-y-3.5">
              {[
                ["Ranking finishes", "HMAC-SHA256 is computed for every one of the frozen participants, and the set is sorted by score."],
                ["Seed is revealed", "SHA-256(seed) is checked against the commitment published before ranking began."],
                ["Winners get a claim window", "Selected people have a fixed window to claim. Unclaimed seats go to the waitlist in order."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.625rem] font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="fd-body-sm text-ink font-medium">{title}</p>
                    <p className="fd-caption text-ink-muted mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {verification?.verification.verified ? (
            <Card className="p-5">
              <h2 className="fd-card-title text-ink">Already verified</h2>
              <p className="fd-body-sm text-ink-muted mt-1.5">
                This draw has been independently re-run from its published values and matches. You
                do not have to take our word for the ranking.
              </p>
              <Button href={`/me/verify/${event.id}`} variant="secondary" size="sm" className="mt-4">
                Open the verifier
              </Button>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="fd-card-title text-ink">Nothing to do yet</h2>
              <p className="fd-body-sm text-ink-muted mt-1.5">
                You do not need to refresh or keep this tab open. Your entry is on the server, the
                ranking is deterministic, and the result will be waiting when you come back.
              </p>
              <Button href="/me" variant="ghost" size="sm" className="mt-3">
                â† All my entries
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function outcomeLabel(status) {
  return (
    {
      WAITING: "In the draw",
      SELECTED: "You got a seat",
      CONFIRMED: "Your seat is confirmed",
      WAITLISTED: "You are on the waitlist",
      NOT_SELECTED: "You were not selected",
      EXPIRED: "Your claim window lapsed",
    }[status] || status
  );
}
