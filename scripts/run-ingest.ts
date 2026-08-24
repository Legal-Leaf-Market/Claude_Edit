import { closeDb } from "../lib/db"
import { describeConfig } from "../lib/env"
import {
  ingestEbayBootstrap,
  ingestEbayDaily,
  ingestEbaySnapshot,
} from "../lib/ingestion/ebay-ingest"
import { ingestReverbFeed } from "../lib/ingestion/reverb-awin"
import { ingestSweetwaterFeed } from "../lib/ingestion/sweetwater-linkconnector"
import { ingestGear4MusicFeed } from "../lib/ingestion/gear4music-awin"
import { ingestZzoundsFeed } from "../lib/ingestion/zzounds-cj"
import { ingestAndertonsFeed } from "../lib/ingestion/andertons-impact"
import { ingestImpactCatalogue } from "../lib/ingestion/impact-catalogue"
import { impactMerchant, impactSkipReason, IMPACT_MERCHANTS } from "../lib/ingestion/impact-merchants"
import { ingestFullCompassFeed } from "../lib/ingestion/fullcompass-cj"
import { ingestPinevilleMusicFeed } from "../lib/ingestion/pinevillemusic-cj"
import { resolveUnmatchedListings } from "../lib/canonical/resolve"
import { refreshAllDeals } from "../lib/deals/pricing"
import {
  ingestStorefront,
  isStorefrontSource,
  storefrontMerchant,
  STOREFRONT_MERCHANTS,
} from "../lib/ingestion/storefront-merchants"

/**
 * Run one ingest job by hand.
 *
 *   npm run ingest:ebay              daily NEWLY_LISTED
 *   npm run ingest:ebay -- snapshot  hourly reconciliation
 *   npm run ingest:ebay -- bootstrap weekly ALL_ACTIVE
 *   npm run ingest:reverb            Awin product datafeed
 *   npm run ingest:sweetwater        LinkConnector product datafeed
 *   npm run ingest:gear4music        Awin product datafeed
 *   npm run ingest:andertons         Impact.com catalogue, over FTP
 *   npm run ingest:impact -- fender  Impact.com catalogue, over the REST API
 *                                    (any merchant in impact-merchants.ts;
 *                                    run it with no name to list them)
 *   npm run ingest:zzounds           CJ Affiliate product feed
 *   npm run ingest:fullcompass       CJ Affiliate product feed
 *   npm run ingest:pinevillemusic    CJ Affiliate product feed
 *   npm run ingest:store -- folkcraft
 *                                    Any independent storefront: its public
 *                                    Shopify /products.json or WooCommerce
 *                                    Store API. Run it with no name to list
 *                                    them (lib/storefronts.ts).
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
  } else if (source === "sweetwater") {
    const result = await ingestSweetwaterFeed()
    console.log("[ingest] Sweetwater:", JSON.stringify(result, null, 2))
  } else if (source === "gear4music") {
    const result = await ingestGear4MusicFeed()
    console.log("[ingest] Gear4music:", JSON.stringify(result, null, 2))
  } else if (source === "andertons") {
    const result = await ingestAndertonsFeed()
    console.log("[ingest] Anderton's:", JSON.stringify(result, null, 2))
  } else if (source === "impact") {
    // One entry point for every Impact merchant, since one job serves them all.
    // Without a merchant name it lists them rather than guessing which was
    // meant, and says which can actually be pulled today.
    const merchant = mode ? impactMerchant(mode) : null
    if (!merchant) {
      console.error(
        `Usage: run-ingest.ts impact <${IMPACT_MERCHANTS.map((m) => m.key).join("|")}>\n` +
          IMPACT_MERCHANTS.map(
            (m) => `  ${m.key.padEnd(18)} ${m.label} (${impactSkipReason(m) ? "not configured" : `catalogue ${m.catalogId}`})`,
          ).join("\n"),
      )
      process.exitCode = 1
    } else {
      const result = await ingestImpactCatalogue(merchant)
      console.log(`[ingest] ${merchant.label}:`, JSON.stringify(result, null, 2))
    }
  } else if (source === "zzounds") {
    const result = await ingestZzoundsFeed()
    console.log("[ingest] zZounds:", JSON.stringify(result, null, 2))
  } else if (source === "fullcompass") {
    const result = await ingestFullCompassFeed()
    console.log("[ingest] Full Compass:", JSON.stringify(result, null, 2))
  } else if (source === "pinevillemusic") {
    const result = await ingestPinevilleMusicFeed()
    console.log("[ingest] Pineville Music:", JSON.stringify(result, null, 2))
  } else if (isStorefrontSource(source)) {
    /*
     * Every independent storefront, as one branch. This was twelve branches
     * of the same two lines, and the CLI is where that hurt least and read
     * worst: a store you could ingest in production but not by hand, because
     * somebody added the row and not the branch.
     */
    const merchant = storefrontMerchant(source)!
    const result = await ingestStorefront(merchant)
    console.log(`[ingest] ${merchant.label}:`, JSON.stringify(result, null, 2))
  } else if (source === "resolve") {
    const tally = await resolveUnmatchedListings()
    console.log("[ingest] resolution tally:", tally)
    console.log("[ingest] deals:", await refreshAllDeals())
  } else {
    console.error(
      "Usage: run-ingest.ts <ebay|reverb|sweetwater|gear4music|andertons|impact|zzounds|fullcompass|pinevillemusic|resolve|" +
        STOREFRONT_MERCHANTS.map((m) => m.source).join("|") +
        "> [daily|snapshot|bootstrap]",
    )
    process.exitCode = 1
  }

  await closeDb()
}

main().catch(async (error) => {
  console.error("[ingest] failed:", error)
  await closeDb()
  process.exit(1)
})
