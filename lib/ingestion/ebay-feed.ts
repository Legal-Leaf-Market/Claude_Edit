import { createGunzip, constants as zlibConstants } from "node:zlib"
import { Readable } from "node:stream"
import { env } from "@/lib/env"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Client and parser for the eBay Buy Feed API (v1_beta).
 *
 * Shape of the thing, because it is unusual for a REST API:
 *   - A successful call returns a gzipped TSV file, NOT JSON. Errors return
 *     JSON. So the response parser branches on status, not on Content-Type.
 *   - The file can be several GB, so it is downloaded in byte ranges through
 *     the mandatory `Range` header and reassembled client side.
 *   - The first line of the decompressed TSV is a header row. We bind columns
 *     by NAME rather than by position: eBay adds fields to the ~98-column Item
 *     schema over time, and a positional parser silently shifts every value the
 *     day they do.
 *
 * Everything here is transport and parsing only. Persistence lives in
 * lib/ingestion/upsert.ts, canonical matching in lib/canonical/resolve.ts.
 */

/* -------------------------------------------------------------------------- */
/*  Request types                                                             */
/* -------------------------------------------------------------------------- */

/**
 * NEWLY_LISTED returns the new listings for a single `date`.
 * ALL_ACTIVE is the weekly bootstrap of everything active, and ignores `date`.
 */
export type FeedScope = "NEWLY_LISTED" | "ALL_ACTIVE"

export type ItemFeedParams = {
  categoryId: string
  feedScope: FeedScope
  /** yyyyMMdd. Required for NEWLY_LISTED, ignored for ALL_ACTIVE. */
  date?: string
}

export type ItemSnapshotParams = {
  categoryId: string
  /** ISO 8601 hour, e.g. 2026-08-09T13:00:00.000Z. eBay lags roughly 2 hours. */
  snapshotDate: string
}

export type FeedFetchOptions = {
  baseUrl?: string
  oauthToken?: string
  marketplaceId?: string
  chunkBytes?: number
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Hard ceiling on bytes pulled in one run. Guards against a runaway bootstrap. */
  maxBytes?: number
  onProgress?: (downloadedBytes: number, totalBytes: number | null) => void
}

/** eBay returns structured JSON on failure. Surface it rather than a bare status. */
export class EbayFeedError extends Error {
  readonly status: number
  readonly errors: unknown

  constructor(status: number, message: string, errors: unknown) {
    super(message)
    this.name = "EbayFeedError"
    this.status = status
    this.errors = errors
  }
}

/* -------------------------------------------------------------------------- */
/*  URL and header construction                                               */
/* -------------------------------------------------------------------------- */

export function buildItemFeedUrl(params: ItemFeedParams, baseUrl = env.ebay.baseUrl): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/item`)
  url.searchParams.set("category_id", params.categoryId)
  url.searchParams.set("feed_scope", params.feedScope)
  // `date` is required for NEWLY_LISTED and rejected as meaningless for
  // ALL_ACTIVE, so it is only ever attached to the former.
  if (params.feedScope === "NEWLY_LISTED") {
    if (!params.date) throw new Error("NEWLY_LISTED requires a date in yyyyMMdd form")
    url.searchParams.set("date", params.date)
  }
  return url.toString()
}

export function buildItemSnapshotUrl(
  params: ItemSnapshotParams,
  baseUrl = env.ebay.baseUrl,
): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/item_snapshot`)
  url.searchParams.set("category_id", params.categoryId)
  url.searchParams.set("snapshot_date", params.snapshotDate)
  return url.toString()
}

