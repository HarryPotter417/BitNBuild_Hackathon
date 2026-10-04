"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinEventAction } from "../app/actions";
import { eventStatus } from "../lib/status";
import { Button } from "./ui";

/**
 * Join / already-entered control.
 *
 * Pressing this repeatedly is the point of the demo: the first press creates
 * one entry, every later press is counted as a duplicate and changes nothing.
 */
export function JoinButton({ event, outcome }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(null);
  const [hasEntry, setHasEntry] = useState(outcome.status !== "NONE");

  const status = eventStatus(event.state);

  if (!status.joinable) {
    if (hasEntry) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p className="fd-body-sm text-ink-secondary flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 8.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Your draw entry is recorded
          </p>
          <Button
            href={outcome.status === "WAITING" ? `/me/waiting-room/${event.id}` : "/me"}
            variant="secondary"
            size="sm"
          >
            {outcome.status === "WAITING" ? "View draw status" : "View my entries"}
          </Button>
        </div>
      );
    }
    if (event.state === "SCHEDULED") {
      return (
        <div className="max-w-xl rounded-xl border border-info-line bg-info-soft p-4">
          <p className="fd-body-sm font-semibold text-ink">Entry has not opened yet</p>
          <p className="fd-caption mt-1.5 text-ink-secondary">
            The organiser must open the event before you can enter. Fair Drop assigns seats by a
            verifiable draw; attendees cannot reserve or choose a specific seat.
          </p>
        </div>
      );
    }
    return (
      <div className="max-w-xl">
        <p className="fd-body-sm text-ink-muted">
          Entries are closed — this event is {status.label.toLowerCase()}.
        </p>
        <p className="fd-caption mt-1.5 text-ink-muted">
          Seats are assigned by the draw, not booked individually.
        </p>
      </div>
    );
  }

  if (hasEntry) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="fd-body-sm text-ink-secondary flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 8.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            You&apos;re in the draw · one entry recorded
          </p>
          <p className="fd-caption mt-1.5 text-ink-muted">
            If selected, you&apos;ll receive an assigned seat to claim before the deadline. Seats can&apos;t be chosen manually.
          </p>
        </div>
        <Button href={`/me/waiting-room/${event.id}`} variant="secondary" size="sm">
          View draw status
        </Button>
      </div>
    );
  }

  const press = () => {
    startTransition(async () => {
      let result;
      if (event.backendMode === "postgres") {
        try {
          const challengeResponse = await fetch("/api/security/challenge", { method: "POST" });
          const challenge = await challengeResponse.json();
          if (!challengeResponse.ok) throw new Error(challenge.error || "Sign in is required to enter.");
          const solution = await solveProofOfWork(challenge.token, challenge.difficultyBits);
          const response = await fetch(`/api/events/${event.id}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge: challenge.token, solution }),
          });
          result = await response.json();
          if (!response.ok) result = { ...result, ok: false, code: response.status };
        } catch (error) {
          result = { ok: false, code: 503, message: error.message || "Entry service is unavailable." };
        }
      } else {
        result = await joinEventAction(event.id);
      }
      setState(result?.error ? { ...result,message:result.error } : result);
      if (result.ok) setHasEntry(true);
      router.refresh();
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={press}
        disabled={pending}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[0.9375rem] font-semibold shadow-fd-sm transition-all ${
          "bg-primary text-primary-contrast hover:bg-primary-hover"
        } disabled:opacity-60`}
      >
        {pending
          ? "Sending…"
          : "Enter the fair draw"}
      </button>

      {state ? (
        <p
          className={`fd-caption mt-2.5 max-w-sm ${state.ok ? "text-success" : "text-danger"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : (
        <p className="fd-caption text-ink-muted mt-2.5 max-w-sm">
          One entry per verified account. A verifiable draw assigns seats after entries close; you cannot select or reserve a seat now.
        </p>
      )}
    </div>
  );
}

async function solveProofOfWork(token, difficultyBits) {
  const nonce = token.split(".")[0];
  for (let counter = 0; ; counter += 1) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${nonce}:${counter}`)));
    let bits = 0;
    for (const byte of digest) {
      if (byte === 0) bits += 8;
      else { bits += Math.clz32(byte) - 24; break; }
    }
    if (bits >= difficultyBits) return String(counter);
    if (counter > 0 && counter % 512 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
