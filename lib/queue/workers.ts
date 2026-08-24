import { Worker, type Job } from "bullmq"
import { requireRedis } from "./redis"
import { QUEUE_NAMES, type IngestionJob, type MaintenanceJob } from "./queues"
import {
  ingestEbayBootstrap,
  ingestEbayDaily,
  ingestEbaySnapshot,
} from "@/lib/ingestion/ebay-ingest"
import { ingestReverbFeed } from "@/lib/ingestion/reverb-awin"
import { ingestSweetwaterFeed } from "@/lib/ingestion/sweetwater-linkconnector"
import { ingestGear4MusicFeed } from "@/lib/ingestion/gear4music-awin"
import { ingestZzoundsFeed } from "@/lib/ingestion/zzounds-cj"
import { ingestAndertonsFeed } from "@/lib/ingestion/andertons-impact"
import { ingestImpactCatalogue } from "@/lib/ingestion/impact-catalogue"
import { impactMerchant, IMPACT_MERCHANTS } from "@/lib/ingestion/impact-merchants"
import { ingestFullCompassFeed } from "@/lib/ingestion/fullcompass-cj"
import { ingestPinevilleMusicFeed } from "@/lib/ingestion/pinevillemusic-cj"
import { refreshAllDeals } from "@/lib/deals/pricing"
import { evaluateAlerts } from "@/lib/alerts/evaluate"
import { ingestStorefrontBySource } from "@/lib/ingestion/storefront-merchants"
import { syncSearchIndex } from "@/lib/search/sync"

/**
 * Worker process bodies.
 *
 * Concurrency is 1 for ingestion on purpose. These jobs are bounded by the
 * eBay daily call budget and by Postgres write throughput, not by CPU, so
 * running several in parallel would spend the same budget faster and race each
 * other on the same upsert targets for no gain.
 */

export function startIngestionWorker(): Worker<IngestionJob> {
  const connection = requireRedis()

  const worker = new Worker<IngestionJob>(
    QUEUE_NAMES.ingestion,
    async (job: Job<IngestionJob>) => {
      const { kind } = job.data
      console.log(`[worker] ingestion job ${kind} (attempt ${job.attemptsMade + 1})`)

      switch (kind) {
        case "ebay-daily": {
          const result = await ingestEbayDaily(job.data.date)
          await syncSearchIndex()
          return result
        }
        case "ebay-snapshot": {
          const result = await ingestEbaySnapshot(job.data.snapshotDate)
          await syncSearchIndex()
          // Alerts run here because this is the job that surfaces price drops.
          await evaluateAlerts()
          return result
        }
        case "ebay-bootstrap": {
          const result = await ingestEbayBootstrap()
          await syncSearchIndex({ full: true })
          return result
        }
        case "reverb-feed": {
          const result = await ingestReverbFeed()
          await syncSearchIndex()
          return result
        }
        case "sweetwater-feed": {
          const result = await ingestSweetwaterFeed()
          await syncSearchIndex()
          return result
        }
        case "gear4music-feed": {
          const result = await ingestGear4MusicFeed()
          await syncSearchIndex()
          return result
        }
        case "andertons-catalogue": {
          const result = await ingestAndertonsFeed()
          await syncSearchIndex()
          return result
        }
        case "impact-catalogue": {
          // One case for every Impact merchant. An unknown key is a config
          // error rather than a transient failure, so it throws with the keys
          // that do exist instead of being retried three times with backoff.
          const merchant = impactMerchant(job.data.merchant)
          if (!merchant) {
            throw new Error(
              `Unknown Impact merchant "${job.data.merchant}". Known: ${IMPACT_MERCHANTS.map((m) => m.key).join(", ")}.`,
            )
          }
          const result = await ingestImpactCatalogue(merchant)
          await syncSearchIndex()
          return result
        }
        case "zzounds-feed": {
          const result = await ingestZzoundsFeed()
          await syncSearchIndex()
          return result
        }
        case "fullcompass-feed": {
          const result = await ingestFullCompassFeed()
          await syncSearchIndex()
          return result
        }
        /*
         * Every independent storefront, as one case. The merchant is a row in
         * lib/storefronts.ts, so twelve cases here were twelve copies of these
         * three lines with the identifier changed, and the copy that gets
         * missed is the store that quietly stops ingesting.
         */
        case "storefront-feed": {
          const result = await ingestStorefrontBySource(job.data.source)
          if (!result) throw new Error(`Unknown storefront "${job.data.source}".`)
          await syncSearchIndex()
          return result
        }
        case "pinevillemusic-feed": {
          const result = await ingestPinevilleMusicFeed()
          await syncSearchIndex()
          return result
        }
        default: {
          // Exhaustiveness guard: adding a job kind without handling it becomes
          // a type error rather than a silent no-op in production.
          const unreachable: never = kind
          throw new Error(`Unknown ingestion job: ${JSON.stringify(unreachable)}`)
        }
      }
    },
    { connection, concurrency: 1 },
  )

  worker.on("failed", (job, error) => {
    console.error(`[worker] ingestion ${job?.name} failed: ${error.message}`)
  })
  worker.on("completed", (job) => {
    console.log(`[worker] ingestion ${job.name} completed`)
  })

  return worker
}

export function startMaintenanceWorker(): Worker<MaintenanceJob> {
  const connection = requireRedis()

  const worker = new Worker<MaintenanceJob>(
    QUEUE_NAMES.maintenance,
    async (job: Job<MaintenanceJob>) => {
      const { kind } = job.data
      console.log(`[worker] maintenance job ${kind}`)

      switch (kind) {
        case "refresh-deals":
          return refreshAllDeals()
        case "evaluate-alerts":
          return evaluateAlerts()
        case "sync-search":
          return syncSearchIndex({ full: true })
        default: {
          const unreachable: never = kind
          throw new Error(`Unknown maintenance job: ${JSON.stringify(unreachable)}`)
        }
      }
    },
    { connection, concurrency: 2 },
  )

  worker.on("failed", (job, error) => {
    console.error(`[worker] maintenance ${job?.name} failed: ${error.message}`)
  })

  return worker
}
