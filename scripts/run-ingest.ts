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
import { ingestFolkcraftFeed } from "../lib/ingestion/folkcraft-shopify"
import { ingestAcousticGuitarFeed } from "../lib/ingestion/acousticguitar-shopify"
import { ingestJamstikFeed } from "../lib/ingestion/jamstik-shopify"
import { ingestJacksonAudioFeed } from "../lib/ingestion/jacksonaudio-shopify"
import { ingestEminenceDigitalFeed } from "../lib/ingestion/eminencedigital-shopify"
import { ingestHazeGuitarFeed } from "../lib/ingestion/hazeguitar-shopify"
import { ingestEartGuitarFeed } from "../lib/ingestion/eartguitar-shopify"
import { ingestPlayWithAuthorityFeed } from "../lib/ingestion/playwithauthority-shopify"
import { ingestPuresMusicFeed } from "../lib/ingestion/puresmusic-shopify"
import { ingestSquaverFeed } from "../lib/ingestion/squaver-woocommerce"
import { ingestEasonMusicStoreFeed } from "../lib/ingestion/easonmusicstore-shopify"
import { ingestGoKalimbaFeed } from "../lib/ingestion/gokalimba-shopify"
import { resolveUnmatchedListings } from "../lib/canonical/resolve"
import { refreshAllDeals } from "../lib/deals/pricing"

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
 *   npm run ingest:folkcraft         Public Shopify storefront JSON
 *   npm run ingest:acousticguitar    Public Shopify storefront JSON
 *   npm run ingest:jamstik           Public Shopify storefront JSON
 *   npm run ingest:jacksonaudio      Public Shopify storefront JSON
 *   npm run ingest:eminencedigital   Public Shopify storefront JSON
 *   npm run ingest:hazeguitar        Public Shopify storefront JSON
 *   npm run ingest:eartguitar        Public Shopify storefront JSON
 *   npm run ingest:playwithauthority Public Shopify storefront JSON
 *   npm run ingest:puresmusic        Public Shopify storefront JSON
 *   npm run ingest:squaver           Public WooCommerce Store API
 *   npm run ingest:easonmusicstore   Public Shopify storefront JSON
 *   npm run ingest:gokalimba         Public Shopify storefront JSON
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
  } else if (source === "folkcraft") {
    const result = await ingestFolkcraftFeed()
    console.log("[ingest] Folkcraft:", JSON.stringify(result, null, 2))
  } else if (source === "acousticguitar") {
    const result = await ingestAcousticGuitarFeed()
    console.log("[ingest] Acoustic Guitar:", JSON.stringify(result, null, 2))
  } else if (source === "jamstik") {
    const result = await ingestJamstikFeed()
    console.log("[ingest] Jamstik:", JSON.stringify(result, null, 2))
  } else if (source === "jacksonaudio") {
    const result = await ingestJacksonAudioFeed()
    console.log("[ingest] Jackson Audio:", JSON.stringify(result, null, 2))
  } else if (source === "eminencedigital") {
    const result = await ingestEminenceDigitalFeed()
    console.log("[ingest] Eminence Digital:", JSON.stringify(result, null, 2))
  } else if (source === "hazeguitar") {
    const result = await ingestHazeGuitarFeed()
    console.log("[ingest] Haze Guitar:", JSON.stringify(result, null, 2))
  } else if (source === "eartguitar") {
    const result = await ingestEartGuitarFeed()
    console.log("[ingest] EART Guitar:", JSON.stringify(result, null, 2))
  } else if (source === "playwithauthority") {
    const result = await ingestPlayWithAuthorityFeed()
    console.log("[ingest] Play With Authority:", JSON.stringify(result, null, 2))
  } else if (source === "puresmusic") {
    const result = await ingestPuresMusicFeed()
    console.log("[ingest] Pures Music:", JSON.stringify(result, null, 2))
  } else if (source === "squaver") {
    const result = await ingestSquaverFeed()
    console.log("[ingest] Squaver:", JSON.stringify(result, null, 2))
  } else if (source === "easonmusicstore") {
    const result = await ingestEasonMusicStoreFeed()
    console.log("[ingest] Eason Music Store:", JSON.stringify(result, null, 2))
  } else if (source === "gokalimba") {
    const result = await ingestGoKalimbaFeed()
    console.log("[ingest] Go Kalimba:", JSON.stringify(result, null, 2))
  } else if (source === "resolve") {
    const tally = await resolveUnmatchedListings()
    console.log("[ingest] resolution tally:", tally)
    console.log("[ingest] deals:", await refreshAllDeals())
  } else {
    console.error(
      "Usage: run-ingest.ts <ebay|reverb|sweetwater|gear4music|andertons|impact|zzounds|fullcompass|pinevillemusic|folkcraft|acousticguitar|jamstik|jacksonaudio|eminencedigital|hazeguitar|eartguitar|playwithauthority|puresmusic|squaver|easonmusicstore|gokalimba|resolve> [daily|snapshot|bootstrap]",
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
