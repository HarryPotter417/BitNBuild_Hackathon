import { getPool } from "../../../server/database.js";
import { getRedis } from "../../../server/rate-limit.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await Promise.allSettled([
    getPool().query("SELECT 1"),
    getRedis().ping(),
  ]);
  const services = { postgres: checks[0].status === "fulfilled", redis: checks[1].status === "fulfilled" };
  const healthy = Object.values(services).every(Boolean);
  return Response.json({ status: healthy ? "healthy" : "degraded", services, checkedAt: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
