import { randomBytes, createHash } from "node:crypto";
import { getPool, withTransaction } from "../../../../server/database.js";
import { hashPassword } from "../../../../server/auth.js";
import { sendVerificationEmail } from "../../../../server/email.js";
import { clientAddress, enforceRateLimit } from "../../../../server/rate-limit.js";

export const runtime = "nodejs";

export async function POST(request) {
  const address = clientAddress(request);
  try {
    const limit = await enforceRateLimit(`register:${address}`, { limit: 5, windowMs: 60_000 });
    if (!limit.allowed) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return Response.json({ error: "Enter a valid email and name." }, { status: 400 });
    const passwordHash = await hashPassword(body.password);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await withTransaction(async (client) => {
      const inserted = await client.query("INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id,email", [email, name, passwordHash]);
      await client.query("INSERT INTO email_verifications(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [inserted.rows[0].id, tokenHash]);
      return inserted.rows[0];
    });
    await sendVerificationEmail(email, token);
    return Response.json({ ok: true, message: "Check your email for a verification link." }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") return Response.json({ error: "Unable to create this account. Check the details or sign in." }, { status: 409 });
    console.error("Registration failed", error);
    return Response.json({ error: "Registration is temporarily unavailable." }, { status: 503 });
  }
}
