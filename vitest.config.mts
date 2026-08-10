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
    // each other. Pure-logic files are unaffected by the single fork. A single
    // fork alone is not enough: Vitest still interleaves individual tests
    // across files by default, so a second integration file's beforeEach
    // truncate() can fire mid-assertion in the first file's test. Disabling
    // file parallelism forces strictly one file at a time.
    pool: "forks",
    maxForks: 1,
    minForks: 1,
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
