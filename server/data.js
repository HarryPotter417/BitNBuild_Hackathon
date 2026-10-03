import {
  listEvents as listDemoEvents, getEvent as getDemoEvent, getUserEntries as getDemoEntries,
  getUserHistory as getDemoHistory, demoOutcomeFor, getDraw as getDemoDraw,
  getVerification as getDemoVerification, getFairness as getDemoFairness,
  getTraffic as getDemoTraffic, liveTraffic as getDemoLiveTraffic,
  getPlatformMetrics as getDemoPlatformMetrics, getSystemHealth as getDemoHealth,
  getAuditLog as getDemoAudit, getAllocationFor as getDemoAllocation,
  claimWindow as getDemoClaimWindow, drawableEventIds as demoDrawableIds,
} from "./store.js";
import {
  getProductionEvent, listProductionEvents, getProductionHistory, getProductionEntry,
  getProductionVerification, getProductionMetrics, getProductionAudit,
} from "./production-store.js";
import { getPool } from "./database.js";
import { getRedis } from "./rate-limit.js";
import { computeSnapshotHash, commitSeed, rankParticipants } from "./draw.js";
import { eventStatus } from "../lib/status.js";
import { cookies } from "next/headers";
import { getSessionUser } from "./auth.js";

export const databaseMode = () => Boolean(process.env.DATABASE_URL);

export async function getCurrentUser() {
  if (!databaseMode()) return (await import("./store.js")).getDemoUser();
  return getSessionUser({ cookies: await cookies(), headers: new Headers() });
}

export async function listEvents() { return databaseMode() ? listProductionEvents() : listDemoEvents(); }
export async function getEvent(id) { return databaseMode() ? getProductionEvent(id) : getDemoEvent(id); }

export async function getUserEntries() {
  if (!databaseMode()) return getDemoEntries();
  const user = await getCurrentUser();
  if (!user) return [];
  const { rows } = await getPool().query(`SELECT e.*,en.status AS entry_status,en.request_count,en.draw_rank,a.seat,a.status AS allocation_status,a.confirmed_at,a.claim_expires_at
    FROM entries en JOIN events e ON e.id=en.event_id LEFT JOIN allocations a ON a.event_id=en.event_id AND a.user_id=en.user_id
    WHERE en.user_id=$1 ORDER BY e.starts_at`, [user.id]);
  return rows.map((row) => {
    const event = toEvent(row);
    const status = row.allocation_status === "CONFIRMED" ? "CONFIRMED" : row.allocation_status === "EXPIRED" ? "EXPIRED" : row.entry_status;
    return { event, outcome: { status, seat: row.seat, rank: row.draw_rank, waitlistRank: status === "WAITLISTED" ? row.draw_rank - Number(row.capacity) : null, confirmedAt: row.confirmed_at, requestCount: Number(row.request_count), inDraw: event.state === "DRAWING" } };
  });
}

export async function getUserHistory() {
  if (!databaseMode()) return getDemoHistory();
  const user = await getCurrentUser();
  if (!user) return [];
  return (await getProductionHistory(user.id)).map((row) => ({ eventId:row.event_id,title:row.title,city:row.city,status:row.allocation_status === "CONFIRMED" ? "CONFIRMED" : row.allocation_status === "EXPIRED" ? "EXPIRED" : row.status,seat:row.seat,rank:row.draw_rank,date:row.starts_at,confirmedAt:row.confirmed_at }));
}

export async function getOutcome(eventId) {
  if (!databaseMode()) return demoOutcomeFor(eventId);
  const user = await getCurrentUser();
  if (!user) return { status: "NONE" };
  const entry = await getProductionEntry(eventId, user.id);
  if (!entry) return { status: "NONE" };
  const status = entry.allocation_status === "CONFIRMED" ? "CONFIRMED" : entry.allocation_status === "EXPIRED" ? "EXPIRED" : entry.status;
  return { status,seat:entry.seat,rank:entry.draw_rank,waitlistRank:status === "WAITLISTED" ? entry.draw_rank - Number(entry.capacity) : null,confirmedAt:entry.confirmed_at,requestCount:Number(entry.request_count),inDraw:status === "WAITING" };
}

