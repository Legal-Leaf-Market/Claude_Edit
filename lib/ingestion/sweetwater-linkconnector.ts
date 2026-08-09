import { gunzipSync } from "node:zlib"
import { env } from "@/lib/env"
import { isSweetwaterProductUrl } from "@/lib/affiliate/sweetwater"
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
 * Sweetwater ingestion, via a LinkConnector affiliate product datafeed only.
 *
 * WHY THIS IS THE ONLY ROUTE. Sweetwater has no published product/inventory API
 * for third parties; the only channel their affiliate program hands to
 * publishers deliberately is the datafeed on the network their program runs on
 * (LinkConnector). We do not scrape sweetwater.com or hit their site search
 * index, mirroring the Reverb rule: same bias toward under-covering rather than
 * building against an interface that was not made for this.
 *
 * So: when LINKCONNECTOR_SWEETWATER_FEED_URL is unset this job logs and no-ops.
 * It does not fall back to scraping. If the feed never materialises, Gear Avail
 * simply does not carry Sweetwater listings.
 *
 * Column names below are LinkConnector's own documented 50-column datafeed
 * format, not guesses: ProductID, Title, Description, Price, URL, ImageURL,
 * ThumbURL, InStock, UPC, EAN, Brand, Manufacturer, Model, Condition, Currency,
 * Link. LinkConnector has no distinct MPN column, so Model is the closest
 * available field and is what we store there.
 */

const FIELD_ALIASES = {
  productId: ["ProductID", "product_id", "SKU", "sku"],
  title: ["Title", "ProductName", "product_name", "Name"],
  description: ["Description", "description"],
  price: ["Price", "SalePrice", "price"],
  retailPrice: ["Retail", "retail"],
  currency: ["Currency", "currency"],
  brand: ["Brand", "brand"],
  manufacturer: ["Manufacturer", "manufacturer"],
  model: ["Model", "model"],
  // The feed's own tracked link, trusted only when it resolves to a
  // Sweetwater host (see lib/affiliate/sweetwater.ts). URL is the plain
  // merchant page, always stored as rawUrl regardless.
  link: ["Link", "link"],
  productUrl: ["URL", "url", "BuyURL"],
  imageUrl: ["ImageURL", "ThumbURL", "image_url"],
  upc: ["UPC", "upc"],
  ean: ["EAN", "ean"],
  condition: ["Condition", "condition"],
  inStock: ["InStock", "Availability", "in_stock"],
  category: ["Categories", "SubCategory", "category"],
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

/** Sweetwater's Gear Exchange condition vocabulary onto the shared buckets. */
function normalizeSweetwaterCondition(raw: string): string {
  const c = raw.toLowerCase()
  if (!c) return "Unspecified"
  if (/brand new|^new$/.test(c)) return "New"
  if (/mint/.test(c)) return "Mint"
  if (/excellent/.test(c)) return "Excellent"
  if (/very good/.test(c)) return "Very good"
  if (/^good/.test(c)) return "Good"
  if (/fair/.test(c)) return "Acceptable"
  if (/poor|non.?functioning|parts/.test(c)) return "For parts or not working"
  if (/refurb/.test(c)) return "Refurbished"
  if (/used/.test(c)) return "Used"
  return raw.slice(0, 50)
}

/** Map one LinkConnector feed row to a listing insert. Returns null for rows we cannot use. */
export function normalizeLinkConnectorRow(row: Record<string, string>): NewMarketplaceListing | null {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return null

  const priceCents = toCents(pick(row, FIELD_ALIASES.price)) ?? toCents(pick(row, FIELD_ALIASES.retailPrice))
  if (priceCents == null) return null

  const merchantUrl = pick(row, FIELD_ALIASES.productUrl)
  if (!merchantUrl) return null

  const title = pick(row, FIELD_ALIASES.title)
  if (!title) return null

  // Trust the feed's own tracked Link only when it is a Sweetwater host. An
  // unrecognised host (a network redirect domain we have not verified, or a
  // misparsed column) produces no affiliate link rather than an unverified one.
  const feedLink = pick(row, FIELD_ALIASES.link)
  const affiliateUrl = feedLink && isSweetwaterProductUrl(feedLink) ? feedLink : null

  const ean = pick(row, FIELD_ALIASES.ean)
  const upc = pick(row, FIELD_ALIASES.upc)

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    source: "sweetwater",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
    priceCents,
    currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
    condition: normalizeSweetwaterCondition(pick(row, FIELD_ALIASES.condition)),
    brand: (pick(row, FIELD_ALIASES.brand) || pick(row, FIELD_ALIASES.manufacturer)).slice(0, 100) || null,
    gtin: (ean || upc).slice(0, 20) || null,
    // EPIDs are an eBay concept; a Sweetwater row never has one.
    epid: null,
    // LinkConnector has no distinct MPN column; Model is the closest available field.
    mpn: pick(row, FIELD_ALIASES.model).slice(0, 100) || null,
    locationCountry: null,
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

export async function fetchLinkConnectorFeedText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { Accept: "text/csv,application/gzip,*/*", "User-Agent": "GearAvail/1.0 (+aggregator)" },
  })
  if (!res.ok) {
    const error = new Error(`LinkConnector feed returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  return maybeGunzip(buffer).toString("utf-8")
}

/** Parse a feed document into listing rows. Exposed for fixture-driven tests. */
export function parseLinkConnectorFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })
  const rows: NewMarketplaceListing[] = []
  let skipped = 0

  for (const record of records) {
    const row = normalizeLinkConnectorRow(record)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type SweetwaterIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
}

export async function ingestSweetwaterFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<SweetwaterIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.linkconnector.hasSweetwaterFeed) {
    const reason =
      "LINKCONNECTOR_SWEETWATER_FEED_URL is not set. Sweetwater ingestion is skipped. " +
      "Confirm in the LinkConnector affiliate dashboard whether a Sweetwater product datafeed exists. " +
      "Do NOT substitute scraping sweetwater.com or its search index."
    console.warn(`[sweetwater] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  const run = await startRun("sweetwater", "sweetwater-feed")

  try {
    const text = await withBackoff(
      () => fetchLinkConnectorFeedText(env.linkconnector.sweetwaterFeedUrl, fetchImpl),
      { attempts: 4, baseDelayMs: 2000 },
    )
    const { rows, seen, skipped } = parseLinkConnectorFeed(text)

    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("sweetwater")

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
    console.error(`[sweetwater] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
