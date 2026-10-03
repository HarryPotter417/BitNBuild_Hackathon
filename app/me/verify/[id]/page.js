import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, getVerification, listEvents } from "../../../../server/data.js";
import { Badge, Breadcrumb, Button, Callout, Card, Hash, KeyValue, PageHeader } from "../../../../components/ui";
import { EventArt } from "../../../../components/event-art";
import { formatDateTime, formatNumber, formatRelative } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Verify · ${event.title}` : "Verify a draw" };
}

export default async function VerifyPage({ params }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  if (!event.hasDraw) {
    const drawn = (await listEvents()).filter((e) => e.hasDraw);
    return (
      <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-7">
        <PageHeader
          eyebrow="Verification"
          title="Nothing to verify yet"
          subtitle={`${event.title} has not run its draw, so there is no published snapshot to check.`}
        />
        <Card className="p-5">
          <h2 className="fd-card-title text-ink">Pick a drawn event</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {drawn.map((e) => (
              <Link
                key={e.id}
                href={`/me/verify/${e.id}`}
                className="fd-card flex items-center gap-3 p-3 transition-all hover:shadow-fd-md hover:border-line-strong"
              >
                <EventArt event={e} rounded="rounded-lg" className="size-11 shrink-0" />
                <div className="min-w-0">
                  <p className="fd-body-sm text-ink font-medium truncate">{e.title}</p>
                  <p className="fd-caption text-ink-muted">
                    {formatNumber(e.participants)} participants · {e.status.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const verification = await getVerification(id);
  const v = verification.verification;
  const revealed = Boolean(verification.revealedSeed);
  const picker = await drawnPicker(event.id);

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-12 sm:px-7">
      <Breadcrumb
        items={[
          { href: "/me", label: "My entries" },
          { href: `/events/${event.id}`, label: event.title },
          { label: "Verify" },
        ]}
      />

      <div className="mt-6">
        <EventArt event={event} className="mb-8 h-24" rounded="rounded-2xl" />
      </div>

      <PageHeader
        eyebrow="Independent verification"
        title={revealed ? (v.verified ? "The draw checks out" : "The draw does not check out") : "Waiting for the seed"}
        subtitle={
          revealed
            ? `The ranking for ${event.title} was re-computed from the published values below and matches the published selection exactly.`
            : "The organiser published a commitment to the seed but has not revealed the seed yet. Until they do, the winners cannot be checked — and that is itself the honest state to show."
        }
        actions={
          <>
            {picker}
            <Button href={`/events/${event.id}`} variant="secondary">
              Event page
            </Button>
          </>
        }
      />

      {!revealed ? (
        <Callout toneName="warning" title="Seed not revealed" className="mb-6">
          <span className="fd-hash text-ink">{verification.commitmentHash}</span> is published. The
          ranking can be computed, but nobody — including you — can confirm it corresponds to the
          winner list until the seed itself is released. A commitment with no reveal proves nothing.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div
              className="flex items-center justify-between gap-3 border-b px-5 py-4"
              style={{
                borderColor: "var(--fd-border)",
                background: v.verified
                  ? "var(--fd-success-soft)"
                  : revealed
                    ? "var(--fd-danger-soft)"
                    : "var(--fd-surface-muted)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid size-8 place-items-center rounded-full"
                  style={{
                    background: v.verified
                      ? "var(--fd-success)"
                      : revealed
                        ? "var(--fd-danger)"
                        : "var(--fd-text-muted)",
                  }}
                >
                  {v.verified ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="fd-card-title text-ink">
                    {v.verified ? "VERIFIED" : revealed ? "FAILED" : "PENDING"}
                  </p>
                  <p className="fd-caption text-ink-muted">
                    {v.verified
                      ? "All checks passed against published values"
                      : revealed
                        ? "At least one check did not reproduce"
                        : "Cannot verify until the seed is revealed"}
                  </p>
                </div>
              </div>
              {verification.selectedCount ? (
                <Badge toneName="neutral" size="sm">
                  {formatNumber(v.recomputedSelectedCount)} re-selected
                </Badge>
              ) : null}
            </div>

            <ul className="divide-y divide-line">
              {v.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-3.5 px-5 py-4">
                  <span
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold"
                    style={{
                      background:
                        check.state === "pass"
                          ? "var(--fd-success-soft)"
                          : check.state === "fail"
                            ? "var(--fd-danger-soft)"
                            : "var(--fd-surface-sunken)",
                      color:
                        check.state === "pass"
                          ? "var(--fd-success)"
                          : check.state === "fail"
                            ? "var(--fd-danger)"
                            : "var(--fd-text-muted)",
                    }}
                  >
                    {check.state === "pass" ? "✓" : check.state === "fail" ? "✕" : "…"}
                  </span>
                  <div className="min-w-0 flex-w-1">
                    <p className="fd-body-sm text-ink font-medium">{check.label}</p>
                    <p className="fd-caption text-ink-muted mt-0.5">{check.detail}</p>
                  </div>
                  <span
                    className="fd-eyebrow shrink-0 pt-1"
                    style={{
                      color:
                        check.state === "pass"
                          ? "var(--fd-success)"
                          : check.state === "fail"
                            ? "var(--fd-danger)"
                            : "var(--fd-text-muted)",
                    }}
                  >
                    {check.state}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="fd-card-title text-ink">Published values</h2>
            <p className="fd-body-sm text-ink-muted mt-1.5 mb-5">
              These four values are the entire draw. Everything above was recomputed from them.
            </p>
            <dl className="space-y-4">
              {[
                ["Participant set hash", verification.snapshotHash, "SHA-256 over the sorted, frozen participant list"],
                ["Commitment", verification.commitmentHash, "SHA-256 of the seed, published before any ranking ran"],
                [
                  "Revealed seed",
                  verification.revealedSeed,
                  revealed ? "Released after the ranking finished" : "Not released yet",
                ],
              ].map(([label, value, hint]) => (
                <div key={label}>
                  <dt className="fd-caption text-ink-muted">{label}</dt>
                  <dd className="mt-1 rounded-lg bg-surface-sunken px-3 py-2">
                    <Hash value={value} head={40} tail={12} className="text-ink" />
                  </dd>
                  <dd className="fd-caption text-ink-muted mt-1">{hint}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 border-t border-line pt-5">
              <KeyValue
                columns={2}
                items={[
                  ["Algorithm", verification.algorithm],
                  ["Version", `v${verification.version}`],
                  ["Participants", formatNumber(verification.participantCount)],
                  ["Capacity", formatNumber(verification.capacity)],
                  ["Commitment published", formatRelative(verification.publishedAt)],
                  ["Seed revealed", verification.revealedAt ? formatRelative(verification.revealedAt) : "not yet"],
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="fd-card-title text-ink">Your result</h2>
            <div className="mt-4 rounded-xl bg-surface-sunken px-4 py-4">
              <p className="fd-eyebrow text-ink-muted">Entry identifier</p>
              <p className="fd-hash text-ink mt-1">{verification.user.id}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="fd-caption text-ink-muted">Rank</p>
                  <p className="fd-metric-sm text-ink mt-1">
                    {verification.user.rank ? `#${formatNumber(verification.user.rank)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="fd-caption text-ink-muted">Outcome</p>
                  <p className="mt-1">
                    <Badge toneName={verification.user.selected ? "success" : "neutral"} size="sm">
                      {verification.user.selected ? "Selected" : "Not selected"}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-3.5">
                <p className="fd-caption text-ink-muted">HMAC score</p>
                <p className="fd-hash text-ink-secondary mt-0.5">
                  {verification.user.score ?? "—"}
                </p>
              </div>
            </div>
            <p className="fd-caption text-ink-muted mt-3.5">
              Lower scores rank first. Recomputing HMAC-SHA256(seed, snapshotHash + identifier) should
              reproduce this exact value.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="fd-card-title text-ink">Top of the winner list</h2>
            <p className="fd-caption text-ink-muted mt-1 mb-3.5">
              Reproduced from the seed above, not read from the selection.
            </p>
            <ol className="space-y-1.5">
              {verification.publishedSample.map((row) => (
                <li key={row.rank} className="flex items-baseline gap-3">
                  <span className="fd-caption text-ink-muted w-6 shrink-0 fd-tabular">
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span className="fd-hash text-ink-secondary flex-1 truncate">{row.id}</span>
                  {row.id === verification.user.id ? (
                    <Badge toneName="primary" size="sm">
                      you
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="fd-card-title text-ink">What this does not prove</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                "That the participant set was fair to begin with — only that it has not changed since it was frozen.",
                "That the seed was random — only that it was committed to before the ranking ran.",
                "That capacity matched the room — that is an organiser responsibility, checked separately.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-muted" aria-hidden="true" />
                  <span className="fd-caption text-ink-muted">{item}</span>
                </li>
              ))}
            </ul>
            <p className="fd-caption text-ink mt-4 border-t border-line pt-3.5">
              Commitment published {formatDateTime(verification.publishedAt)}.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function drawnPicker(currentId) {
  const drawn = (await listEvents()).filter((e) => e.hasDraw && e.id !== currentId).slice(0, 1);
  if (!drawn.length) return null;
  return (
    <Button href={`/me/verify/${drawn[0].id}`} variant="ghost">
      Check another draw
    </Button>
  );
}
