import { closeDb } from "../lib/db"
import { describeConfig } from "../lib/env"
import {
  ingestEbayBootstrap,
  ingestEbayDaily,
  ingestEbaySnapshot,
} from "../lib/ingestion/ebay-ingest"
import { ingestReverbFeed } from "../lib/ingestion/reverb-awin"
import { resolveUnmatchedListings } from "../lib/canonical/resolve"
import { refreshAllDeals } from "../lib/deals/pricing"

/**
 * Run one ingest job by hand.
 *
 *   npm run ingest:ebay              daily NEWLY_LISTED
 *   npm run ingest:ebay -- snapshot  hourly reconciliation
 *   npm run ingest:ebay -- bootstrap weekly ALL_ACTIVE
 *   npm run ingest:reverb            Awin product datafeed
 *
 * Useful for a first load and for checking credentials without waiting on a
 * schedule.
 */
async function main() {
  const [source, mode] = process.argv.slice(2)
  console.log(`[ingest] ${describeConfig()}`)

  if (source === "ebay") {
    const result =
      mode === "bootstrap"
        ? await ingestEbayBootstrap()
        : mode === "snapshot"
          ? await ingestEbaySnapshot()
          : await ingestEbayDaily()
    console.log("[ingest] eBay:", JSON.stringify(result, null, 2))
  } else if (source === "reverb") {
    const result = await ingestReverbFeed()
    console.log("[ingest] Reverb:", JSON.stringify(result, null, 2))
  } else if (source === "resolve") {
    const tally = await resolveUnmatchedListings()
    console.log("[ingest] resolution tally:", tally)
    console.log("[ingest] deals:", await refreshAllDeals())
  } else {
    console.error("Usage: run-ingest.ts <ebay|reverb|resolve> [daily|snapshot|bootstrap]")
    process.exitCode = 1
  }

  await closeDb()
}

main().catch(async (error) => {
  console.error("[ingest] failed:", error)
  await closeDb()
  process.exit(1)
})
