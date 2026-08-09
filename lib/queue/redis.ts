import IORedis from "ioredis"
import { env } from "@/lib/env"

/**
 * Shared Redis connection.
 *
 * Redis is OPTIONAL. It powers the BullMQ queues and the shared rate-limit
 * counter, but the whole ingestion pipeline also runs from the /api/cron routes
 * with no Redis at all, which is how it deploys to Vercel. Every caller must
 * handle a null connection.
 */

const globalForRedis = globalThis as unknown as { __musictimeRedis?: IORedis | null }

export function getRedis(): IORedis | null {
  if (!env.redisUrl) return null
  if (globalForRedis.__musictimeRedis !== undefined) return globalForRedis.__musictimeRedis

  const client = new IORedis(env.redisUrl, {
    // BullMQ requires this to be null: it blocks on BRPOPLPUSH and a retry
    // ceiling would tear the worker down mid-wait.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  })

  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message)
  })

  globalForRedis.__musictimeRedis = client
  return client
}

/** Throwing accessor for the queue layer, which genuinely cannot run without it. */
export function requireRedis(): IORedis {
  const client = getRedis()
  if (!client) {
    throw new Error("REDIS_URL is not set. The BullMQ queues need Redis; use the cron routes instead.")
  }
  return client
}

export async function closeRedis(): Promise<void> {
  const client = globalForRedis.__musictimeRedis
  if (client) {
    await client.quit().catch(() => {})
    globalForRedis.__musictimeRedis = undefined
  }
}
