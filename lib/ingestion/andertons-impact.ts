import { gunzipSync } from "node:zlib"
import { Writable } from "node:stream"
import { isImpactTrackingUrl } from "@/lib/affiliate/impact"
import { env } from "@/lib/env"
import { detectDelimiter, parseCsv } from "./csv"
import {
  expirePastEndDate,
  finishRun,
  resolveAndReprice,
  startRun,
  upsertListings,
  type UpsertStats,
} from "./upsert"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Anderton's ingestion, via their Impact.com product catalogue.
 *
 * Three things make this different from every other source here, and all three
 * are load bearing.
 *
 * 1. IT ARRIVES BY FTP, NOT HTTPS. Awin, CJ and LinkConnector all publish an
 *    authenticated feed URL. Impact drops catalogues on an FTP server
 *    (products.impact.com, one directory per advertiser) and the publisher
 *    pulls them. That is why this job belongs on the BullMQ worker rather than
 *    a Vercel cron route: a serverless function cannot hold an FTP control
 *    connection plus passive data ports open for the length of a 27k-row
 *    download.
 *
 * 2. THE SCHEMA IS THE BRAND'S, NOT THE NETWORK'S. Impact mandates exactly
 *    three fields (a link URL, a catalogue item id, and a name) and lets each
 *    brand name and choose the rest. Anderton's catalogue is literally called
 *    "Custom AMC Feed", so there is no network-standard column set to bind to
 *    the way zzounds-cj.ts binds to CJ's documented fields.
 *
 *    The response is the same discipline section 3 of CLAUDE.md demands of the
 *    eBay parser: bind by HEADER NAME through an alias table, never by
 *    position, and when a mandatory column cannot be found, FAIL LOUDLY naming
 *    the headers that were actually present. A parser that guesses silently
 *    shifts every value in every row, which is indistinguishable from working
 *    until someone notices the prices are wrong.
 *
 * 3. IT IS PRICED IN GBP. Anderton's trades only in the UK. Defaulting the
 *    currency to USD, as the CJ modules reasonably do for US retailers, would
 *    mislabel all 27,052 rows and make every price comparison against them
 *    nonsense.
 *
 * Commission is 4% on a named list of sixteen brands and 1% elsewhere. That is
 * recorded in CLAUDE.md and is deliberately NOT visible to this module: a
 * commission-aware ingester is one refactor away from filtering the feed down
 * to the paying brands, which is ranking by payout performed at the row level.
 */

/* -------------------------------------------------------------------------- */
/*  Column binding                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Header aliases, most specific first.
 *
 * TUNED AGAINST THE REAL HEADER ROW (40 columns, tab separated, 11 Aug 2026).
 * It is preserved verbatim as tests/fixtures/andertons-impact-headers.tsv and
 * `tests/andertons-impact.test.ts` binds against it, so a future feed change
 * that drops or renames a column fails in CI rather than in production.
 *
 * The real row confirmed the design and caught exactly one miss: the brand
 * column is "Manufacturer Name", not "Manufacturer", so every one of the 27,052
 * rows would have come through with a null brand. That is not cosmetic. Brand
 * is what scopes MPN matching and fuzzy matching in the resolver (CLAUDE.md
 * section 4), and an unscoped fallback to parsing the brand back out of the
 * title is exactly the guesswork tier 1c exists to avoid.
 *
 * Impact's own documented field names are kept in each list ahead of the
 * Anderton's spelling. They cost nothing, and Impact catalogues are configured
 * per advertiser, so the next Impact merchant will very likely name things
 * differently again.
 */
