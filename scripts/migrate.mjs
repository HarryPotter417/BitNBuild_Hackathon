import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPool } from "../server/database.js";

const pool = getPool();
const sql = await readFile(resolve("db/migrations/001_initial.sql"), "utf8");
await pool.query(sql);
console.log("Database schema is up to date.");
await pool.end();
