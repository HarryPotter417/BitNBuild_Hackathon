"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getWaitingRoomState } from "../app/actions";
import { DrawProgress } from "./draw-progress";
import { Button } from "./ui";
import { formatNumber } from "../lib/format";

/**
 * Live waiting room.
 *
 * Polls the server for the pipeline state rather than running a local timer, so
 * the moment the draw completes on the server this screen reflects it. Polling
 * stops as soon as there is nothing left to wait for.
 */
export function WaitingRoom({ eventId, initialOutcome, initialStages = [], initialRatio = null }) {
  const [outcome, setOutcome] = useState(initialOutcome);
  const [stages, setStages] = useState(initialStages);
  const [ratio, setRatio] = useState(initialRatio);
  const [running, setRunning] = useState(initialOutcome.status === "WAITING");
  const [lastPoll, setLastPoll] = useState(null);
  const [justLanded, setJustLanded] = useState(false);
  const settledRef = useRef(initialOutcome.status !== "WAITING");

  useEffect(() => {
    if (!running) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getWaitingRoomState(eventId);
        if (cancelled) return;
        setLastPoll(new Date());
        if (next.draw?.stages?.length) setStages(next.draw.stages);
        if (typeof next.draw?.ratio === "number") setRatio(next.draw.ratio);
        const wasWaiting = !settledRef.current;
        if (next.outcome.status !== "WAITING" && next.outcome.status !== "NONE") {
          settledRef.current = true;
          setRunning(false);
          setOutcome((prev) => ({ ...prev, ...next.outcome }));
          if (wasWaiting) setJustLanded(true);
          return;
        }
        setOutcome((prev) => ({ ...prev, ...next.outcome }));
      } catch {
        // A failed poll is not news about the draw; the next tick retries.
      }
    };

    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId, running]);

  const progress = { running, ratio: running ? ratio : 1, stages };

  if (justLanded) {
    return (
      <div className="py-6 text-center" role="status">
        <div
          className="mx-auto mb-5 grid size-16 place-items-center rounded-full animate-scale-in"
          style={{ background: "var(--fd-success-soft)" }}
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M8 16.5l5.5 5.5L24 11"
              stroke="var(--fd-success)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="fd-section-title text-ink">The draw just finished</h3>
        <p className="fd-body-sm text-ink-muted mt-2 max-w-sm mx-auto">
          Your result is in. Refreshing this page with the published values…
        </p>
        <Button href={`/me/waiting-room/${eventId}`} size="sm" className="mt-5">
          Load my result
        </Button>
      </div>
    );
  }

  if (outcome.status !== "WAITING") {
    return (
      <div>
        <div className="mb-5 rounded-xl bg-surface-sunken px-4 py-3.5">
          <p className="fd-eyebrow text-ink-muted">Result</p>
          <p className="fd-metric-sm text-ink mt-2">
            {outcome.seat ? outcome.seat : `#${formatNumber(outcome.rank)}`}
          </p>
          <p className="fd-caption text-ink-muted mt-1.5">
            {outcome.status === "SELECTED"
              ? "Claim your seat before the window closes."
              : outcome.status === "CONFIRMED"
                ? "Confirmed and done."
                : outcome.status === "WAITLISTED"
                  ? `Waitlist position #${formatNumber(outcome.waitlistRank)}.`
                  : outcome.status === "EXPIRED"
                    ? "The claim window closed without a claim."
                    : "Not selected this time."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {outcome.status === "SELECTED" ? (
            <Button href={`/me/claim/${eventId}`}>Claim seat {outcome.seat}</Button>
          ) : (
            <Button href={`/me/verify/${eventId}`} variant="secondary">
              Verify the draw
            </Button>
          )}
          <Button href="/me" variant="ghost">
            All my entries
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DrawProgress progress={progress} />

      <div className="mt-6 rounded-xl bg-primary-soft px-4 py-3.5 ring-1 ring-inset ring-primary-line">
        <p className="fd-body-sm text-ink">
          Your score is being computed along with everyone else&apos;s. Nothing you do now changes
          the outcome — the participant set is already frozen and hashed.
        </p>
      </div>

      <p className="fd-caption text-ink-muted mt-4 flex items-center gap-2">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        {lastPoll
          ? `Server state as of ${lastPoll.toLocaleTimeString("en-IN", { hour12: false })} · polling every 2s`
          : "Contacting the server…"}
      </p>
    </div>
  );
}
