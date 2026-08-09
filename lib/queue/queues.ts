import { Queue, type JobsOptions } from "bullmq"
import { env } from "@/lib/env"
import { getRedis } from "./redis"

/**
 * BullMQ queues.
 *
 * These are the SECOND way to run ingestion. The /api/cron routes are the
 * first, and they are what a Vercel deploy uses. Both call the same job
 * functions, so there is exactly one implementation of the work and two ways to
 * trigger it.
 *
 * Which one you want depends on where you run: cron routes are simpler and
 * serverless friendly, workers give you concurrency control, retries with
 * backoff and a durable queue for the multi-GB bootstrap feed that will not
 * finish inside a serverless function's timeout.
 */

export const QUEUE_NAMES = {
  ingestion: "musictime-ingestion",
  maintenance: "musictime-maintenance",
} as const

export type IngestionJob =
  | { kind: "ebay-daily"; date?: string }
  | { kind: "ebay-snapshot"; snapshotDate?: string }
  | { kind: "ebay-bootstrap" }
  | { kind: "reverb-feed" }
  | { kind: "sweetwater-feed" }
  | { kind: "gear4music-feed" }
  | { kind: "zzounds-feed" }
  | { kind: "fullcompass-feed" }
  | { kind: "pinevillemusic-feed" }

export type MaintenanceJob =
  | { kind: "refresh-deals" }
  | { kind: "evaluate-alerts" }
  | { kind: "sync-search" }

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },
  // Keep a short history for debugging without letting Redis grow without bound.
  removeOnComplete: { age: 86_400, count: 200 },
  removeOnFail: { age: 604_800, count: 500 },
}

let ingestionQueue: Queue<IngestionJob> | null = null
let maintenanceQueue: Queue<MaintenanceJob> | null = null

export function getIngestionQueue(): Queue<IngestionJob> | null {
  const connection = getRedis()
  if (!connection) return null
  if (!ingestionQueue) {
    ingestionQueue = new Queue<IngestionJob>(QUEUE_NAMES.ingestion, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    })
  }
  return ingestionQueue
}

export function getMaintenanceQueue(): Queue<MaintenanceJob> | null {
  const connection = getRedis()
  if (!connection) return null
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue<MaintenanceJob>(QUEUE_NAMES.maintenance, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    })
  }
  return maintenanceQueue
}

/**
 * Register the recurring schedule.
 *
 * BullMQ 6 drops the old `repeat` option on add() in favour of named job
 * schedulers. That is a better fit anyway: the scheduler is keyed by the id we
 * choose, so changing a cron expression UPDATES the existing schedule. Under
 * the old API the repeat key was derived from the options, and editing a
 * pattern silently left the previous schedule running beside the new one, which
 * meant the feed got pulled twice and the call budget burned twice as fast.
 *
 * Every scheduler id below is stable for that reason.
 */
export async function registerRepeatableJobs(): Promise<string[]> {
  const ingestion = getIngestionQueue()
  const maintenance = getMaintenanceQueue()
  if (!ingestion || !maintenance) {
    console.warn("[queue] REDIS_URL is unset; no repeatable jobs registered")
    return []
  }

  const registered: string[] = []

  // Daily new listings, shortly after midnight UTC so the previous day's feed
  // is complete.
  await ingestion.upsertJobScheduler(
    "ebay-daily",
    { pattern: "20 1 * * *" },
    { name: "ebay-daily", data: { kind: "ebay-daily" } },
  )
  registered.push("ebay-daily @ 01:20 UTC")

  // Hourly price and status reconciliation.
  await ingestion.upsertJobScheduler(
    "ebay-snapshot",
    { pattern: "10 * * * *" },
    { name: "ebay-snapshot", data: { kind: "ebay-snapshot" } },
  )
  registered.push("ebay-snapshot @ :10 hourly")

  // Weekly full catalogue bootstrap. Large, so it runs at a quiet hour.
  await ingestion.upsertJobScheduler(
    "ebay-bootstrap",
    { pattern: "0 3 * * 0" },
    { name: "ebay-bootstrap", data: { kind: "ebay-bootstrap" } },
  )
  registered.push("ebay-bootstrap @ Sun 03:00 UTC")

  if (env.awin.hasFeed) {
    await ingestion.upsertJobScheduler(
      "reverb-feed",
      { pattern: "40 */6 * * *" },
      { name: "reverb-feed", data: { kind: "reverb-feed" } },
    )
    registered.push("reverb-feed @ every 6h")
  }

  if (env.linkconnector.hasSweetwaterFeed) {
    await ingestion.upsertJobScheduler(
      "sweetwater-feed",
      { pattern: "20 */6 * * *" },
      { name: "sweetwater-feed", data: { kind: "sweetwater-feed" } },
    )
    registered.push("sweetwater-feed @ every 6h")
  }

  if (env.awin.hasGear4musicFeed) {
    await ingestion.upsertJobScheduler(
      "gear4music-feed",
      { pattern: "0 */6 * * *" },
      { name: "gear4music-feed", data: { kind: "gear4music-feed" } },
    )
    registered.push("gear4music-feed @ every 6h")
  }

  if (env.cj.hasZzoundsFeed) {
    await ingestion.upsertJobScheduler(
      "zzounds-feed",
      { pattern: "10 */6 * * *" },
      { name: "zzounds-feed", data: { kind: "zzounds-feed" } },
    )
    registered.push("zzounds-feed @ every 6h")
  }

  if (env.cj.hasFullCompassFeed) {
    await ingestion.upsertJobScheduler(
      "fullcompass-feed",
      { pattern: "50 */6 * * *" },
      { name: "fullcompass-feed", data: { kind: "fullcompass-feed" } },
    )
    registered.push("fullcompass-feed @ every 6h")
  }

  if (env.cj.hasPinevilleMusicFeed) {
    await ingestion.upsertJobScheduler(
      "pinevillemusic-feed",
      { pattern: "0 3 * * *" },
      { name: "pinevillemusic-feed", data: { kind: "pinevillemusic-feed" } },
    )
    registered.push("pinevillemusic-feed @ daily 03:00 UTC")
  }

  await maintenance.upsertJobScheduler(
    "refresh-deals",
    { pattern: "0 4 * * *" },
    { name: "refresh-deals", data: { kind: "refresh-deals" } },
  )
  registered.push("refresh-deals @ 04:00 UTC")

  return registered
}
