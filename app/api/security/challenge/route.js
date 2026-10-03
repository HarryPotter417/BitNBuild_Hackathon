import { getSessionUser } from "../../../../server/auth.js";
import { issueChallenge } from "../../../../server/bot-guard.js";
import { clientAddress, enforceRateLimit } from "../../../../server/rate-limit.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const address=clientAddress(request);
    const ipLimit=await enforceRateLimit(`challenge-ip:${address}`,{limit:60,windowMs:10_000});
    if(!ipLimit.allowed)return Response.json({error:"Too many challenge requests. Try again shortly."},{status:429,headers:{"Retry-After":String(Math.ceil(ipLimit.retryAfterMs/1000))}});
    const user = await getSessionUser(request);
    if (!user?.email_verified_at) return Response.json({ error: "Sign in with a verified account to enter." }, { status: 401 });
    const challenge = await issueChallenge(request, user.id);
    if (!challenge) return Response.json({ error: "Too many challenge requests. Try again shortly." }, { status: 429 });
    return Response.json(challenge, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Challenge service unavailable", error);
    return Response.json({ error: "Protection service temporarily unavailable." }, { status: 503 });
  }
}
