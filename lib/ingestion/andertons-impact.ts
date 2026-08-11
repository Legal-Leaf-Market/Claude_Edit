import { gunzipSync } from "node:zlib"
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
 * 1. IT ARRIVES BY SFTP, NOT HTTPS. Awin, CJ and LinkConnector all publish an
 *    authenticated feed URL. Impact drops catalogues on a file server
 *    (products.impact.com, one directory per advertiser) and the publisher
 *    pulls them.
 *
 *    SFTP rather than FTP, which was measured rather than read off the docs.
 *    Impact's documentation says "FTP" throughout and this module was written
 *    against basic-ftp on that basis; probing the host found port 21 denying
 *    FEAT before any credential and refusing AUTH TLS with a 431, port 990 not
 *    listening at all, and port 22 answering SSH-2.0-APACHE-SSHD-2.14.0. See
 *    fetchAndertonsCatalogue below, and lib/ingestion/ftp-probe.ts for the
 *    probe that settled it without sending a password anywhere.
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

  description: ["Description", "description", "Long Description", "LongDescription", "Short Description", "ShortDescription"],
  currentPrice: ["Current Price", "CurrentPrice", "current_price", "Price", "price", "Sale Price", "SalePrice", "sale_price"],
  originalPrice: ["Original Price", "OriginalPrice", "original_price", "Retail Price", "RetailPrice", "List Price", "ListPrice", "Was Price"],
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
  category: ["Category Path", "CategoryPath", "Category", "category", "Category Name", "CategoryName", "Product Category", "ProductCategory", "Google Category"],
  gtin: ["Gtin", "GTIN", "gtin", "Ean", "EAN", "Upc", "UPC", "Barcode"],
  /**
   * NOT PRESENT in Anderton's catalogue, and that is a fact about the feed
   * rather than a gap in this table. It resolves to null, tier 1c (brand + MPN)
   * simply never fires for these rows, and Gtin carries the hard identity
   * instead. Do not "fix" this by pointing it at Sku: a retailer's own stock
   * number is not a manufacturer part number, and feeding one into a key that
   * claims to name a product across merchants would merge unrelated gear.
   */
  mpn: ["Mpn", "MPN", "mpn", "Manufacturer Part Number", "ManufacturerPartNumber", "Part Number", "PartNumber"],
  stock: ["Stock Availability", "StockAvailability", "stock_availability", "Availability", "In Stock", "InStock", "Stock", "Stock Status", "StockStatus"],
  /**
   * CONFIRMED PRESENT as "Original Url". This is the good case: the feed
   * carries Anderton's own untracked product page beside Impact's tracked
   * link, so rawUrl is the real page and affiliateUrl is the tracked one.
   * Better than the CJ situation, where only a pre-built BUY_URL exists.
   *
   * THE CAMELCASE SPELLINGS ARE NOT DECORATION. Header matching collapses
   * spaces and underscores but cannot split "OriginalUrl" into two words, so
   * "Original Url" and "OriginalUrl" are genuinely different keys to the
   * binder. The FTP feed uses the spaced form and Impact's API uses CamelCase
   * throughout ("CatalogItemId", "CurrentPrice", "StockAvailability"), and
   * this field having only the spaced spelling was a real bug caught by the
   * API tests: it binds to nothing, `rawUrl` silently falls back to the
   * TRACKED url, and every listing on the site then points a shopper at an
   * affiliate link where the untracked page belongs. Nothing throws, no row is
   * skipped, and the only symptom is /go handing out links it should have
   * built itself.
   */
  originalUrl: [
    "Original Url",
    "OriginalUrl",
    "Original URL",
    "original_url",
    "Merchant Url",
    "MerchantUrl",
    "Landing Page",
    "LandingPage",
    "Product Page",
    "ProductPage",
  ],
  condition: ["Condition", "condition", "Item Condition", "ItemCondition"],
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

export type ParsedCatalogue = {
  rows: NewMarketplaceListing[]
  seen: number
  skipped: number
  columns: Record<keyof typeof FIELD_ALIASES, string | null>
}

/**
 * Bind and normalise a set of already-parsed records.
 *
 * Shared by both transports on purpose. The FTP drop arrives as delimited text
 * and the REST API arrives as JSON objects, but from here down they are the
 * same thing: a list of string-keyed records whose field names are the brand's
 * choice rather than the network's. Binding by name through one alias table
 * means the two paths cannot drift into disagreeing about what a row means,
 * which is section 7's "never fork the logic" applied to transports rather
 * than to triggers.
 */
