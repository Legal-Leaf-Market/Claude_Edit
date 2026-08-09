import { gunzipSync } from "node:zlib"
import { env } from "@/lib/env"
import { buildAwinDeepLink, isReverbProductUrl } from "@/lib/affiliate/awin"
import { detectDelimiter, parseCsv } from "./csv"
import {
  expirePastEndDate,
  finishRun,
  resolveAndReprice,
  startRun,
  upsertListings,
  type UpsertStats,
} from "./upsert"
import { withBackoff } from "./rate-limit"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Reverb ingestion, via the Awin product datafeed only.
 *
 * WHY THIS IS THE ONLY ROUTE. The Reverb API is scoped to managing your own
 * shop, and their terms forbid both scraping and the use of API or member data
 * with a third-party advertising or marketing platform. Aggregating their
 * catalogue through either would be a straightforward breach. An Awin product
 * datafeed, if Reverb publishes one to publishers, is catalogue data they have
 * deliberately handed to publishers for exactly this purpose.
 *
 * So: when AWIN_REVERB_FEED_URL is unset this job logs and no-ops. It does not
 * fall back to the Reverb API, and it does not scrape. If the feed never
 * materialises, Gear Avail ships as an eBay-only aggregator that links out to
 * Reverb through Awin, which is a complete and compliant product.
 */

/** Awin column aliases, first match wins. Covers the CSV and XML-flattened spellings. */
const FIELD_ALIASES = {
  productId: ["product_id", "aw_product_id", "merchant_product_id", "pid", "id"],
  name: ["product_name", "name", "title"],
  description: ["description", "product_short_description", "specifications"],
  price: ["search_price", "price", "store_price", "display_price"],
  currency: ["currency", "curr"],
  brand: ["brand_name", "brand", "merchant_brand"],
  deepLink: ["aw_deep_link", "deep_link", "merchant_deep_link"],
  productUrl: ["merchant_deep_link", "product_url", "deep_link", "aw_deep_link"],
  imageUrl: ["merchant_image_url", "aw_image_url", "image_url", "large_image", "merchant_thumb"],
  ean: ["ean", "gtin"],
  upc: ["upc"],
  mpn: ["mpn", "model_number", "part_number"],
  condition: ["condition", "product_condition"],
  category: ["merchant_category", "category_name", "product_type"],
  inStock: ["in_stock", "stock_status", "is_for_sale"],
  lastUpdated: ["last_updated", "valid_from"],
  country: ["merchant_country", "country"],
} as const

function pick(row: Record<string, string>, names: readonly string[]): string {
  for (const name of names) {
    const direct = row[name]
    if (direct) return direct.trim()
    // Awin's CSV headers arrive in mixed case across accounts.
    const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase())
    if (key && row[key]) return row[key].trim()
  }
  return ""
}

