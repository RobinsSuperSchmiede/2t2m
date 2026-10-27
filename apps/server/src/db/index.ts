import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.js";
import { logger } from "../logger.js";
import * as schema from "./schema.js";

function sslConfig(): pg.PoolConfig["ssl"] {
  switch (env.DATABASE_SSL) {
    case "disable":
      return false;
    case "require":
      return { rejectUnauthorized: false };
    case "verify":
      return { rejectUnauthorized: true };
  }
}

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig(),
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Hängende Abfragen dürfen den Pool nicht dauerhaft blockieren.
  statement_timeout: 15_000,
  application_name: "2t2m-server",
});

// Fehler einer untätigen Verbindung (z. B. DB-Failover) würden sonst den Prozess beenden.
pool.on("error", (err) => logger.error({ err }, "Fehler einer Datenbankverbindung im Pool"));

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Für den Readiness-Check: kurze Abfrage, ob die Datenbank erreichbar ist. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}

export { schema };