export async function getDraw(eventId) {
  if (!databaseMode()) return getDemoDraw(eventId);
  const { rows } = await getPool().query("SELECT d.*,e.state FROM draws d JOIN events e ON e.id=d.event_id WHERE d.event_id=$1", [eventId]);
  const draw = rows[0];
  if (!draw) return null;
  const stages = ["Participant set frozen","Snapshot created","Commitment generated","Generating deterministic ranking","Selecting winners"];
  const activeIndex={queued:-1,ranking:3,selecting:4,complete:5}[draw.stage]??-1;
  const doneCount=activeIndex===-1?3:activeIndex;
  return { state:draw.state,snapshotHash:draw.snapshot_hash,commitmentHash:draw.commitment_hash,revealedSeed:draw.revealed_seed,participantCount:draw.participant_count,completedAt:draw.completed_at,progress:{running:!draw.completed_at,ratio:draw.progress===null?null:Number(draw.progress)/100,stages:stages.map((label,index)=>({id:String(index),label,status:draw.completed_at||index<doneCount?"done":index===activeIndex?"active":"pending",within:0,hint:draw.stage==="queued"?"Waiting for a draw worker.":"Reported by the draw worker."}))} };
}

export async function getVerification(eventId) {
  if (!databaseMode()) return getDemoVerification(eventId);
  const user = await getCurrentUser();
  const raw = await getProductionVerification(eventId, user?.id);
  if (!raw) return null;
  const event = await getProductionEvent(eventId);
  const checks=raw.checks.map((check)=>({id:check.id,label:check.id==="snapshot"?"Snapshot hash matches the frozen participant set":check.id==="commitment"?"Commitment matches revealed seed":"Deterministic ranking reproduces the same winners",detail:check.ok===null?"Waiting for the seed to be revealed.":check.ok?"Check recomputed from the published values.":"Recomputed value does not match.",state:check.ok===null?"pending":check.ok?"pass":"fail"}));
  return {...raw,title:event?.title,verification:{verified:raw.verified,awaitingReveal:!raw.revealedSeed,checks,recomputedSelectedCount:raw.selectedCount},user:raw.user||{id:user?.id,rank:null,selected:false,score:null,seat:null},publishedSample:raw.publishedSample||[]};
}

export async function getFairness(eventId) {
  if (!databaseMode()) return getDemoFairness(eventId);
  const event = await getProductionEvent(eventId);
  if (!event?.hasDraw) return null;
  const { rows } = await getPool().query("SELECT user_id,request_count,draw_rank FROM entries WHERE event_id=$1", [eventId]);
  const groups = new Map();
  for (const row of rows) {
    const count = Number(row.request_count);
    const label = count <= 2 ? "1–2" : count <= 10 ? "3–10" : count <= 100 ? "11–100" : count <= 1000 ? "101–1000" : "1000+";
    const group = groups.get(label) || { label,users:0,requests:0,winners:0 };
    group.users += 1; group.requests += count; if (row.draw_rank && row.draw_rank <= event.capacity) group.winners += 1;
    groups.set(label, group);
  }
  const metrics = (await getProductionMetrics(eventId))[0];
  const requests = Number(metrics.join_requests), base = rows.length ? Math.min(event.capacity,rows.length) / rows.length * 100 : 0;
  const requestFrequency = [...groups.values()].map((row) => ({ ...row,winRate:row.users?row.winners/row.users*100:0,shareOfUsers:rows.length?row.users/rows.length*100:0,shareOfRequests:requests?row.requests/requests*100:0 }));
  const alloc = await getPool().query("SELECT seat,status FROM allocations WHERE event_id=$1", [eventId]);
  const confirmed = alloc.rows.filter((row) => row.status === "CONFIRMED");
  return { eventId,scope:event.title,httpJoinRequests:requests,uniqueVerifiedUsers:rows.length,validEntries:rows.length,duplicateAttempts:Math.max(0,requests-rows.length),selectedUsers:Math.min(event.capacity,rows.length),confirmedAllocations:confirmed.length,expiredClaims:alloc.rows.filter((row)=>row.status==="EXPIRED").length,promotedFromWaitlist:0,entryAmplification:rows.length?1:0,requestsPerEntry:rows.length?requests/rows.length:0,entryCaptureRate:requests?rows.length/requests*100:0,measuredRequests:requests,requestFrequency,integrity:{duplicateEntries:rows.length-new Set(rows.map((row)=>row.user_id)).size,duplicateAllocations:confirmed.length-new Set(confirmed.map((row)=>row.seat)).size,oversoldSeats:Math.max(0,confirmed.length-event.capacity),confirmedWithinCapacity:confirmed.length<=event.capacity} };
}

