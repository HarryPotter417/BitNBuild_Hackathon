import { listEvents } from "../../../server/data.js";
import { Card, PageHeader } from "../../../components/ui.js";

export const metadata={title:"Adversarial testing"};

const scenarios=[
  ["normal-crowd","Normal crowd","Ramp verified participants against an open event."],
  ["single-user-spam","Single user spam","Repeat one verified user; expect one entry and controlled throttling."],
  ["bot-flood","Anonymous bot flood","Probe the challenge endpoint without a session; requests should be rejected or limited."],
  ["duplicate-join","Duplicate joins","Multiple concurrent clients repeat joins; the database uniqueness constraint preserves one row per account."],
  ["retry-storm","Retry storm","Raise arrival rate and observe 429s, 5xxs, and tail latency."],
  ["claim-race","Claim race","Race claims against a real claiming event and inspect confirmed allocation counts."],
  ["health","API health load","Measure availability and latency while the stack is under test traffic."],
];

export default async function AdversarialPage(){
  const events=await listEvents();
  const open=events.filter((event)=>event.state==="OPEN");
  const claiming=events.filter((event)=>event.state==="CLAIMING");
  return <div className="space-y-7"><PageHeader eyebrow="Controlled testing" title="Adversarial load lab" subtitle="This lab runs k6 against the deployed API. Metrics come from the actual HTTP test run; the dashboard does not synthesize RPS or latency."/>
    <Card className="p-5"><h2 className="fd-card-title">Choose a workload</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{scenarios.map(([id,title,description])=><div key={id} className="rounded-lg border border-line bg-surface-muted p-4"><h3 className="fd-body-sm font-semibold">{title}</h3><p className="fd-caption text-ink-muted mt-1">{description}</p><code className="mt-3 block overflow-x-auto rounded bg-bg p-2 text-[0.7rem] text-ink-secondary">FAIRDROP_SCENARIO={id} npx k6 run scripts/load/fairdrop.js</code></div>)}</div></Card>
    <div className="grid gap-4 lg:grid-cols-2">{[["Open events",open],["Claiming events",claiming]].map(([title,list])=><Card key={title} className="p-5"><h2 className="fd-card-title">{title}</h2>{list.length?<ul className="mt-3 space-y-2">{list.map((event)=><li key={event.id} className="fd-caption text-ink-secondary">{event.title} · {event.id} · {event.participants}/{event.capacity}</li>)}</ul>:<p className="fd-caption text-ink-muted mt-2">No events in this state.</p>}</Card>)}</div>
    <Card className="p-5"><h2 className="fd-card-title">Measured result handling</h2><p className="fd-body-sm text-ink-muted mt-2">Run the test from a controlled machine with k6 installed. For join tests, provide verified session cookie values through FAIRDROP_SESSION_COOKIES; choose an open event ID. For claim tests, choose a claiming event and cookies belonging to selected users. k6 reports p50/p95/p99, request rate, status codes, and check failures in its terminal summary. After the run, inspect the event fairness report and audit log for stored business outcomes.</p><p className="fd-caption text-warning mt-3">Start with a low virtual-user count. These are real requests against the configured environment.</p></Card>
  </div>;
}
