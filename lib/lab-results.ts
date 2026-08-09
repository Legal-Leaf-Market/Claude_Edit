// Per-store lab-results / COA pages and product-search config used by the
// COA finder. When a shopper opens "view COA", we search that store for their
// strain server-side and deep-link straight to the matching product page
// (where the retailer publishes the strain's COA), instead of dumping them on
// a generic lab-results list.

export type LabResultsInfo = {
  /** Absolute URL to open in the embedded viewer. */
  url: string
  /** True when the URL is a store-wide lab-results listing page. */
  dedicated: boolean
}

// Store-wide lab-results listing pages (used as the fallback when a strain
// search comes up empty). Verified live where a dedicated page exists.
const DEDICATED_PAGES: Record<string, string> = {
  "THCA Small Buds": "https://thcasmallbuds.com/pages/test-results",
  "Black Tie CBD": "https://www.blacktiecbd.net/pages/lab-results-and-coas",
}

/**
 * Resolve the fallback COA/lab-results URL for a product.
 * Falls back to the product's own page when the store has no dedicated page.
 */
export function labResultsFor(storeName: string, productLink: string): LabResultsInfo {
  const dedicated = DEDICATED_PAGES[storeName]
  if (dedicated) return { url: dedicated, dedicated: true }
  return { url: productLink, dedicated: false }
}

// Some stores publish their COAs as individual, strain-named files in a public
// cloud folder. When we know that folder we can grab the shopper's exact COA
// document directly (no product page, no age gate) and embed it. THCA King
// keeps every COA in a public Dropbox folder named "THCA Hemp/Hash - {Strain}
// COA.pdf", which we list and match server-side.
export type CoaFolder = {
  provider: "dropbox"
  linkKey: string
  secureHash: string
  rlkey: string
}

export const COA_FOLDERS: Record<string, CoaFolder> = {
  "THCA King": {
    provider: "dropbox",
    linkKey: "nhb7kh9sjlrcaxc27cwbm",
    secureHash: "ABBsDQjjyvvuBVUsKZAS2-M",
    rlkey: "ha646vs5ac35qtro6b10j4u1l",
  },
}

// How to search each store for a strain, so the finder can grab the exact
// product/COA and link to it.
export type StoreSearch =
  | { platform: "shopify"; searchBase: string; linkBase: string }
  | { platform: "woocommerce"; searchBase: string }

export const STORE_SEARCH: Record<string, StoreSearch> = {
  "THCA Small Buds": {
    platform: "shopify",
    searchBase: "https://thcasmallbuds.com",
    linkBase: "https://thcasmallbuds.com",
  },
  "THCA King": {
    platform: "shopify",
    searchBase: "https://thcaking.com",
    linkBase: "https://thcaking.com",
  },
  "Black Tie CBD": {
    platform: "shopify",
    searchBase: "https://blacktie-cbd.myshopify.com",
    linkBase: "https://blacktie-cbd.myshopify.com",
  },
  THCA4Cheap: {
    platform: "woocommerce",
    searchBase: "https://thca4cheap.com",
  },
}

// Words that describe form/grade/cannabinoid rather than the strain itself.
// Stripped before searching so "Gelato (INDOOR) THCA Flower" -> "gelato".
const STRAIN_NOISE = new Set([
  "thca", "thc", "thcp", "thcv", "cbd", "cbg", "cbn", "delta", "d8", "d9", "d10",
  "flower", "flowers", "indoor", "outdoor", "greenhouse", "exotic", "premium",
  "smalls", "small", "buds", "bud", "popcorn", "shake", "trim", "preroll", "prerolls",
  "vape", "vapes", "cart", "carts", "cartridge", "disposable", "rosin", "resin",
  "concentrate", "concentrates", "diamonds", "sauce", "hash", "kief", "gummies",
  "gummy", "edible", "edibles", "strain", "strains", "the", "and", "with", "new",
  "hemp", "coa", "coas", "certificate", "analysis", "lab", "result", "results",
  "sativa", "indica", "hybrid", "oz", "ounce", "gram", "grams", "lb", "pound",
])

/**
 * Reduce a product/strain label to a compact search query of the meaningful
 * strain tokens (max 3), e.g. "Lemon Cherry Gelato (INDOOR) THCA Flower" ->
 * "lemon cherry gelato".
 */
export function cleanStrainQuery(raw: string): string {
  const tokens = strainTokens(raw)
  return tokens.slice(0, 3).join(" ")
}

/** The distinctive lowercase strain tokens from a label (noise removed). */
export function strainTokens(raw: string): string[] {
  return (raw || "")
    .replace(/\([^)]*\)/g, " ") // drop parentheticals like (INDOOR)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STRAIN_NOISE.has(t) && !/^\d+$/.test(t))
}

/** Hosts the COA proxy is allowed to fetch, to prevent an open proxy. */
export const COA_ALLOWED_HOSTS = [
  "thcasmallbuds.com",
  "thcaking.com",
  "blacktiecbd.net",
  "www.blacktiecbd.net",
  "blacktie-cbd.myshopify.com",
  "thca4cheap.com",
  "www.thca4cheap.com",
  "cdn.shopify.com",
  // COA document hosts (Dropbox public folders + their CDN redirect target).
  "dropbox.com",
  "www.dropbox.com",
  "dl.dropboxusercontent.com",
  "dropboxusercontent.com",
]
