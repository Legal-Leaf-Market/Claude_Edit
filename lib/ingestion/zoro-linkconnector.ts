import { once } from "node:events"
import { createGunzip } from "node:zlib"
import { env } from "@/lib/env"
import { isZoroTrackedProductUrl } from "@/lib/affiliate/zoro"
import {
  createCsvRecordSplitter,
  detectDelimiter,
  parseCsvRows,
  zipRecord,
  type CsvRecordSplitter,
} from "./csv"
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
 * Zoro ingestion, via their LinkConnector affiliate product datafeed.
 *
 * Zoro is Grainger's SMB arm: an industrial and business supply retailer, not a
 * music retailer. It is in scope because its catalogue genuinely does carry a
 * musical-instrument branch (a confirmed "Musical Instruments" taxonomy with
 * Instrument Accessories and Stringed Instruments beneath it, a "Percussion
 * Instruments" branch, and real instrument SKUs such as the Accent Acoustic
 * Folk Guitar CS-6), and because the LinkConnector campaign is a legitimate
 * third-party datafeed channel, the same class of source as the CJ and Awin
 * merchants. It is NOT scraped; no-ops on an unset feed URL like every other
 * gated source here.
 *
 * TWO THINGS MAKE THIS MODULE DIFFERENT FROM EVERY OTHER FEED IN THIS FOLDER.
 *
 * 1. THE FEED IS MOSTLY NOT MUSIC, so it is filtered rather than ingested
 *    whole. Zoro publishes on the order of 3.5M SKUs and the music branch is a
 *    rounding error inside it, weighted towards accessories. Ingesting the
 *    whole thing would bury the catalogue under mops, hinges and key blanks and
 *    would corrupt the one claim the site most depends on: a market price
 *    computed from an industrial supplier's list prices, mixed into the rolling
 *    median for an instrument, drags that median up and manufactures fake deal
 *    badges on everyone else's listings (CLAUDE.md section 8). The filter is
 *    therefore part of the ingestion contract, not a nicety.
 *
 *    The filter is CATEGORY FIRST and fails closed: a row whose category path
 *    does not match the music allowlist is dropped, and so is a row with no
 *    category at all. Title-keyword matching as a fallback was considered and
 *    rejected, because on this specific catalogue it is actively harmful: a
 *    search of Zoro for instrument words returns piano HINGES, jobsite piano
 *    BOXES, keyboard DRAWERS and key BLANKS. Those homographs are what a title
 *    filter would find. Dropping an unclassifiable row costs us one accessory;
 *    admitting a hinge costs us the catalogue's credibility. This is the same
 *    "under-merge rather than over-merge" bias as section 4.
 *
 * 2. IT CANNOT BE BUFFERED. At 3.5M rows the file does not fit in memory, so
 *    this module streams: a single inflater whose window survives chunk
 *    boundaries, a quote-aware record splitter, and per-row filtering, so peak
 *    memory tracks the few thousand rows we KEEP rather than the file we read.
 *    Same lesson as the eBay bootstrap feed in section 3, reached for the same
 *    reason.
 *
 * MONETISATION IS CONDITIONAL, per the campaign terms: click commission of up
 * to $0.36 pays only on product-oriented links carrying lc_pid, so a
 * zoro.com URL without it is not merely unattributed but explicitly unpaid.
 * See lib/affiliate/zoro.ts; affiliate_url is null unless both conditions hold.
 *
 * Column names are LinkConnector's own documented datafeed format, shared with
 * lib/ingestion/sweetwater-linkconnector.ts rather than guessed per merchant.
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
  /** The feed's own tracked link. Trusted only when it carries lc_pid. */
  link: ["Link", "link"],
  productUrl: ["URL", "url", "BuyURL"],
  imageUrl: ["ImageURL", "ThumbURL", "image_url"],
  upc: ["UPC", "upc"],
  ean: ["EAN", "ean"],
  condition: ["Condition", "condition"],
  inStock: ["InStock", "Availability", "in_stock"],
  /** Every category-ish column is concatenated into one path before matching. */
  category: ["Categories", "Category", "SubCategory", "category", "subcategory"],
} as const

