"use client";

import { useState } from "react";
import { Badge, Button, Card } from "./ui.js";

const scenarios = [
  { id: "normal-crowd", title: "Flash crowd", type: "join", description: "Ramp verified people into an open event." },
  { id: "single-user-spam", title: "Single-account spam", type: "join", description: "Repeat one account and verify retries never multiply entries." },
  { id: "bot-flood", title: "Anonymous bot flood", type: "none", description: "Send unauthenticated challenge requests and inspect safe rejections." },
  { id: "duplicate-join", title: "Duplicate joins", type: "join", description: "Repeat joins from multiple accounts to test entry uniqueness." },
  { id: "retry-storm", title: "Retry storm", type: "join", description: "Increase arrival rate and watch throttling, errors, and latency." },
  { id: "claim-race", title: "Claim race", type: "claim", description: "Race real selected users for their offered seats." },
  { id: "health", title: "API health", type: "none", description: "Measure health endpoint availability under concurrent traffic." },
];

const durations = ["30s", "60s", "2m", "5m"];

function makeCommand({ scenario, eventId, baseUrl, vus, duration, shell }) {
  const values = [
    ["FAIRDROP_BASE_URL", baseUrl],
    ["FAIRDROP_SCENARIO", scenario.id],
    ["FAIRDROP_VUS", vus],
    ["FAIRDROP_DURATION", duration],
  ];
  if (scenario.type !== "none") values.push(["FAIRDROP_EVENT_ID", eventId]);
  if (scenario.type !== "none") values.push(["FAIRDROP_SESSION_COOKIES", "<verified-session-cookie-1>,<verified-session-cookie-2>"]);

  if (shell === "powershell") {
    return `${values.map(([key, value]) => `$env:${key}='${String(value).replaceAll("'", "''")}'`).join("; ")}; npm run load:k6`;
  }

  return `${values.map(([key, value]) => `export ${key}='${String(value).replaceAll("'", "'\\''")}'`).join("\n")}\nnpm run load:k6`;
}

