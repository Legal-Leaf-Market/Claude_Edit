import { closeDb } from "../lib/db"
import { describeConfig } from "../lib/env"
import { closeRedis, getRedis } from "../lib/queue/redis"
import { registerRepeatableJobs } from "../lib/queue/queues"
import { startIngestionWorker, startMaintenanceWorker } from "../lib/queue/workers"

/**
 * Long-running worker process.
 *
 * Run this alongside the web app when you want queued ingestion rather than the
 * /api/cron routes. It registers the recurring schedule on boot, so a fresh
 * Redis picks up the right cadence without a separate setup step.
 */
async function main() {
  console.log(`[worker] starting: ${describeConfig()}`)

  if (!getRedis()) {
    console.error(
      "[worker] REDIS_URL is not set. Either set it, or drive ingestion through the /api/cron routes instead.",
    )
    process.exit(1)
  }

  const scheduled = await registerRepeatableJobs()
  scheduled.forEach((entry) => console.log(`[worker] scheduled ${entry}`))

  const ingestion = startIngestionWorker()
  const maintenance = startMaintenanceWorker()
  console.log("[worker] ready")

  // Drain in-flight jobs before exiting so a deploy does not abandon a
  // half-written ingest run.
  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, closing`)
    await Promise.allSettled([ingestion.close(), maintenance.close()])
    await closeRedis()
    await closeDb()
    process.exit(0)
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
}

main().catch(async (error) => {
  console.error("[worker] fatal:", error)
  await closeRedis()
  await closeDb()
  process.exit(1)
})
