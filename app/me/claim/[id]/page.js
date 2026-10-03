import { notFound } from "next/navigation";
import {
  claimWindow,
  getOutcome,
  getAllocationFor,
  getEvent,
  getFairness,
  getVerification,
} from "../../../../server/data.js";
import { Badge, Breadcrumb, Button, Callout, Card, Hash, KeyValue, PageHeader } from "../../../../components/ui";
import { OutcomeBadge, RankChip, SeatChip } from "../../../../components/event-card";
import { EventArt } from "../../../../components/event-art";
import { ClaimControl } from "../../../../components/claim-control";
import { formatCompact, formatDateTime, formatNumber } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Claim · ${event.title}` : "Claim seat" };
}

export default async function ClaimPage({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [outcome,allocation,window,verification,fairness] = await Promise.all([
    getOutcome(id),getAllocationFor(id),claimWindow(id),event.hasDraw?getVerification(id):null,event.hasDraw?getFairness(id):null,
  ]);

  const claimable = outcome.status === "SELECTED";
  let disabledReason =
    "This allocation is not in a claimable state right now. Open the event page for the current status.";
  if (outcome.status === "CONFIRMED") disabledReason = "You have already confirmed this seat.";
  else if (outcome.status === "EXPIRED")
    disabledReason =
      "Your claim window closed before you confirmed. The seat was released to the waitlist — your entry and rank are still on the record.";
  else if (outcome.status === "NOT_SELECTED")
    disabledReason = "You were not selected for this event, so there is no seat to claim.";
  else if (outcome.status === "WAITLISTED")
    disabledReason = `You are number ${formatNumber(outcome.waitlistRank)} on the waitlist. If a selected person lets their claim lapse, the seat is offered to you in order — there is nothing to claim yet.`;
  else if (outcome.status === "WAITING")
    disabledReason = "The draw has not finished yet. Open the waiting room to watch it.";
  else if (!window && outcome.status !== "NONE")
    disabledReason = `Claims are not open — this event is ${event.status.label.toLowerCase()}.`;

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-12 sm:px-7">
      <Breadcrumb
        items={[
          { href: "/me", label: "My entries" },
          { href: `/events/${event.id}`, label: event.title },
          { label: "Claim" },
        ]}
      />

      <div className="mt-6">
        <EventArt event={event} className="mb-8 h-24" rounded="rounded-2xl" />
      </div>

      <PageHeader
        eyebrow="Seat allocation"
        title={claimable ? "You have a seat. Claim it." : "Your allocation"}
        subtitle={
          claimable
            ? "This seat is held for you until the window closes. Confirming allocates it against live capacity — it is not a reservation that could oversell the room."
            : `Here is the current state of your allocation for ${event.title}.`
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <OutcomeBadge status={outcome.status} />
              {outcome.seat ? <SeatChip seat={outcome.seat} /> : null}
              {outcome.rank ? <RankChip rank={outcome.rank} /> : null}
            </div>
            {window ? (
              <Badge toneName="warning" size="sm" dot>
                Window open
              </Badge>
            ) : null}
          </div>

          <div className="px-5 py-5">
            <ClaimControl
              eventId={event.id}
              seat={outcome.seat}
              rank={outcome.rank}
              claimExpiresAt={claimable ? window?.expiresAt : null}
              disabled={!claimable}
              disabledReason={disabledReason}
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="fd-card-title text-ink">Allocation detail</h2>
            <div className="mt-4">
              <KeyValue
                columns={1}
                items={[
                  ["Seat", allocation?.seat || "—"],
                  ["Rank", allocation?.rank ? `#${formatNumber(allocation.rank)}` : "—"],
                  ["Status", allocation?.status || outcome.status],
                  ["Confirmed at", allocation?.confirmedAt ? formatDateTime(allocation.confirmedAt) : "not confirmed"],
                  ["Promoted from waitlist", allocation?.promoted ? "Yes" : "No"],
                  ["Idempotency key", allocation?.idempotencyKey || "not used yet"],
                ]}
              />
            </div>
          </Card>

          {window ? (
            <Card className="p-5">
              <h2 className="fd-card-title text-ink">Claim window</h2>
              <div className="mt-4">
                <KeyValue
                  columns={1}
                  items={[
                    ["Opened", formatDateTime(window.startedAt)],
                    ["Expires", formatDateTime(window.expiresAt)],
                    ["Length", `${window.windowMinutes} minutes`],
                  ]}
                />
              </div>
              <p className="fd-caption text-ink-muted mt-4 border-t border-line pt-3.5">
                Seats not claimed before expiry are back-filled from the waitlist in rank order. No
                seat is ever silently dropped, and confirmed count never exceeds capacity.
              </p>
            </Card>
          ) : null}

          {verification?.verification.verified ? (
            <Card className="p-5">
              <h2 className="fd-card-title text-ink">The draw behind this seat</h2>
              <p className="fd-body-sm text-ink-muted mt-1.5 mb-4">
                Your seat came out of a ranking anyone can re-run.
              </p>
              <dl className="space-y-3">
                {[
                  ["Snapshot hash", verification.snapshotHash],
                  ["Commitment", verification.commitmentHash],
                  ["Revealed seed", verification.revealedSeed],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="fd-caption text-ink-muted">{label}</dt>
                    <dd className="mt-0.5">
                      <Hash value={value} head={18} tail={6} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Button href={`/me/verify/${event.id}`} variant="secondary" size="sm" className="mt-4">
                Verify it yourself
              </Button>
            </Card>
          ) : null}

          {fairness ? (
            <Card className="p-5">
              <h2 className="fd-card-title text-ink">Capacity headroom</h2>
              <p className="fd-body-sm text-ink-muted mt-1.5">
                {formatNumber(event.confirmed)} of {formatNumber(event.capacity)} seats confirmed ·{" "}
                {formatCompact(event.offered - event.confirmed)} offered and awaiting a claim ·{" "}
                {formatNumber(event.expiredClaims)} lapsed and released.
              </p>
              {event.expiredClaims > 0 ? (
                <Callout toneName="info" className="mt-4">
                  Lapsed claims do not reduce the published capacity. They are back-filled from the
                  waitlist, which is why this event can show both confirmed seats and expired claims.
                </Callout>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
