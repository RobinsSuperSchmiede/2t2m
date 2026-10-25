import { pool } from "./index.js";
import { runMigrations } from "./migrate.js";

runMigrations()
  .then(() => {
    console.log("Migrationen ausgeführt.");
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
