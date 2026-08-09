import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env"
import * as schema from "./schema"

/**
 * Database access.
 *
 * The pool is created LAZILY, on first query, never at import time. Two reasons:
 *
 *   1. Plenty of modules that import `db` also export pure helpers (the deal
 *      maths, for one). Connecting on import would make those helpers
 *      untestable and unusable without a live database.
 *   2. On serverless, a route that never touches Postgres should not open a
 *      connection just because something in its import graph mentioned one.
 *
 * A single pool is cached on globalThis so Next's dev-mode module re-evaluation
 * does not leak a pool per file save until Postgres refuses new connections.
 */

const globalForDb = globalThis as unknown as {
  __musictimePool?: Pool
  __musictimeDb?: NodePgDatabase<typeof schema>
}

function makePool(): Pool {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres 14+ instance.",
    )
  }
  return new Pool({
    connectionString: env.databaseUrl,
    // Serverless platforms open a pool per instance; a small ceiling per
    // instance keeps the total under Postgres' max_connections.
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    // Neon and Supabase terminate TLS at the pooler with a chain node-postgres
    // will not verify by default.
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(env.databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  })
}

export function getPool(): Pool {
  if (!globalForDb.__musictimePool) globalForDb.__musictimePool = makePool()
  return globalForDb.__musictimePool
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.__musictimeDb) {
    globalForDb.__musictimeDb = drizzle(getPool(), { schema })
  }
  return globalForDb.__musictimeDb
}

/**
 * Drizzle client. This is a Proxy so that `import { db }` costs nothing: the
 * real client and its pool are built on the first property access, which is
 * always an actual query.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
})

/** Close the pool. Used by scripts and tests; the app leaves it open. */
export async function closeDb(): Promise<void> {
  const existing = globalForDb.__musictimePool
  if (existing) {
    await existing.end().catch(() => {})
    globalForDb.__musictimePool = undefined
    globalForDb.__musictimeDb = undefined
  }
}

export { schema }
