import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Database-backed tests share one Postgres schema, so they must not race
    // each other. Pure-logic files are unaffected by the single fork.
    pool: "forks",
    maxForks: 1,
    minForks: 1,
    testTimeout: 30_000,
  },
})
