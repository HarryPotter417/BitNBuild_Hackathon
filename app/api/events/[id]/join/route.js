import { getSessionUser } from "../../../../../server/auth.js";
import { allowJoinRequest, verifyChallenge } from "../../../../../server/bot-guard.js";
import { clientAddress } from "../../../../../server/rate-limit.js";
import { joinProductionEvent } from "../../../../../server/production-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in to enter this event." }, { status: 401 });
    if (!user.email_verified_at) return Response.json({ error: "Verify your email before entering." }, { status: 403 });
    const body = await request.json();
    if (!(await verifyChallenge(request, user.id, body.challenge, body.solution))) return Response.json({ error: "Request verification failed. Get a new challenge and try again." }, { status: 403 });
    const rate = await allowJoinRequest(request, user.id);
    if (!rate.allowed) return Response.json({ error: "Too many requests. Your entry state is unchanged." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } });
    const result = await joinProductionEvent(id, user.id, clientAddress(request));
    return Response.json(result, { status: result.code || 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Join request failed", error);
    return Response.json({ error: "Entry service is temporarily unavailable." }, { status: 503 });
  }
}