export function normalizeRecords(records: Record<string, string>[]): ParsedCatalogue {
  if (records.length === 0) {
    throw new ImpactSchemaError("Anderton's Impact catalogue parsed to zero rows. Empty or truncated.")
  }

  /*
   * Bind against the union of keys across a sample rather than the first
   * record alone. JSON differs from CSV here in a way that matters: a CSV
   * header row names every column whether or not a given row fills it, while a
   * JSON API commonly omits null fields per item. Taking the first item's keys
   * would then miss a field simply because item one happened not to have it.
   */
  const keys = new Set<string>()
  for (const record of records.slice(0, 50)) {
    for (const key of Object.keys(record)) keys.add(key)
  }

  const columns = bindColumns([...keys])

  const rows: NewMarketplaceListing[] = []
  let skipped = 0
  for (const record of records) {
    const row = normalizeAndertonsRow(record, columns)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped, columns }
}

/** Parse a whole catalogue document. Exposed separately so tests run off a fixture. */
export function parseAndertonsFeed(text: string): ParsedCatalogue {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })

  if (records.length === 0) {
    throw new ImpactSchemaError("Anderton's Impact feed parsed to zero rows. Empty or truncated file.")
  }

  return normalizeRecords(records)
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

export type SftpConfig = {
  host: string
  port: number
  user: string
  password: string
  path: string
}

/**
 * Download the newest catalogue file from the Impact drop, over SFTP.
 *
 * IT IS SFTP, NOT FTPS, AND THAT WAS MEASURED RATHER THAN ASSUMED. Everything
 * here was originally written against `basic-ftp` on the reasonable reading of
 * Impact's own docs, which say "FTP" throughout. Probing the host settled it:
 *
 *   port 21   220 banner, then 530 Access denied to FEAT before any
 *             credential, then 431 to AUTH TLS. 431 is RFC 2228's security
 *             range, so TLS is refused outright rather than being unavailable
 *             temporarily. That port is a dead end, and the only thing it
 *             offers instead is plaintext FTP, which would put the password on
 *             the wire in clear.
 *   port 990  connection timed out, so implicit FTPS is not listening.
 *   port 22   SSH-2.0-APACHE-SSHD-2.14.0.
 *
 * An SSH banner means the drop speaks SSH, and `basic-ftp` cannot speak SSH at
 * all. This was never a wrong option on the right library; it was the wrong
 * library, which is exactly the distinction the probe exists to draw and the
 * reason it sends no credential while drawing it.
 *
 * The credential pair Impact mails out is therefore an SSH login. Same pair,
 * different protocol.
 *
 * Deliberately the only part of this module that touches a file server, so
 * everything above it stays testable against a fixture. The import is dynamic
 * because ssh2 pulls in native crypto bindings, and a static import would drag
 * them into any bundle that wants this file for the parser alone.
 */
export type DropListing = {
  connected: boolean
  /** The directory these entries actually came from. */
  path: string
  /** What was configured, when that turned out not to exist. */
  configuredPath?: string
  /** True when the configured path was missing and this is a fallback. */
  configuredPathMissing?: boolean
  files: { name: string; sizeBytes: number; modified: string | null }[]
  /** The file a pull would actually take, by the same rule the pull uses. */
  chosen: string | null
}

/**
 * Where to look when the configured directory is not there.
 *
 * The home directory first, because an SFTP account serving one publisher is
 * usually chrooted or dropped straight into its own directory, and "." is
 * whatever the server considers that. Root second, for the case where it is
 * not.
 */
const FALLBACK_PATHS = [".", "/"]

function isMissingDirectory(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /No such file|ENOENT/i.test(message)
}

/**
 * Open the drop, list it, and close. No download.
 *
 * THE CHEAP STEP BEFORE THE EXPENSIVE ONE. A pull of this catalogue is 27,052
 * rows against a 300 second ceiling, so an attempt that fails on the login or
 * on the directory path costs several minutes and reports a timeout, which
 * looks exactly like the size problem it is not. Listing costs a second and
 * separates them outright: it either authenticates or it does not, and the
 * directory either holds a catalogue or names what it holds instead.
 *
 * Same shape of reasoning as the peek on the API side and the port probe
 * before that. The pattern is worth stating plainly, because this source has
 * now cost four round trips of guessing: when a step is slow, expensive or
 * hard to interpret, put a fast and unambiguous one in front of it.
 *
 * `chosen` runs the real selection rule, so the answer to "which file would a
 * pull take" comes from the code that would take it rather than from reading
 * the list and assuming.
 */
