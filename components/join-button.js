"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinEventAction } from "../app/actions";
import { eventStatus } from "../lib/status";

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
  const [requests, setRequests] = useState(outcome.requestCount || 0);
  const [hasEntry, setHasEntry] = useState(outcome.status !== "NONE");

  const status = eventStatus(event.state);

  if (!status.joinable) {
    if (hasEntry) {
      return (
        <div className="fd-body-sm text-ink-secondary flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 8.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          You have an entry · {requests || 1} request{requests === 1 ? "" : "s"} sent
        </div>
      );
    }
    return (
      <div className="fd-body-sm text-ink-muted">
        Entries are closed — this event is {status.label.toLowerCase()}.
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
      setRequests(result.entry?.requestCount || result.requestCount || 1);
      if (result.ok && !result.duplicate) setHasEntry(true);
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
          hasEntry
            ? "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-muted"
            : "bg-primary text-primary-contrast hover:bg-primary-hover"
        } disabled:opacity-60`}
      >
        {pending
          ? "Sending…"
          : hasEntry
            ? `Send another request (${requests})`
            : "Enter this event"}
      </button>

      {state ? (
        <p
          className={`fd-caption mt-2.5 max-w-sm ${state.duplicate ? "text-ink-muted" : "text-success"}`}
          role="status"
        >
          {state.message}
          {state.duplicate ? (
            <> Entry count is still 1.</>
          ) : (
            <> Entries: {event.participants.toLocaleString("en-IN")}.</>
          )}
        </p>
      ) : hasEntry ? (
        <p className="fd-caption text-ink-muted mt-2.5 max-w-sm">
          Keep pressing if you like. Only the first request created an entry — the rest were counted
          as duplicates.
        </p>
      ) : (
        <p className="fd-caption text-ink-muted mt-2.5 max-w-sm">
          One entry per verified account. {event.joinRequests.toLocaleString("en-IN")} join requests
          have already been handled for this event.
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
