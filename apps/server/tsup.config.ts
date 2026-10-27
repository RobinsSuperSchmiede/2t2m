import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/migrate-cli.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Shared-Paket liegt als TypeScript-Quelle vor und wird mitgebündelt.
  noExternal: ["@2t2m/shared"],
});