export async function listAndertonsDrop(config: SftpConfig): Promise<DropListing> {
  const { default: SftpClient } = await import("ssh2-sftp-client")
  const client = new SftpClient()

  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: 30_000,
    })

    /*
     * WHEN THE CONFIGURED PATH IS NOT THERE, SHOW WHAT IS.
     *
     * IMPACT_ANDERTONS_FTP_PATH defaults to a guessed directory name, and a
     * guess that is wrong throws ENOENT after a SUCCESSFUL login. Reporting
     * only "no such directory" would leave the next step as another guess and
     * another deploy, which is how this source has already burned several
     * round trips. Listing the home directory instead turns the failure into
     * the answer: the real path is almost always one of the names in it.
     *
     * Only a missing directory falls back. A permission error is a different
     * problem with a different fix and must not be papered over by quietly
     * listing somewhere else.
     */
    let listing: Awaited<ReturnType<typeof client.list>> | null = null
    let listedPath = config.path
    let missing = false

    try {
      listing = await client.list(config.path)
    } catch (error) {
      if (!isMissingDirectory(error)) throw error
      missing = true

      for (const candidate of FALLBACK_PATHS) {
        try {
          listing = await client.list(candidate)
          listedPath = candidate
          break
        } catch (fallbackError) {
          if (!isMissingDirectory(fallbackError)) throw fallbackError
        }
      }

      if (!listing) throw error
    }

    const files = listing
      .filter((f) => f.type === "-")
      .map((f) => ({
        name: f.name,
        sizeBytes: f.size,
        modified: f.modifyTime ? new Date(f.modifyTime).toISOString() : null,
      }))

    return {
      connected: true,
      path: listedPath,
      ...(missing ? { configuredPath: config.path, configuredPathMissing: true } : {}),
      // Directories included by name only, since a drop that turns out to be
      // one directory per date is a path problem rather than an empty one.
      files: [...files, ...listing.filter((f) => f.type === "d").map((f) => ({ name: `${f.name}/`, sizeBytes: 0, modified: null }))],
      // Never claim a pull target from a fallback directory: the file a pull
      // would take is the one under the CONFIGURED path, and that path does
      // not exist yet.
      chosen: missing ? null : pickCatalogueFile(files.map((f) => f.name)),
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchAndertonsCatalogue(config: SftpConfig): Promise<string> {
  const { default: SftpClient } = await import("ssh2-sftp-client")
  const client = new SftpClient()

  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: 60_000,
    })

    const listing = await client.list(config.path)
    // ssh2-sftp-client marks a plain file with "-", the same convention as ls.
    const chosen = pickCatalogueFile(listing.filter((f) => f.type === "-").map((f) => f.name))
    if (!chosen) {
      throw new Error(
        `No catalogue file in ${config.path}. Saw: ${listing.map((f) => f.name).join(", ") || "(empty directory)"}`,
      )
    }

    const downloaded = await client.get(`${config.path.replace(/\/+$/, "")}/${chosen}`)
    /*
     * `get` hands back a Buffer when no destination is given, but its type
     * admits a string and a stream too. Normalising here keeps the gzip sniff
     * below working on bytes rather than on a string that has already been
     * decoded, which would corrupt a compressed file beyond recovery.
     */
    const buffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(String(downloaded), "binary")
    return maybeGunzip(buffer).toString("utf-8")
  } finally {
    await client.end().catch(() => {})
  }
}

/* -------------------------------------------------------------------------- */
/*  HTTPS transport: Impact's partner catalogue API                           */
/* -------------------------------------------------------------------------- */

/**
 * Impact's REST API is a legitimate partner channel, not a workaround.
 *
 * Worth saying explicitly given section 2 and the hard "do not" list. This is
 * not a frontend endpoint or an undocumented index of the kind rejected for
 * Guitar Center and Sweetwater: it is Impact's own published Mediapartners API,
 * authenticated with our account credentials, serving the catalogue Anderton's
 * publishes to partners for exactly this purpose. It is the same relationship
 * as the FTP drop with a different transport.
 *
 * Reference: GET /Mediapartners/{AccountSid}/Catalogs/{CatalogId}/Items,
 * HTTP Basic (SID as username, token as password), Accept: application/json.
 */
const IMPACT_API_BASE = "https://api.impact.com"

/**
 * The API version, sent explicitly on every request.
 *
 * Impact deprecated v11 and older in March 2022 and requires a version to be
 * named, either per request or as an account-level default. Relying on the
 * account default is the trap: it is set in a UI nobody here can see, so the
 * same code answers differently for two accounts and the difference is
 * invisible from the logs. `IrVersion` as a query parameter and `IR-Version`
 * as a header are the two documented ways to say it; we send the parameter.
 *
 * Overridable because Impact retires versions on a schedule, the same reason
 * GROQ_MODEL is overridable rather than compiled in.
 */
const IMPACT_API_VERSION = env.impact.apiVersion

/**
 * Impact's own default page size, used as ours.
 *
 * This module previously asked for 1000 on the strength of nothing, which is
 * exactly the kind of guess CLAUDE.md forbids when binding columns and which
 * is no more defensible here. 100 is the documented default, so it is the one
 * size the endpoint is certain to accept.
 */
const IMPACT_DEFAULT_PAGE_SIZE = 100

