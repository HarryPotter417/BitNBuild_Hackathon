"use client";

import { useEffect, useState } from "react";
import { claimSeatAction } from "../app/actions";
import { Button, Callout } from "./ui";
import { formatClock } from "../lib/format";

/**
 * Claim control with a live countdown.
 *
 * The idempotency key is generated once per page load and reused for every
 * attempt. Pressing "Confirm" twice therefore cannot allocate two seats — the
 * second press replays the first result. That is the whole point of the key, and
 * this component demonstrates it rather than describing it.
 */
export function ClaimControl({ eventId, seat, rank, claimExpiresAt, disabled, disabledReason }) {
  const [remaining, setRemaining] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(null);

  useEffect(() => {
    if (!claimExpiresAt) return undefined;
    const tick = () => setRemaining(Math.max(0, new Date(claimExpiresAt).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [claimExpiresAt]);

  const expired = remaining === null || remaining <= 0;

  const claim = async () => {
    const key = idempotencyKey ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem_${eventId}_${Math.random().toString(36).slice(2)}`);
    setIdempotencyKey(key);
    setPending(true);
    setAttempts((n) => n + 1);
    const response = await claimSeatAction(eventId, key);
    setResult(response);
    setPending(false);
  };

  if (result?.ok && result.allocation) {
    return (
      <div>
        <div className="rounded-xl bg-success-soft px-5 py-5 ring-1 ring-inset ring-success-line">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="fd-card-title text-ink">
                Seat {result.allocation.seat} is yours
              </p>
              <p className="fd-caption text-ink-muted">
                {result.replay
                  ? "Replayed the earlier result — same key, same seat, no double allocation."
                  : "Confirmed against live capacity, not a reserved placeholder."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-surface-muted px-4 py-3.5">
          <p className="fd-eyebrow text-ink-muted mb-2">Idempotency key used</p>
          <p className="fd-hash text-ink-secondary">{idempotencyKey}</p>
          <p className="fd-caption text-ink-muted mt-2">
            {attempts} {attempts === 1 ? "request" : "requests"} sent ·{" "}
            {result.replay ? "replay detected" : "first write"}. Press again — the seat will not
            change and no second allocation is created.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={claim} disabled={pending} variant="secondary" size="sm">
            {pending ? "Sending…" : "Send the same request again"}
          </Button>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <Callout toneName="neutral" title="Nothing to claim">
        {disabledReason}
      </Callout>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-warning-soft px-5 py-4 ring-1 ring-inset ring-warning-line">
        <div>
          <p className="fd-eyebrow text-warning">Claim window closes in</p>
          <p className="fd-metric text-warning mt-1.5" style={{ color: "var(--fd-warning)" }}>
            {remaining === null ? "—" : expired ? "00:00" : formatClock(remaining, { forceHours: true })}
          </p>
        </div>
        <div className="text-right">
          <p className="fd-eyebrow text-ink-muted">Seat held for you</p>
          <p className="fd-metric-sm text-ink mt-1.5 font-mono">{seat}</p>
          {rank ? <p className="fd-caption text-ink-muted mt-0.5">rank #{rank}</p> : null}
        </div>
      </div>

      <Button
        onClick={claim}
        disabled={pending || expired}
        size="lg"
        className="mt-5 w-full"
        variant={expired ? "secondary" : "primary"}
      >
        {pending ? "Confirming…" : expired ? "Claim window closed" : "Confirm my seat"}
      </Button>

      <p className="fd-caption text-ink-muted mt-3">
        One request carries a unique idempotency key. If the network drops and you press again, the
        server replays the original result instead of allocating a second seat.
      </p>

      {result && !result.ok ? (
        <Callout toneName="danger" title={`Request refused (${result.code})`} className="mt-4">
          {result.message}
        </Callout>
      ) : null}
    </div>
  );
}
