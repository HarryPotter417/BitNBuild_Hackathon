import { revokeSession, sessionCookieName } from "../../../../server/auth.js";

export const runtime = "nodejs";

export async function POST(request) {
  try { await revokeSession(request); }
  catch (error) { console.error("Session revocation failed", error); }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${sessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` } });
}