const FIELD_ALIASES = {
  /** Mandatory in Impact's spec. Anderton's: "Sku". */
  itemId: ["Catalog Item Id", "CatalogItemId", "catalog_item_id", "Item Id", "SKU", "Sku", "Id", "Product Id", "product_id"],
  /** Mandatory in Impact's spec. Anderton's: "Name". */
  name: ["Name", "Product Name", "product_name", "Title", "title"],
  /** Mandatory in Impact's spec. This is the tracked destination. Anderton's: "Url". */
  url: ["Url", "URL", "Link URL", "Link Url", "link_url", "Product Url", "product_url", "Tracking Url", "Buy Url"],

  description: ["Description", "description", "Long Description", "Short Description"],
  currentPrice: ["Current Price", "CurrentPrice", "current_price", "Price", "price", "Sale Price", "sale_price"],
  originalPrice: ["Original Price", "OriginalPrice", "original_price", "Retail Price", "List Price", "Was Price"],
  currency: ["Currency", "currency", "Currency Code", "currency_code"],
  /**
   * "Manufacturer Name" is Anderton's spelling and the one that actually binds.
   * The bare "Manufacturer" ahead of it is Impact's documented name.
   */
  manufacturer: ["Manufacturer", "Manufacturer Name", "manufacturer_name", "manufacturer", "Brand", "brand", "Vendor"],
  imageUrl: ["Image Url", "Image URL", "ImageUrl", "image_url", "Image", "Main Image"],
  /**
   * The feed carries BOTH "Category Path" and "Category Name". The path wins:
   * it is the full hierarchy ("Guitars > Electric Guitars > ...") and
   * `normalizeCategory` has more to match against, where the leaf name alone
   * loses the context that tells a "Standard" apart from a "Standard".
   */
  category: ["Category Path", "Category", "category", "Category Name", "Product Category", "Google Category"],
  gtin: ["Gtin", "GTIN", "gtin", "Ean", "EAN", "Upc", "UPC", "Barcode"],
  /**
   * NOT PRESENT in Anderton's catalogue, and that is a fact about the feed
   * rather than a gap in this table. It resolves to null, tier 1c (brand + MPN)
   * simply never fires for these rows, and Gtin carries the hard identity
   * instead. Do not "fix" this by pointing it at Sku: a retailer's own stock
   * number is not a manufacturer part number, and feeding one into a key that
   * claims to name a product across merchants would merge unrelated gear.
   */
  mpn: ["Mpn", "MPN", "mpn", "Manufacturer Part Number", "Part Number"],
  stock: ["Stock Availability", "StockAvailability", "stock_availability", "Availability", "In Stock", "Stock", "Stock Status"],
  /**
   * CONFIRMED PRESENT as "Original Url". This is the good case: the feed
   * carries Anderton's own untracked product page beside Impact's tracked
   * link, so rawUrl is the real page and affiliateUrl is the tracked one.
   * Better than the CJ situation, where only a pre-built BUY_URL exists.
   */
  originalUrl: ["Original Url", "Original URL", "original_url", "Merchant Url", "Landing Page", "Product Page"],
  condition: ["Condition", "condition", "Item Condition"],
} as const

/**
 * COLUMNS THIS PARSER DELIBERATELY DOES NOT BIND.
 *
 * The real header row carries "Min Commission Percentage", "Max Commission
 * Percentage" and "Commission Currency", per product. That is the 1%-to-4%
 * split, and it means the feed itself will tell this module, row by row, which
 * products pay us the most.
 *
 * Binding those columns is forbidden (CLAUDE.md section 1 and the hard "do not"
 * list). It is not a slippery-slope worry, it is one `.filter()` away: a parser
 * that knows the commission on each row is a parser that can drop the 1% rows,
 * and dropping them is ranking by payout performed at the row level, on a site
 * whose footer promises shoppers that commission never affects what they see.
 * Ingest all 27,052 rows, rank them exactly like every other source, earn on
 * whichever subset happens to pay.
 *
 * If a commission figure is ever genuinely needed (a finance report, say), it
 * belongs in a separate module that reads the feed for that purpose and has no
 * path into `marketplace_listings`. Do not add it here.
 *
 * Also unbound, for the ordinary reason that nothing consumes them yet:
 * Program Id, Program Names, Catalog Id, Catalog Name, Language Locale, Last
 * Updated, Bullets, Labels, Additional ImageUrls, Discount Percentage,
 * Promotions, Product Launch Date, Expiration Date, and the brand's ten
 * free-form Text/Numeric/Money slots.
 */
