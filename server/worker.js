import Redis from "ioredis";
import { Worker } from "bullmq";
import { getPool } from "./database.js";
import { expireAndPromote, performProductionDraw } from "./production-store.js";
import { enqueueDraw } from "./queue.js";

if(!process.env.REDIS_URL||!process.env.DATABASE_URL)throw new Error("DATABASE_URL and REDIS_URL are required for the worker.");
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const worker=new Worker("fairdrop-draws",async(job)=>performProductionDraw(job.data.eventId),{connection,concurrency:Number(process.env.DRAW_WORKER_CONCURRENCY||2)});
worker.on("failed",(job,error)=>console.error("Draw job failed",job?.id,error));
worker.on("error",(error)=>console.error("Worker error",error));

async function reconcile(){
  try {
    const queued=await getPool().query("SELECT id FROM events WHERE state='FROZEN'");
    for(const row of queued.rows)await enqueueDraw(row.id);
    const expired=await getPool().query("SELECT DISTINCT event_id FROM allocations WHERE status='OFFERED' AND claim_expires_at<=now() LIMIT 100");
    for(const row of expired.rows)await expireAndPromote(row.event_id);
  } catch(error){console.error("Worker reconciliation failed",error);}
}
await reconcile();
setInterval(reconcile,10_000).unref();
console.log("Fair Drop draw and expiry worker started.");
