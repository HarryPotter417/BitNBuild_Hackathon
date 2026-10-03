import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { getPool, withTransaction } from "./database.js";
import { computeSnapshotHash, commitSeed, rankParticipants } from "./draw.js";
import { enqueueDraw } from "./queue.js";
import { eventStatus } from "../lib/status.js";

function encryptSeed(seed) {
  const key = Buffer.from(process.env.DRAW_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("DRAW_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(seed, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decryptSeed(buffer) {
  const key = Buffer.from(process.env.DRAW_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("DRAW_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8");
}

export async function listProductionEvents() {
  const { rows } = await getPool().query(`
    SELECT e.*, counts.participants, counts.join_requests, counts.confirmed, counts.offered
      FROM events e
      LEFT JOIN LATERAL (
        SELECT count(en.id)::int AS participants,coalesce(sum(en.request_count),0)::float8 AS join_requests,
          count(*) FILTER (WHERE a.status='CONFIRMED')::int AS confirmed,
          count(*) FILTER (WHERE a.status='OFFERED')::int AS offered
        FROM entries en LEFT JOIN allocations a ON a.event_id=en.event_id AND a.user_id=en.user_id
        WHERE en.event_id=e.id
      ) counts ON true
     ORDER BY e.starts_at ASC`);
  return rows.map(mapEvent);
}

export async function getProductionEvent(id) {
  const { rows } = await getPool().query(`
    SELECT e.*, counts.participants, counts.join_requests, counts.confirmed, counts.offered
      FROM events e LEFT JOIN LATERAL (
        SELECT count(en.id)::int AS participants,coalesce(sum(en.request_count),0)::float8 AS join_requests,
          count(*) FILTER (WHERE a.status='CONFIRMED')::int AS confirmed,
          count(*) FILTER (WHERE a.status='OFFERED')::int AS offered
        FROM entries en LEFT JOIN allocations a ON a.event_id=en.event_id AND a.user_id=en.user_id
        WHERE en.event_id=e.id
      ) counts ON true WHERE e.id=$1`, [id]);
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function joinProductionEvent(eventId, userId, address) {
  return withTransaction(async (client) => {
    const event = await client.query("SELECT state FROM events WHERE id=$1 FOR KEY SHARE", [eventId]);
    if (!event.rowCount) return { ok: false, code: 404, message: "Event not found." };
    if (event.rows[0].state !== "OPEN") return { ok: false, code: 409, message: "Entries are not open for this event." };
    const entry = await client.query(`
      INSERT INTO entries(event_id,user_id) VALUES($1,$2)
      ON CONFLICT(event_id,user_id) DO UPDATE SET request_count=entries.request_count+1
      RETURNING id,status,request_count,created_at,(xmax=0) AS created`, [eventId, userId]);
    const row = entry.rows[0];
    if (row.created) await writeAudit(client, eventId, userId, "ENTRY_CREATED", { address });
    return { ok: true, duplicate: !row.created, entry: { id: row.id, eventId, status: row.status, requestCount: row.request_count, joinedAt: row.created_at }, message: row.created ? "Entry confirmed." : "You already have an entry. This request did not create another one." };
  });
}

export async function freezeAndQueueDraw(eventId, actorId) {
  const frozen = await withTransaction(async (client) => {
    const eventResult = await client.query("SELECT id,state,capacity FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    const event = eventResult.rows[0];
    if (!event) throw httpError(404, "Event not found.");
    if (event.state !== "OPEN") throw httpError(409, "Only an open event can be frozen.");
    const entries = await client.query("SELECT user_id FROM entries WHERE event_id=$1 ORDER BY user_id", [eventId]);
    if (!entries.rowCount) throw httpError(409, "Cannot draw an event with no entries.");
    const participantIds = entries.rows.map((row) => row.user_id);
    const snapshotHash = computeSnapshotHash(eventId, participantIds);
    const seed = randomBytes(32).toString("hex");
    const encryptedSeed = encryptSeed(seed);
    await client.query("UPDATE events SET state='FROZEN',updated_at=now() WHERE id=$1", [eventId]);
    await client.query(`INSERT INTO draws(event_id,snapshot_hash,commitment_hash,encrypted_seed,participant_count,frozen_at)
      VALUES($1,$2,$3,$4,$5,now())`, [eventId, snapshotHash, commitSeed(seed), encryptedSeed, participantIds.length]);
    await writeAudit(client, eventId, actorId, "PARTICIPANT_SET_FROZEN", { participants: participantIds.length, capacity: event.capacity, snapshotHash });
    return { eventId };
  });
  await enqueueDraw(frozen.eventId);
  return { ok: true, status: "FROZEN" };
}

export async function performProductionDraw(eventId) {
  const pool = getPool();
  const setup = await pool.query(`SELECT e.state,e.capacity,e.claim_window_seconds,d.snapshot_hash,d.commitment_hash,d.encrypted_seed
    FROM events e JOIN draws d ON d.event_id=e.id WHERE e.id=$1`, [eventId]);
  const draw = setup.rows[0];
  if (!draw || !["FROZEN", "DRAWING"].includes(draw.state)) return { skipped: true };
  const entries = await pool.query("SELECT user_id FROM entries WHERE event_id=$1 ORDER BY user_id", [eventId]);
  const participantIds = entries.rows.map((row) => row.user_id);
  const snapshotHash = computeSnapshotHash(eventId, participantIds);
  if (snapshotHash !== draw.snapshot_hash || commitSeed(decryptSeed(draw.encrypted_seed)) !== draw.commitment_hash) {
    throw new Error("Frozen participant snapshot or seed commitment failed verification.");
  }
  const seed = decryptSeed(draw.encrypted_seed);
  await pool.query("UPDATE draws SET stage='ranking',started_at=COALESCE(started_at,now()),progress=NULL WHERE event_id=$1",[eventId]);
  const ranking = rankParticipants({ eventId, participantIds, snapshotHash, seed, capacity: draw.capacity });
  await withTransaction(async (client) => {
    await client.query("SELECT id FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    const current = await client.query("SELECT state FROM events WHERE id=$1", [eventId]);
    if (current.rows[0]?.state === "CLAIMING") return;
    if (!current.rows[0] || !["FROZEN", "DRAWING"].includes(current.rows[0].state)) throw new Error("Event state changed while draw was running.");
    await client.query("UPDATE draws SET stage='selecting' WHERE event_id=$1",[eventId]);
    await client.query("UPDATE events SET state='DRAWING',updated_at=now() WHERE id=$1", [eventId]);
    const selected = new Set(ranking.selectedIds);
    for (let i = 0; i < ranking.all.length; i += 1) {
      const row = ranking.all[i];
      await client.query("UPDATE entries SET draw_rank=$3,status=$4 WHERE event_id=$1 AND user_id=$2", [eventId, row.id, i + 1, selected.has(row.id) ? "SELECTED" : "WAITLISTED"]);
    }
    const expiry = new Date(Date.now() + draw.claim_window_seconds * 1000);
    for (let i = 0; i < ranking.selected.length; i += 1) {
      const row = ranking.selected[i];
      await client.query("INSERT INTO allocations(event_id,user_id,rank,seat,status,claim_expires_at) VALUES($1,$2,$3,$4,'OFFERED',$5)", [eventId, row.id, i + 1, seatLabel(i), expiry]);
    }
    await client.query("UPDATE draws SET started_at=COALESCE(started_at,now()),completed_at=now(),revealed_seed=$2,stage='complete',progress=100 WHERE event_id=$1", [eventId, seed]);
    await client.query("UPDATE events SET state='CLAIMING',updated_at=now() WHERE id=$1", [eventId]);
    await writeAudit(client, eventId, null, "DRAW_COMPLETED", { participants: participantIds.length, selected: ranking.selected.length, snapshotHash });
  });
  return { skipped: false, participants: participantIds.length, selected: ranking.selected.length };
}

export async function claimProductionSeat(eventId, userId, idempotencyKey, address) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey || "")) throw httpError(400, "A valid Idempotency-Key header is required.");
  return withTransaction(async (client) => {
    const replay = await client.query("SELECT * FROM allocations WHERE event_id=$1 AND idempotency_key=$2 FOR UPDATE", [eventId, idempotencyKey]);
    if (replay.rowCount) return { ok: true, replay: true, allocation: publicAllocation(replay.rows[0]) };
    const { rows } = await client.query("SELECT a.* ,e.state FROM allocations a JOIN events e ON e.id=a.event_id WHERE a.event_id=$1 AND a.user_id=$2 FOR UPDATE OF a", [eventId, userId]);
    const allocation = rows[0];
    if (!allocation) throw httpError(404, "No seat offer exists for this account.");
    if (allocation.status === "CONFIRMED") return { ok: true, replay: true, allocation: publicAllocation(allocation) };
    if (allocation.status !== "OFFERED" || allocation.state !== "CLAIMING") throw httpError(409, "This seat is no longer available to claim.");
    if (new Date(allocation.claim_expires_at) <= new Date()) throw httpError(410, "The claim window has expired.");
    const updated = await client.query("UPDATE allocations SET status='CONFIRMED',idempotency_key=$3,confirmed_at=now() WHERE event_id=$1 AND user_id=$2 AND status='OFFERED' RETURNING *", [eventId, userId, idempotencyKey]);
    await client.query("UPDATE entries SET status='CONFIRMED' WHERE event_id=$1 AND user_id=$2", [eventId, userId]);
    await writeAudit(client, eventId, userId, "ALLOCATION_CONFIRMED", { seat: allocation.seat, idempotencyKey, address });
    return { ok: true, replay: false, allocation: publicAllocation(updated.rows[0]) };
  });
}

export async function expireAndPromote(eventId) {
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    const expired = await client.query("SELECT * FROM allocations WHERE event_id=$1 AND status='OFFERED' AND claim_expires_at<=now() ORDER BY rank FOR UPDATE SKIP LOCKED LIMIT 1", [eventId]);
    if (!expired.rowCount) return false;
    const offer = expired.rows[0];
    await client.query("UPDATE allocations SET status='EXPIRED' WHERE id=$1", [offer.id]);
    await client.query("UPDATE entries SET status='EXPIRED' WHERE event_id=$1 AND user_id=$2", [eventId, offer.user_id]);
    const next = await client.query("SELECT user_id,draw_rank FROM entries WHERE event_id=$1 AND status='WAITLISTED' ORDER BY draw_rank LIMIT 1 FOR UPDATE SKIP LOCKED", [eventId]);
    if (next.rowCount) {
      const event = await client.query("SELECT claim_window_seconds FROM events WHERE id=$1", [eventId]);
      const row = next.rows[0];
      await client.query("INSERT INTO allocations(event_id,user_id,rank,seat,status,claim_expires_at) VALUES($1,$2,$3,$4,'OFFERED',now()+($5*interval '1 second'))", [eventId, row.user_id, row.draw_rank, offer.seat, event.rows[0].claim_window_seconds]);
      await client.query("UPDATE entries SET status='SELECTED' WHERE event_id=$1 AND user_id=$2", [eventId, row.user_id]);
      await writeAudit(client, eventId, null, "WAITLIST_PROMOTED", { rank: row.draw_rank, seat: offer.seat });
    }
    await writeAudit(client, eventId, null, "CLAIM_EXPIRED", { seat: offer.seat });
    return true;
  });
}

export async function getProductionEntry(eventId, userId) {
  const { rows } = await getPool().query(`SELECT en.*,a.seat,a.status AS allocation_status,a.claim_expires_at,a.confirmed_at,d.snapshot_hash,d.commitment_hash,d.revealed_seed,d.algorithm,d.version,e.capacity
    FROM entries en JOIN events e ON e.id=en.event_id LEFT JOIN allocations a ON a.event_id=en.event_id AND a.user_id=en.user_id LEFT JOIN draws d ON d.event_id=en.event_id
    WHERE en.event_id=$1 AND en.user_id=$2`, [eventId, userId]);
  return rows[0] || null;
}

export async function getProductionHistory(userId) {
  const { rows } = await getPool().query(`SELECT e.id AS event_id,e.title,e.city,e.starts_at,en.status,en.draw_rank,a.seat,a.confirmed_at
    FROM entries en JOIN events e ON e.id=en.event_id LEFT JOIN allocations a ON a.event_id=en.event_id AND a.user_id=en.user_id WHERE en.user_id=$1 ORDER BY e.starts_at DESC`, [userId]);
  return rows;
}

export async function getProductionVerification(eventId, userId) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const drawResult = await client.query("SELECT d.*,e.capacity FROM draws d JOIN events e ON e.id=d.event_id WHERE d.event_id=$1", [eventId]);
    const draw = drawResult.rows[0];
    if (!draw) return null;
    const entries = await client.query("SELECT user_id,draw_rank FROM entries WHERE event_id=$1 ORDER BY user_id", [eventId]);
    const participants = entries.rows.map((row) => row.user_id);
    const snapshotMatches = computeSnapshotHash(eventId, participants) === draw.snapshot_hash;
    const seedMatches = draw.revealed_seed ? commitSeed(draw.revealed_seed) === draw.commitment_hash : null;
    const ranking = draw.revealed_seed && snapshotMatches ? rankParticipants({ eventId, participantIds: participants, snapshotHash: draw.snapshot_hash, seed: draw.revealed_seed, capacity: draw.capacity }) : null;
    const rankedEntries = entries.rows.filter((row) => row.draw_rank && row.draw_rank <= draw.capacity).sort((a,b) => a.draw_rank-b.draw_rank);
    const selectedMatches = ranking ? rankedEntries.length === ranking.selected.length && rankedEntries.every((row,index)=>row.user_id===ranking.selected[index]?.id) : null;
    const own = userId ? entries.rows.find((row) => row.user_id === userId) : null;
    return {
      eventId,algorithm:draw.algorithm,version:draw.version,participantCount:participants.length,capacity:draw.capacity,
      snapshotHash:draw.snapshot_hash,commitmentHash:draw.commitment_hash,revealedSeed:draw.revealed_seed,
      publishedAt:draw.frozen_at,revealedAt:draw.completed_at,selectedCount:Math.min(draw.capacity,participants.length),
      verified:Boolean(snapshotMatches && seedMatches && selectedMatches),
      checks:[{id:"snapshot",ok:snapshotMatches},{id:"commitment",ok:seedMatches},{id:"ranking",ok:selectedMatches}],
      user:own ? { id:own.user_id,rank:own.draw_rank,selected:own.draw_rank<=draw.capacity,score:ranking?.all[own.draw_rank-1]?.score||null,seat:own.draw_rank<=draw.capacity?seatLabel(own.draw_rank-1):null } : null,
      publishedSample:ranking?.selected.slice(0,8).map((row,index)=>({rank:index+1,id:row.id,score:row.score}))||[],
    };
  } finally { await client.query("ROLLBACK"); client.release(); }
}