export const UNBOUND_BY_POLICY = [
  "Min Commission Percentage",
  "Max Commission Percentage",
  "Commission Currency",
] as const

/** Impact mandates these three. Without them a row cannot become a listing at all. */
const MANDATORY: (keyof typeof FIELD_ALIASES)[] = ["itemId", "name", "url"]

export class ImpactSchemaError extends Error {}

/**
 * Resolve each logical field to the actual header present in this file.
 *
 * Done ONCE against the header row rather than per row, both for speed across
 * 27k rows and so the failure is a single clear error rather than 27,052
 * silently skipped rows.
 */
export function bindColumns(headers: string[]): Record<keyof typeof FIELD_ALIASES, string | null> {
  const normalised = new Map<string, string>()
  for (const header of headers) {
    normalised.set(header.trim().toLowerCase().replace(/[\s_-]+/g, " "), header)
  }

  const bound = {} as Record<keyof typeof FIELD_ALIASES, string | null>
  for (const field of Object.keys(FIELD_ALIASES) as (keyof typeof FIELD_ALIASES)[]) {
    bound[field] = null
    for (const alias of FIELD_ALIASES[field]) {
      const hit = normalised.get(alias.trim().toLowerCase().replace(/[\s_-]+/g, " "))
      if (hit) {
        bound[field] = hit
        break
      }
    }
  }

  const missing = MANDATORY.filter((field) => bound[field] == null)
  if (missing.length > 0) {
    throw new ImpactSchemaError(
      `Anderton's Impact feed is missing ${missing.length} mandatory column(s): ${missing.join(", ")}. ` +
        `Headers actually present: ${headers.map((h) => JSON.stringify(h)).join(", ")}. ` +
        `Add the real spelling to FIELD_ALIASES in lib/ingestion/andertons-impact.ts. ` +
        `Do NOT bind by column position: Impact catalogues are brand-configured and the order is not stable.`,
    )
  }

  return bound
}

function cell(row: Record<string, string>, header: string | null): string {
  if (!header) return ""
  return (row[header] ?? "").trim()
}

/**
 * Money to integer cents.
 *
 * Strips a currency symbol and thousands separators. Rejects zero and negative
 * values rather than storing them: a 0.00 row in a retail feed means "price
 * withheld", not "free", and letting it through would put a £0 listing at the
 * top of every price-ascending search.
 */
