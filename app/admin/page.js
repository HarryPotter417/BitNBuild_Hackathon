import Link from "next/link";
import { getPlatformMetrics, getSystemHealth, listEvents } from "../../server/data.js";
import { Badge, Card, PageHeader, Stat, StatCell, StatGrid } from "../../components/ui.js";
import { formatNumber } from "../../lib/format.js";

export const metadata={title:"Admin overview"};

export default async function AdminPage(){
  const [metrics,health,events]=await Promise.all([getPlatformMetrics(),getSystemHealth(),listEvents()]);
  return <div className="space-y-8"><PageHeader eyebrow="Operations" title="Platform overview" subtitle="Counters are queried from the current application store. Health reflects reachable services only."/>
    <StatGrid columns={4}>
      {[["Active events",metrics.activeEvents], ["Registered users",metrics.totalUsers], ["Join requests",metrics.joinAttempts], ["Unique entries",metrics.uniqueEntries], ["Duplicate requests",metrics.duplicateAttempts], ["Confirmed seats",metrics.confirmedAllocations], ["Expired offers",metrics.expiredClaims], ["Total capacity",metrics.totalCapacity]].map(([label,value])=><StatCell key={label}><Stat label={label} value={formatNumber(value)}/></StatCell>)}
    </StatGrid>
    <section><h2 className="fd-section-title mb-4">Service checks</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{health.services.map((service)=><Card key={service.id} className="flex items-center justify-between p-4"><div><p className="fd-body-sm font-semibold">{service.name}</p><p className="fd-caption text-ink-muted">Connectivity check</p></div><Badge toneName={service.state==="healthy"?"success":"danger"} dot>{service.state}</Badge></Card>)}</div><p className="fd-caption text-ink-muted mt-3">CPU, memory, queue depth, and latency histograms are not collected by this build.</p></section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="fd-section-title">Events</h2><Link href="/admin/events" className="fd-caption text-primary">Manage events →</Link></div><div className="space-y-2">{events.slice(0,6).map((event)=><Card key={event.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="fd-body-sm font-semibold">{event.title}</p><p className="fd-caption text-ink-muted">{formatNumber(event.participants)} entries · {formatNumber(event.capacity)} seats</p></div><Badge toneName={event.status.tone} dot>{event.status.label}</Badge></Card>)}</div></section>
  </div>;
}
