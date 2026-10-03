import { Queue } from "bullmq";
import { getRedis } from "./rate-limit.js";

let drawQueue;
export function getDrawQueue() {
  if (!drawQueue) drawQueue = new Queue("fairdrop-draws", { connection: getRedis() });
  return drawQueue;
}

export async function enqueueDraw(eventId) {
  return getDrawQueue().add("draw", { eventId }, { jobId: `draw-${eventId}`, attempts: 4, backoff: { type: "exponential", delay: 1500 }, removeOnComplete: 500, removeOnFail: 1000 });
}
