import Redis from "ioredis";

let redis;
export function getRedis() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required.");
  if (!redis) redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  return redis;
}

const LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export async function enforceRateLimit(key, { limit, windowMs }) {
  const redisClient = getRedis();
  const result = await redisClient.eval(LIMIT_SCRIPT, 1, `fd:limit:${key}`, windowMs);
  const [count, ttl] = result.map(Number);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterMs: Math.max(0, ttl) };
}

export function clientAddress(request) {
  // Trust only the ingress proxy configured by the deployment.
  const forwarded = process.env.TRUST_PROXY === "true" ? request.headers.get("x-forwarded-for") : null;
  return (forwarded?.split(",")[0]?.trim() || "unknown").slice(0, 64);
}