export async function getProductionMetrics(eventId) {
  const { rows } = await getPool().query(`SELECT e.id,e.title,e.capacity,e.state,
    coalesce(en.unique_entries,0)::int AS unique_entries,coalesce(en.join_requests,0)::float8 AS join_requests,
    coalesce(en.users_with_retries,0)::int AS users_with_retries,
    coalesce(a.confirmed_allocations,0)::int AS confirmed_allocations,
    coalesce(a.offered_allocations,0)::int AS offered_allocations,
    coalesce(a.expired_allocations,0)::int AS expired_allocations,
    coalesce(d.participant_count,0)::int AS frozen_participants
    FROM events e
    LEFT JOIN LATERAL (SELECT count(*) AS unique_entries,coalesce(sum(request_count),0) AS join_requests,count(*) FILTER (WHERE request_count>1) AS users_with_retries FROM entries WHERE event_id=e.id) en ON true
    LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE status='CONFIRMED') AS confirmed_allocations,count(*) FILTER (WHERE status='OFFERED') AS offered_allocations,count(*) FILTER (WHERE status='EXPIRED') AS expired_allocations FROM allocations WHERE event_id=e.id) a ON true
    LEFT JOIN draws d ON d.event_id=e.id WHERE ($1::text IS NULL OR e.id=$1) ORDER BY e.id`, [eventId || null]);
  return rows;
}

