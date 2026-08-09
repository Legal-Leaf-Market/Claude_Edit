import type { Product } from "@/lib/products"

export const SITE_URL = "https://legal-leafmarket.com"
export const SITE_NAME = "Legal-Leaf Market"
const SITE_DESCRIPTION =
  "Compare real-time hemp prices across trusted THCA, Delta-8, Delta-9 & CBD retailers."

// Cap the ItemList so the server-rendered JSON-LD stays a reasonable size.
const MAX_LIST_ITEMS = 60

/** Site-wide WebSite schema with a SearchAction (Sitelinks search box). */
export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

/** Organization schema so brand/logo can surface in knowledge panels. */
export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
    description: SITE_DESCRIPTION,
  }
}

// Wholesale/bulk weights (quarter-pound and up) are excluded from the schema
// price range. Mixing a 1g retail sample with a 448g pound produced nonsensical
// spans like "$8.99–$1,299.99", which Google's quality filters flag as
// misleading and can suppress the price snippet entirely. Anything up to a
// standard ounce (28g) is a coherent consumer retail purchase.
const MAX_RETAIL_GRAMS = 28
// Consumer retail ceiling. Bulk/wholesale variants sometimes arrive without a
// parsed gram weight (grams === null), so a size filter alone can't catch them;
// a price cap removes stray wholesale prices (e.g. a $26,000 pound) from the
// schema. No single consumer hemp purchase realistically exceeds this.
const MAX_RETAIL_PRICE = 600
// Titles that signal a wholesale/bulk listing rather than a consumer product.
const WHOLESALE_TITLE_RE = /\b(bulk|wholesale|pounds?|\blb\b|\blbs\b|\bqp\b|\bhp\b)\b/i

/** Remove affiliate/tracking params so schema URLs point to the canonical page.
 * Passing ?ref= inside JSON-LD can trip Google's thin-affiliate classifiers. */
function canonicalUrl(link: string): string {
  if (!link) return link
  try {
    const u = new URL(link)
    for (const key of [...u.searchParams.keys()]) {
      if (/^(ref|aff|affiliate|utm_|fbclid|gclid|src|source|tag)/i.test(key)) {
        u.searchParams.delete(key)
      }
    }
    u.search = u.searchParams.toString()
    return u.toString()
  } catch {
    // Not a parseable absolute URL — strip any query string as a fallback.
    return link.split("?")[0]
  }
}

/**
 * Product + AggregateOffer schema for a single product. Reports the real
 * in-stock retail price range (bulk/wholesale sizes excluded) so Google renders
 * coherent "$X–$Y" price-comparison results that pass validation.
 * Returns null when there's no usable price (nothing to advertise).
 */
export function buildProductSchema(product: Product) {
  // Skip wholesale/bulk listings outright — they aren't consumer retail products.
  if (WHOLESALE_TITLE_RE.test(product.title)) return null

  const priced = product.variants.filter((v) => v.price > 0)
  // Keep only coherent consumer retail sizes: unit products (grams === null,
  // e.g. gummies/vapes) plus weighted sizes up to an ounce, and always under the
  // retail price ceiling. This drops pound/QP outliers (including bulk variants
  // whose weight didn't parse) that inflated the high price.
  const retailPool = priced.filter(
    (v) => (v.grams === null || v.grams <= MAX_RETAIL_GRAMS) && v.price <= MAX_RETAIL_PRICE,
  )
  // Wholesale-only listings (all variants are pounds/QPs) are not consumer
  // retail products — omit them entirely so a $26,000 bulk price never lands in
  // the product schema and trips Google's misleading-price filters.
  if (!retailPool.length) return null
  const inStock = retailPool.filter((v) => v.available)
  const pool = inStock.length ? inStock : retailPool
  if (!pool.length) return null

  const prices = pool.map((v) => v.price)
  const lowPrice = Math.min(...prices)
  const highPrice = Math.max(...prices)
  const available = !product.isSoldOut && inStock.length > 0

  const offers: Record<string, unknown> = {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: Number(lowPrice.toFixed(2)),
    highPrice: Number(highPrice.toFixed(2)),
    // Distinct in-stock retail purchase options actually being aggregated.
    offerCount: pool.length,
    availability: available
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    seller: { "@type": "Organization", name: product.storeName },
  }

  const schema: Record<string, unknown> = {
    "@type": "Product",
    name: product.title,
    category: product.category,
    description: `Lab-tested ${product.category}. Compare live prices across retailers by price per gram.`,
    brand: { "@type": "Brand", name: product.storeName },
    offers,
  }
  if (product.imageUrl) schema.image = product.imageUrl
  if (product.link) schema.url = canonicalUrl(product.link)
  return schema
}

/**
 * ItemList of products wrapping Product/AggregateOffer entries. This is the
 * money schema for a comparison site — it feeds Google's product rich results.
 */
export function buildItemListSchema(products: Product[]) {
  const items = products
    .slice(0, MAX_LIST_ITEMS)
    .map((p, i) => {
      const item = buildProductSchema(p)
      if (!item) return null
      return { "@type": "ListItem", position: i + 1, item }
    })
    .filter((x): x is { "@type": string; position: number; item: Record<string, unknown> } => x !== null)
    // Re-number after filtering so positions stay contiguous.
    .map((entry, i) => ({ ...entry, position: i + 1 }))

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Legal hemp deals compared by price per gram",
    numberOfItems: items.length,
    itemListElement: items,
  }
}
