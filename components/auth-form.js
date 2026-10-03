"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "./ui";

export function AuthForm() {
  const router=useRouter();
  const [mode,setMode]=useState("login");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    try {
      const response=await fetch(`/api/auth/${mode==="login"?"login":"register"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"The request could not be completed.");
      if(mode==="register")setMessage(result.message);
      else router.push("/me");
    } catch(error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <Card className="mx-auto max-w-md p-6">
    <div className="mb-5 flex rounded-lg bg-surface-sunken p-1" role="tablist" aria-label="Account action">
      {["login","register"].map((tab)=><button key={tab} type="button" role="tab" aria-selected={mode===tab} onClick={()=>{setMode(tab);setMessage("");}} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize ${mode===tab?"bg-surface text-ink shadow-fd-sm":"text-ink-muted"}`}>{tab}</button>)}
    </div>
    <form onSubmit={submit} className="space-y-4">
      {mode==="register"?<label className="block text-sm font-medium text-ink">Name<input name="name" autoComplete="name" required maxLength={100} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3" /></label>:null}
      <label className="block text-sm font-medium text-ink">Email<input name="email" type="email" autoComplete="email" required className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3" /></label>
      <label className="block text-sm font-medium text-ink">Password<input name="password" type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={12} required className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3" />{mode==="register"?<span className="fd-caption text-ink-muted mt-1 block">Use at least 12 characters.</span>:null}</label>
      <Button type="submit" disabled={busy} className="w-full">{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</Button>
      {message?<p role="status" aria-live="polite" className="fd-body-sm text-ink-secondary">{message}</p>:null}
    </form>
  </Card>;
}
