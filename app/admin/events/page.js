import { listEvents } from "../../../server/data.js";
import { Badge, Card, PageHeader } from "../../../components/ui.js";
import { AdminEventControls, AdminEventForm } from "../../../components/admin-event-controls.js";
import { formatNumber,formatDate } from "../../../lib/format.js";

export const metadata={title:"Manage events"};

export default async function AdminEventsPage(){
  const events=await listEvents();
  return <div className="space-y-6"><PageHeader eyebrow="Administration" title="Events" subtitle="Create scheduled events and advance only valid lifecycle actions."/><AdminEventForm/><div className="space-y-3">{events.map((event)=><Card key={event.id} className="space-y-4 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="fd-card-title">{event.title}</h2><p className="fd-caption text-ink-muted mt-1">{event.city} · {formatDate(event.startsAt)} · {formatNumber(event.participants)} entries / {formatNumber(event.capacity)} seats</p></div><Badge toneName={event.status.tone} dot>{event.status.label}</Badge></div><AdminEventControls event={event}/></Card>)}</div></div>;
}
