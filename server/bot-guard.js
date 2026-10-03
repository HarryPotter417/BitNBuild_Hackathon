import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { clientAddress, enforceRateLimit, getRedis } from "./rate-limit.js";

const DIFFICULTY_BITS = Math.max(12, Math.min(22, Number(process.env.POW_DIFFICULTY_BITS || 16)));
const hmac = (value) => createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");

function requireSecret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

export async function issueChallenge(request, userId) {
  requireSecret();
  const ip = clientAddress(request);
  const limit = await enforceRateLimit(`pow:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return null;
  const nonce = randomBytes(24).toString("base64url");
  const expires = Math.floor(Date.now() / 1000) + 120;
  await getRedis().set(`fd:pow:${nonce}`, userId, "EX", 120, "NX");
  const payload = `${nonce}.${expires}.${userId}.${ip}`;
  return { token: `${payload}.${hmac(payload)}`, difficultyBits: DIFFICULTY_BITS, expiresAt: expires };
}

export async function verifyChallenge(request, userId, token, solution) {
  requireSecret();
  if (typeof token !== "string" || token.length > 512 || typeof solution !== "string" || solution.length > 32) return false;
  const parts = token.split(".");
  if (parts.length !== 5) return false;
  const [nonce, expiryText, boundUser, boundIp, signature] = parts;
  const expiry = Number(expiryText);
  if (boundUser !== userId || boundIp !== clientAddress(request) || !Number.isInteger(expiry) || expiry < Date.now() / 1000 || expiry > Date.now() / 1000 + 120) return false;
  const payload = parts.slice(0, 4).join(".");
  const expected = Buffer.from(hmac(payload), "hex");
  const supplied = Buffer.from(signature, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return false;
  const digest = createHash("sha256").update(`${nonce}:${solution}`).digest();
  let zeroBits = 0;
  for (const byte of digest) {
    if (byte === 0) zeroBits += 8;
    else { zeroBits += Math.clz32(byte) - 24; break; }
  }
  if (zeroBits < DIFFICULTY_BITS) return false;
  return (await getRedis().getdel(`fd:pow:${nonce}`)) === userId;
}

export async function allowJoinRequest(request, userId) {
  const [ipLimit, userLimit] = await Promise.all([
    enforceRateLimit(`join-ip:${clientAddress(request)}`, { limit: 80, windowMs: 10_000 }),
    enforceRateLimit(`join-user:${userId}`, { limit: 20, windowMs: 60_000 }),
  ]);
  return { allowed: ipLimit.allowed && userLimit.allowed, retryAfterMs: Math.max(ipLimit.retryAfterMs, userLimit.retryAfterMs) };
}
