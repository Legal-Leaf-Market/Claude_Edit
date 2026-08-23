import { and, desc, eq } from "drizzle-orm"
import { isImpactTrackingUrl } from "@/lib/affiliate/impact"
import { db } from "@/lib/db"
import { ingestRuns } from "@/lib/db/schema"
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
import { canPullImpactMerchant, impactSkipReason, type ImpactMerchant } from "./impact-merchants"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Impact.com product catalogues: one parser, one transport, many merchants.
 *
 * This started as Anderton's ingestion and stayed that way while Anderton's was
 * the only Impact merchant here. It is now eight, and everything except the
 * catalogue id and a handful of per-merchant defaults was identical between
 * them, so the merchant became data (lib/ingestion/impact-merchants.ts) and
 * this became the single implementation that reads it. Anderton's own module
 * still exists for its FTP transport and re-exports this one, so there remains
 * exactly one normaliser however a catalogue arrives.
 *
 * Three things make Impact different from every other network here, and all
 * three are load bearing.
 *
 * 1. THE SCHEMA IS THE BRAND'S, NOT THE NETWORK'S. Impact mandates exactly
 *    three fields (a link URL, a catalogue item id, and a name) and lets each
 *    brand name and choose the rest. Anderton's catalogue is literally called
 *    "Custom AMC Feed". CJ's column set is documented and consistent across its
 *    advertisers; Impact's is not, and eight merchants means eight chances for
 *    a brand to have spelled something its own way.
 *
 *    The response is the discipline section 3 of CLAUDE.md demands of the eBay
 *    parser: bind by HEADER NAME through an alias table, never by position, and
 *    when a mandatory column cannot be found, FAIL LOUDLY naming the headers
 *    actually present. A parser that guesses silently shifts every value in
 *    every row, which is indistinguishable from working until someone notices
 *    the prices are wrong.
 *
 * 2. THERE ARE TWO TRANSPORTS. Impact drops catalogues on an FTP server and
 *    also serves them over a paginated REST API. Both land in
 *    `normalizeRecords` below, because from binding down they are the same
 *    thing: a list of records whose field names are the brand's choice rather
 *    than the network's.
 *
 * 3. A MERCHANT'S HOME MARKET IS NOT THE NETWORK'S. Anderton's prices in GBP
 *    and ships from the UK; the US retailers price in USD. Getting that wrong
 *    does not throw, it just makes every cross-source comparison against that
 *    merchant nonsense, so it is declared per merchant and the run records
 *    whether the feed's own column was there to override it.
 */