/**
 * Category paths we accept as musical instruments.
 *
 * Anchored on branches confirmed to exist in Zoro's own taxonomy ("Musical
 * Instruments", "Percussion Instruments", "Instrument Accessories", "Stringed
 * Instruments") plus instrument-family words that cannot mean anything else in
 * a category path. Note what is deliberately NOT here: a bare /drum/, because
 * Zoro's biggest "drum" business is 55-gallon steel drums, and a bare /brass/,
 * because brass fittings are core MRO stock. Both are required to appear with
 * an instrument-qualifying word.
 *
 * Widening this list means checking the real feed's category values first, the
 * same rule house rule 13 applies to exclusion regexes.
 */
const MUSIC_CATEGORY_PATTERNS: readonly RegExp[] = [
  /musical instrument/i,
  /percussion instrument/i,
  /instrument accessor/i,
  /stringed instrument/i,
  /\bwoodwind/i,
  /\bbrass instrument/i,
  /\bdrum (?:accessor|head|stick|kit|set|pedal|throne|hardware)/i,
  /\bcymbal/i,
  /\bguitar/i,
  /\bsheet music\b/i,
]

/**
 * Hardware whose NAME reads musical. Defence in depth behind the category gate,
 * for rows where Zoro's own category assignment is loose or generic.
 *
 * The first five are observed live Zoro SKU families (Zoro Select Piano Hinge,
 * Jobsite Piano Box, Keyboard Drawer, Key Blanks, Key Cutting Lock Cylinder).
 * The drum and brass-fitting patterns are the industrial senses of words the
 * allowlist above admits in their musical sense, and should be checked against
 * the real feed's titles when it first runs rather than trusted as complete.
 */
const HARDWARE_HOMOGRAPH_PATTERNS: readonly RegExp[] = [
  /piano hinge/i,
  /piano box/i,
  /keyboard (?:drawer|tray|arm|shelf|mount|platform)/i,
  /key blank/i,
  /key cutting/i,
  /\b(?:steel|poly|plastic|fiber|fibre|salvage|shipping) drum\b/i,
  /\b\d+\s*(?:gal|gallon)\b[^,]{0,40}\bdrum\b/i,
  /\bdrum (?:dolly|faucet|pump|heater|liner|cradle|wrench|truck|ring|plug|deheader|opener|lifter)/i,
  /\bcable drum\b/i,
  /\bbrass (?:fitting|nipple|bushing|elbow|valve|tee|coupling|adapter)/i,
]

function pick(row: Record<string, string>, names: readonly string[]): string {
  for (const name of names) {
    const direct = row[name]
    if (direct) return direct.trim()
    const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase())
    if (key && row[key]) return row[key].trim()
  }
  return ""
}

/** Join every category-ish column so a match on any of them counts. */
function categoryPath(row: Record<string, string>): string {
  const parts: string[] = []
  for (const name of FIELD_ALIASES.category) {
    const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase())
    if (key && row[key]) parts.push(row[key].trim())
  }
  return parts.join(" > ")
}

export function isMusicCategory(path: string): boolean {
  if (!path.trim()) return false
  return MUSIC_CATEGORY_PATTERNS.some((pattern) => pattern.test(path))
}