export function toCents(raw: string): number | null {
  if (!raw) return null
  const match = raw.replace(/[,\s]/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

/** Out-of-stock spellings seen across retail feeds. Anything else counts as available. */
function isOutOfStock(raw: string): boolean {
  if (!raw) return false
  return /^(0|false|no|n|out ?of ?stock|unavailable|discontinued|sold ?out|backorder)/i.test(raw.trim())
}

export function normalizeAndertonsRow(
  record: Record<string, string>,
  columns: Record<keyof typeof FIELD_ALIASES, string | null>,
): NewMarketplaceListing | null {
  const externalId = cell(record, columns.itemId)
  const title = cell(record, columns.name)
  const url = cell(record, columns.url)
  if (!externalId || !title || !url) return null

  const priceCents =
    toCents(cell(record, columns.currentPrice)) ?? toCents(cell(record, columns.originalPrice))
  if (priceCents == null) return null

  /*
   * Which URL is which.
   *
   * When the feed carries both a tracked link and the merchant's own, use each
   * for its purpose. When it carries only one, trust it as the affiliate link
   * ONLY if it resolves to an Impact tracking host; otherwise it is the raw
   * URL and no affiliate_url is stored. Same rule as CJ and Awin: an
   * unrecognised host produces null rather than a half-built link, because
   * routing a shopper through a tracker that credits nobody is worse than a
   * clean direct link.
   */
  const merchantUrl = cell(record, columns.originalUrl)
  const urlIsTracked = isImpactTrackingUrl(url)
  const rawUrl = merchantUrl || url
  const affiliateUrl = urlIsTracked ? url : null

  const stockRaw = cell(record, columns.stock)

  return {
    source: "andertons",
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: cell(record, columns.description).slice(0, 8000) || null,
    priceCents,
    // GBP unless the feed says otherwise. Anderton's trades only in the UK, so
    // a USD default (right for the CJ retailers) would mislabel every row.
    currency: (cell(record, columns.currency) || "GBP").slice(0, 10),
    // A retailer, not a peer marketplace: an empty condition means new stock,
    // the same call gear4music-awin.ts and the CJ modules make.
    condition: cell(record, columns.condition) || "New",
    brand: cell(record, columns.manufacturer).slice(0, 100) || null,
    gtin: cell(record, columns.gtin).slice(0, 20) || null,
    epid: null,
    mpn: cell(record, columns.mpn).slice(0, 100) || null,
    locationCountry: "GB",
    locationZip: null,
    isLocalPickup: false,
    isShippable: true,
    rawUrl,
    affiliateUrl,
    primaryImageUrl: cell(record, columns.imageUrl) || null,
    listingStatus: isOutOfStock(stockRaw) ? "expired" : "active",
    listedAt: null,
    endsAt: null,
  }
}

/** Parse a whole catalogue document. Exposed separately so tests run off a fixture. */
export function parseAndertonsFeed(text: string): {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
  columns: Record<keyof typeof FIELD_ALIASES, string | null>
} {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })

  if (records.length === 0) {
    throw new ImpactSchemaError("Anderton's Impact feed parsed to zero rows. Empty or truncated file.")
  }

  const columns = bindColumns(Object.keys(records[0]))

  const rows: NewMarketplaceListing[] = []
  let skipped = 0
  for (const record of records) {
    const row = normalizeAndertonsRow(record, columns)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped, columns }
}

/* -------------------------------------------------------------------------- */
/*  FTP transport                                                             */
/* -------------------------------------------------------------------------- */

function maybeGunzip(buffer: Buffer): Buffer {
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) return gunzipSync(buffer)
  return buffer
}

/** Catalogue files, newest first, ignoring anything that is plainly not one. */
function pickCatalogueFile(names: string[]): string | null {
  const candidates = names
    .filter((name) => /\.(csv|psv|txt|tsv)(\.gz)?$/i.test(name))
    .sort()
    .reverse()
  return candidates[0] ?? null
}

export type FtpConfig = {
  host: string
  user: string
  password: string
  path: string
}

/**
 * Download the newest catalogue file from the Impact FTP drop.
 *
 * Deliberately the only part of this module that touches the network, so
 * everything above it is testable against a fixture without a server. The
 * import is dynamic because `basic-ftp` pulls in node:net and node:tls, and a
 * static import would drag those into any bundle that imports this file for
 * the parser alone.
 */
export async function fetchAndertonsCatalogue(config: FtpConfig): Promise<string> {
  const { Client } = await import("basic-ftp")
  const client = new Client(60_000)

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: true,
      // Impact's server presents a certificate that does not always match the
      // connecting hostname. The credential is still sent over TLS; this only
      // relaxes the name check, and the alternative offered by the server is
      // plaintext FTP, which would put the password on the wire in clear.
      secureOptions: { rejectUnauthorized: false },
    })

    const listing = await client.list(config.path)
    const chosen = pickCatalogueFile(listing.filter((f) => f.isFile).map((f) => f.name))
    if (!chosen) {
      throw new Error(
        `No catalogue file in ${config.path}. Saw: ${listing.map((f) => f.name).join(", ") || "(empty directory)"}`,
      )
    }

    const chunks: Buffer[] = []
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    })

    await client.downloadTo(sink, `${config.path.replace(/\/+$/, "")}/${chosen}`)
    return maybeGunzip(Buffer.concat(chunks)).toString("utf-8")
  } finally {
    client.close()
  }
}

/* -------------------------------------------------------------------------- */
/*  Job                                                                       */
/* -------------------------------------------------------------------------- */