/* -------------------------------------------------------------------------- */
/*  Column binding                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Header aliases, most specific first.
 *
 * TUNED AGAINST A REAL HEADER ROW (Anderton's, 40 columns, tab separated,
 * 11 Aug 2026). It is preserved verbatim as
 * tests/fixtures/andertons-impact-headers.tsv and the tests bind against it, so
 * a future feed change that drops or renames a column fails in CI rather than
 * in production.
 *
 * That row confirmed the design and caught exactly one miss: the brand column
 * is "Manufacturer Name", not "Manufacturer", so every one of the 27,052 rows
 * would have come through with a null brand. That is not cosmetic. Brand is
 * what scopes MPN matching and fuzzy matching in the resolver (CLAUDE.md
 * section 4), and an unscoped fallback to parsing the brand back out of the
 * title is exactly the guesswork tier 1c exists to avoid.
 *
 * Impact's own documented field names are kept in each list ahead of any one
 * brand's spelling, and they matter more now than they did with one merchant:
 * seven of the eight catalogues here have never been read, and Impact's names
 * are the likeliest thing each of them uses. When a new merchant's peek shows a
 * field PRESENT BUT UNBOUND, the fix is a line in this table, never a second
 * parser.
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
   * Anderton's carries BOTH "Category Path" and "Category Name". The path wins:
   * it is the full hierarchy ("Guitars > Electric Guitars > ...") and
   * `normalizeCategory` has more to match against, where the leaf name alone
   * loses the context that tells a "Standard" apart from a "Standard".
   */
  category: ["Category Path", "CategoryPath", "Category", "category", "Category Name", "CategoryName", "Product Category", "ProductCategory", "Google Category"],
  gtin: ["Gtin", "GTIN", "gtin", "Ean", "EAN", "Upc", "UPC", "Barcode"],
  /**
   * NOT PRESENT in Anderton's catalogue, and that is a fact about that feed
   * rather than a gap in this table. It resolves to null, tier 1c (brand + MPN)
   * simply never fires for those rows, and Gtin carries the hard identity
   * instead. Do not "fix" a null by pointing it at Sku: a retailer's own stock
   * number is not a manufacturer part number, and feeding one into a key that
   * claims to name a product across merchants would merge unrelated gear.
   */
  mpn: ["Mpn", "MPN", "mpn", "Manufacturer Part Number", "ManufacturerPartNumber", "Part Number", "PartNumber"],
  stock: ["Stock Availability", "StockAvailability", "stock_availability", "Availability", "In Stock", "InStock", "Stock", "Stock Status", "StockStatus"],
  /**
   * CONFIRMED PRESENT in Anderton's as "Original Url". This is the good case:
   * the catalogue carries the merchant's own untracked product page beside
   * Impact's tracked link, so rawUrl is the real page and affiliateUrl is the
   * tracked one. Better than the CJ situation, where only a pre-built BUY_URL
   * exists.
   *
   * THE CAMELCASE SPELLINGS ARE NOT DECORATION. Header matching collapses
   * spaces and underscores but cannot split "OriginalUrl" into two words, so
   * "Original Url" and "OriginalUrl" are genuinely different keys to the
   * binder. The FTP drop uses the spaced form and Impact's API uses CamelCase
   * throughout ("CatalogItemId", "CurrentPrice", "StockAvailability"), and this
   * field having only the spaced spelling was a real bug caught by the API
   * tests: it binds to nothing, `rawUrl` silently falls back to the TRACKED
   * url, and every listing on the site then points a shopper at an affiliate
   * link where the merchant's own page belongs. Nothing throws and no row is
   * skipped; the only symptom is /go handing out links it should have built
   * itself.
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
 * Anderton's real header row carries "Min Commission Percentage", "Max
 * Commission Percentage" and "Commission Currency", per product. That is the
 * 1%-to-4% split, and it means the catalogue itself will tell this module, row
 * by row, which products pay us the most. The other seven merchants may well
 * carry the same.
 *
 * Binding those columns is forbidden (CLAUDE.md section 1 and the hard "do not"
 * list). It is not a slippery-slope worry, it is one `.filter()` away: a parser
 * that knows the commission on each row is a parser that can drop the cheap
 * rows, and dropping them is ranking by payout performed at the row level, on a
 * site whose footer promises shoppers that commission never affects what they
 * see. Ingest every row, rank them exactly like every other source, earn on
 * whichever subset happens to pay.
 *
 * If a commission figure is ever genuinely needed (a finance report, say), it
 * belongs in a separate module that reads the catalogue for that purpose and
 * has no path into `marketplace_listings`. Do not add it here.
 *
 * Also unbound, for the ordinary reason that nothing consumes them yet:
 * Program Id, Program Names, Catalog Id, Catalog Name, Language Locale, Last
 * Updated, Bullets, Labels, Additional ImageUrls, Discount Percentage,
 * Promotions, Product Launch Date, Expiration Date, and a brand's free-form
 * Text/Numeric/Money slots.
 */
export const UNBOUND_BY_POLICY = [
  "Min Commission Percentage",
  "Max Commission Percentage",
  "Commission Currency",
] as const

/** Impact mandates these three. Without them a row cannot become a listing at all. */
const MANDATORY: (keyof typeof FIELD_ALIASES)[] = ["itemId", "name", "url"]

export type BoundColumns = Record<keyof typeof FIELD_ALIASES, string | null>

export class ImpactSchemaError extends Error {}

/**
 * Resolve each logical field to the actual header present in this catalogue.
 *
 * Done ONCE against the header row rather than per row, both for speed across
 * tens of thousands of rows and so the failure is a single clear error rather
 * than every row silently skipped.
 *
 * `label` only names the merchant in the error. It is optional because the
 * binder itself is merchant-agnostic and the tests exercise it that way.
 */
