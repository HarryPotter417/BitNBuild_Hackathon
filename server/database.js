import pg from "pg";

const { Pool } = pg;
let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
    pool.on("error", (error) => console.error("PostgreSQL pool error", error));
  }
  return pool;
}

export async function withTransaction(callback, isolation = "READ COMMITTED") {
  const client = await getPool().connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
