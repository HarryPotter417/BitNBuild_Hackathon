import { getSessionUser } from "../../../../../server/auth.js";
import { clientAddress, enforceRateLimit } from "../../../../../server/rate-limit.js";
import { claimProductionSeat } from "../../../../../server/production-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user?.email_verified_at) return Response.json({ error: "Sign in with a verified account to claim." }, { status: 401 });
    const key = request.headers.get("idempotency-key");
    const address = clientAddress(request);
    const rateLimitAddress = clientAddress(request, user.id);
    const [userLimit, ipLimit] = await Promise.all([
      enforceRateLimit(`claim-user:${user.id}`, { limit: 15, windowMs: 60_000 }),
      enforceRateLimit(`claim-ip:${rateLimitAddress}`, { limit: 60, windowMs: 10_000 }),
    ]);
    if (!userLimit.allowed || !ipLimit.allowed) return Response.json({ error: "Too many requests. Your allocation is protected; try again shortly." }, { status: 429 });
    const result = await claimProductionSeat(id, user.id, key, address);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error.status || 503;
    if (status >= 500) console.error("Claim request failed", error);
    return Response.json({ error: status >= 500 ? "Claim service is temporarily unavailable." : error.message }, { status });
  }
}
