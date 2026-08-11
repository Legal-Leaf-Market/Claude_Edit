import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
import { closeDb, db } from "../lib/db"
import { describeConfig, env } from "../lib/env"

/**
 * Apply migrations.
 *
 * Extensions are created first and separately. The generated SQL declares GIN
 * trigram indexes, and `gin_trgm_ops` does not exist until pg_trgm is
 * installed, so a fresh database would otherwise fail on the first index with
 * an error that does not name the real cause.
 *
 * DEPLOY MODE (`--deploy`) is what `npm run build` uses, so that a deploy
 * migrates the database it is about to serve. It exists because the
 * alternative bit us: migration 0006 added `avg_new_price_cents`, the new code
 * selected it in every search query, `next build` does not run migrations, and
 * the deploy therefore shipped code that 500s on the homepage against a schema
 * that had never been updated. A deploy that cannot fail that way is worth the
 * two guards below.
 *
 * Deploy mode differs from a normal run in exactly two ways, and both are
 * about not breaking builds that have no business touching a database.
 */

/**
 * A lock id for `pg_advisory_lock`. Any constant works as long as nothing else
 * in this database uses the same one; it is derived from the project name so a
 * collision would have to be deliberate.
 */
const MIGRATION_LOCK_ID = 8_675_309_001

async function main() {
  const deployMode = process.argv.includes("--deploy")

  /*
   * GUARD ONE: no database, no migration, no failed build.
   *
   * Preview deploys, CI type-check jobs and a fresh clone all run the build
   * with no DATABASE_URL. Failing there would block deploys that were never
   * going to touch Postgres, so deploy mode skips and says so. A normal run
   * still fails loudly, because someone typing `npm run db:migrate` by hand
   * means to migrate something.
   */
  if (deployMode && !env.databaseUrl) {
    console.log("[migrate] DATABASE_URL is not set, skipping migrations for this build.")
    return
  }

  console.log(`[migrate] ${describeConfig()}`)

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
  console.log("[migrate] extensions ready: pg_trgm, pgcrypto")

  /*
   * GUARD TWO: one migrator at a time.
   *
   * Two deploys can build concurrently, and two migrators racing on the same
   * database is how you get a half-applied schema and a journal that disagrees
   * with reality. The advisory lock serialises them: the second build waits,
   * then finds the work already done and applies nothing.
   *
   * The lock is session-scoped and this script's pool is closed in `finally`,
   * so a crash mid-migration still releases it when the connection drops.
   */
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`)
  try {
    await migrate(db, { migrationsFolder: "./drizzle" })
    console.log("[migrate] done")
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`)
  }
}

main()
  .then(closeDb)
  .catch(async (error) => {
    console.error("[migrate] failed:", error)
    await closeDb()
    // Non-zero on a real failure even in deploy mode: a migration that cannot
    // apply must stop the deploy, since shipping code against the wrong schema
    // is the exact failure this whole file exists to prevent.
    process.exit(1)
  })
