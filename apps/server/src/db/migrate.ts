import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

// Funktioniert sowohl aus src/db (tsx) als auch aus dist (gebündelt).
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.resolve(here, "../../drizzle"), path.resolve(here, "../drizzle")];

/** Beliebige, feste Kennung für die Advisory-Lock der Migrationen. */
const MIGRATION_LOCK_ID = 727_272_001;

/**
 * Führt ausstehende Migrationen aus. Eine Advisory-Lock sorgt dafür, dass bei mehreren
 * gleichzeitig startenden Instanzen (z. B. Rolling Deploy) nur eine migriert.
 */
export async function runMigrations() {
  const migrationsFolder = candidates.find((p) => existsSync(path.join(p, "meta", "_journal.json")));
  if (!migrationsFolder) throw new Error("Kein Migrationsordner gefunden (npm run db:generate ausführen)");

  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
