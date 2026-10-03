import { getSystemHealth } from "../../../server/data.js";
import { Badge, Card, PageHeader } from "../../../components/ui.js";

export const metadata={title:"System health"};

export default async function SystemPage(){
  const health=await getSystemHealth();
  return <div><PageHeader eyebrow="Operations" title="System health" subtitle={`Last checked ${new Date(health.checkedAt).toLocaleString("en-IN")}. Only directly probed services are shown.`}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{health.services.map((service)=><Card key={service.id} className="p-5"><div className="flex items-center justify-between"><h2 className="fd-card-title">{service.name}</h2><Badge toneName={service.state==="healthy"?"success":"danger"} dot>{service.state}</Badge></div><p className="fd-body-sm text-ink-muted mt-3">Connectivity probe</p></Card>)}</div><Card className="mt-6 p-5"><h2 className="fd-card-title">Telemetry coverage</h2><p className="fd-body-sm text-ink-muted mt-2">CPU, memory, event-loop delay, database pool saturation, request percentiles, and queue depth require a metrics collector and are not reported as live values yet.</p></Card></div>;
}
