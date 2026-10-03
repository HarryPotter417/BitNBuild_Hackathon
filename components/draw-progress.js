"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

const STATUS_STYLE = {
  done: { ring: "border-success bg-success text-white", text: "text-success", label: "Done" },
  active: { ring: "border-primary bg-primary text-primary-contrast", text: "text-primary", label: "Running" },
  pending: { ring: "border-line bg-surface text-ink-muted", text: "text-ink-muted", label: "Pending" },
};

const STATUS_ICON = {
  done: "M3.5 8.2l3 3 6-6.4",
  pending: "M6 3.4v5.2M6 11.6v.2",
  active: null,
};

/**
 * The five draw stages.
 *
 * When the pipeline is not running, every stage is reported done — a finished
 * draw is not re-animated, because pretending work is in progress would be a
 * lie about the state of the system.
 */
export function DrawProgress({ progress, className, compact = false }) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!progress?.running) return undefined;
    const timer = setInterval(() => force((n) => n + 1), 400);
    return () => clearInterval(timer);
  }, [progress?.running]);

  if (!progress) return null;

  const stages = progress.stages || [];
  const ratio = typeof progress.ratio === "number" ? Math.round(progress.ratio * 100) : null;

  return (
    <div className={className}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "relative inline-flex size-2",
              progress.running ? "animate-pulse" : ""
            )}
            aria-hidden="true"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                progress.running ? "bg-primary" : "bg-success"
              )}
            />
          </span>
          <span className={cn("fd-eyebrow", progress.running ? "text-primary" : "text-success")}>
            {progress.running ? "Draw in progress" : "Draw complete"}
          </span>
        </div>
        <span className="fd-caption text-ink-muted fd-tabular">{ratio === null ? "Status only" : `${ratio}%`}</span>
      </div>

      <ol className="space-y-0">
        {stages.map((stage, i) => {
          const style = STATUS_STYLE[stage.status] || STATUS_STYLE.pending;
          const last = i === stages.length - 1;
          return (
            <li key={stage.id} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[0.625rem] font-bold transition-colors",
                    style.ring
                  )}
                >
                  {STATUS_ICON[stage.status] ? (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d={STATUS_ICON[stage.status]}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                {!last ? (
                  <span
                    className={cn(
                      "w-px flex-1 transition-colors",
                      stage.status === "done" ? "bg-success-line" : "bg-line"
                    )}
                    style={{ minHeight: compact ? 14 : 22 }}
                  />
                ) : null}
              </div>

              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "text-[0.8125rem] font-semibold",
                      stage.status === "pending" ? "text-ink-muted" : "text-ink"
                    )}
                  >
                    {stage.label}
                  </p>
                  <span className={cn("fd-caption shrink-0", style.text)}>{style.label}</span>
                </div>
                {!compact ? (
                  <p className="fd-caption text-ink-muted mt-0.5">{stage.hint}</p>
                ) : null}
                {stage.status === "active" ? (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${Math.round((stage.within || 0) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
