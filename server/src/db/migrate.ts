import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index.js";

// Funktioniert sowohl aus src/db (tsx) als auch aus dist (gebündelt).
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.resolve(here, "../../drizzle"), path.resolve(here, "../drizzle")];

export async function runMigrations() {
  const { existsSync } = await import("node:fs");
  const migrationsFolder = candidates.find((p) => existsSync(path.join(p, "meta", "_journal.json")));
  if (!migrationsFolder) throw new Error("Kein Migrationsordner gefunden (npm run db:generate ausführen)");
  await migrate(db, { migrationsFolder });
}
