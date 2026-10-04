import Link from "next/link";
import { databaseMode, getFairness, listEvents } from "../../../server/data.js";
import { Badge, Card, PageHeader, Progress, Stat } from "../../../components/ui.js";
import { formatNumber, formatPercent } from "../../../lib/format.js";

export const metadata = { title: "Fairness" };

function FairnessBuckets({ report }) {
  const baseline = report.uniqueVerifiedUsers
    ? (report.selectedUsers / report.uniqueVerifiedUsers) * 100
    : 0;
  const highestObserved = Math.max(0, ...report.requestFrequency.map((bucket) => bucket.winRate));
  const chartMax = Math.max(baseline * 2, highestObserved * 1.15, 0.1);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="fd-card-title">Does retry volume change the odds?</h3>
          <p className="fd-caption mt-1 text-ink-muted">
            Each eligible account has the same target selection rate, regardless of how often it retried.
          </p>
        </div>
        <Badge toneName="info">Expected per account · {formatPercent(baseline, 2)}</Badge>
      </div>

      {report.requestFrequency.length ? (
        <div className="divide-y divide-line px-5">
          {report.requestFrequency.map((bucket) => {
            const delta = bucket.winRate - baseline;
            const barWidth = Math.min(100, (bucket.winRate / chartMax) * 100);
            const reference = Math.min(100, (baseline / chartMax) * 100);
            return (
              <div key={bucket.label} className="grid gap-2 py-4 md:grid-cols-[minmax(6rem,0.7fr)_minmax(12rem,1.5fr)_minmax(9rem,1fr)] md:items-center md:gap-5">
                <div>
                  <p className="fd-body-sm font-semibold text-ink">{bucket.label} requests / account</p>
                  <p className="fd-caption mt-0.5 text-ink-muted">
                    {formatNumber(bucket.users)} people · {formatPercent(bucket.shareOfUsers, 1)} of entries
                  </p>
                </div>

                <div>
                  <div
                    className="relative h-2.5 overflow-hidden rounded-full bg-surface-sunken"
                    role="img"
                    aria-label={`${bucket.label} requests: ${formatPercent(bucket.winRate, 2)} observed win rate; expected ${formatPercent(baseline, 2)}`}
                    title={`Observed ${formatPercent(bucket.winRate, 2)} · Expected ${formatPercent(baseline, 2)}`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${barWidth}%` }}
                    />
                    <span
                      className="absolute inset-y-0 w-0.5 bg-ink"
                      style={{ left: `${reference}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between gap-2">
                    <span className="fd-caption text-ink-muted">Observed selection rate</span>
                    <span className="fd-caption font-semibold text-ink">{formatPercent(bucket.winRate, 2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div>
                    <p className={`fd-body-sm font-semibold ${Math.abs(delta) < 0.005 ? "text-success" : "text-ink"}`}>
                      {delta > 0 ? "+" : ""}{formatPercent(delta, 2)} pp
                    </p>
                    <p className="fd-caption text-ink-muted">vs expected · {formatPercent(bucket.shareOfRequests, 1)} of requests</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-5 py-8 text-center fd-body-sm text-ink-muted">There are no participant request groups to compare yet.</p>
      )}

      <div className="border-t border-line bg-surface-muted px-5 py-3">
        <p className="fd-caption text-ink-muted">
          The dark tick marks the expected rate. Small groups naturally vary; this breakdown describes observed outcomes and is not a statistical significance test.
        </p>
      </div>
    </Card>
  );
}

function IntegrityChecks({ integrity }) {
  const checks = [
    ["Duplicate entries", integrity.duplicateEntries, integrity.duplicateEntries === 0],
    ["Duplicate seats", integrity.duplicateAllocations, integrity.duplicateAllocations === 0],
    ["Oversold seats", integrity.oversoldSeats, integrity.oversoldSeats === 0],
    ["Within capacity", integrity.confirmedWithinCapacity ? "Yes" : "No", integrity.confirmedWithinCapacity],
  ];

  return (
    <div className="flex flex-wrap gap-2" aria-label="Allocation integrity checks">
      {checks.map(([label, value, passed]) => (
        <Badge key={label} toneName={passed ? "success" : "danger"} dot>
          {label}: {typeof value === "number" ? formatNumber(value) : value}
        </Badge>
      ))}
    </div>
  );
}

export default async function FairnessPage() {
  const isProduction = databaseMode();
  const events = (await listEvents()).filter((event) => event.hasDraw);
  const reports = await Promise.all(events.map(async (event) => ({
    event,
    report: await getFairness(event.id),
  })));
  const visibleReports = reports.filter((row) => row.report);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Allocation integrity"
        title="Fairness, measured"
        subtitle="Compare draw outcomes across retry-frequency groups. Retries are counted, but one verified account can only enter a given event once."
        actions={<Badge toneName={isProduction ? "success" : "warning"} dot>{isProduction ? "Production data" : "Demo data"}</Badge>}
      />

      {visibleReports.length ? visibleReports.map(({ event, report }) => (
        <section key={event.id} className="space-y-4" aria-labelledby={`fairness-${event.id}`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="fd-eyebrow text-ink-muted">{event.category} · {event.city}</p>
              <h2 id={`fairness-${event.id}`} className="fd-section-title mt-1">{event.title}</h2>
              <p className="fd-caption mt-1 text-ink-muted">
                {formatNumber(report.uniqueVerifiedUsers)} unique verified entries · {formatNumber(event.capacity)} seats
              </p>
            </div>
            <Link href={`/me/verify/${event.id}`} className="fd-caption font-semibold text-primary hover:underline">
              Verify the draw →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Recorded join attempts", formatNumber(report.httpJoinRequests), "Passed the entry handler"],
              ["Unique entries", formatNumber(report.validEntries), "One per verified account"],
              ["Repeat attempts", formatNumber(report.duplicateAttempts), "No extra entry created"],
              ["Requests per entry", `${report.requestsPerEntry.toFixed(2)}×`, "Lower means less retry amplification"],
              ["Selected", formatNumber(report.selectedUsers), "From the frozen draw"],
            ].map(([label, value, sub]) => (
              <Card key={label} className="p-4">
                <Stat label={label} value={value} sub={sub} />
              </Card>
            ))}
          </div>

          <FairnessBuckets report={report} />

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h3 className="fd-body-sm font-semibold text-ink">Allocation invariants</h3>
              <p className="fd-caption mt-1 text-ink-muted">Database-backed uniqueness and capacity checks for this event.</p>
            </div>
            <IntegrityChecks integrity={report.integrity} />
          </Card>
        </section>
      )) : (
        <Card className="p-5">
          <p className="fd-body-sm text-ink-muted">
            No completed or in-progress draws have fairness data yet. Once an event is frozen, its outcomes will appear here.
          </p>
        </Card>
      )}
    </div>
  );
}
