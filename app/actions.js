"use server";

import { applyLifecycle, claimSeat, demoOutcomeFor, drawProgress, getDraw, joinEvent } from "../server/store";
import { headers } from "next/headers";
import { databaseMode, getCurrentUser, getOutcome, getDraw as getStoredDraw } from "../server/data.js";
import { allowJoinRequest, verifyChallenge } from "../server/bot-guard.js";
import { clientAddress, enforceRateLimit } from "../server/rate-limit.js";
import { claimProductionSeat, joinProductionEvent } from "../server/production-store.js";

/** Polled by the waiting room so the page reflects the pipeline, not a timer. */
export async function getWaitingRoomState(eventId) {
  if (databaseMode()) {
    const [outcome, draw] = await Promise.all([getOutcome(eventId), getStoredDraw(eventId)]);
    return { outcome, draw: draw ? { state:draw.state,running:draw.progress.running,ratio:draw.progress.ratio,stages:draw.progress.stages,revealedSeed:draw.revealedSeed } : null };
  }
  const draw = getDraw(eventId);
  const outcome = demoOutcomeFor(eventId);
  return {
    outcome: {
      status: outcome.status,
      seat: outcome.seat ?? null,
      rank: outcome.rank ?? null,
      score: outcome.score ?? null,
      inDraw: Boolean(outcome.inDraw),
      promoted: Boolean(outcome.promoted),
    },
    draw: draw
      ? {
          state: draw.state,
          running: Boolean(draw.progress?.running),
          ratio: draw.progress?.ratio ?? 1,
          stages: draw.progress?.stages ?? [],
          revealedSeed: draw.revealedSeed,
          verified: null,
        }
      : null,
  };
}

/**
 * Mutations for the demo. In a real deployment these would sit behind the API
 * gateway with auth, rate limiting and an idempotency store; the invariants they
 * protect live in the service, not here, so they hold however they are called.
 */

export async function joinEventAction(eventId, challenge, solution) {
  if (databaseMode()) {
    const user = await getCurrentUser();
    if (!user) return { ok:false,code:401,message:"Sign in to enter this event." };
    if (!user.email_verified_at) return { ok:false,code:403,message:"Verify your email before entering." };
    const headerStore = await headers();
    const request = { headers:headerStore };
    if (!(await verifyChallenge(request,user.id,challenge,solution))) return { ok:false,code:403,message:"Request verification failed. Try again." };
    const rate = await allowJoinRequest(request,user.id);
    if (!rate.allowed) return { ok:false,code:429,message:"Too many requests. Try again shortly." };
    return joinProductionEvent(eventId,user.id,clientAddress(request));
  }
  const result = joinEvent(eventId);
  return {
    ...result,
    entry: result.entry
      ? {
          eventId: result.entry.eventId,
          status: result.entry.status,
          requestCount: result.entry.requestCount || 1,
          joinedAt: result.entry.joinedAt,
        }
      : null,
    allocation: undefined,
  };
}

export async function claimSeatAction(eventId, idempotencyKey) {
  if (databaseMode()) {
    const user = await getCurrentUser();
    if (!user?.email_verified_at) return { ok:false,code:401,message:"Sign in with a verified account to claim." };
    const headerStore = await headers();
    const address = clientAddress({headers:headerStore});
    const rateLimitAddress = clientAddress({headers:headerStore},user.id);
    const [userLimit,ipLimit] = await Promise.all([
      enforceRateLimit(`claim-user:${user.id}`,{limit:15,windowMs:60_000}),
      enforceRateLimit(`claim-ip:${rateLimitAddress}`,{limit:60,windowMs:10_000}),
    ]);
    if (!userLimit.allowed || !ipLimit.allowed) return { ok:false,code:429,message:"Too many requests. Your allocation is protected; try again shortly." };
    try { return await claimProductionSeat(eventId,user.id,idempotencyKey,address); }
    catch(error) { return {ok:false,code:error.status||503,message:error.status?error.message:"Claim service is temporarily unavailable."}; }
  }
  const result = claimSeat(eventId, undefined, idempotencyKey);
  return {
    ok: Boolean(result.ok),
    code: result.code ?? 200,
    message: result.message,
    replay: Boolean(result.replay),
    replayedKey: result.replayedKey ?? null,
    allocation: result.allocation
      ? {
          seat: result.allocation.seat,
          rank: result.allocation.rank,
          status: result.allocation.status,
          confirmedAt: result.allocation.confirmedAt,
          promoted: Boolean(result.allocation.promoted),
        }
      : null,
  };
}

