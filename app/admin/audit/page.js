import { getAuditLog } from "../../../server/data.js";
import { Card, PageHeader, Table } from "../../../components/ui.js";
import { formatDateTime } from "../../../lib/format.js";

export const metadata={title:"Audit log"};

export default async function AuditPage(){
  const rows=await getAuditLog({limit:200});
  return <div><PageHeader eyebrow="Operations" title="Audit log" subtitle="Append-only event, draw, and allocation actions recorded by the application."/><Card><Table columns={[{key:"at",header:"Time"},{key:"action",header:"Action"},{key:"event",header:"Event"},{key:"actor",header:"Actor"},{key:"request",header:"Request ID"},{key:"metadata",header:"Metadata"}]} rows={rows.map((row)=>({key:row.id,at:formatDateTime(row.created_at||row.at),action:row.action,event:row.event_title||row.eventId||"—",actor:row.actor||row.actor_id||"system",request:row.request_id||row.requestId,metadata:JSON.stringify(row.metadata||{})}))}/></Card></div>;
}