export function isHardwareHomograph(title: string): boolean {
  return HARDWARE_HOMOGRAPH_PATTERNS.some((pattern) => pattern.test(title))
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

/* -------------------------------------------------------------------------- */
/*  Row mapping                                                               */
/* -------------------------------------------------------------------------- */

export type ZoroRowResult =
  | { kind: "listing"; listing: NewMarketplaceListing }
  /** Unusable row: no id, no price, no URL, no title. */
  | { kind: "rejected"; reason: "malformed" }
  /** A perfectly good row for something that is not a musical instrument. */
  | { kind: "rejected"; reason: "off-category" }

/**
 * Map one LinkConnector feed row to a listing insert, or say why not.
 *
 * The two rejection reasons are kept apart because they mean opposite things
 * operationally: "malformed" climbing is a feed or parser problem worth
 * investigating, whereas "off-category" is this module working as designed on
 * an industrial catalogue and will always be the overwhelming majority.
 */
export function classifyZoroRow(row: Record<string, string>): ZoroRowResult {
  const externalId = pick(row, FIELD_ALIASES.productId)
  if (!externalId) return { kind: "rejected", reason: "malformed" }

  const title = pick(row, FIELD_ALIASES.title)
  if (!title) return { kind: "rejected", reason: "malformed" }

  const merchantUrl = pick(row, FIELD_ALIASES.productUrl)
  if (!merchantUrl) return { kind: "rejected", reason: "malformed" }

  const priceCents =
    toCents(pick(row, FIELD_ALIASES.price)) ?? toCents(pick(row, FIELD_ALIASES.retailPrice))
  if (priceCents == null) return { kind: "rejected", reason: "malformed" }

  // Category gate before anything else is stored. Fails closed on a blank
  // category: see the header comment on why a title fallback is worse here.
  if (!isMusicCategory(categoryPath(row))) return { kind: "rejected", reason: "off-category" }
  if (isHardwareHomograph(title)) return { kind: "rejected", reason: "off-category" }

  // Click commission pays only on lc_pid-carrying product links, so an
  // untracked Zoro URL earns nothing and must not be stored as if it did.
  const feedLink = pick(row, FIELD_ALIASES.link)
  const affiliateUrl = feedLink && isZoroTrackedProductUrl(feedLink) ? feedLink : null

  const ean = pick(row, FIELD_ALIASES.ean)
  const upc = pick(row, FIELD_ALIASES.upc)

  const inStockRaw = pick(row, FIELD_ALIASES.inStock)
  const isActive = inStockRaw === "" ? true : truthy(inStockRaw)

  return {
    kind: "listing",
    listing: {
      source: "zoro",
      externalId: externalId.slice(0, 255),
      title: title.slice(0, 255),
      description: pick(row, FIELD_ALIASES.description).slice(0, 8000) || null,
      priceCents,
      currency: (pick(row, FIELD_ALIASES.currency) || "USD").slice(0, 10),
      // An industrial-supply retailer with no used or consignment channel, so
      // an empty condition column means New, same as Gear4music and the CJ
      // retailers rather than Reverb's "Unspecified".
      condition: normalizeZoroCondition(pick(row, FIELD_ALIASES.condition)),
      brand: (pick(row, FIELD_ALIASES.brand) || pick(row, FIELD_ALIASES.manufacturer)).slice(0, 100) || null,
      gtin: (ean || upc).slice(0, 20) || null,
      // EPIDs are an eBay concept; a Zoro row never has one.
      epid: null,
      // LinkConnector has no distinct MPN column; Model is the closest field.
      mpn: pick(row, FIELD_ALIASES.model).slice(0, 100) || null,
      // The campaign is US traffic only and Zoro ships domestically.
      locationCountry: "US",
      locationZip: null,
      isLocalPickup: false,
      isShippable: true,
      rawUrl: merchantUrl,
      affiliateUrl,
      primaryImageUrl: pick(row, FIELD_ALIASES.imageUrl) || null,
      listingStatus: isActive ? "active" : "expired",
      listedAt: null,
      endsAt: null,
    },
  }
}

function normalizeZoroCondition(raw: string): string {
  const c = raw.toLowerCase()
  if (!c) return "New"
  if (/refurb|recondition/.test(c)) return "Refurbished"
  if (/open.?box/.test(c)) return "Open box"
  if (/used/.test(c)) return "Used"
  return "New"
}

/** Convenience wrapper for callers that only want the listing or nothing. */
export function normalizeZoroRow(row: Record<string, string>): NewMarketplaceListing | null {
  const result = classifyZoroRow(row)
  return result.kind === "listing" ? result.listing : null
}

/* -------------------------------------------------------------------------- */
/*  Streaming parse                                                           */
/* -------------------------------------------------------------------------- */

export type ZoroParseTally = {
  seen: number
  kept: number
  malformed: number
  offCategory: number
}

/**
 * Incremental reader: text chunks in, music listings out.
 *
 * The header line is taken from the text before the first newline. Column names
 * never contain a quoted newline, so that is safe to find without quote state,
 * and it is what tells us the delimiter before the record splitter is built.
 */
function createZoroRecordReader() {
  let headerBuffer = ""
  let header: string[] | null = null
  let splitter: CsvRecordSplitter | null = null
  let delimiter = ","
  const tally: ZoroParseTally = { seen: 0, kept: 0, malformed: 0, offCategory: 0 }

  function toListings(lines: string[]): NewMarketplaceListing[] {
    const out: NewMarketplaceListing[] = []
    for (const line of lines) {
      if (line.trim() === "") continue
      const cells = parseCsvRows(line, { delimiter })[0]
      if (!cells) continue
      tally.seen += 1
      const result = classifyZoroRow(zipRecord(header!, cells))
      if (result.kind === "listing") {
        tally.kept += 1
        out.push(result.listing)
      } else if (result.reason === "malformed") {
        tally.malformed += 1
      } else {
        tally.offCategory += 1
      }
    }
    return out
  }

  return {
    tally,
    push(chunk: string): NewMarketplaceListing[] {
      if (!header) {
        headerBuffer += chunk
        const newline = headerBuffer.indexOf("\n")
        if (newline === -1) return []
        const headerLine = headerBuffer.slice(0, newline)
        const rest = headerBuffer.slice(newline + 1)
        headerBuffer = ""
        delimiter = detectDelimiter(headerLine)
        header = (parseCsvRows(headerLine, { delimiter })[0] ?? []).map((h) => h.trim())
        splitter = createCsvRecordSplitter({ delimiter })
        return toListings(splitter.push(rest))
      }
      return toListings(splitter!.push(chunk))
    },
    flush(): NewMarketplaceListing[] {
      if (!header || !splitter) return []
      return toListings(splitter.flush())
    },
  }
}

/** Parse a whole feed document. Exposed for fixture-driven tests. */
export function parseZoroFeed(text: string): {
  rows: NewMarketplaceListing[]
  tally: ZoroParseTally
} {
  const reader = createZoroRecordReader()
  const rows = [...reader.push(text), ...reader.flush()]
  return { rows, tally: reader.tally }
}

/* -------------------------------------------------------------------------- */
/*  Fetching                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Stream a feed response as text, inflating it if it is gzipped.
 *
 * Gzip is detected from the magic bytes rather than Content-Type, because
 * affiliate networks serve .gz files as octet-stream (which fetch will not
 * decompress for us) as readily as they serve plain CSV. One inflater is used
 * for the whole stream so a gzip member split across two network chunks is
 * invisible to it, the same requirement as the eBay feed's chunked ranges.
 */
export async function* streamZoroFeedText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<string> {
  const res = await fetchImpl(url, {
    headers: {
      Accept: "text/csv,text/tab-separated-values,application/gzip,*/*",
      "User-Agent": "GearAvail/1.0 (+aggregator)",
    },
  })
  if (!res.ok) {
    const error = new Error(`LinkConnector feed returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  if (!res.body) return

  const reader = res.body.getReader()

  // Accumulate at least the two gzip magic bytes before deciding how to read
  // the rest. A server is entirely free to deliver the first chunk one byte at
  // a time, and deciding on a short first chunk reads a gzipped feed as text.
  const headChunks: Buffer[] = []
  let headBytes = 0
  let exhausted = false
  while (headBytes < 2) {
    const { done, value } = await reader.read()
    if (done) {
      exhausted = true
      break
    }
    headChunks.push(Buffer.from(value))
    headBytes += value.length
  }
  if (headBytes === 0) return

  const head = Buffer.concat(headChunks)
  const decoder = new TextDecoder("utf-8")
  const isGzip = head.length > 1 && head[0] === 0x1f && head[1] === 0x8b

  if (!isGzip) {
    yield decoder.decode(head, { stream: true })
    while (!exhausted) {
      const { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(Buffer.from(value), { stream: true })
    }
    const tail = decoder.decode()
    if (tail) yield tail
    return
  }

  const gunzip = createGunzip()
  const pump = (async () => {
    if (!gunzip.write(head)) await once(gunzip, "drain")
    while (!exhausted) {
      const { done, value } = await reader.read()
      if (done) break
      if (!gunzip.write(Buffer.from(value))) await once(gunzip, "drain")
    }
    gunzip.end()
  })()
  // Surface a mid-stream network error as a stream error rather than an
  // unhandled rejection that leaves the inflater hanging.
  pump.catch((error: unknown) => gunzip.destroy(error as Error))

  for await (const chunk of gunzip) {
    yield decoder.decode(chunk as Buffer, { stream: true })
  }
  const tail = decoder.decode()
  if (tail) yield tail
  await pump
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Rows per upsert flush. Keeps peak memory tied to this rather than to the
 * number of music rows the feed happens to contain.
 */
const UPSERT_FLUSH_SIZE = 500

export type ZoroIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  /** How the filter split the feed, so a broken filter is visible in the log. */
  tally?: ZoroParseTally
  error?: string
}

export async function ingestZoroFeed(fetchImpl: typeof fetch = fetch): Promise<ZoroIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  if (!env.linkconnector.hasZoroFeed) {
    const reason =
      "LINKCONNECTOR_ZORO_FEED_URL is not set. Zoro ingestion is skipped. " +
      "Retrieve the product datafeed URL from the LinkConnector dashboard under the Zoro campaign. " +
      "Do NOT substitute scraping zoro.com."
    console.warn(`[zoro] ${reason}`)
    return { status: "skipped", reason, stats: empty, resolved: 0 }
  }

  const run = await startRun("zoro", "zoro-feed")

  try {
    const stats: UpsertStats = { ...empty, touchedGearIds: [] }
    let bytes = 0
    let tally: ZoroParseTally = { seen: 0, kept: 0, malformed: 0, offCategory: 0 }

    const flush = async (batch: NewMarketplaceListing[]) => {
      if (batch.length === 0) return
      const batchStats = await upsertListings(batch)
      stats.inserted += batchStats.inserted
      stats.updated += batchStats.updated
      stats.skipped += batchStats.skipped
      stats.priceChanges += batchStats.priceChanges
      stats.touchedGearIds.push(...batchStats.touchedGearIds)
    }

    // withBackoff wraps the whole stream rather than a single response, so a
    // retry restarts the feed from the beginning. That is safe because every
    // upsert is keyed on (source, external_id) and a re-run is a no-op by
    // design (section 9), and it is the only correct option: a partially
    // consumed stream cannot be resumed from the middle.
    await withBackoff(
      async () => {
        const reader = createZoroRecordReader()
        let batch: NewMarketplaceListing[] = []
        for await (const chunk of streamZoroFeedText(env.linkconnector.zoroFeedUrl, fetchImpl)) {
          bytes += Buffer.byteLength(chunk)
          batch.push(...reader.push(chunk))
          while (batch.length >= UPSERT_FLUSH_SIZE) {
            await flush(batch.slice(0, UPSERT_FLUSH_SIZE))
            batch = batch.slice(UPSERT_FLUSH_SIZE)
          }
        }
        batch.push(...reader.flush())
        await flush(batch)
        tally = reader.tally
      },
      { attempts: 4, baseDelayMs: 2000 },
    )

    stats.seen = tally.seen
    stats.skipped += tally.malformed

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate("zoro")

    console.log(
      `[zoro] ${tally.kept} music rows kept from ${tally.seen} feed rows ` +
        `(${tally.offCategory} off-category, ${tally.malformed} malformed)`,
    )

    await finishRun(run, {
      status: "ok",
      rowsSeen: tally.seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: tally.offCategory + tally.malformed,
      bytesDownloaded: bytes,
      detail: { resolved, priceChanges: stats.priceChanges, tally },
    })

    return { status: "ok", stats, resolved, tally }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[zoro] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
