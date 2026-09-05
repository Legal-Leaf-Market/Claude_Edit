import { gunzipSync } from "node:zlib"
import { env } from "@/lib/env"
import { gear4musicAffiliateUrl, isGear4MusicProductUrl } from "@/lib/affiliate/awin"
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
 * Gear4music ingestion, via their Awin product datafeed.
 *
 * Gear4music runs its affiliate program on the same Awin network as Reverb,
 * so the feed shape (column names, gzip-or-not, deep link construction) is
 * identical to lib/ingestion/reverb-awin.ts. This is a separate module rather
 * than a parameterised one because the two sources differ in what matters:
 * Gear4music is primarily NEW retail inventory (an empty condition column
 * means new stock, unlike a peer marketplace where it is ambiguous), and it
 * ships several regional storefronts (.com, .ie, .fr, .dk, .pl) under one
 * merchant account, each potentially with its own feed URL.
 *
 * Like Reverb, this no-ops on an unset feed URL rather than falling back to
 * anything else. Gear4music's terms have not been reviewed for scraping, and
 * we do not need to: their Awin datafeed is the channel built for this.
 */

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
  country: ["merchant_country", "country"],
} as const

function pick(row: Record<string, string>, names: readonly string[]): string {
  for (const name of names) {
    const direct = row[name]
    if (direct) return direct.trim()
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
 * Gear4music's condition vocabulary onto the shared buckets. Unlike Reverb, an
 * empty condition column here means new retail stock, not "unspecified": this
 * is a big-box retailer's feed, and the rare ex-demo/clearance row is the one
 * that actually states its condition.
 */
function normalizeGear4MusicCondition(raw: string): string {
  const c = raw.toLowerCase()
  if (!c) return "New"
  if (/brand new|^new$/.test(c)) return "New"
  if (/ex.?demo|open box/.test(c)) return "Excellent"
  if (/b.?stock|refurb/.test(c)) return "Refurbished"
  if (/used/.test(c)) return "Used"
  if (/poor|non.?functioning|parts/.test(c)) return "For parts or not working"
  return raw.slice(0, 50)
}

/** Map one Awin feed row to a listing insert. Returns null for rows we cannot use. */
export function normalizeGear4MusicRow(row: Record<string, string>): NewMarketplaceListing | null {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return null

  const priceCents = toCents(pick(row, FIELD_ALIASES.price))
  if (priceCents == null) return null

  const awDeepLink = pick(row, FIELD_ALIASES.deepLink)
  const merchantUrl = pick(row, FIELD_ALIASES.productUrl) || awDeepLink
  if (!merchantUrl) return null

  const affiliateUrl = awDeepLink.includes("awin1.com")
    ? awDeepLink
    : isGear4MusicProductUrl(merchantUrl)
      ? gear4musicAffiliateUrl(merchantUrl, { clickRef: externalId.slice(0, 100) })
      : null

  const ean = pick(row, FIELD_ALIASES.ean)
  const upc = pick(row, FIELD_ALIASES.upc)
  const title = pick(row, FIELD_ALIASES.name)
  if (!title) return null

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    source: "gear4music",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
    priceCents,
    currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
    condition: normalizeGear4MusicCondition(pick(row, FIELD_ALIASES.condition)),
    // The merchant's own taxonomy, stored verbatim and interpreted later by
    // lib/canonical/feed-category.ts. The alias has been declared here since
    // this reader was written and the value was being dropped on the floor.
    feedCategory: pick(row, FIELD_ALIASES.category).slice(0, 200) || null,
    brand: pick(row, FIELD_ALIASES.brand).slice(0, 100) || null,
    gtin: (ean || upc).slice(0, 20) || null,
    // EPIDs are an eBay concept; a Gear4music row never has one.
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

function maybeGunzip(buffer: Buffer): Buffer {
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer)
  }
  return buffer
}

export async function fetchGear4MusicFeedText(
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
export function parseGear4MusicFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })
  const rows: NewMarketplaceListing[] = []
  let skipped = 0

  for (const record of records) {
    const row = normalizeGear4MusicRow(record)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type Gear4MusicIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
}

export async function ingestGear4MusicFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<Gear4MusicIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.awin.hasGear4musicFeed) {
    const reason =
      "AWIN_GEAR4MUSIC_FEED_URL is not set. Gear4music ingestion is skipped. " +
      "Confirm the feed URL in the Awin publisher dashboard under the Gear4music programme."
    console.warn(`[gear4music] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  if (!env.awin.gear4musicIsConfigured) {
    console.warn(
      "[gear4music] AWIN_PUBLISHER_ID or AWIN_GEAR4MUSIC_MERCHANT_ID is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }

  const run = await startRun("gear4music", "gear4music-feed")

  try {
    const text = await withBackoff(
      () => fetchGear4MusicFeedText(env.awin.gear4musicFeedUrl, fetchImpl),
      { attempts: 4, baseDelayMs: 2000 },
    )
    const { rows, seen, skipped } = parseGear4MusicFeed(text)

    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("gear4music")

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
    console.error(`[gear4music] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