/**
 * THE CEILING, and why it is a fact about the product rather than a tunable.
 *
 * Impact's catalogue Items endpoint cannot page beyond 20,000 records: a
 * request for anything past it answers 400, not an empty page. Anderton's
 * catalogue is 27,052 products, so PLAIN PAGING CANNOT REACH ALL OF IT. That
 * is not a bug to route around, it is the documented reason the FTP drop
 * exists for large catalogues, and it is why this module keeps both transports
 * rather than replacing one with the other.
 *
 * The honest behaviour at the boundary is to stop and say so. Walking into it
 * would turn a known limit into an opaque 400 three hundred pages deep, which
 * is the same failure mode as a silently null column: nothing throws where the
 * mistake was made.
 */
export const IMPACT_PAGING_CEILING = 20_000

function impactAuthHeader(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`
}

/**
 * Strip markup and clip, so an error body can be shown without burying it.
 *
 * Impact answers some failures with an HTML page and some with JSON. The
 * original code refused to show the body at all for that reason, which is
 * backwards: for a 400 the body is the ONLY thing that says which parameter
 * was wrong. Status alone is what left a live 400 undiagnosable.
 */
function readableBody(text: string, limit = 500): string {
  const flattened = text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return flattened.length > limit ? `${flattened.slice(0, limit)}...` : flattened
}

export type ImpactResponse = {
  ok: boolean
  status: number
  statusText: string
  /** Parsed when the body was JSON, null otherwise. */
  json: Record<string, unknown> | null
  /** Always present, flattened and clipped, so a failure can be shown as-is. */
  body: string
  /** The URL actually requested, credentials never being in it. */
  url: string
}

/**
 * One request to Impact, with the response body kept whether or not it failed.
 *
 * Credentials travel in the Authorization header and never in the URL, so the
 * echoed `url` is safe to put in an admin panel or a log line.
 */
async function impactApiGet(
  config: ImpactApiConfig,
  path: string,
  params: Record<string, string> = {},
  options: { omitVersion?: boolean } = {},
): Promise<ImpactResponse> {
  const url = new URL(path.startsWith("http") ? path : `${IMPACT_API_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  // A URL carried over from @nextpageuri may already name a version; setting
  // it unconditionally would silently upgrade a cursor mid-walk.
  if (!options.omitVersion && !url.searchParams.has("IrVersion")) {
    url.searchParams.set("IrVersion", IMPACT_API_VERSION)
  }

  const response = await fetch(url, {
    headers: {
      authorization: impactAuthHeader(config.accountSid, config.authToken),
      accept: "application/json",
    },
  })

  const text = await response.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    json = null
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json,
    body: readableBody(text),
    url: url.toString(),
  }
}

/**
 * Turn a status into the setting worth changing, the way explainFtpFailure does.
 *
 * The 400 is the one that needed this most. It is the status Impact returns
 * for a bad parameter AND for paging past the 20,000 ceiling, so naming both
 * candidates beside the server's own words is what makes it actionable.
 */
export function explainImpactStatus(status: number, catalogId: string, body = ""): string {
  /*
   * THE CAUSE THAT IS NOT OURS, checked before any of the parameter guesses.
   *
   * Impact returns 400 with this message when the BRAND has not ticked "make
   * this catalogue available via API", which is a switch in the advertiser's
   * own Impact account and not a request we can reshape. Anderton's answered
   * exactly this on 11 Aug 2026 with valid credentials and the right catalogue
   * id, and the first version of this function sent the reader down a list of
   * parameter causes that could never have been the answer.
   *
   * Reading the body rather than only the status is the whole reason the body
   * is captured. A status of 400 is shared by every one of these; the sentence
   * underneath is what separates "we asked wrongly" from "you are not allowed
   * to ask at all".
   */
  if (/not been made available via api/i.test(body)) {
    return (
      "This is not a problem with the request, the credentials or the catalogue id: all three are fine, " +
      "and the credentials clearly work because Impact got far enough to refuse on policy rather than on auth. " +
      "The ADVERTISER has not enabled API access for this catalogue in their own Impact account. " +
      "Nothing here can change that; it needs the brand or the Impact account manager to switch it on. " +
      "Until they do, the SFTP drop is the only channel for this catalogue."
    )
  }

  switch (status) {
    case 400:
      return (
        "Impact rejected the request itself rather than the credentials. The usual causes, in order: " +
        "the advertiser not having enabled API access for the catalogue (the body says so in as many words), " +
        `a PageSize the endpoint will not accept (its documented default is ${IMPACT_DEFAULT_PAGE_SIZE}), ` +
        `paging past the ${IMPACT_PAGING_CEILING.toLocaleString()}-record ceiling on catalogue items, ` +
        "or an API version this account cannot serve. The server's own words are below."
      )
    case 401:
      return "The AccountSid or AuthToken was rejected. Both come from the Impact platform's API settings, and they are not the FTP pair."
    case 403:
      return "Authenticated, but this account may not read that catalogue. Check the catalogue belongs to a programme this partner account has joined."
    case 404:
      return `No catalogue ${catalogId} for this account. List the catalogues to see which ids this account can actually read.`
    case 429:
      return "Rate limited. Impact throttles per account, so a second pull running elsewhere will do this."
    default:
      return ""
  }
}