export async function getProductionAudit({ eventId, limit = 100 } = {}) {
  const { rows } = await getPool().query(`SELECT a.*,u.email AS actor,e.title AS event_title FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN events e ON e.id=a.event_id WHERE ($1::text IS NULL OR a.event_id=$1) ORDER BY a.created_at DESC LIMIT $2`, [eventId || null, Math.min(500, Math.max(1, limit))]);
  return rows;
}

async function writeAudit(client, eventId, actorId, action, metadata) {
  await client.query("INSERT INTO audit_log(event_id,actor_id,action,request_id,metadata) VALUES($1,$2,$3,$4,$5)", [eventId, actorId, action, randomUUID(), metadata || {}]);
}

function mapEvent(row) {
  return { id: row.id,title: row.title,tagline: row.tagline,about: row.description,category: row.category,city: row.city,venue: row.venue,startsAt: row.starts_at,capacity: row.capacity,state: row.state,participants:Number(row.participants||0),joinRequests:Number(row.join_requests||0),confirmed:Number(row.confirmed||0),offered:Number(row.offered||0),waitlistSize:Math.max(0,Number(row.participants||0)-Number(row.capacity)),hasDraw:["FROZEN","DRAWING","CLAIMING","CLOSED","SOLD_OUT"].includes(row.state),selected:Math.min(Number(row.participants||0),Number(row.capacity)),status:eventStatus(row.state),entriesCloseAt:row.entry_closes_at,accent:["#3f45e0","#7b83f7"],agenda:[],backendMode:"postgres" };
}

function publicAllocation(row) { return { eventId:row.event_id,userId:row.user_id,seat:row.seat,rank:row.rank,status:row.status,confirmedAt:row.confirmed_at,claimExpiresAt:row.claim_expires_at }; }
function seatLabel(index) { return `${String.fromCharCode(65 + Math.floor(index / 120))}-${String(index + 1).padStart(3,"0")}`; }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
export { httpError };