export async function getTraffic(eventId) { return databaseMode() ? null : getDemoTraffic(eventId); }
export async function liveTraffic(minutes=60) { return databaseMode() ? [] : getDemoLiveTraffic(minutes); }

export async function getPlatformMetrics() {
  if (!databaseMode()) return getDemoPlatformMetrics();
  const [metrics,users] = await Promise.all([getProductionMetrics(),getPool().query("SELECT count(*)::int AS total FROM users")]);
  const sum=(key)=>metrics.reduce((total,row)=>total+Number(row[key]||0),0);
  const events=await listProductionEvents();
  return { activeEvents:events.filter((event)=>["OPEN","FROZEN","DRAWING","CLAIMING"].includes(event.state)).length,totalEvents:events.length,totalUsers:users.rows[0].total,joinAttempts:sum("join_requests"),uniqueEntries:sum("unique_entries"),duplicateAttempts:Math.max(0,sum("join_requests")-sum("unique_entries")),selectedWinners:sum("offered_allocations")+sum("confirmed_allocations")+sum("expired_allocations"),confirmedAllocations:sum("confirmed_allocations"),expiredClaims:sum("expired_allocations"),totalCapacity:metrics.reduce((total,row)=>total+Number(row.capacity),0) };
}

export async function getSystemHealth() {
  if (!databaseMode()) return getDemoHealth();
  const checks=await Promise.allSettled([getPool().query("SELECT 1"),getRedis().ping()]);
  const healthy=checks.every((result)=>result.status==="fulfilled");
  return {overall:healthy?"healthy":"degraded",checkedAt:new Date().toISOString(),services:[{id:"postgres",name:"PostgreSQL",state:checks[0].status==="fulfilled"?"healthy":"down"},{id:"redis",name:"Redis",state:checks[1].status==="fulfilled"?"healthy":"down"}]};
}

export async function getAuditLog(options) { return databaseMode() ? getProductionAudit(options) : getDemoAudit(options); }
export async function getAllocationFor(eventId) { if (!databaseMode()) return getDemoAllocation(eventId); const user=await getCurrentUser(); const entry=user?await getProductionEntry(eventId,user.id):null; return entry?.seat?{seat:entry.seat,rank:entry.draw_rank,status:entry.allocation_status,confirmedAt:entry.confirmed_at,idempotencyKey:null,promoted:false,claimExpiresAt:entry.claim_expires_at}:null; }
export async function claimWindow(eventId) { if (!databaseMode()) return getDemoClaimWindow(eventId); const draw=await getDraw(eventId); const offer=await getAllocationFor(eventId); const expires=offer?.claimExpiresAt; return expires?{startedAt:draw?.completedAt,expiresAt:expires,windowMinutes:Math.max(0,Math.ceil((new Date(expires)-new Date())/60000))}:null; }
export async function drawableEventIds() { if (!databaseMode()) return demoDrawableIds(); const events=await listProductionEvents(); return events.filter((event)=>["DRAWING","CLAIMING","CLOSED","SOLD_OUT"].includes(event.state)).map((event)=>event.id); }

function toEvent(row) {
  const hasDraw=["DRAWING","CLAIMING","CLOSED","SOLD_OUT"].includes(row.state);
  const event={id:row.id,title:row.title,tagline:row.tagline||"",category:row.category,city:row.city,venue:row.venue,startsAt:row.starts_at,capacity:Number(row.capacity),participants:Number(row.participants||0),joinRequests:Number(row.join_requests||0),state:row.state,hasDraw,selected:Math.min(Number(row.capacity),Number(row.participants||0)),confirmed:Number(row.confirmed||0),offered:Number(row.offered||0),waitlistSize:Math.max(0,Number(row.participants||0)-Number(row.capacity)),entriesCloseAt:row.entry_closes_at,about:row.description,accent:row.accent||["#3f45e0","#7b83f7"],agenda:row.agenda||[]};
  return {...event,status:eventStatus(event.state),backendMode:"postgres"};
}