export type ImpactApiConfig = {
  accountSid: string
  authToken: string
  catalogId: string
}

/**
 * One page of catalogue items, plus whatever the envelope said about paging.
 *
 * `raw` carries the envelope's own non-array keys so a caller can show them.
 * That is what makes the peek route useful: Impact's paging attributes are
 * documented inconsistently across their API versions, and reading them off a
 * real response beats picking one and hoping.
 */
export type ImpactPage = {
  records: Record<string, string>[]
  page: number
  totalPages: number | null
  total: number | null
  nextPageUri: string | null
  envelopeKeys: string[]
  itemsKey: string | null
}

/**
 * Find the item array in the envelope without hard-coding its name.
 *
 * Impact wraps collections in a key named after the resource, and the exact
 * spelling ("Items", "Catalogs", "CatalogItems") varies by endpoint and API
 * version. Rather than guess one and fail opaquely when it is another, take
 * the first array-of-objects property. If the envelope ever carries two, the
 * peek route shows every key so the ambiguity is visible rather than silently
 * resolved.
 *
 * This is deliberately NOT the same latitude the column binder gets. Field
 * names decide what a price MEANS and so are bound explicitly through an alias
 * table; the collection key only decides where the list lives, and getting it
 * wrong yields no rows rather than wrong rows.
 */
function findItemsArray(envelope: Record<string, unknown>): { key: string; items: unknown[] } | null {
  for (const [key, value] of Object.entries(envelope)) {
    if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
      return { key, items: value }
    }
  }
  return null
}

/** Impact returns every scalar as a string already; this only flattens shape. */
function stringifyValues(item: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(item)) {
    if (value == null) continue
    if (typeof value === "object") continue
    out[key] = String(value)
  }
  return out
}

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Fetch one page of the catalogue.
 *
 * `pathOrPage` takes either a page number or the `@nextpageuri` from a previous
 * response, because following the server's own cursor is more reliable than
 * reconstructing it, and Impact returns one when it has one.
 */
export function itemsPath(config: ImpactApiConfig): string {
  return `/Mediapartners/${encodeURIComponent(config.accountSid)}/Catalogs/${encodeURIComponent(config.catalogId)}/Items`
}

export async function fetchAndertonsApiPage(
  config: ImpactApiConfig,
  pathOrPage: number | string = 1,
  pageSize = IMPACT_DEFAULT_PAGE_SIZE,
): Promise<ImpactPage> {
  /*
   * Refuse to ask for a page that cannot exist, rather than letting Impact
   * answer 400 for it. The caller gets the limit named, which is the whole
   * difference between "this catalogue is bigger than this transport" and an
   * unexplained failure partway through a walk.
   */
  if (typeof pathOrPage === "number" && (pathOrPage - 1) * pageSize >= IMPACT_PAGING_CEILING) {
    throw new Error(
      `Page ${pathOrPage} at ${pageSize} per page starts past Impact's ${IMPACT_PAGING_CEILING.toLocaleString()}-record ` +
        "ceiling on catalogue items, which the API answers with a 400. The catalogue beyond that point is reachable " +
        "over the FTP drop, which is what that transport is for.",
    )
  }

  const response =
    typeof pathOrPage === "string"
      ? await impactApiGet(config, pathOrPage)
      : await impactApiGet(config, itemsPath(config), {
          Page: String(pathOrPage),
          PageSize: String(pageSize),
        })

  if (!response.ok) {
    const detail = explainImpactStatus(response.status, config.catalogId, response.body)
    throw new Error(
      `Impact API returned ${response.status} ${response.statusText}. ${detail}`.trim() +
        (response.body ? `\n\nImpact said: ${response.body}` : "") +
        `\n\nRequested: ${response.url}`,
    )
  }

  const body = response.json ?? {}
  const found = findItemsArray(body)

  const envelopeKeys = Object.keys(body).filter((k) => !Array.isArray(body[k]))

  return {
    records: (found?.items ?? []).map((item) => stringifyValues(item as Record<string, unknown>)),
    page: toInt(body["@page"] ?? body.Page) ?? (typeof pathOrPage === "number" ? pathOrPage : 1),
    totalPages: toInt(body["@numpages"] ?? body.NumPages),
    total: toInt(body["@total"] ?? body.Total),
    nextPageUri: (body["@nextpageuri"] as string) || (body.NextPageUri as string) || null,
    envelopeKeys,
    itemsKey: found?.key ?? null,
  }
}

/**
 * Every catalogue this account can actually read.
 *
 * The single most useful call when something is wrong, because it separates
 * three failures a 400 or a 404 cannot: whether the credentials work at all,
 * whether this partner account has joined the programme, and whether the
 * catalogue id we hold is one of the ids it is allowed to name. A default of
 * 30480 is a guess written down, and this is how it stops being a guess.
 */
