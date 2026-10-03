import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./database.js";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 14;
const SESSION_COOKIE = "fairdrop_session";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

function requireAuthSecret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
}

export function sessionCookieName() { return SESSION_COOKIE; }
export function sessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 };
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    throw new Error("Password must be between 12 and 200 characters.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, saltHex, hashHex] = String(encoded || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function issueSession(userId) {
  requireAuthSecret();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await getPool().query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)", [userId, hashToken(token), expiresAt]);
  return token;
}

export async function getSessionUser(request) {
  requireAuthSecret();
  const cookie = request.cookies?.get?.(SESSION_COOKIE)?.value || readCookieHeader(request.headers.get("cookie"), SESSION_COOKIE);
  if (!cookie) return null;
  const { rows } = await getPool().query(
    `SELECT u.id,u.email,u.display_name AS name,u.role,u.email_verified_at
       FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now()`, [hashToken(cookie)]);
  return rows[0] ? { ...rows[0], initials: rows[0].name.split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toUpperCase() } : null;
}

export async function revokeSession(request) {
  const cookie = request.cookies?.get?.(SESSION_COOKIE)?.value || readCookieHeader(request.headers.get("cookie"), SESSION_COOKIE);
  if (cookie) await getPool().query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(cookie)]);
}

function readCookieHeader(header, name) {
  const found = header?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}