export type AndertonsIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
  /** Rows the feed contained in total, so a caller can size the next slice. */
  totalRows?: number
  /** Where this slice started. */
  offset?: number
  /** How many rows this call actually wrote. */
  wrote?: number
  /** False when there is more catalogue left to fetch. */
  done?: boolean
}

function emptyStats(): UpsertStats {
  return { seen: 0, inserted: 0, updated: 0, skipped: 0, priceChanges: 0, touchedGearIds: [] }
}

/**
 * How much of the catalogue to take in one call.
 *
 * WHY THIS EXISTS. 27,052 rows is a lot of upserting, and a Vercel function
 * stops at 300 seconds whether or not it has finished. All-or-nothing meant
 * either the whole catalogue landed or the attempt taught us nothing, which is
 * a bad trade when the alternative is this cheap.
 *
 * Chunking works here for one specific reason: the upsert is idempotent and
 * keyed on (source, external_id), so the same rows can be written twice with
 * no effect and a run can be resumed by asking for a later slice. The feed is
 * a full snapshot rather than a delta, so slice N always means the same rows.
 *
 * The cost is re-downloading the file per chunk, which is real and worth it:
 * bandwidth is free and a half-written catalogue is not.
 */
export type IngestWindow = {
  /** Row index to start at, after parsing. */
  offset?: number
  /** How many rows to write. Omit for all of them. */
  limit?: number
}

/**
 * Which rows this call writes, and whether anything is left.
 *
 * Pulled out as a pure function so the windowing is testable without a
 * database or an FTP server. `done` is what decides whether the run may expire
 * missing rows, so getting it wrong retires a live catalogue.
 */
export function sliceRows<T>(rows: T[], window: IngestWindow = {}): { slice: T[]; offset: number; done: boolean } {
  const offset = Math.max(0, window.offset ?? 0)
  const limit = window.limit && window.limit > 0 ? window.limit : rows.length
  const slice = rows.slice(offset, offset + limit)
  return { slice, offset, done: offset + slice.length >= rows.length }
}

/**
 * Ingest the Anderton's catalogue, or one slice of it.
 *
 * `fetchImpl` is injectable so the integration test can run the whole job
 * against a fixture without an FTP server, the same way the eBay tests drive
 * the feed parser.
 */
export async function ingestAndertonsFeed(
  fetchImpl: (config: FtpConfig) => Promise<string> = fetchAndertonsCatalogue,
  window: IngestWindow = {},
): Promise<AndertonsIngestOutcome> {
  if (!env.impact.hasAndertonsFeed) {
    const reason =
      "IMPACT_ANDERTONS_FTP_USER / IMPACT_ANDERTONS_FTP_PASSWORD are not set. Anderton's ingestion is skipped. " +
      "Credentials come from the Impact account's FTP settings; the catalogue is a per-advertiser directory on products.impact.com."
    console.warn(`[andertons] ${reason}`)
    return { status: "skipped", reason, stats: emptyStats(), resolved: 0 }
  }

  const run = await startRun("andertons", "andertons-catalogue")

  try {
    const text = await fetchImpl({
      host: env.impact.andertonsFtpHost,
      user: env.impact.andertonsFtpUser,
      password: env.impact.andertonsFtpPassword,
      path: env.impact.andertonsFtpPath,
    })

    const { rows, seen, skipped, columns } = parseAndertonsFeed(text)

    const { slice, offset, done } = sliceRows(rows, window)

    const stats = await upsertListings(slice)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    // Expiring only makes sense once the whole snapshot has been written.
    // Doing it after a partial slice would retire every row the feed still
    // lists but this chunk had not reached yet.
    if (done) await expirePastEndDate("andertons")

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      bytesDownloaded: Buffer.byteLength(text),
      // Recording the resolved column names makes a later schema change
      // visible in the run history rather than only in a failure.
      detail: { resolved, priceChanges: stats.priceChanges, columns, offset, wrote: slice.length, done },
    })

    return { status: "ok", stats, resolved, totalRows: rows.length, offset, wrote: slice.length, done }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[andertons] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: emptyStats(), resolved: 0, error: message }
  }
}