function feedHeaders(opts: FeedFetchOptions, rangeStart: number, rangeEnd: number) {
  const token = opts.oauthToken ?? env.ebay.oauthToken
  const headers: Record<string, string> = {
    // Both types are required: success is TSV_GZIP, errors are JSON.
    Accept: "application/json,text/tab-separated-values",
    "X-EBAY-C-MARKETPLACE-ID": opts.marketplaceId ?? env.ebay.marketplaceId,
    Range: `bytes=${rangeStart}-${rangeEnd}`,
    "Accept-Encoding": "gzip",
  }
  if (token) headers.Authorization = `Bearer ${token}`
  // Passing affiliate context is what makes eBay populate itemAffiliateWebUrl
  // in the feed rows. Without it every row arrives with an empty affiliate URL
  // and we fall back to the raw listing link at click time.
  if (env.ebay.affiliateCampaignId) {
    headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${env.ebay.affiliateCampaignId}`
  }
  return headers
}

/** `bytes 0-10485759/52428800` -> { end, total }. Null when absent or unparseable. */
export function parseContentRange(
  header: string | null,
): { start: number; end: number; total: number | null } | null {
  if (!header) return null
  const m = header.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i)
  if (!m) return null
  return {
    start: Number(m[1]),
    end: Number(m[2]),
    total: m[3] === "*" ? null : Number(m[3]),
  }
}

/* -------------------------------------------------------------------------- */
/*  Chunked download                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Pull a feed file in sequential byte ranges.
 *
 * eBay answers a ranged request with 206 and a Content-Range that tells us the
 * true file size, so the loop learns its own termination condition from the
 * first response rather than needing it up front. A 200 means the server
 * ignored the range and handed us the whole file, which is a valid single-pass
 * outcome we accept and stop on.
 */
export async function* downloadFeedChunks(
  url: string,
  opts: FeedFetchOptions = {},
): AsyncGenerator<Uint8Array> {
  const doFetch = opts.fetchImpl ?? fetch
  const chunkBytes = opts.chunkBytes ?? env.ebay.chunkBytes
  const maxBytes = opts.maxBytes ?? Number.POSITIVE_INFINITY

  let position = 0
  let total: number | null = null

  for (;;) {
    const rangeEnd = position + chunkBytes - 1
    const res = await doFetch(url, {
      method: "GET",
      headers: feedHeaders(opts, position, rangeEnd),
    })

    if (res.status !== 200 && res.status !== 206) {
      throw await toFeedError(res)
    }

    const body = new Uint8Array(await res.arrayBuffer())
    if (body.byteLength > 0) {
      yield body
      position += body.byteLength
      opts.onProgress?.(position, total)
    }

    // A 200 means the range was ignored and the body is the complete file.
    if (res.status === 200) return

    const range = parseContentRange(res.headers.get("content-range"))
    if (range?.total != null) total = range.total

    if (body.byteLength === 0) return
    if (total != null && position >= total) return
    if (position >= maxBytes) return
    // Server returned less than we asked for and gave us no total: treat a
    // short chunk as the end of the file rather than looping forever.
    if (total == null && body.byteLength < chunkBytes) return
  }
}

async function toFeedError(res: Response): Promise<EbayFeedError> {
  const text = await res.text().catch(() => "")
  let parsed: unknown = undefined
  let message = `eBay Feed API returned ${res.status}`
  try {
    parsed = JSON.parse(text)
    const first = (parsed as { errors?: { message?: string; longMessage?: string }[] })?.errors?.[0]
    if (first?.longMessage || first?.message) {
      message = `${message}: ${first.longMessage ?? first.message}`
    }
  } catch {
    // Non-JSON body (a proxy error page, say). Keep the raw text as context.
    if (text) message = `${message}: ${text.slice(0, 400)}`
  }
  return new EbayFeedError(res.status, message, parsed)
}

/* -------------------------------------------------------------------------- */
/*  Decompression                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Inflate a sequence of byte chunks that together form one gzip file.
 *
 * The chunk boundaries from the Range loop fall at arbitrary offsets, routinely
 * mid-DEFLATE-block and sometimes mid-gzip-member. A streaming inflater is the
 * correct answer: it keeps its own window across writes, so a boundary that
 * splits a member is simply invisible to it. Reassembling the whole file in
 * memory first would work too, but a multi-GB bootstrap feed would not fit.
 *
 * `finishFlush: Z_SYNC_FLUSH` makes a truncated tail yield the bytes decoded so
 * far instead of throwing, which matters when `maxBytes` cuts a run short.
 */
export function gunzipChunks(chunks: AsyncIterable<Uint8Array>): AsyncIterable<Buffer> {
  const gunzip = createGunzip({ finishFlush: zlibConstants.Z_SYNC_FLUSH })
  return Readable.from(chunks).pipe(gunzip)
}

/* -------------------------------------------------------------------------- */
/*  TSV parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Turn a byte stream into rows keyed by the feed's own header names.
 *
 * Deliberately incremental: it holds one line at a time, not the file, so a
 * 5 GB feed costs constant memory. Blank lines are skipped, and a row with a
 * different arity to the header is padded or truncated rather than dropped, so
 * one malformed row never aborts an entire category's ingest.
 */
export async function* parseTsvRows(
  byteChunks: AsyncIterable<Buffer | Uint8Array>,
): AsyncGenerator<Record<string, string>> {
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let header: string[] | null = null

  const emit = function* (line: string): Generator<Record<string, string>> {
    if (line === "") return
    if (header === null) {
      header = line.split("\t").map((h) => h.trim())
      return
    }
    const cells = line.split("\t")
    const row: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cells[i] ?? ""
    }
    yield row
  }

  for await (const chunk of byteChunks) {
    buffer += decoder.decode(chunk, { stream: true })
    let newlineAt: number
    while ((newlineAt = buffer.indexOf("\n")) !== -1) {
      // Strip a trailing \r so CRLF feeds do not leave it glued to the last cell.
      const line = buffer.slice(0, newlineAt).replace(/\r$/, "")
      buffer = buffer.slice(newlineAt + 1)
      yield* emit(line)
    }
  }
  buffer += decoder.decode()
  if (buffer.length > 0) yield* emit(buffer.replace(/\r$/, ""))
}

/* -------------------------------------------------------------------------- */
/*  Item schema                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The slice of eBay's ~98-column Item schema that Gear Avail actually uses.
 * Everything else in the row is carried through untouched in `raw` so a later
 * feature can read a field without a re-ingest.
 */
export type EbayItem = {
  itemId: string
  legacyItemId: string
  title: string
  condition: string
  conditionId: string
  priceValue: number | null
  priceCurrency: string
  brand: string
  inferredBrand: string
  mpn: string
  inferredMpn: string
  epid: string
  inferredEpid: string
  gtin: string
  inferredGtin: string
  defaultImageUrl: string
  additionalImageUrls: string[]
  itemWebUrl: string
  itemAffiliateWebUrl: string
  itemLocationCountry: string
  itemLocationPostalCode: string
  itemCreationDate: string
  itemEndDate: string
  buyingOptions: string[]
  localizedAspects: string
  sellerUsername: string
  categoryId: string
  raw: Record<string, string>
}

/** Column aliases seen across feed versions, first match wins. */
const COLUMN_ALIASES: Record<keyof Omit<EbayItem, "raw">, string[]> = {
  itemId: ["itemId", "item_id"],
  legacyItemId: ["legacyItemId", "legacy_item_id"],
  title: ["title"],
  condition: ["condition"],
  conditionId: ["conditionId", "condition_id"],
  priceValue: ["price", "price/value", "priceValue", "price.value"],
  priceCurrency: ["priceCurrency", "price/currency", "price.currency"],
  brand: ["brand"],
  inferredBrand: ["inferredBrand", "inferred_brand"],
  mpn: ["mpn"],
  inferredMpn: ["inferredMpn", "inferred_mpn"],
  epid: ["epid"],
  inferredEpid: ["inferredEpid", "inferred_epid"],
  gtin: ["gtin"],
  inferredGtin: ["inferredGtin", "inferred_gtin"],
  defaultImageUrl: ["defaultImageUrl", "image", "imageUrl"],
  additionalImageUrls: ["additionalImageUrls", "additional_image_urls"],
  itemWebUrl: ["itemWebUrl", "item_web_url"],
  itemAffiliateWebUrl: ["itemAffiliateWebUrl", "item_affiliate_web_url"],
  itemLocationCountry: ["itemLocationCountry", "itemLocation/country", "item_location_country"],
  itemLocationPostalCode: ["itemLocationPostalCode", "itemLocation/postalCode"],
  itemCreationDate: ["itemCreationDate", "item_creation_date"],
  itemEndDate: ["itemEndDate", "item_end_date"],
  buyingOptions: ["buyingOptions", "buying_options"],
  localizedAspects: ["localizedAspects", "localized_aspects"],
  sellerUsername: ["sellerUsername", "seller/username", "seller"],
  categoryId: ["categoryId", "category_id", "primaryCategoryId"],
}

function pick(row: Record<string, string>, names: string[]): string {
  for (const n of names) {
    const v = row[n]
    if (v !== undefined && v !== "") return v.trim()
  }
  return ""
}

/**
 * eBay writes prices either as a bare decimal ("249.99") or as a compound
 * "USD249.99" / "249.99 USD" depending on the column. Parse both, and never
 * trust a value that is not finite.
 */
export function parseFeedPrice(raw: string): { value: number | null; currency: string } {
  if (!raw) return { value: null, currency: "" }
  const currencyMatch = raw.match(/[A-Z]{3}/)
  const numberMatch = raw.match(/-?\d+(?:[.,]\d+)?/)
  if (!numberMatch) return { value: null, currency: currencyMatch?.[0] ?? "" }
  const n = Number.parseFloat(numberMatch[0].replace(",", "."))
  return {
    value: Number.isFinite(n) ? n : null,
    currency: currencyMatch?.[0] ?? "",
  }
}

function splitList(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toEbayItem(row: Record<string, string>): EbayItem {
  const priceRaw = pick(row, COLUMN_ALIASES.priceValue)
  const parsedPrice = parseFeedPrice(priceRaw)
  const explicitCurrency = pick(row, COLUMN_ALIASES.priceCurrency)

  return {
    itemId: pick(row, COLUMN_ALIASES.itemId),
    legacyItemId: pick(row, COLUMN_ALIASES.legacyItemId),
    title: pick(row, COLUMN_ALIASES.title),
    condition: pick(row, COLUMN_ALIASES.condition),
    conditionId: pick(row, COLUMN_ALIASES.conditionId),
    priceValue: parsedPrice.value,
    priceCurrency: explicitCurrency || parsedPrice.currency || "USD",
    brand: pick(row, COLUMN_ALIASES.brand),
    inferredBrand: pick(row, COLUMN_ALIASES.inferredBrand),
    mpn: pick(row, COLUMN_ALIASES.mpn),
    inferredMpn: pick(row, COLUMN_ALIASES.inferredMpn),
    epid: pick(row, COLUMN_ALIASES.epid),
    inferredEpid: pick(row, COLUMN_ALIASES.inferredEpid),
    gtin: pick(row, COLUMN_ALIASES.gtin),
    inferredGtin: pick(row, COLUMN_ALIASES.inferredGtin),
    defaultImageUrl: pick(row, COLUMN_ALIASES.defaultImageUrl),
    additionalImageUrls: splitList(pick(row, COLUMN_ALIASES.additionalImageUrls)),
    itemWebUrl: pick(row, COLUMN_ALIASES.itemWebUrl),
    itemAffiliateWebUrl: pick(row, COLUMN_ALIASES.itemAffiliateWebUrl),
    itemLocationCountry: pick(row, COLUMN_ALIASES.itemLocationCountry),
    itemLocationPostalCode: pick(row, COLUMN_ALIASES.itemLocationPostalCode),
    itemCreationDate: pick(row, COLUMN_ALIASES.itemCreationDate),
    itemEndDate: pick(row, COLUMN_ALIASES.itemEndDate),
    buyingOptions: splitList(pick(row, COLUMN_ALIASES.buyingOptions)),
    localizedAspects: pick(row, COLUMN_ALIASES.localizedAspects),
    sellerUsername: pick(row, COLUMN_ALIASES.sellerUsername),
    categoryId: pick(row, COLUMN_ALIASES.categoryId),
    raw: row,
  }
}

/* -------------------------------------------------------------------------- */
/*  Condition mapping                                                         */
/* -------------------------------------------------------------------------- */

/**
 * eBay condition IDs collapsed into the handful of buckets a used-gear shopper
 * actually filters on. The numeric id is authoritative; the free-text
 * `condition` column varies by seller and category.
 */
const CONDITION_BY_ID: Record<string, string> = {
  "1000": "New",
  "1500": "Open box",
  "1750": "New with defects",
  "2000": "Refurbished",
  "2010": "Refurbished",
  "2020": "Refurbished",
  "2030": "Refurbished",
  "2500": "Seller refurbished",
  "3000": "Used",
  "4000": "Very good",
  "5000": "Good",
  "6000": "Acceptable",
  "7000": "For parts or not working",
}

export function normalizeCondition(item: Pick<EbayItem, "conditionId" | "condition">): string {
  const byId = CONDITION_BY_ID[item.conditionId]
  if (byId) return byId
  return item.condition || "Unspecified"
}

/* -------------------------------------------------------------------------- */
/*  Normalisation to a listing row                                            */
/* -------------------------------------------------------------------------- */

function toCents(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

function toDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Map one feed Item onto a marketplace_listings insert.
 *
 * Returns null for rows we cannot honestly represent: no id, no price, or no
 * outbound URL. Dropping them here keeps the "cheapest first" sort truthful,
 * which is the entire product.
 *
 * Explicit fields beat inferred ones throughout. eBay's `inferred*` columns are
 * their own guess from the title, so treating them as equal to a seller-entered
 * GTIN would let a guess claim a UNIQUE key in canonical_gear.
 */
export function normalizeToListing(item: EbayItem): NewMarketplaceListing | null {
  const externalId = item.itemId || item.legacyItemId
  if (!externalId) return null

  const priceCents = toCents(item.priceValue)
  if (priceCents == null || priceCents <= 0) return null

  const rawUrl = item.itemWebUrl
  if (!rawUrl) return null

  // CLASSIFIED_AD listings are local, in-person sales: there is no shipping leg
  // and no online checkout. Everything else is treated as shippable.
  const isClassified = item.buyingOptions.includes("CLASSIFIED_AD")

  return {
    source: "ebay",
    externalId,
    title: item.title.slice(0, 255),
    description: null,
    priceCents,
    currency: item.priceCurrency || "USD",
    condition: normalizeCondition(item),
    brand: (item.brand || item.inferredBrand || "").slice(0, 100) || null,
    gtin: (item.gtin || item.inferredGtin || "").slice(0, 20) || null,
    epid: (item.epid || item.inferredEpid || "").slice(0, 30) || null,
    mpn: (item.mpn || item.inferredMpn || "").slice(0, 100) || null,
    locationCountry: item.itemLocationCountry.slice(0, 4) || null,
    locationZip: item.itemLocationPostalCode.slice(0, 20) || null,
    isLocalPickup: isClassified,
    isShippable: !isClassified,
    rawUrl,
    affiliateUrl: item.itemAffiliateWebUrl || null,
    primaryImageUrl: item.defaultImageUrl || null,
    listingStatus: "active",
    listedAt: toDate(item.itemCreationDate),
    endsAt: toDate(item.itemEndDate),
  }
}

/* -------------------------------------------------------------------------- */
/*  High-level readers                                                        */
/* -------------------------------------------------------------------------- */

export type FeedReadResult = {
  items: EbayItem[]
  rowsSeen: number
  bytesDownloaded: number
}

/** Compose download -> gunzip -> TSV -> Item for any feed URL. */
export async function* streamFeedItems(
  url: string,
  opts: FeedFetchOptions = {},
): AsyncGenerator<EbayItem> {
  let bytes = 0
  const counted = async function* (): AsyncGenerator<Uint8Array> {
    for await (const chunk of downloadFeedChunks(url, opts)) {
      bytes += chunk.byteLength
      yield chunk
    }
  }
  for await (const row of parseTsvRows(gunzipChunks(counted()))) {
    yield toEbayItem(row)
  }
}

export async function readItemFeed(
  params: ItemFeedParams,
  opts: FeedFetchOptions = {},
): Promise<EbayItem[]> {
  const url = buildItemFeedUrl(params, opts.baseUrl ?? env.ebay.baseUrl)
  const items: EbayItem[] = []
  for await (const item of streamFeedItems(url, opts)) items.push(item)
  return items
}

export async function readItemSnapshot(
  params: ItemSnapshotParams,
  opts: FeedFetchOptions = {},
): Promise<EbayItem[]> {
  const url = buildItemSnapshotUrl(params, opts.baseUrl ?? env.ebay.baseUrl)
  const items: EbayItem[] = []
  for await (const item of streamFeedItems(url, opts)) items.push(item)
  return items
}

/** yyyyMMdd in UTC, the format the `date` query parameter expects. */
export function feedDateStamp(d: Date = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/**
 * The most recent hour eBay is likely to have published.
 *
 * Snapshot files take roughly two hours to generate, so asking for the current
 * hour reliably 404s. Default to three hours back and floor to the hour.
 */
export function snapshotHourStamp(now: Date = new Date(), hoursBack = 3): string {
  const d = new Date(now.getTime() - hoursBack * 3600_000)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, ".000Z")
}