export async function listImpactCatalogs(
  config: ImpactApiConfig,
): Promise<{ ok: boolean; status: number; catalogs: Record<string, string>[]; body: string }> {
  const response = await impactApiGet(config, `/Mediapartners/${encodeURIComponent(config.accountSid)}/Catalogs`)
  const found = response.json ? findItemsArray(response.json) : null

  return {
    ok: response.ok,
    status: response.status,
    catalogs: (found?.items ?? []).map((c) => stringifyValues(c as Record<string, unknown>)),
    body: response.ok ? "" : response.body,
  }
}

export type ImpactProbe = {
  label: string
  /** What this probe varies, so a reader can tell why it is in the list. */
  varies: string
  status: number
  ok: boolean
  records: number | null
  note: string
}

/**
 * Press once, learn which of the candidate causes is the real one.
 *
 * The FTP side already earned this pattern: probe-ftp opens the ports and
 * reports what the server says rather than leaving somebody to guess between
 * a wrong host, a wrong port and a wrong library. A 400 from this endpoint has
 * the same problem, several plausible causes and no way to tell them apart
 * from the status alone, so it gets the same treatment.
 *
 * Each probe changes exactly ONE thing against the call this module makes, so
 * a green row is a direct answer rather than a hint. They run in sequence
 * rather than at once because Impact rate limits per account, and a 429
 * storming in halfway through would answer a question nobody asked.
 *
 * It writes nothing, and credentials stay in the Authorization header.
 */