export function bindColumns(headers: string[], label = "This Impact catalogue"): BoundColumns {
  const normalised = new Map<string, string>()
  for (const header of headers) {
    normalised.set(header.trim().toLowerCase().replace(/[\s_-]+/g, " "), header)
  }

  const bound = {} as BoundColumns
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
      `${label} is missing ${missing.length} mandatory column(s): ${missing.join(", ")}. ` +
        `Headers actually present: ${headers.map((h) => JSON.stringify(h)).join(", ")}. ` +
        `Add the real spelling to FIELD_ALIASES in lib/ingestion/impact-catalogue.ts. ` +
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
 * withheld", not "free", and letting it through would put a zero-price listing
 * at the top of every price-ascending search.
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

export function normalizeImpactRow(
  record: Record<string, string>,
  columns: BoundColumns,
  merchant: ImpactMerchant,
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
   * When the catalogue carries both a tracked link and the merchant's own, use
   * each for its purpose. When it carries only one, trust it as the affiliate
   * link ONLY if it resolves to an Impact tracking host; otherwise it is the
   * raw URL and no affiliate_url is stored. Same rule as CJ and Awin: an
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
    source: merchant.source,
    externalId: externalId.slice(0, 255),
    title: title.slice(0, 255),
    description: cell(record, columns.description).slice(0, 8000) || null,
    priceCents,
    // The catalogue's own currency column always wins. The merchant's fallback
    // only applies when there is no such column at all, and the run detail
    // records when that happened, because a wrong currency mislabels every row
    // without failing anything.
    currency: (cell(record, columns.currency) || merchant.fallbackCurrency).slice(0, 10),
    // Retailers and brand stores, not peer marketplaces: an empty condition
    // means new stock, the same call gear4music-awin.ts and the CJ modules
    // make. Section 8 depends on this landing in the NEW median rather than
    // dragging the used one up and manufacturing deals that do not exist.
    condition: cell(record, columns.condition) || "New",
    brand: cell(record, columns.manufacturer).slice(0, 100) || null,
    gtin: cell(record, columns.gtin).slice(0, 20) || null,
    epid: null,
    mpn: cell(record, columns.mpn).slice(0, 100) || null,
    locationCountry: merchant.country,
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
  columns: BoundColumns
}

/**
 * Bind and normalise a set of already-parsed records.
 *
 * Shared by both transports on purpose. The FTP drop arrives as delimited text
 * and the REST API as JSON objects, but from here down they are the same thing:
 * a list of string-keyed records whose field names are the brand's choice
 * rather than the network's. Binding by name through one alias table means the
 * two paths cannot drift into disagreeing about what a row means, which is
 * section 7's "never fork the logic" applied to transports rather than to
 * triggers.
 */
export function normalizeImpactRecords(
  records: Record<string, string>[],
  merchant: ImpactMerchant,
): ParsedCatalogue {
  if (records.length === 0) {
    throw new ImpactSchemaError(
      `The ${merchant.label} Impact catalogue parsed to zero rows. Empty or truncated.`,
    )
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

  const columns = bindColumns([...keys], `The ${merchant.label} Impact catalogue`)

  const rows: NewMarketplaceListing[] = []
  let skipped = 0
  for (const record of records) {
    const row = normalizeImpactRow(record, columns, merchant)
    if (row) rows.push(row)
    else skipped += 1
  }

  return { rows, seen: records.length, skipped, columns }
}

/** Parse a whole catalogue document. Exposed separately so tests run off a fixture. */
export function parseImpactCatalogue(text: string, merchant: ImpactMerchant): ParsedCatalogue {
  const delimiter = detectDelimiter(text)
  const records = parseCsv(text, { delimiter })

  if (records.length === 0) {
    throw new ImpactSchemaError(
      `The ${merchant.label} Impact feed parsed to zero rows. Empty or truncated file.`,
    )
  }

  return normalizeImpactRecords(records, merchant)
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
 * authenticated with our account credentials, serving the catalogues these
 * brands publish to partners for exactly this purpose. It is the same
 * relationship as the FTP drop with a different transport.
 *
 * Reference: GET /Mediapartners/{AccountSid}/Catalogs/{CatalogId}/Items,
 * HTTP Basic (SID as username, token as password), Accept: application/json.
 */
const IMPACT_API_BASE = "https://api.impact.com"

/**
 * A page size no paginated API refuses, used only as the fallback above.
 *
 * Not a claim about Impact's limit: it is the number to drop to when the
 * limit turns out to be lower than what we asked for, chosen because 100 is
 * the smallest common cap and a page that size is still worth a round trip.
 */
const SAFE_PAGE_SIZE = 100

function impactAuthHeader(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`
}

export type ImpactApiConfig = {
  accountSid: string
  authToken: string
  catalogId: string
}

/** Credentials as the environment has them, for a merchant's catalogue. */
export function impactApiConfig(merchant: ImpactMerchant): ImpactApiConfig {
  return {
    accountSid: env.impact.accountSid,
    authToken: env.impact.authToken,
    catalogId: merchant.catalogId,
  }
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
 * The body of a failed response, when it is short enough to be a message.
 *
 * WHY THIS IS BOUNDED AND SNIFFED rather than just concatenated. Impact answers
 * an auth failure with an HTML error page in some deployments, and pasting a
 * page of markup into a log buries the one useful fact in it. But a 400 from a
 * JSON API is the opposite case: the body is the only place that says WHICH
 * parameter it did not like, and without it the message is "400 Bad Request"
 * and nobody can act on it.
 *
 * So: take the body when it is short and not markup, collapse its whitespace,
 * and cap it. Anything else is dropped and the status stands on its own.
 */
async function errorBody(response: Response): Promise<string> {
  try {
    const raw = (await response.text()).trim()
    if (!raw) return ""
    if (raw.startsWith("<")) return ""
    const flat = raw.replace(/\s+/g, " ")
    return flat.length > 400 ? `${flat.slice(0, 400)}...` : flat
  } catch {
    /* A body that will not read is not worth failing differently over: the
       status is still the thing being reported. */
    return ""
  }
}

/**
 * The request that failed, with the credential removed.
 *
 * The account sid is half of the HTTP Basic pair and it sits in the PATH of
 * every one of these URLs, so a log line quoting the URL verbatim publishes it.
 * Everything else about the request is exactly what somebody diagnosing this
 * needs to see, which is why the URL is worth including at all.
 */
export function redactImpactUrl(url: string): string {
  return url.replace(/(\/Mediapartners\/)[^/?#]+/i, "$1***")
}

/** Turn a non-2xx into the one sentence that says what to go and change. */
function apiError(status: number, statusText: string, catalogId: string, extra = ""): Error {
  const detail =
    status === 401
      ? "The AccountSid or AuthToken was rejected. Both come from the Impact platform's API settings."
      : status === 403
        ? "Authenticated, but this account is not permitted to read that catalogue. Check the catalogue id belongs to a programme this partner account has joined."
        : status === 404
          ? `No catalogue ${catalogId} for this account. The id is on the product catalogue page in the Impact platform, and the admin catalogue list will read the real ones off the account.`
          : status === 400
            ? /*
               * A 400 IS THE INFORMATIVE ONE, and it took a production outage
               * to notice this branch was empty. Impact checks credentials
               * before it checks anything else, so a 400 rather than a 401
               * means the account is fine and the REQUEST is what it rejected:
               * a parameter out of range, or a catalogue it will not serve in
               * this state. The body says which, so the body is reported.
               */
              "The credentials were accepted and the request itself was rejected, so this is a parameter rather than an access problem."
            : ""
  return new Error(`Impact API returned ${status} ${statusText}. ${detail} ${extra}`.trim())
}

/**
 * Fetch one page of a catalogue.
 *
 * `pathOrPage` takes either a page number or the `@nextpageuri` from a previous
 * response, because following the server's own cursor is more reliable than
 * reconstructing it, and Impact returns one when it has one.
 */
export async function fetchImpactApiPage(
  config: ImpactApiConfig,
  pathOrPage: number | string = 1,
  pageSize = 1000,
): Promise<ImpactPage> {
  const url =
    typeof pathOrPage === "string"
      ? new URL(pathOrPage.startsWith("http") ? pathOrPage : `${IMPACT_API_BASE}${pathOrPage}`)
      : new URL(
          `${IMPACT_API_BASE}/Mediapartners/${encodeURIComponent(config.accountSid)}/Catalogs/${encodeURIComponent(config.catalogId)}/Items`,
        )

  if (typeof pathOrPage === "number") {
    url.searchParams.set("Page", String(pathOrPage))
    url.searchParams.set("PageSize", String(pageSize))
  }

  let response = await fetch(url, {
    headers: {
      authorization: impactAuthHeader(config.accountSid, config.authToken),
      accept: "application/json",
    },
  })

  /*
   * ONE RETRY AT A SMALLER PAGE, AND ONLY ON A 400.
   *
   * Impact does not publish a maximum PageSize for this endpoint and we cannot
   * ask it from a test, so this asks the only way that settles it: request the
   * page we want, and if the API rejects the REQUEST rather than the caller,
   * ask again for a page small enough that no sane API refuses it.
   *
   * Narrow on purpose. A 400 is the one status that means "your credentials
   * are fine and this request is not", so it is the only one where a different
   * request could help; a 401, 403 or 404 gets no second attempt because a
   * smaller page cannot fix any of them. And it happens once, not in a loop.
   *
   * It says so in the log when it works, because the point is not to paper
   * over the limit but to find out what it is: a run that reports falling back
   * is a run that tells somebody what to set `PageSize` to permanently.
   */
  if (response.status === 400 && typeof pathOrPage === "number" && pageSize > SAFE_PAGE_SIZE) {
    const firstBody = await errorBody(response)
    url.searchParams.set("PageSize", String(SAFE_PAGE_SIZE))
    response = await fetch(url, {
      headers: {
        authorization: impactAuthHeader(config.accountSid, config.authToken),
        accept: "application/json",
      },
    })
    if (response.ok) {
      console.warn(
        `[impact] catalogue ${config.catalogId}: PageSize ${pageSize} was rejected ` +
          `(${firstBody || "no reason given"}), ${SAFE_PAGE_SIZE} was accepted. ` +
          `Set the page size to ${SAFE_PAGE_SIZE} to stop paying for the first call.`,
      )
      pageSize = SAFE_PAGE_SIZE
    }
  }

  if (!response.ok) {
    throw apiError(
      response.status,
      response.statusText,
      config.catalogId,
      `Asked for ${redactImpactUrl(url.toString())}. ${await errorBody(response)}`.trim(),
    )
  }

  const body = (await response.json()) as Record<string, unknown>
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

/* -------------------------------------------------------------------------- */
/*  Discovery: which catalogues does this account actually have?              */
/* -------------------------------------------------------------------------- */

export type ImpactCatalogSummary = {
  id: string
  name: string | null
  advertiser: string | null
  items: number | null
  /**
   * The programme this catalogue belongs to, when the response says so.
   *
   * This is what lets the admin list pair a catalogue with a merchant in the
   * registry, since the registry knows each brand's programme id from the
   * marketplace export. It is a display aid and nothing more: the human still
   * reads the catalogue id off the result and pastes it into an env var.
   */
  programId: string | null
  raw: Record<string, string>
}

/**
 * List every catalogue this partner account can read.
 *
 * WHY THIS EXISTS. A catalogue id is the one setting per merchant that cannot
 * be defaulted, guessed or derived: Anderton's 30480 was read off the platform
 * by hand, and repeating that eight times through a web UI is both tedious and
 * error prone. Worse, a wrong id does not fail safely. It either 404s, which is
 * merely annoying, or it returns a DIFFERENT advertiser's products, which would
 * file another merchant's stock under this merchant's name and silently corrupt
 * both the store page and the price medians.
 *
 * So the account is asked directly, and the answer is the id column. Reads
 * nothing but metadata and writes nothing at all.
 */
export async function listImpactCatalogs(
  accountSid: string,
  authToken: string,
): Promise<ImpactCatalogSummary[]> {
  const url = new URL(`${IMPACT_API_BASE}/Mediapartners/${encodeURIComponent(accountSid)}/Catalogs`)
  url.searchParams.set("PageSize", "200")

  const response = await fetch(url, {
    headers: {
      authorization: impactAuthHeader(accountSid, authToken),
      accept: "application/json",
    },
  })

  if (!response.ok) {
    throw apiError(
      response.status,
      response.statusText,
      "(list)",
      `Asked for ${redactImpactUrl(url.toString())}. ${await errorBody(response)}`.trim(),
    )
  }

  const body = (await response.json()) as Record<string, unknown>
  const found = findItemsArray(body)

  return (found?.items ?? []).map((item) => {
    const raw = stringifyValues(item as Record<string, unknown>)
    /*
     * Bound leniently, unlike product fields. Getting a display name wrong
     * costs a squint at the admin panel; getting a price field wrong costs
     * money, which is why that side of this module binds through an explicit
     * alias table and this side does not.
     */
    const pick = (...names: string[]) => names.map((n) => raw[n]).find((v) => v) ?? null
    return {
      id: pick("Id", "CatalogId", "id") ?? "",
      name: pick("Name", "CatalogName"),
      advertiser: pick("AdvertiserName", "CampaignName", "Advertiser", "Campaign"),
      items: toInt(pick("NumberOfItems", "ItemCount", "TotalItems")),
      /*
       * Campaign first, advertiser second. Impact's marketplace export lists
       * one row per programme, which is a campaign, so that is the number the
       * registry holds. Reading the advertiser id too costs nothing and covers
       * the case where this endpoint reports the account rather than the
       * programme; `raw` carries everything either way, so a mismatch is
       * visible rather than silently wrong.
       */
      programId: pick("CampaignId", "AdvertiserId", "ProgramId"),
      raw,
    }
  })
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
 * what would otherwise become a silently null column across a whole catalogue,
 * the way "Manufacturer Name" nearly did. With eight merchants and seven of
 * their catalogues never yet read, peeking before the first pull is not
 * optional politeness, it is the only thing standing between a brand's private
 * spelling and a column of nulls.
 */
export async function peekImpactCatalogue(
  config: ImpactApiConfig,
  label = "This Impact catalogue",
): Promise<{
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
  const page = await fetchImpactApiPage(config, 1, 25)

  const fieldNames = [...new Set(page.records.flatMap((r) => Object.keys(r)))].sort()
  const bound =
    page.records.length > 0 ? bindColumns(fieldNames, label) : ({} as Record<string, string | null>)
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
 * Walk a catalogue, a page at a time, up to a cap.
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
export async function fetchImpactApiRange(
  config: ImpactApiConfig,
  startPage = 1,
  pages = 5,
  pageSize = 1000,
): Promise<{ records: Record<string, string>[]; nextPage: number | null; total: number | null; totalPages: number | null }> {
  const records: Record<string, string>[] = []
  let cursor: number | string = startPage
  let pageNumber = startPage
  let total: number | null = null
  let totalPages: number | null = null

  for (let i = 0; i < pages; i++) {
    const page = await fetchImpactApiPage(config, cursor, pageSize)
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

export type ImpactIngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  stats: UpsertStats
  resolved: number
  error?: string
  /** Rows the catalogue contained in total, so a caller can size the next slice. */
  totalRows?: number
  /** Where this slice started. */
  offset?: number
  /** How many rows this call actually wrote. */
  wrote?: number
  /** False when there is more catalogue left to fetch. */
  done?: boolean
  /** Next page to ask for, on the API transport. Null when finished. */
  nextPage?: number | null
}

export function emptyStats(): UpsertStats {
  return { seen: 0, inserted: 0, updated: 0, skipped: 0, priceChanges: 0, touchedGearIds: [] }
}

/**
 * How much of a catalogue to take in one call.
 *
 * WHY THIS EXISTS. Anderton's alone is 27,052 rows, and a Vercel function stops
 * at 300 seconds whether or not it has finished. All-or-nothing meant either
 * the whole catalogue landed or the attempt taught us nothing, which is a bad
 * trade when the alternative is this cheap.
 *
 * Chunking works here for one specific reason: the upsert is idempotent and
 * keyed on (source, external_id), so the same rows can be written twice with no
 * effect and a run can be resumed by asking for a later slice. A catalogue is a
 * full snapshot rather than a delta, so slice N always means the same rows.
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
 * Ingest one merchant's catalogue over Impact's REST API.
 *
 * The single job behind every Impact merchant: the cron route, the BullMQ
 * worker, the admin button and the CLI all call this with a different merchant
 * and nothing else differs. A slice is a range of pages, which is both cheaper
 * than the FTP path's re-download-per-chunk and the API's own unit of work.
 *
 * `done` governs expiry, and it matters for the same reason it does over FTP:
 * retiring rows after a partial pass would expire everything the catalogue
 * still lists but this call had not reached.
 */
/**
 * WHERE THE LAST RUN STOPPED, so the next one carries on.
 *
 * The route above already promised this ("a caller, or the next scheduled run,
 * can pick it up") and nothing implemented it: `startPage` defaulted to 1 every
 * time. On a small catalogue that is invisible, because five pages covers it.
 * On Anderton's it is a silent, permanent hole: 27,052 products, 5,000 rows a
 * call, so an unparameterised cron would re-ingest the same first five pages
 * forever and the remaining 22,000 products would never exist on the site.
 * Nothing errors, nothing is logged, and the store page just quietly holds a
 * fifth of the catalogue.
 *
 * So the cursor is read back off the last successful run, where this job has
 * been recording it as `detail.nextPage` all along. Consecutive runs walk the
 * catalogue and wrap to the start once `done`, which is what makes a plain
 * cron entry sufficient for a merchant of any size.
 *
 * Idempotency is what makes this safe to get wrong: the upsert is keyed on
 * (source, external_id), so an overlapping or repeated slice costs time and
 * nothing else.
 */
export async function resumePageFor(merchant: ImpactMerchant, jobKind: string): Promise<number> {
  try {
    const rows = await db
      .select({ detail: ingestRuns.detail })
      .from(ingestRuns)
      .where(
        and(
          eq(ingestRuns.source, merchant.source),
          eq(ingestRuns.jobKind, jobKind),
          eq(ingestRuns.status, "ok"),
        ),
      )
      .orderBy(desc(ingestRuns.startedAt))
      .limit(1)

    const detail = rows[0]?.detail as { nextPage?: number | null; done?: boolean } | null
    /* Finished last time, or never ran: start at the top and refresh. */
    if (!detail || detail.done || detail.nextPage == null) return 1
    return Math.max(1, detail.nextPage)
  } catch {
    /* A bookkeeping read must never be the thing that stops an ingest. Starting
       over costs a duplicate slice; throwing costs the whole run. */
    return 1
  }
}

export async function ingestImpactCatalogue(
  merchant: ImpactMerchant,
  window: { startPage?: number; pages?: number; pageSize?: number } = {},
): Promise<ImpactIngestOutcome> {
  if (!canPullImpactMerchant(merchant)) {
    const reason = impactSkipReason(merchant) ?? "Not configured."
    console.warn(`[impact:${merchant.key}] ${reason}`)
    return { status: "skipped", reason, stats: emptyStats(), resolved: 0 }
  }

  const config = impactApiConfig(merchant)
  const jobKind = `${merchant.key}-catalogue-api`
  /* An explicit window wins: the admin buttons and the resume loop both pass
     one. Without it, carry on from wherever the last successful run stopped. */
  const startPage = Math.max(1, window.startPage ?? (await resumePageFor(merchant, jobKind)))
  const run = await startRun(merchant.source, jobKind)

  try {
    const { records, nextPage, total, totalPages } = await fetchImpactApiRange(
      config,
      startPage,
      window.pages ?? 5,
      window.pageSize ?? 1000,
    )

    /*
     * An empty first page is a real failure, not an empty catalogue. It means
     * the collection key was not found or the catalogue is not readable by
     * this account, and treating it as "nothing to do" would report success
     * while writing nothing. A later page coming back empty is just the end.
     */
    if (records.length === 0 && startPage === 1) {
      throw new ImpactSchemaError(
        `The Impact API answered for ${merchant.label} but no catalogue items were found in the response. ` +
          "Use the schema peek to see what it actually returned.",
      )
    }

    const { rows, seen, skipped, columns } = normalizeImpactRecords(records, merchant)
    const stats = await upsertListings(rows)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    const done = nextPage == null
    if (done) await expirePastEndDate(merchant.source)

    /*
     * `fellBackOnCurrency` is the quiet one worth recording. A catalogue with
     * no currency column takes this merchant's declared default, and if that
     * default is wrong every price on the site for this merchant is wrong by a
     * whole exchange rate while nothing errors. Writing it into the run makes
     * a guess visible in /api/health instead of invisible everywhere.
     */
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
        fellBackOnCurrency: columns.currency == null ? merchant.fallbackCurrency : false,
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
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[impact:${merchant.key}] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: emptyStats(), resolved: 0, error: message }
  }
}
