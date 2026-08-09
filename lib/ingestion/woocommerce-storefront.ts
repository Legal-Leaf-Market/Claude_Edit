import {
  expirePastEndDate,
  finishRun,
  resolveAndReprice,
  startRun,
  upsertListings,
  type UpsertStats,
} from "./upsert"
import { withBackoff } from "./rate-limit"
import type { NewMarketplaceListing, Source } from "@/lib/db/schema"

/**
 * Shared parser for small independent sellers on WooCommerce's public Store
 * API (/wp-json/wc/store/v1/products), the read endpoint WooCommerce Blocks
 * ships for its own cart/checkout UI and leaves unauthenticated by default.
 *
 * This is a WEAKER compliance basis than lib/ingestion/shopify-storefront.ts.
 * Shopify's platform-wide agents.md explicitly publishes a "Read-Only
 * Browsing (No Authentication Required)" section inviting third-party agents
 * to read /products.json; WooCommerce has made no equivalent publication for
 * the Store API, and a store running it has no agents.md at all. The Store
 * API being open is a default of the platform, not a decision by the
 * merchant to publish a third-party feed. The user was flagged on this
 * distinction explicitly and chose to proceed anyway for a specific
 * confirmed GoAffPro store (Squaver); this module exists for that decision
 * and should not be treated as clearing the bar for WooCommerce stores in
 * general the way the Shopify agents.md pattern does. Re-verify per store:
 * check robots.txt doesn't disallow the wp-json path and that the store is
 * confirmed enrolled in an affiliate program that wants the traffic, the
 * same per-merchant discipline as the Shopify sources.
 *
 * The Store API returns one listing per PRODUCT, not per variant: variation
 * detail lives behind a separate per-product endpoint
 * (/products/{id}/variations), and hitting that for every product in a
 * catalogue is an N+1 call pattern this module does not take on. Variable
 * products without a usable top-level price are skipped rather than guessed.
 */

export type WooCommerceStoreConfig = {
  source: Source
  /** Store origin, no trailing slash, e.g. "https://squaver.in". */
  baseUrl: string
  locationCountry?: string
  /** GoAffPro (or similar) referral query parameter, e.g. "ref". */
  refParam?: string
  /** This publisher's referral code/value for that store's affiliate program. */
  refCode?: string
}

type WooCommercePrices = {
  price?: string
  price_range?: { min_amount?: string; max_amount?: string } | null
  currency_code?: string
  currency_minor_unit?: number
}
type WooCommerceImage = { src?: string }
type WooCommerceBrand = { name?: string }
type WooCommerceProduct = {
  id: number | string
  name?: string
  sku?: string | null
  permalink?: string
  short_description?: string
  type?: string
  prices?: WooCommercePrices
  images?: WooCommerceImage[]
  brands?: WooCommerceBrand[]
  is_in_stock?: boolean
  is_purchasable?: boolean
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
}

/** short_description is real HTML; strip tags and decode entities for a plain description. */
export function stripWooCommerceHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const codePoint = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim()
}

/**
 * The Store API's "price" is already expressed in the currency's minor unit
 * (e.g. paise for INR), the same shape marketplaceListings.priceCents wants
 * for a 2-decimal currency. Anything else is unfamiliar territory for this
 * schema, so it is rejected rather than silently mis-scaled.
 */
function toCents(prices: WooCommercePrices | undefined): number | null {
  if (!prices) return null
  if (prices.currency_minor_unit !== undefined && prices.currency_minor_unit !== 2) return null
  const raw = prices.price
  if (!raw) return null
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function buildAffiliateUrl(rawUrl: string, config: WooCommerceStoreConfig): string | null {
  if (!config.refParam || !config.refCode) return null
  const url = new URL(rawUrl)
  url.searchParams.set(config.refParam, config.refCode)
  return url.toString()
}

/** Map one WooCommerce product to a listing insert. One listing per product. */
export function normalizeWooCommerceProduct(
  product: WooCommerceProduct,
  config: WooCommerceStoreConfig,
): NewMarketplaceListing[] {
  const rawUrl = product.permalink
  if (!rawUrl) return []

  const title = (product.name ?? "").trim()
  if (!title) return []

  const priceCents = toCents(product.prices)
  if (priceCents == null) return []

  const description = product.short_description
    ? stripWooCommerceHtml(product.short_description).slice(0, 8000)
    : null

  return [
    {
      source: config.source,
      externalId: String(product.id).slice(0, 255),
      title: title.slice(0, 255),
      description,
      priceCents,
      currency: (product.prices?.currency_code ?? "USD").slice(0, 10),
      // These are small new-inventory retailers, not peer marketplaces.
      condition: "New",
      brand: product.brands?.[0]?.name?.slice(0, 100) || null,
      gtin: null,
      epid: null,
      mpn: product.sku?.slice(0, 100) || null,
      locationCountry: (config.locationCountry ?? "US").slice(0, 4),
      locationZip: null,
      isLocalPickup: false,
      isShippable: true,
      rawUrl,
      affiliateUrl: buildAffiliateUrl(rawUrl, config),
      primaryImageUrl: product.images?.[0]?.src ?? null,
      listingStatus: product.is_in_stock === false || product.is_purchasable === false ? "expired" : "active",
      listedAt: null,
      endsAt: null,
    },
  ]
}

/** Page cap as a runaway-loop backstop; no small independent store approaches this. */
const MAX_PAGES = 40
const PAGE_SIZE = 100

async function fetchWooCommerceProductsPage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<WooCommerceProduct[]> {
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "GearAvail/1.0 (+aggregator)" },
  })
  if (!res.ok) {
    const error = new Error(`WooCommerce Store API returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  return (await res.json()) as WooCommerceProduct[]
}

/**
 * Fetches every page. Throws on the first non-ok response rather than
 * retrying internally; the caller (ingestWooCommerceStore) wraps the whole
 * call in withBackoff, the same shape as fetchShopifyProducts.
 */
export async function fetchWooCommerceProducts(
  config: WooCommerceStoreConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: NewMarketplaceListing[]; seen: number }> {
  const rows: NewMarketplaceListing[] = []
  let seen = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${config.baseUrl}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`
    const products = await fetchWooCommerceProductsPage(url, fetchImpl)
    if (products.length === 0) break

    seen += products.length
    for (const product of products) {
      rows.push(...normalizeWooCommerceProduct(product, config))
    }
    if (products.length < PAGE_SIZE) break
  }

  return { rows, seen }
}

export type WooCommerceIngestOutcome = {
  status: "ok" | "failed"
  stats: UpsertStats
  resolved: number
  error?: string
}

/** Run one store's ingest. Called by each store's thin per-store module. */
export async function ingestWooCommerceStore(
  config: WooCommerceStoreConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<WooCommerceIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  const run = await startRun(config.source, `${config.source}-woocommerce`)

  try {
    const { rows, seen } = await withBackoff(() => fetchWooCommerceProducts(config, fetchImpl), {
      attempts: 4,
      baseDelayMs: 2000,
    })
    const stats = await upsertListings(rows)
    stats.seen = seen

    const { resolved } = await resolveAndReprice(stats)
    await expirePastEndDate(config.source)

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      detail: { resolved, priceChanges: stats.priceChanges },
    })

    return { status: "ok", stats, resolved }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${config.source}] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: empty, resolved: 0, error: message }
  }
}