export async function diagnoseAndertonsApi(config: ImpactApiConfig): Promise<{
  probes: ImpactProbe[]
  catalogs: Record<string, string>[]
  verdict: string
}> {
  const probes: ImpactProbe[] = []

  const run = async (
    label: string,
    varies: string,
    params: Record<string, string>,
    options: { omitVersion?: boolean } = {},
  ) => {
    try {
      const response = await impactApiGet(config, itemsPath(config), params, options)
      const found = response.json ? findItemsArray(response.json) : null
      probes.push({
        label,
        varies,
        status: response.status,
        ok: response.ok,
        records: found ? found.items.length : null,
        note: response.ok ? "" : response.body,
      })
    } catch (error) {
      probes.push({
        label,
        varies,
        status: 0,
        ok: false,
        records: null,
        note: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const catalogList = await listImpactCatalogs(config)
  probes.push({
    label: "List this account's catalogues",
    varies: "no catalogue id at all, so it tests the credentials alone",
    status: catalogList.status,
    ok: catalogList.ok,
    records: catalogList.ok ? catalogList.catalogs.length : null,
    note: catalogList.body,
  })

  await run("Items, documented defaults", `Page=1, PageSize=${IMPACT_DEFAULT_PAGE_SIZE}`, {
    Page: "1",
    PageSize: String(IMPACT_DEFAULT_PAGE_SIZE),
  })
  await run("Items, no paging parameters", "neither Page nor PageSize, so Impact picks", {})
  await run("Items, the old PageSize", "PageSize=1000, the value that was failing", { Page: "1", PageSize: "1000" })
  await run("Items, no API version", `IrVersion omitted rather than ${IMPACT_API_VERSION}`, {
    Page: "1",
    PageSize: String(IMPACT_DEFAULT_PAGE_SIZE),
  }, { omitVersion: true })

  return { probes, catalogs: catalogList.catalogs, verdict: verdictFor(probes, catalogList, config) }
}

/**
 * Say what the probes mean in one sentence, ordered by what to fix first.
 *
 * Deliberately conservative: it reports what the rows actually show and says
 * so when they disagree, rather than picking a story. A confident wrong
 * diagnosis costs more than no diagnosis, which is the same reason the deal
 * engine publishes no market price below MIN_SAMPLE_SIZE.
 */
function verdictFor(
  probes: ImpactProbe[],
  catalogList: { ok: boolean; status: number; catalogs: Record<string, string>[] },
  config: ImpactApiConfig,
): string {
  const items = probes.filter((p) => p.label.startsWith("Items"))
  const working = items.filter((p) => p.ok)

  if (!catalogList.ok && catalogList.status === 401) {
    return "The credentials themselves are being rejected, so nothing else in this list matters yet. IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN come from Impact's API settings page and are NOT the FTP pair."
  }

  /*
   * THE CONCLUSIVE CASE, and the one this whole matrix was built to reach.
   *
   * When every variation fails with the same advertiser-policy message, the
   * matrix has done its job: it has ruled out PageSize, paging parameters and
   * the API version by varying each one and getting the identical refusal. At
   * that point telling the reader to go and read the rows is a worse answer
   * than the rows themselves, so say it outright.
   */
  const blocked = items.filter((p) => /not been made available via api/i.test(p.note))
  if (items.length > 0 && blocked.length === items.length) {
    return (
      "Conclusive: the ADVERTISER has not enabled API access for this catalogue. Every variation above was refused " +
      "identically, which rules out PageSize, the paging parameters and the API version, and the catalogue listing " +
      `${catalogList.ok ? "succeeded, so the credentials are fine" : "is the one to read next"}. ` +
      "This is a switch in the brand's own Impact account and nothing here can change it. The SFTP drop is the " +
      "channel for this catalogue until they turn it on."
    )
  }

  /*
   * A 200 with nothing in it. Not the same as a wrong catalogue id: the
   * account authenticates and is simply entitled to read no catalogue at all
   * over the API, which is what a publisher sees when no advertiser they work
   * with has enabled the channel.
   */
  if (catalogList.ok && catalogList.catalogs.length === 0) {
    return (
      "The credentials work: listing catalogues answered 200. It returned NO catalogues at all, which means this " +
      "account is not entitled to read any catalogue over the API rather than that the id is wrong. That is set by " +
      "each advertiser, so it is a question for the brand or the Impact account manager, not a setting here."
    )
  }

  if (catalogList.ok) {
    const ids = catalogList.catalogs
      .map((c) => c.Id ?? c.CatalogId ?? c.id)
      .filter(Boolean)
      .map(String)
    if (ids.length > 0 && !ids.includes(String(config.catalogId))) {
      return `The credentials work, but catalogue ${config.catalogId} is not one this account can read. It can read: ${ids.join(", ")}. Set IMPACT_ANDERTONS_CATALOG_ID to the right one.`
    }
  }

  if (working.length === items.length && items.length > 0) {
    return "Every variation succeeded, so whatever produced the 400 is not in this list. The likeliest remaining cause is paging past the 20,000-record ceiling on a later page rather than anything about page one."
  }

  if (working.length === 0) {
    return "No variation of the items call succeeded. Read the note on each row: Impact's own words are the fastest route from here, and the catalogue listing above says whether the credentials are the problem."
  }

  return `${working.length} of ${items.length} variations worked: ${working.map((p) => p.varies).join("; ")}. The failing rows name what they changed, so the difference between them is the cause.`
}

/**
 * Read ONE page and report what came back, writing nothing.
 *
 * This is the header row discipline made self-service. CLAUDE.md's rule is not
 * to write a normaliser against a guessed schema, and the FTP feed satisfied
 * it by someone pasting the real header row into the conversation. The API
 * deserves the same treatment, and can do it itself: peek shows the envelope's
 * paging keys, the collection key, and every field name on a real item,
 * alongside which of them this module's alias table actually bound.
 *
 * An unbound-but-present field name is the interesting output. It is exactly
 * what would otherwise become a silently null column across 27,052 rows, the
 * way "Manufacturer Name" nearly did.
 */
export async function peekAndertonsApi(config: ImpactApiConfig): Promise<{
  reached: boolean
  itemsKey: string | null
  envelopeKeys: string[]
  total: number | null
  totalPages: number | null
  sampleSize: number
  fieldNames: string[]
  bound: Record<string, string | null>
  unboundFields: string[]
  sample: Record<string, string> | null
}> {
  const page = await fetchAndertonsApiPage(config, 1, 25)

  const fieldNames = [...new Set(page.records.flatMap((r) => Object.keys(r)))].sort()
  const bound = page.records.length > 0 ? bindColumns(fieldNames) : ({} as Record<string, string | null>)
  const claimed = new Set(Object.values(bound).filter(Boolean) as string[])

  return {
    reached: true,
    itemsKey: page.itemsKey,
    envelopeKeys: page.envelopeKeys,
    total: page.total,
    totalPages: page.totalPages,
    sampleSize: page.records.length,
    fieldNames,
    bound,
    unboundFields: fieldNames.filter((f) => !claimed.has(f)),
    sample: page.records[0] ?? null,
  }
}

/**
 * Walk the catalogue, a page at a time, up to a cap.
 *
 * The cap is not paranoia about Impact: it is the same 300 second function
 * ceiling the FTP path slices around. `pages` is how many to take in one call
 * and `startPage` is where to resume, so the browser loop that already drives
 * the FTP pull drives this one unchanged.
 *
 * Paging is strictly better than the FTP chunking it replaces. That path
 * re-downloads the entire file per chunk because a slice is an offset into an
 * already-parsed document; here a slice is genuinely just the pages it asks
 * for.
 */
export async function fetchAndertonsApiRange(
  config: ImpactApiConfig,
  startPage = 1,
  pages = 5,
  pageSize = IMPACT_DEFAULT_PAGE_SIZE,
): Promise<{
  records: Record<string, string>[]
  nextPage: number | null
  total: number | null
  totalPages: number | null
  /** Set when the walk stopped at Impact's ceiling rather than at the end. */
  ceilingReached?: boolean
}> {
  const records: Record<string, string>[] = []
  let cursor: number | string = startPage
  let pageNumber = startPage
  let total: number | null = null
  let totalPages: number | null = null

  for (let i = 0; i < pages; i++) {
    /*
     * Stop AT the ceiling rather than one page past it. Impact answers a
     * request beyond 20,000 records with a 400, so walking into it would turn
     * a known limit into a failed run that had already written most of a
     * catalogue, and the status would say nothing about why.
     */
    if ((pageNumber - 1) * pageSize >= IMPACT_PAGING_CEILING) {
      return { records, nextPage: null, total, totalPages, ceilingReached: true }
    }

    const page = await fetchAndertonsApiPage(config, cursor, pageSize)
    records.push(...page.records)
    total = page.total ?? total
    totalPages = page.totalPages ?? totalPages
    pageNumber = page.page

    const noMore =
      page.records.length === 0 || (totalPages != null && pageNumber >= totalPages) || (!page.nextPageUri && totalPages == null && page.records.length < pageSize)

    if (noMore) return { records, nextPage: null, total, totalPages }

    cursor = page.nextPageUri ?? pageNumber + 1
    pageNumber = pageNumber + 1
  }

  return { records, nextPage: pageNumber, total, totalPages }
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
  /**
   * True when the API walk stopped at Impact's 20,000-record paging ceiling
   * rather than at the end of the catalogue. Distinct from `done` because it
   * is the one ending that must NOT expire missing rows.
   */
  ceilingReached?: boolean
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
  fetchImpl: (config: SftpConfig) => Promise<string> = fetchAndertonsCatalogue,
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
      port: env.impact.andertonsFtpPort,
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

/**
 * Ingest the Anderton's catalogue over Impact's REST API instead of FTP.
 *
 * Same normaliser, same upsert, same expiry rule, different transport. The
 * only genuinely different piece is what a "slice" means: over FTP it is an
 * offset into a document that has to be re-downloaded each time, and here it
 * is a range of pages, which is both cheaper and the API's own unit of work.
 *
 * `done` still governs expiry, and it still matters for the same reason:
 * retiring rows after a partial pass would expire everything the catalogue
 * still lists but this call had not reached.
 */
export async function ingestAndertonsViaApi(
  window: { startPage?: number; pages?: number; pageSize?: number } = {},
): Promise<AndertonsIngestOutcome & { nextPage?: number | null }> {
  if (!env.impact.hasAndertonsApi) {
    const reason =
      "IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN are not set. The Anderton's API pull is skipped. " +
      "Both come from the Impact platform's API settings; the catalogue id defaults to 30480."
    console.warn(`[andertons-api] ${reason}`)
    return { status: "skipped", reason, stats: emptyStats(), resolved: 0 }
  }

  const config: ImpactApiConfig = {
    accountSid: env.impact.accountSid,
    authToken: env.impact.authToken,
    catalogId: env.impact.andertonsCatalogId,
  }

  const startPage = Math.max(1, window.startPage ?? 1)
  const run = await startRun("andertons", "andertons-catalogue-api")

  try {
    const { records, nextPage, total, totalPages, ceilingReached } = await fetchAndertonsApiRange(
      config,
      startPage,
      window.pages ?? 20,
      window.pageSize ?? IMPACT_DEFAULT_PAGE_SIZE,
    )

    /*
     * An empty first page is a real failure, not an empty catalogue. It means
     * the collection key was not found or the catalogue is not readable by
     * this account, and treating it as "nothing to do" would report success
     * while writing nothing. A later page coming back empty is just the end.
     */
    if (records.length === 0 && startPage === 1) {
      throw new ImpactSchemaError(
        "The Impact API answered but no catalogue items were found in the response. Use the schema peek to see what it actually returned.",
      )
    }

    const { rows, seen, skipped, columns } = normalizeRecords(records)
    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    const done = nextPage == null

    /*
     * NEVER EXPIRE AFTER A CEILING STOP, and this is the sharp edge of the
     * 20,000 limit rather than the limit itself.
     *
     * `done` means "the walk ended", and expiry reads it as "every row the
     * catalogue still lists has now been written". Those are the same
     * statement only when the walk ended because the catalogue ran out. When
     * it ended at Impact's ceiling they are opposite: Anderton's publishes
     * 27,052 products, so a ceiling stop has seen at most 20,000 of them and
     * expiring here would retire the ~7,000 it never got to. They are live
     * listings that would vanish from the site, and nothing would throw.
     */
    const complete = done && !ceilingReached
    if (complete) await expirePastEndDate("andertons")

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      bytesDownloaded: 0,
      detail: {
        resolved,
        priceChanges: stats.priceChanges,
        columns,
        startPage,
        nextPage,
        totalPages,
        done,
        ceilingReached: Boolean(ceilingReached),
        expired: complete,
      },
    })

    return {
      status: "ok",
      stats,
      resolved,
      totalRows: total ?? undefined,
      offset: startPage,
      wrote: rows.length,
      done,
      nextPage,
      ceilingReached: Boolean(ceilingReached),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[andertons-api] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: emptyStats(), resolved: 0, error: message }
  }
}
