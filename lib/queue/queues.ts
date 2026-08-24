import { Queue, type JobsOptions } from "bullmq"
import { env } from "@/lib/env"
import { canPullImpactMerchant, IMPACT_MERCHANTS } from "@/lib/ingestion/impact-merchants"
import { getRedis } from "./redis"
import { scheduledStorefrontMerchants } from "@/lib/storefronts"

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
  | { kind: "andertons-catalogue" }
  /**
   * Any Impact.com merchant over the REST catalogue API, named by its registry
   * key (lib/ingestion/impact-merchants.ts). One job kind rather than eight,
   * because the merchant is data and the work is identical.
   */
  | { kind: "impact-catalogue"; merchant: string }
  | { kind: "fullcompass-feed" }
  | { kind: "pinevillemusic-feed" }
  /**
   * Any independent storefront, named by its registry key
   * (lib/storefronts.ts). One job kind rather than twelve, for the same
   * reason `impact-catalogue` is one rather than eight.
   */
  | { kind: "storefront-feed"; source: string }

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

  // Anderton's, on the WORKER only and never a cron route: FTP needs a control
  // connection plus passive data ports, which a serverless function cannot
  // hold open for a 27k-row download. Offset to 30 past so the largest feed
  // does not start alongside the others.
  if (env.impact.hasAndertonsFeed) {
    await ingestion.upsertJobScheduler(
      "andertons-catalogue",
      { pattern: "30 */6 * * *" },
      { name: "andertons-catalogue", data: { kind: "andertons-catalogue" } },
    )
    registered.push("andertons-catalogue @ every 6h")
  }

  /*
   * The Impact merchants over the REST API.
   *
   * Gated per merchant on having a catalogue id, so an approved programme whose
   * catalogue id nobody has looked up yet costs nothing rather than scheduling
   * a job that logs a skip every six hours. Anderton's is skipped here because
   * its FTP scheduler above already pulls the same catalogue; scheduling both
   * would write the same 27k rows twice.
   *
   * Staggered by index so eight catalogues do not all start in the same minute
   * and race each other on Postgres write throughput, which is what ingestion
   * concurrency 1 exists to avoid in the first place.
   */
  for (const [index, merchant] of IMPACT_MERCHANTS.entries()) {
    if (merchant.key === "andertons") continue
    if (!canPullImpactMerchant(merchant)) continue

    const minute = (3 + index * 7) % 60
    await ingestion.upsertJobScheduler(
      `impact-${merchant.key}`,
      { pattern: `${minute} */6 * * *` },
      { name: `impact-${merchant.key}`, data: { kind: "impact-catalogue", merchant: merchant.key } },
    )
    registered.push(`impact-${merchant.key} @ every 6h`)
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

  /*
   * Independent storefronts. Unlike the gated feeds above, these need no feed
   * URL or merchant approval to ingest, so the schedule is unconditional.
   *
   * DRIVEN OFF THE REGISTRY, so a store's pattern is written once beside its
   * base URL rather than here as well. A paused store has a null schedule and
   * is simply absent from this loop, which is the same "code stays, schedule
   * doesn't" treatment Full Compass and Pineville Music get above: the job
   * still runs by hand, it just does not run by itself.
   *
   * The scheduler id stays `<source>-feed`, unchanged from when these were
   * twelve blocks. BullMQ keys a schedule on that id, so renaming them would
   * leave every old schedule running beside the new one and pull each feed
   * twice.
   */
  for (const merchant of scheduledStorefrontMerchants()) {
    await ingestion.upsertJobScheduler(
      `${merchant.source}-feed`,
      { pattern: merchant.schedule as string },
      { name: `${merchant.source}-feed`, data: { kind: "storefront-feed", source: merchant.source } },
    )
    registered.push(`${merchant.source}-feed @ ${merchant.schedule}`)
  }

  /*
   * Pures Music used to be commented out here in prose. It is now a null
   * `schedule` with a `pausedReason` on its registry row, which is a better
   * place for it: a commented-out block says a store is paused only to
   * somebody reading this file, while the row says it to the cron route, the
   * admin console and anybody listing the merchants.
   */

  await maintenance.upsertJobScheduler(
    "refresh-deals",
    { pattern: "0 4 * * *" },
    { name: "refresh-deals", data: { kind: "refresh-deals" } },
  )
  registered.push("refresh-deals @ 04:00 UTC")

  return registered
}
