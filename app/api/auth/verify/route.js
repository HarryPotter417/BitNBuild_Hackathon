import { createHash } from "node:crypto";
import { getPool } from "../../../../server/database.js";

export const runtime = "nodejs";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 200) return Response.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  const hash = createHash("sha256").update(token).digest("hex");
  const result = await getPool().query(
    `UPDATE users SET email_verified_at=now() WHERE id=(SELECT user_id FROM email_verifications WHERE token_hash=$1 AND expires_at>now()) RETURNING id`, [hash]);
  if (!result.rowCount) return Response.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  await getPool().query("DELETE FROM email_verifications WHERE token_hash=$1", [hash]);
  return Response.redirect(new URL("/auth/verified", request.url));
}
