"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEventAction, lifecycleAction } from "../app/actions.js";

const actions={SCHEDULED:[["open","Open entries"],["cancel","Cancel"]],OPEN:[["freeze","Freeze and draw"],["cancel","Cancel"]],CLAIMING:[["close","Close claims"]]};

export function AdminEventControls({event}){
  const router=useRouter();const [pending,startTransition]=useTransition();const [message,setMessage]=useState("");
  const run=(action)=>startTransition(async()=>{const result=await lifecycleAction(event.id,action);setMessage(result.ok?`Event updated: ${result.state||action}.`:result.message||"Update failed.");router.refresh();});
  return <div className="flex flex-wrap items-center gap-2">{(actions[event.state]||[]).map(([action,label])=><button key={action} type="button" disabled={pending} onClick={()=>run(action)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-contrast disabled:opacity-50">{pending?"Working…":label}</button>)}{message?<span role="status" className="fd-caption text-ink-muted">{message}</span>:null}</div>;
}

export function AdminEventForm(){
  const router=useRouter();const [pending,startTransition]=useTransition();const [message,setMessage]=useState("");
  const submit=(formData)=>startTransition(async()=>{const result=await createEventAction(Object.fromEntries(formData.entries()));setMessage(result.ok?"Event created and scheduled.":result.message);if(result.ok){document.getElementById("event-create-form")?.reset();router.refresh();}});
  return <form id="event-create-form" action={submit} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-3">
    <label className="fd-caption text-ink-secondary">Title<input name="title" required maxLength={160} className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary">Event ID<input name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="community-summit-2027" className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary">Starts at<input name="startsAt" type="datetime-local" required className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary">Capacity<input name="capacity" type="number" min="1" max="100000" required className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary">City<input name="city" maxLength={120} className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary">Venue<input name="venue" maxLength={200} className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <label className="fd-caption text-ink-secondary sm:col-span-2">Tagline<input name="tagline" maxLength={200} className="mt-1 block h-10 w-full rounded-lg border border-line bg-bg px-3 text-ink"/></label>
    <button disabled={pending} className="h-10 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast disabled:opacity-50">{pending?"Creating…":"Create scheduled event"}</button>
    {message?<p role="status" className="fd-caption text-ink-muted sm:col-span-3">{message}</p>:null}
  </form>;
}