function toCents(raw: string): number | null {
  if (!raw) return null
  const match = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

function truthy(raw: string): boolean {
  return /^(1|true|yes|y|in ?stock|available)$/i.test(raw.trim())
}

/**
 * Normalise Reverb's condition vocabulary onto the same buckets the eBay
 * mapper produces, so the condition facet is a single coherent list rather than
 * two parallel ones.
 */
function normalizeReverbCondition(raw: string): string {
  const c = raw.toLowerCase()
  if (!c) return "Unspecified"
  if (/brand new|^new$/.test(c)) return "New"
  if (/mint/.test(c)) return "Mint"
  if (/excellent/.test(c)) return "Excellent"
  if (/very good/.test(c)) return "Very good"
  if (/^good/.test(c)) return "Good"
  if (/fair/.test(c)) return "Acceptable"
  if (/poor|non.?functioning|parts/.test(c)) return "For parts or not working"
  if (/b.?stock|refurb/.test(c)) return "Refurbished"
  if (/used/.test(c)) return "Used"
  return raw.slice(0, 50)
}

/** Map one Awin feed row to a listing insert. Returns null for rows we cannot use. */
export function normalizeAwinRow(row: Record<string, string>): NewMarketplaceListing | null {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return null

  const priceCents = toCents(pick(row, FIELD_ALIASES.price))
  if (priceCents == null) return null

  // The merchant URL is what we wrap; aw_deep_link is Awin's own tracked form
  // and is used directly when present.
  const awDeepLink = pick(row, FIELD_ALIASES.deepLink)
  const merchantUrl = pick(row, FIELD_ALIASES.productUrl) || awDeepLink
  if (!merchantUrl) return null

  const affiliateUrl = awDeepLink.includes("awin1.com")
    ? awDeepLink
    : isReverbProductUrl(merchantUrl)
      ? buildAwinDeepLink(merchantUrl, { clickRef: externalId.slice(0, 100) })
      : null

  const ean = pick(row, FIELD_ALIASES.ean)
  const upc = pick(row, FIELD_ALIASES.upc)
  const title = pick(row, FIELD_ALIASES.name)
  if (!title) return null

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  // An absent stock column means the feed only publishes live products, so
  // treat "unstated" as active rather than dropping the whole catalogue.
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    source: "reverb",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
    priceCents,
    currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
    condition: normalizeReverbCondition(pick(row, FIELD_ALIASES.condition)),
    brand: pick(row, FIELD_ALIASES.brand).slice(0, 100) || null,
    gtin: (ean || upc).slice(0, 20) || null,
    // EPIDs are an eBay concept; a Reverb row never has one and must not
    // borrow one, or it would collide on canonical_gear's unique epid index.
    epid: null,
    mpn: pick(row, FIELD_ALIASES.mpn).slice(0, 100) || null,
    locationCountry: pick(row, FIELD_ALIASES.country).slice(0, 4) || null,
    locationZip: null,
    isLocalPickup: false,
    isShippable: true,
    rawUrl: merchantUrl,
    affiliateUrl,
    primaryImageUrl: pick(row, FIELD_ALIASES.imageUrl) || null,
    listingStatus: isActive ? "active" : "expired",
    listedAt: null,
    endsAt: null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Fetching                                                                  */
/* -------------------------------------------------------------------------- */

/** Awin serves feeds gzipped whether or not the URL says .gz. Sniff the magic bytes. */
function maybeGunzip(buffer: Buffer): Buffer {
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer)
  }
  return buffer
}

export async function fetchAwinFeedText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { Accept: "text/csv,application/gzip,*/*", "User-Agent": "GearAvail/1.0 (+aggregator)" },
  })
  if (!res.ok) {
    const error = new Error(`Awin feed returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  return maybeGunzip(buffer).toString("utf-8")
}

/** Parse a feed document into listing rows. Exposed for fixture-driven tests. */
export function parseAwinFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })
  const rows: NewMarketplaceListing[] = []
  let skipped = 0

  for (const record of records) {
    const row = normalizeAwinRow(record)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type ReverbIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
}

export async function ingestReverbFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ReverbIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.awin.hasFeed) {
    const reason =
      "AWIN_REVERB_FEED_URL is not set. Reverb catalogue ingestion is skipped. " +
      "Confirm in the Awin publisher dashboard whether Reverb publishes a product datafeed. " +
      "Do NOT substitute the Reverb API or scraping: their terms forbid both for aggregation."
    console.warn(`[reverb] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  if (!env.awin.isConfigured) {
    // We can still ingest the catalogue, we just cannot monetise it yet. Worth
    // saying out loud, because an unmonetised catalogue is a silent revenue leak.
    console.warn(
      "[reverb] AWIN_PUBLISHER_ID or AWIN_REVERB_MERCHANT_ID is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }

  const run = await startRun("reverb", "reverb-feed")

  try {
    const text = await withBackoff(() => fetchAwinFeedText(env.awin.reverbFeedUrl, fetchImpl), {
      attempts: 4,
      baseDelayMs: 2000,
    })
    const { rows, seen, skipped } = parseAwinFeed(text)

    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("reverb")

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      bytesDownloaded: Buffer.byteLength(text),
      detail: { resolved, priceChanges: stats.priceChanges },
    })

    return { status: "ok", stats, resolved }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[reverb] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
