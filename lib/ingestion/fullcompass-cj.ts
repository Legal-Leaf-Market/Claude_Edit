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
 * Full Compass Systems ingestion, via their CJ Affiliate product feed.
 *
 * Same CJ network, same standard field set as zZounds
 * (lib/ingestion/zzounds-cj.ts); this is a separate module rather than a
 * shared parameterised one purely because upstream tooling in this project
 * keeps one source per file (see reverb-awin.ts vs gear4music-awin.ts for the
 * same reasoning). No-ops on an unset feed URL. Does not scrape
 * fullcompass.com; CJ's directory listed Full Compass under "Consumer
 * Electronics" rather than "Music", which is a category-tagging mistake on
 * CJ's side, not a signal about what they actually sell (professional audio
 * and musical instrument gear).
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
export function normalizeFullCompassRow(row: Record<string, string>): NewMarketplaceListing | null {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return null

  const priceCents = toCents(pick(row, FIELD_ALIASES.price)) ?? toCents(pick(row, FIELD_ALIASES.retailPrice))
  if (priceCents == null) return null

  const buyUrl = pick(row, FIELD_ALIASES.buyUrl)
  if (!buyUrl) return null

  const title = pick(row, FIELD_ALIASES.name)
  if (!title) return null

  const isTracked = isCjTrackingUrl(buyUrl)

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    source: "fullcompass",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
    priceCents,
    currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
    condition: "New",
    brand: pick(row, FIELD_ALIASES.manufacturer).slice(0, 100) || null,
    gtin: pick(row, FIELD_ALIASES.upc).slice(0, 20) || null,
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

export async function fetchFullCompassFeedText(
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
export function parseFullCompassFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })
  const rows: NewMarketplaceListing[] = []
  let skipped = 0

  for (const record of records) {
    const row = normalizeFullCompassRow(record)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type FullCompassIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
}

export async function ingestFullCompassFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<FullCompassIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.cj.hasFullCompassFeed) {
    const reason =
      "CJ_FULLCOMPASS_FEED_URL is not set. Full Compass ingestion is skipped. " +
      "Confirm the feed URL in the CJ Affiliate account dashboard under the Full Compass Systems programme."
    console.warn(`[fullcompass] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  const run = await startRun("fullcompass", "fullcompass-feed")

  try {
    const text = await withBackoff(
      () => fetchFullCompassFeedText(env.cj.fullCompassFeedUrl, fetchImpl),
      { attempts: 4, baseDelayMs: 2000 },
    )
    const { rows, seen, skipped } = parseFullCompassFeed(text)

    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("fullcompass")

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
    console.error(`[fullcompass] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
