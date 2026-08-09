import { gunzipSync } from "node:zlib"
import { env } from "@/lib/env"
import { isCjTrackingUrl } from "@/lib/affiliate/cj"
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
 * zZounds ingestion, via their CJ Affiliate product feed.
 *
 * zZounds has no published product API for third parties; CJ's product
 * catalogue feed (tab or comma delimited, CJ's own standard column set) is
 * the channel built for affiliate aggregation. No-ops on an unset feed URL,
 * same as every other source here. Does not scrape zzounds.com.
 *
 * Column names are CJ's own documented standard field set (SKU, NAME,
 * DESCRIPTION, PRICE, BUY_URL, IMAGE_URL, MANUFACTURER_NAME, UPC, IN_STOCK,
 * CATEGORY), which is consistent across CJ advertisers rather than specific
 * to zZounds. Full Compass Systems (lib/ingestion/fullcompass-cj.ts) reuses
 * the same field aliases for that reason.
 */

const FIELD_ALIASES = {
  productId: ["SKU", "sku", "product_id", "ITEM_ID"],
  name: ["NAME", "name", "PRODUCT_NAME"],
  description: ["DESCRIPTION", "description", "DESCRIPTION2"],
  price: ["PRICE", "price", "SALE_PRICE"],
  retailPrice: ["RETAIL_PRICE", "retail_price"],
  currency: ["CURRENCY", "currency"],
  manufacturer: ["MANUFACTURER_NAME", "manufacturer_name", "BRAND"],
  buyUrl: ["BUY_URL", "buy_url", "LINK_URL"],
  imageUrl: ["IMAGE_URL", "image_url", "THUMBNAIL_URL"],
  upc: ["UPC", "upc"],
  isbn: ["ISBN", "isbn"],
  mpn: ["MPN", "mpn", "MODEL", "model"],
  category: ["CATEGORY", "category", "SUBCATEGORY"],
  inStock: ["IN_STOCK", "in_stock", "AVAILABILITY"],
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

/** Map one CJ feed row to a listing insert. Returns null for rows we cannot use. */
export function normalizeZzoundsRow(row: Record<string, string>): NewMarketplaceListing | null {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return null

  const priceCents = toCents(pick(row, FIELD_ALIASES.price)) ?? toCents(pick(row, FIELD_ALIASES.retailPrice))
  if (priceCents == null) return null

  const buyUrl = pick(row, FIELD_ALIASES.buyUrl)
  if (!buyUrl) return null

  const title = pick(row, FIELD_ALIASES.name)
  if (!title) return null

  // CJ's standard feed schema has no separate untracked merchant URL column;
  // BUY_URL is the only destination it publishes. Trust it as the affiliate
  // link only when it is actually a CJ tracking-domain link; otherwise it
  // becomes the raw URL and no affiliate_url is stored.
  const isTracked = isCjTrackingUrl(buyUrl)

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    source: "zzounds",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
    priceCents,
    currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
    // zZounds is primarily new retail inventory, same as Gear4music.
    condition: "New",
    brand: pick(row, FIELD_ALIASES.manufacturer).slice(0, 100) || null,
    gtin: (pick(row, FIELD_ALIASES.upc) || pick(row, FIELD_ALIASES.isbn)).slice(0, 20) || null,
    epid: null,
    mpn: pick(row, FIELD_ALIASES.mpn).slice(0, 100) || null,
    locationCountry: "US",
    locationZip: null,
    isLocalPickup: false,
    isShippable: true,
    rawUrl: buyUrl,
    affiliateUrl: isTracked ? buyUrl : null,
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

export async function fetchZzoundsFeedText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { Accept: "text/csv,text/tab-separated-values,application/gzip,*/*", "User-Agent": "MusicTime/1.0 (+aggregator)" },
  })
  if (!res.ok) {
    const error = new Error(`CJ feed returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  return maybeGunzip(buffer).toString("utf-8")
}

/** Parse a feed document into listing rows. Exposed for fixture-driven tests. */
export function parseZzoundsFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })
  const rows: NewMarketplaceListing[] = []
  let skipped = 0

  for (const record of records) {
    const row = normalizeZzoundsRow(record)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type ZzoundsIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
}

export async function ingestZzoundsFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ZzoundsIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.cj.hasZzoundsFeed) {
    const reason =
      "CJ_ZZOUNDS_FEED_URL is not set. zZounds ingestion is skipped. " +
      "Confirm the feed URL in the CJ Affiliate account dashboard under the zZounds programme."
    console.warn(`[zzounds] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  const run = await startRun("zzounds", "zzounds-feed")

  try {
    const text = await withBackoff(() => fetchZzoundsFeedText(env.cj.zzoundsFeedUrl, fetchImpl), {
      attempts: 4,
      baseDelayMs: 2000,
    })
    const { rows, seen, skipped } = parseZzoundsFeed(text)

    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("zzounds")

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
    console.error(`[zzounds] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
