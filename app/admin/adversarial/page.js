import { listEvents } from "../../../server/data.js";
import { AdversarialLoadBuilder } from "../../../components/adversarial-load-builder.js";
import { Badge, Card, PageHeader, Stat } from "../../../components/ui.js";

export const metadata = { title: "Adversarial testing" };

export default async function AdversarialPage() {
  const events = await listEvents();
  const openEvents = events.filter((event) => event.state === "OPEN");
  const claimingEvents = events.filter((event) => event.state === "CLAIMING");
  const eligibleUsers = Math.max(0, ...openEvents.map((event) => event.participants));

  const eventOptions = (items) => items.map((event) => ({
    id: event.id,
    title: event.title,
    participants: event.participants,
    capacity: event.capacity,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Controlled testing"
        title="Adversarial load lab"
        subtitle="Configure a workload against your running API. The lab prepares commands; measurements come from the real k6 run, not generated dashboard data."
        actions={<Badge toneName="info" dot>k6 workloads</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Stat label="Open entry events" value={openEvents.length} sub="Available for join workloads" />
        </Card>
        <Card className="p-4">
          <Stat label="Claiming events" value={claimingEvents.length} sub="Available for claim-race tests" />
        </Card>
        <Card className="p-4">
          <Stat label="Largest open pool" value={eligibleUsers.toLocaleString("en-IN")} sub="Eligible participants in one event" />
        </Card>
      </div>

      <AdversarialLoadBuilder
        openEvents={eventOptions(openEvents)}
        claimingEvents={eventOptions(claimingEvents)}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="fd-card-title">What to capture for your demo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="fd-eyebrow text-ink-muted">From the k6 summary</p>
              <p className="fd-body-sm mt-1.5 text-ink-secondary">Request rate, p50/p95/p99 latency, failed requests, 429s, 503s, and check results.</p>
            </div>
            <div>
              <p className="fd-eyebrow text-ink-muted">From Fairness reports</p>
              <p className="fd-body-sm mt-1.5 text-ink-secondary">Unique entries, retries per account, win rates by retry group, and allocation integrity checks.</p>
            </div>
          </div>
          <p className="fd-caption mt-4 border-t border-line pt-3 text-ink-muted">
            Save the terminal summary for each scenario and compare outcomes at the same event capacity and participant pool.
          </p>
        </Card>

        <Card className="border-warning-line bg-warning-soft p-5 sm:p-6">
          <h2 className="fd-card-title">Run safely</h2>
          <ul className="mt-3 space-y-2 fd-body-sm text-ink-secondary">
            <li>Start with a small virtual-user count and increase in steps.</li>
            <li>Run only against infrastructure you control.</li>
            <li>Use verified test accounts; never paste session cookies into a shared recording.</li>
            <li>Ramp workloads run for 60 seconds; steady scenarios use the selected duration.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
