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
 * Shared parser for small independent sellers' public Shopify storefront JSON
 * (/products.json), per CLAUDE.md section 2's exception for merchants
 * confirmed enrolled in an affiliate program that wants publisher traffic.
 *
 * This is NOT the same trust model as the eBay/Awin/LinkConnector/CJ feeds.
 * Those are gated data-sharing agreements built for third-party aggregation;
 * this is Shopify's public storefront endpoint, which is legitimate here only
 * because:
 *
 *   1. The specific store's own /agents.md publishes a "Read-Only Browsing
 *      (No Authentication Required)" section naming /products.json (or
 *      /collections/{handle}/products.json) as the sanctioned path for agents
 *      that read catalogue data without transacting. Verified per store
 *      before wiring one in, not assumed from one example.
 *   2. The store is confirmed enrolled in an affiliate program (GoAffPro or
 *      similar) that explicitly wants publisher-driven traffic, i.e. it
 *      showed up in an affiliate network's own merchant directory.
 *
 * GoAffPro (and similar small-merchant affiliate apps) do not run a network
 * redirect domain the way Awin/CJ do: the tracked link is the merchant's own
 * product URL with a referral query parameter appended, so there is no new
 * host to allowlist in /go — the raw URL and the affiliate URL share a host.
 * An unconfigured referral parameter produces a null affiliate_url, same
 * "no half-built link" rule as every other source.
 */

export type ShopifyStoreConfig = {
  source: Source
  /** Store origin, no trailing slash, e.g. "https://folkcraft.com". */
  baseUrl: string
  currency?: string
  locationCountry?: string
  /** GoAffPro (or similar) referral query parameter, e.g. "ref" or "aff". */
  refParam?: string
  /** This publisher's referral code/value for that store's affiliate program. */
  refCode?: string
}

type ShopifyImage = { src?: string }
type ShopifyVariant = {
  id: number | string
  title?: string
  sku?: string
  price?: string
  available?: boolean
  featured_image?: ShopifyImage | null
}
type ShopifyProduct = {
  id: number | string
  title?: string
  handle?: string
  body_html?: string
  vendor?: string
  product_type?: string
  images?: ShopifyImage[]
  variants?: ShopifyVariant[]
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
}

/** Shopify's body_html is real HTML; strip tags and decode entities for a plain description. */
export function stripShopifyHtml(html: string): string {
  return html
    // Small sellers routinely embed a Shopify Buy Button widget or a video
    // embed here; <script>/<style> CONTENT must go, not just the tags, or raw
    // JS/CSS leaks straight into the description.
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
    // An inline tag stripped to a space right before punctuation (e.g.
    // "style</b>." -> "style .") reads as a typo; close the gap up.
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim()
}

function toCents(raw: string | undefined): number | null {
  if (!raw) return null
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

function buildAffiliateUrl(rawUrl: string, config: ShopifyStoreConfig): string | null {
  if (!config.refParam || !config.refCode) return null
  const url = new URL(rawUrl)
  url.searchParams.set(config.refParam, config.refCode)
  return url.toString()
}

/** Map one Shopify product's variants to listing inserts. One listing per variant. */
export function normalizeShopifyProduct(
  product: ShopifyProduct,
  config: ShopifyStoreConfig,
): NewMarketplaceListing[] {
  const handle = product.handle
  if (!handle) return []

  const productTitle = (product.title ?? "").trim()
  if (!productTitle) return []

  const description = product.body_html ? stripShopifyHtml(product.body_html).slice(0, 8000) : null
  const productImage = product.images?.[0]?.src ?? null
  const rawUrl = `${config.baseUrl}/products/${handle}`

  const variants = product.variants ?? []
  const listings: NewMarketplaceListing[] = []

  for (const variant of variants) {
    const priceCents = toCents(variant.price)
    if (priceCents == null) continue

    const variantTitle = variant.title && variant.title !== "Default Title" ? variant.title : ""
    const title = (variantTitle ? `${productTitle} - ${variantTitle}` : productTitle).slice(0, 255)

    listings.push({
      source: config.source,
      externalId: `${product.id}-${variant.id}`.slice(0, 255),
      title,
      description,
      priceCents,
      currency: (config.currency ?? "USD").slice(0, 10),
      // These are small new-inventory retailers, not peer marketplaces.
      condition: "New",
      // Shopify's product_type is the merchant's own single-word taxonomy
      // ("Effects Pedal", "Guitar"). Interpreted by feed-category.ts.
      feedCategory: product.product_type?.trim().slice(0, 200) || null,
      brand: product.vendor?.slice(0, 100) || null,
      gtin: null,
      epid: null,
      mpn: variant.sku?.slice(0, 100) || null,
      locationCountry: (config.locationCountry ?? "US").slice(0, 4),
      locationZip: null,
      isLocalPickup: false,
      isShippable: true,
      rawUrl,
      affiliateUrl: buildAffiliateUrl(rawUrl, config),
      primaryImageUrl: variant.featured_image?.src ?? productImage,
      // Shopify's cart permalink (/cart/{variantId}:{qty}) is keyed on this,
      // not on the product id.
      platformVariantId: String(variant.id).slice(0, 50),
      listingStatus: variant.available === false ? "expired" : "active",
      listedAt: null,
      endsAt: null,
    })
  }

  return listings
}

/** Page cap as a runaway-loop backstop; no small independent store approaches this. */
const MAX_PAGES = 40
const PAGE_SIZE = 250

async function fetchShopifyProductsPage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<ShopifyProduct[]> {
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "GearAvail/1.0 (+aggregator)" },
  })
  if (!res.ok) {
    const error = new Error(`Shopify storefront returned ${res.status} ${res.statusText}`) as Error & {
      status: number
    }
    error.status = res.status
    throw error
  }
  const body = (await res.json()) as { products?: ShopifyProduct[] }
  return body.products ?? []
}

/**
 * Fetches every page. Throws on the first non-ok response rather than
 * retrying internally; the caller (ingestShopifyStore) wraps the whole call
 * in withBackoff, the same shape as fetchAwinFeedText/fetchZzoundsFeedText.
 */
export async function fetchShopifyProducts(
  config: ShopifyStoreConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: NewMarketplaceListing[]; seen: number }> {
  const rows: NewMarketplaceListing[] = []
  let seen = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${config.baseUrl}/products.json?limit=${PAGE_SIZE}&page=${page}`
    const products = await fetchShopifyProductsPage(url, fetchImpl)
    if (products.length === 0) break

    seen += products.length
    for (const product of products) {
      rows.push(...normalizeShopifyProduct(product, config))
    }
    if (products.length < PAGE_SIZE) break
  }

  return { rows, seen }
}

export type ShopifyIngestOutcome = {
  status: "ok" | "failed"
  stats: UpsertStats
  resolved: number
  error?: string
}

/** Run one store's ingest. Called by each store's thin per-store module. */
export async function ingestShopifyStore(
  config: ShopifyStoreConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  const empty: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }

  const run = await startRun(config.source, `${config.source}-shopify`)

  try {
    const { rows, seen } = await withBackoff(() => fetchShopifyProducts(config, fetchImpl), {
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
