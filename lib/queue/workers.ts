import { Worker, type Job } from "bullmq"
import { requireRedis } from "./redis"
import { QUEUE_NAMES, type IngestionJob, type MaintenanceJob } from "./queues"
import {
  ingestEbayBootstrap,
  ingestEbayDaily,
  ingestEbaySnapshot,
} from "@/lib/ingestion/ebay-ingest"
import { ingestReverbFeed } from "@/lib/ingestion/reverb-awin"
import { ingestGear4MusicFeed } from "@/lib/ingestion/gear4music-awin"
import { ingestZzoundsFeed } from "@/lib/ingestion/zzounds-cj"
import { ingestFullCompassFeed } from "@/lib/ingestion/fullcompass-cj"
import { ingestPinevilleMusicFeed } from "@/lib/ingestion/pinevillemusic-cj"
import { ingestFolkcraftFeed } from "@/lib/ingestion/folkcraft-shopify"
import { ingestAcousticGuitarFeed } from "@/lib/ingestion/acousticguitar-shopify"
import { ingestJamstikFeed } from "@/lib/ingestion/jamstik-shopify"
import { ingestJacksonAudioFeed } from "@/lib/ingestion/jacksonaudio-shopify"
import { ingestEminenceDigitalFeed } from "@/lib/ingestion/eminencedigital-shopify"
import { ingestHazeGuitarFeed } from "@/lib/ingestion/hazeguitar-shopify"
import { ingestEartGuitarFeed } from "@/lib/ingestion/eartguitar-shopify"
import { ingestPlayWithAuthorityFeed } from "@/lib/ingestion/playwithauthority-shopify"
import { ingestPuresMusicFeed } from "@/lib/ingestion/puresmusic-shopify"
import { ingestSquaverFeed } from "@/lib/ingestion/squaver-woocommerce"
import { ingestEasonMusicStoreFeed } from "@/lib/ingestion/easonmusicstore-shopify"
import { ingestGoKalimbaFeed } from "@/lib/ingestion/gokalimba-shopify"
import { refreshAllDeals } from "@/lib/deals/pricing"
import { evaluateAlerts } from "@/lib/alerts/evaluate"
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
        case "gear4music-feed": {
          const result = await ingestGear4MusicFeed()
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
        case "pinevillemusic-feed": {
          const result = await ingestPinevilleMusicFeed()
          await syncSearchIndex()
          return result
        }
        case "folkcraft-feed": {
          const result = await ingestFolkcraftFeed()
          await syncSearchIndex()
          return result
        }
        case "acousticguitar-feed": {
          const result = await ingestAcousticGuitarFeed()
          await syncSearchIndex()
          return result
        }
        case "jamstik-feed": {
          const result = await ingestJamstikFeed()
          await syncSearchIndex()
          return result
        }
        case "jacksonaudio-feed": {
          const result = await ingestJacksonAudioFeed()
          await syncSearchIndex()
          return result
        }
        case "eminencedigital-feed": {
          const result = await ingestEminenceDigitalFeed()
          await syncSearchIndex()
          return result
        }
        case "hazeguitar-feed": {
          const result = await ingestHazeGuitarFeed()
          await syncSearchIndex()
          return result
        }
        case "eartguitar-feed": {
          const result = await ingestEartGuitarFeed()
          await syncSearchIndex()
          return result
        }
        case "playwithauthority-feed": {
          const result = await ingestPlayWithAuthorityFeed()
          await syncSearchIndex()
          return result
        }
        case "puresmusic-feed": {
          const result = await ingestPuresMusicFeed()
          await syncSearchIndex()
          return result
        }
        case "squaver-feed": {
          const result = await ingestSquaverFeed()
          await syncSearchIndex()
          return result
        }
        case "easonmusicstore-feed": {
          const result = await ingestEasonMusicStoreFeed()
          await syncSearchIndex()
          return result
        }
        case "gokalimba-feed": {
          const result = await ingestGoKalimbaFeed()
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
