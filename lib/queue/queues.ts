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
  ingestion: "gearavail-ingestion",
  maintenance: "gearavail-maintenance",
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
  | { kind: "folkcraft-feed" }
  | { kind: "acousticguitar-feed" }
  | { kind: "jamstik-feed" }
  | { kind: "jacksonaudio-feed" }
  | { kind: "eminencedigital-feed" }
  | { kind: "hazeguitar-feed" }
  | { kind: "eartguitar-feed" }
  | { kind: "playwithauthority-feed" }
  | { kind: "puresmusic-feed" }
  | { kind: "squaver-feed" }
  | { kind: "easonmusicstore-feed" }
  | { kind: "gokalimba-feed" }

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

  // eBay: no EPN keyset approved yet, so these are paused rather than
  // scheduled. Re-add once EBAY_OAUTH_TOKEN is actually set; the code and
  // tests stay in place, same "code stays, schedule doesn't" treatment as
  // the paused CJ/Shopify sources below.
  //
  // await ingestion.upsertJobScheduler(
  //   "ebay-daily",
  //   { pattern: "20 1 * * *" },
  //   { name: "ebay-daily", data: { kind: "ebay-daily" } },
  // )
  // await ingestion.upsertJobScheduler(
  //   "ebay-snapshot",
  //   { pattern: "10 * * * *" },
  //   { name: "ebay-snapshot", data: { kind: "ebay-snapshot" } },
  // )
  // await ingestion.upsertJobScheduler(
  //   "ebay-bootstrap",
  //   { pattern: "0 3 * * 0" },
  //   { name: "ebay-bootstrap", data: { kind: "ebay-bootstrap" } },
  // )

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

  // Small independent Shopify sellers. Unlike the gated feeds above, these
  // need no feed URL or merchant approval to ingest (their catalogue is
  // public), so the schedule is unconditional.
  await ingestion.upsertJobScheduler(
    "folkcraft-feed",
    { pattern: "30 */6 * * *" },
    { name: "folkcraft-feed", data: { kind: "folkcraft-feed" } },
  )
  registered.push("folkcraft-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "acousticguitar-feed",
    { pattern: "45 */6 * * *" },
    { name: "acousticguitar-feed", data: { kind: "acousticguitar-feed" } },
  )
  registered.push("acousticguitar-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "jamstik-feed",
    { pattern: "15 */6 * * *" },
    { name: "jamstik-feed", data: { kind: "jamstik-feed" } },
  )
  registered.push("jamstik-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "jacksonaudio-feed",
    { pattern: "35 */6 * * *" },
    { name: "jacksonaudio-feed", data: { kind: "jacksonaudio-feed" } },
  )
  registered.push("jacksonaudio-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "eminencedigital-feed",
    { pattern: "5 */6 * * *" },
    { name: "eminencedigital-feed", data: { kind: "eminencedigital-feed" } },
  )
  registered.push("eminencedigital-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "hazeguitar-feed",
    { pattern: "25 */6 * * *" },
    { name: "hazeguitar-feed", data: { kind: "hazeguitar-feed" } },
  )
  registered.push("hazeguitar-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "eartguitar-feed",
    { pattern: "50 */6 * * *" },
    { name: "eartguitar-feed", data: { kind: "eartguitar-feed" } },
  )
  registered.push("eartguitar-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "playwithauthority-feed",
    { pattern: "55 */6 * * *" },
    { name: "playwithauthority-feed", data: { kind: "playwithauthority-feed" } },
  )
  registered.push("playwithauthority-feed @ every 6h")

  // Pures Music: GoAffPro enrollment is not confirmed yet (unlike the other
  // Shopify sources above), so this is paused rather than scheduled. The
  // ingestion module, cron route, and env vars stay in place; re-add the
  // scheduler call here once the store is actually approved.

  await ingestion.upsertJobScheduler(
    "squaver-feed",
    { pattern: "8 */6 * * *" },
    { name: "squaver-feed", data: { kind: "squaver-feed" } },
  )
  registered.push("squaver-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "easonmusicstore-feed",
    { pattern: "12 */6 * * *" },
    { name: "easonmusicstore-feed", data: { kind: "easonmusicstore-feed" } },
  )
  registered.push("easonmusicstore-feed @ every 6h")

  await ingestion.upsertJobScheduler(
    "gokalimba-feed",
    { pattern: "18 */6 * * *" },
    { name: "gokalimba-feed", data: { kind: "gokalimba-feed" } },
  )
  registered.push("gokalimba-feed @ every 6h")

  await maintenance.upsertJobScheduler(
    "refresh-deals",
    { pattern: "0 4 * * *" },
    { name: "refresh-deals", data: { kind: "refresh-deals" } },
  )
  registered.push("refresh-deals @ 04:00 UTC")

  return registered
}