export async function lifecycleAction(eventId, action) {
  if (databaseMode()) {
    const user = await getCurrentUser();
    if (user?.role !== "admin") return {ok:false,code:user?403:401,message:"Administrator access is required."};
    const {getPool,withTransaction}=await import("../server/database.js");
    const {freezeAndQueueDraw}=await import("../server/production-store.js");
    if (action === "freeze" || action === "draw") return freezeAndQueueDraw(eventId,user.id);
    const transitions={open:{from:"SCHEDULED",to:"OPEN"},cancel:{from:["SCHEDULED","OPEN","FROZEN"],to:"CANCELLED"},close:{from:"CLAIMING",to:"CLOSED"}};
    const rule=transitions[action];
    if(!rule)return {ok:false,code:400,message:"Unsupported event action."};
    return withTransaction(async(client)=>{
      const {rows}=await client.query("SELECT state FROM events WHERE id=$1 FOR UPDATE",[eventId]);
      if(!rows[0])return {ok:false,code:404,message:"Event not found."};
      if(!(Array.isArray(rule.from)?rule.from.includes(rows[0].state):rows[0].state===rule.from))return {ok:false,code:409,message:`Action is not valid while event is ${rows[0].state}.`};
      await client.query("UPDATE events SET state=$2,updated_at=now() WHERE id=$1",[eventId,rule.to]);
      await client.query("INSERT INTO audit_log(event_id,actor_id,action,metadata) VALUES($1,$2,$3,$4)",[eventId,user.id,`EVENT_${rule.to}`,{from:rows[0].state,to:rule.to}]);
      return {ok:true,state:rule.to};
    });
  }
  return applyLifecycle(eventId, action);
}

export async function createEventAction(form) {
  if (!databaseMode()) return {ok:false,message:"Event creation is available with the PostgreSQL backend enabled."};
  const user=await getCurrentUser();
  if(user?.role!=="admin")return {ok:false,message:"Administrator access is required."};
  const title=String(form.title||"").trim().slice(0,160);
  const id=String(form.id||"").trim().toLowerCase();
  const startsAt=new Date(form.startsAt);
  const capacity=Number(form.capacity);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||!title||!Number.isInteger(capacity)||capacity<1||capacity>100000||!Number.isFinite(startsAt.getTime())||startsAt<=new Date())return {ok:false,message:"Enter a valid event ID, a future date, and a capacity from 1 to 100,000."};
  const {getPool,withTransaction}=await import("../server/database.js");
  try{return await withTransaction(async(client)=>{
    await client.query(`INSERT INTO events(id,title,tagline,description,category,city,venue,starts_at,capacity,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED')`,[id,title,String(form.tagline||"").slice(0,200),String(form.description||"").slice(0,5000),String(form.category||"Event").slice(0,80),String(form.city||"").slice(0,120),String(form.venue||"").slice(0,200),startsAt,capacity]);
    await client.query("INSERT INTO audit_log(event_id,actor_id,action,metadata) VALUES($1,$2,'EVENT_CREATED',$3)",[id,user.id,{capacity,startsAt}]);
    return {ok:true,id};
  });}catch(error){if(error.code==="23505")return {ok:false,message:"An event with that ID already exists."};throw error;}
}
