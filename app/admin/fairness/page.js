import { listEvents, getFairness } from "../../../server/data.js";
import { Badge, Card, PageHeader, Stat, StatCell, StatGrid, Table } from "../../../components/ui.js";
import { formatNumber } from "../../../lib/format.js";

export const metadata={title:"Fairness"};

export default async function FairnessPage(){
  const events=(await listEvents()).filter((event)=>event.hasDraw);
  const reports=await Promise.all(events.map(async(event)=>({event,report:await getFairness(event.id)})));
  return <div className="space-y-7"><PageHeader eyebrow="Integrity" title="Fairness reports" subtitle="Request counts and outcomes are grouped from stored entry records. A retry increments request_count, while the unique event and user key keeps one entry."/>
    {reports.map(({event,report})=>report?<section key={event.id} className="space-y-4"><h2 className="fd-section-title">{event.title}</h2><StatGrid columns={5}><StatCell><Stat label="HTTP requests" value={formatNumber(report.httpJoinRequests)}/></StatCell><StatCell><Stat label="Verified entries" value={formatNumber(report.validEntries)}/></StatCell><StatCell><Stat label="Duplicate attempts" value={formatNumber(report.duplicateAttempts)}/></StatCell><StatCell><Stat label="Entry amplification" value={`${report.entryAmplification.toFixed(2)}×`}/></StatCell><StatCell><Stat label="Selected" value={formatNumber(report.selectedUsers)}/></StatCell></StatGrid>
      <Card className="p-4"><Table columns={[{key:"label",header:"Requests per user"},{key:"users",header:"Users"},{key:"requests",header:"Requests"},{key:"winners",header:"Selected"},{key:"winRate",header:"Win rate"}]} rows={report.requestFrequency.map((bucket)=>({label:bucket.label,users:formatNumber(bucket.users),requests:formatNumber(bucket.requests),winners:formatNumber(bucket.winners),winRate:`${bucket.winRate.toFixed(2)}%`}))}/></Card>
      <div className="flex flex-wrap gap-2">{Object.entries(report.integrity).filter(([key])=>key!=="confirmedWithinCapacity").map(([key,value])=><Badge key={key} toneName={value===0?"success":"danger"} dot>{key.replace(/[A-Z]/g," $&")}: {value}</Badge>)}</div></section>:null)}
    {!reports.some((row)=>row.report)?<Card className="p-5"><p className="fd-body-sm text-ink-muted">No completed draw has data to report yet.</p></Card>:null}
  </div>;
}
