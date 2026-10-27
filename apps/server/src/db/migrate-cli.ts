import { logger } from "../logger.js";
import { pool } from "./index.js";
import { runMigrations } from "./migrate.js";

runMigrations()
  .then(() => {
    logger.info("Migrationen ausgeführt");
    return pool.end();
  })
  .catch((err) => {
    logger.fatal({ err }, "Migration fehlgeschlagen");
    process.exit(1);
  });
