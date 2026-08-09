import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
import { closeDb, db } from "../lib/db"
import { describeConfig } from "../lib/env"

/**
 * Apply migrations.
 *
 * Extensions are created first and separately. The generated SQL declares GIN
 * trigram indexes, and `gin_trgm_ops` does not exist until pg_trgm is
 * installed, so a fresh database would otherwise fail on the first index with
 * an error that does not name the real cause.
 */
async function main() {
  console.log(`[migrate] ${describeConfig()}`)

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
  console.log("[migrate] extensions ready: pg_trgm, pgcrypto")

  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("[migrate] done")

  await closeDb()
}

main().catch(async (error) => {
  console.error("[migrate] failed:", error)
  await closeDb()
  process.exit(1)
})
