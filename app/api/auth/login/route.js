import { getPool } from "../../../../server/database.js";
import { issueSession, sessionCookieName, sessionCookieOptions, verifyPassword } from "../../../../server/auth.js";
import { clientAddress, enforceRateLimit } from "../../../../server/rate-limit.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const address = clientAddress(request);
    const limit = await enforceRateLimit(`login:${address}`, { limit: 10, windowMs: 60_000 });
    if (!limit.allowed) return Response.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const { rows } = await getPool().query("SELECT id,email,display_name,password_hash,email_verified_at,role FROM users WHERE email=$1", [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    if (!user.email_verified_at) return Response.json({ error: "Verify your email before signing in." }, { status: 403 });
    const token = await issueSession(user.id);
    const response = Response.json({ id: user.id, email: user.email, name: user.display_name, role: user.role });
    response.headers.append("Set-Cookie", `${sessionCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionCookieOptions().maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    console.error("Login unavailable", error);
    return Response.json({ error: "Sign in is temporarily unavailable." }, { status: 503 });
  }
}