export function AdversarialLoadBuilder({ openEvents, claimingEvents }) {
  const [scenarioId, setScenarioId] = useState("normal-crowd");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [vus, setVus] = useState("20");
  const [duration, setDuration] = useState("60s");
  const [shell, setShell] = useState("powershell");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0];
  const events = scenario.type === "claim" ? claimingEvents : openEvents;
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || "");
  const selectedEvent = events.find((event) => event.id === selectedEventId) || events[0];
  const eventId = selectedEvent?.id || "";
  const command = makeCommand({ scenario, eventId, baseUrl, vus, duration, shell });
  const requiresAccounts = scenario.type !== "none";
  const validTarget = /^https?:\/\/[^/\s]+(?:\/\S*)?$/.test(baseUrl);
  const validVus = Number.isInteger(Number(vus)) && Number(vus) >= 1 && Number(vus) <= 5000;
  const canCopy = validTarget && validVus && (!requiresAccounts || (events.length > 0 && Boolean(eventId)));

  function updateInput(update) {
    update();
    setCopied(false);
    setCopyError("");
  }

  function selectScenario(id) {
    const nextScenario = scenarios.find((item) => item.id === id);
    setScenarioId(id);
    setSelectedEventId((nextScenario.type === "claim" ? claimingEvents : openEvents)[0]?.id || "");
    setCopied(false);
    setCopyError("");
  }

  async function copyCommand() {
    try {
      if (!canCopy) return;
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyError("");
    } catch (error) {
      console.error("Could not copy the load-test command", error);
      setCopied(false);
      setCopyError("Clipboard access was denied. Select and copy the command manually.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="fd-card-title">Configure a workload</h2>
            <p className="fd-caption mt-1 text-ink-muted">Choose a real API scenario, then copy a ready-to-run command.</p>
          </div>
          <Badge toneName="info" dot>Live test · your infrastructure</Badge>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Load test scenario">
          {scenarios.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={scenario.id === item.id}
              onClick={() => selectScenario(item.id)}
              className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                scenario.id === item.id
                  ? "border-primary bg-primary-soft"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted"
              }`}
            >
              <span className="fd-body-sm block font-semibold text-ink">{item.title}</span>
              <span className="fd-caption mt-1 block text-ink-muted">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="fd-caption mb-1.5 block font-semibold text-ink-secondary">Target URL</span>
              <input
                type="url"
                value={baseUrl}
                onChange={(event) => updateInput(() => setBaseUrl(event.target.value))}
                required
                className="h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label="Target API base URL"
              />
            </label>
            <label className="block">
              <span className="fd-caption mb-1.5 block font-semibold text-ink-secondary">Virtual users</span>
              <input
                type="number"
                min="1"
                max="5000"
                value={vus}
                onChange={(event) => updateInput(() => setVus(event.target.value))}
                required
                className="h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label="Virtual users"
              />
            </label>
            <label className="block">
              <span className="fd-caption mb-1.5 block font-semibold text-ink-secondary">
                {scenario.type === "claim" ? "Claiming event" : "Open event"}
              </span>
              {requiresAccounts ? (
                <select
                  value={eventId}
                  onChange={(event) => updateInput(() => setSelectedEventId(event.target.value))}
                  disabled={!events.length}
                  className="h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  aria-label={scenario.type === "claim" ? "Select a claiming event" : "Select an open event"}
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.title} · {event.participants.toLocaleString()} entries</option>
                  ))}
                  {!events.length ? <option value="">No compatible event available</option> : null}
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-lg border border-line bg-surface-muted px-3 text-sm text-ink-muted">
                  Not needed for this workload
                </div>
              )}
            </label>
            <label className="block">
              <span className="fd-caption mb-1.5 block font-semibold text-ink-secondary">Steady-load duration</span>
              <select
                value={duration}
                onChange={(event) => updateInput(() => setDuration(event.target.value))}
                className="h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label="Steady-load test duration"
              >
                {durations.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          {requiresAccounts ? (
            <div className="mt-4 rounded-xl border border-warning-line bg-warning-soft p-3.5">
              <p className="fd-caption font-semibold text-ink">Verified sessions required</p>
              <p className="fd-caption mt-1 text-ink-secondary">
                Replace the cookie placeholders in the command with verified accounts. Cookies stay in your terminal and are never sent to this page.
              </p>
            </div>
          ) : null}
          {scenario.id === "normal-crowd" || scenario.id === "retry-storm" ? (
            <p className="fd-caption mt-3 text-ink-muted">
              Ramp workloads run their defined 60-second stages; the duration setting applies to steady-load scenarios.
            </p>
          ) : null}
          {requiresAccounts && !events.length ? (
            <p className="fd-caption mt-3 text-danger">No {scenario.type === "claim" ? "claiming" : "open"} event is available. Create or transition an event before running this scenario.</p>
          ) : null}
          {selectedEvent ? (
            <p className="fd-caption mt-3 text-ink-muted">
              Selected event: <span className="font-mono text-ink-secondary">{selectedEvent.id}</span>
              {" · "}{selectedEvent.participants.toLocaleString()} entries / {selectedEvent.capacity.toLocaleString()} seats
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="fd-eyebrow text-ink-muted">Run from the project root</p>
              <div className="mt-2 inline-flex rounded-lg border border-line bg-surface-muted p-1" role="group" aria-label="Shell syntax">
                {["powershell", "posix"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={shell === value}
                    onClick={() => updateInput(() => setShell(value))}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      shell === value ? "bg-surface text-ink shadow-fd-sm" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {value === "powershell" ? "PowerShell" : "macOS / Linux"}
                  </button>
                ))}
              </div>
            </div>
            <Button type="button" size="sm" onClick={copyCommand} disabled={!canCopy}>
              {copied ? "Copied" : "Copy command"}
            </Button>
          </div>
          <pre className="max-h-52 overflow-auto rounded-xl border border-line bg-surface-muted p-4 text-xs leading-6 text-ink-secondary">
            <code>{command}</code>
          </pre>
          <p className={`fd-caption mt-2 ${copyError ? "text-danger" : "text-ink-muted"}`} aria-live="polite">
            {copyError || (copied
              ? "Command copied. Replace any session-cookie placeholders before running."
              : !validTarget
                ? "Enter a valid http:// or https:// target URL."
                : !validVus
                  ? "Virtual users must be a whole number from 1 to 5,000."
                  : "The selected workload sends real traffic. Start small and target only systems you control.")}
          </p>
        </div>
      </div>
    </Card>
  );
}
