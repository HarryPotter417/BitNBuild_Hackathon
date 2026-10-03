import { listProductionEvents } from "../../../server/production-store.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try { return Response.json({ events: await listProductionEvents() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Event listing failed", error); return Response.json({ error: "Events are temporarily unavailable." }, { status: 503 }); }
}
