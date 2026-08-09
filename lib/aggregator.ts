import "server-only"
import type { Cannabinoid, Product, StoreType, Variant } from "@/lib/products"
import {
  decodeEntities,
  detectCannabinoid,
  extractPotencyPct,
  extractStrainName,
  isMerchandise,
} from "@/lib/products"

/* -------------------------------------------------------------------------- */
/*  Store configuration (ported from the original Apps Script backend)        */
/* -------------------------------------------------------------------------- */

type StoreConfig = {
  id: string
  name: string
  baseUrl: string
  cartBaseUrl: string | null
  affTag: string
  type: StoreType
  sources: string[]
}

const AFF = "?ref=coffeeandajoint"

export const STORE_CONFIGS: StoreConfig[] = [
  {
    id: "thcasmallbuds",
    name: "THCA Small Buds",
    baseUrl: "https://thcasmallbuds.com",
    cartBaseUrl: null,
    affTag: AFF,
    type: "shopify",
    sources: ["https://thcasmallbuds.com/products.json?limit=250"],
  },
  {
    id: "thcaking",
    name: "THCA King",
    baseUrl: "https://thcaking.com",
    cartBaseUrl: null,
    affTag: AFF,
    type: "shopify",
    sources: ["https://thcaking.com/products.json?limit=250"],
  },
  {
    id: "blacktiecbd",
    name: "Black Tie CBD",
    baseUrl: "https://www.blacktiecbd.net",
    cartBaseUrl: "https://blacktie-cbd.myshopify.com",
    affTag: AFF,
    type: "shopify",
    sources: [
      "https://blacktie-cbd.myshopify.com/products.json?limit=250",
      "https://blacktie-cbd.myshopify.com/collections/all/products.json?limit=250",
      "https://www.blacktiecbd.net/products.json?limit=250",
      "https://www.blacktiecbd.net/collections/all/products.json?limit=250",
    ],
  },
  {
    id: "thca4cheap",
    name: "THCA4Cheap",
    baseUrl: "https://thca4cheap.com",
    cartBaseUrl: "https://thca4cheap.com",
    affTag: AFF,
    type: "woocommerce",
    sources: [
      "https://thca4cheap.com/wp-json/wc/store/v1/products?per_page=100&page=1",
      "https://thca4cheap.com/wp-json/wc/store/v1/products?per_page=100&page=2",
    ],
  },
]

const INVENTORY_TTL = 7200 // 2 hours, matches original INVENTORY_TTL

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  Accept: "application/json, text/html, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
}

/* -------------------------------------------------------------------------- */
/*  Small utility helpers (ported)                                            */
/* -------------------------------------------------------------------------- */

function safeNum(v: unknown): number | null {
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(s: unknown): string {
  return String(s ?? "").replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase())
}

function appendTracking(url: string, tag: string): string {
  if (!url || !tag) return url
  const t = tag.charAt(0) === "?" || tag.charAt(0) === "&" ? tag.substring(1) : tag
  return url + (url.indexOf("?") === -1 ? "?" : "&") + t
}

function extractTags(text: string): Product["extractedTags"] {
  const t = String(text || "").toLowerCase()
  const tags: Product["extractedTags"] = []
  if (/sativa/.test(t)) tags.push("Sativa")
  else if (/indica/.test(t)) tags.push("Indica")
  else if (/hybrid/.test(t)) tags.push("Hybrid")
  if (/indoor/.test(t)) tags.push("Indoor")
  else if (/greenhouse/.test(t)) tags.push("Greenhouse")
  return tags
}

// Detect a gram weight from a free-text label (variant/product title).
// Handles pounds/ounces, "3.5g", "3.5 Grams", "(112g)", and mg for vape/edibles.
function detectGrams(text: string): number | null {
  if (!text) return null
  const t = String(text).toLowerCase()
  if (/1[/-]2\s*(lb|pound)/.test(t) || /half\s*pound|\bhp\b|8\s*oz/.test(t)) return 224
  if (/1[/-]4\s*(lb|pound)/.test(t) || /quarter\s*pound|\bqp\b|4\s*oz/.test(t)) return 112
  if (/\b1\s*lb\b|one\s*pound|16\s*oz/.test(t)) return 448
  if (/1[/-]8\s*(oz|ounce)|eighth/.test(t)) return 3.5
  if (/28\s*g|1\s*oz|1oz|ounce/.test(t)) return 28
  if (/14\s*g|half\s*oz|1[/-]2\s*oz/.test(t)) return 14
  if (/7\s*g|quarter\s*oz|1[/-]4\s*oz/.test(t)) return 7
  if (/3\.5\s*g/.test(t)) return 3.5
  // Generic "<n> g / gram / grams", optionally in parentheses e.g. "(112g)".
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:g\b|gram|grams)/)
  if (m) {
    const v = parseFloat(m[1])
    if (Number.isFinite(v) && v > 0 && v <= 448) return v
  }
  // Milligram products (vapes/edibles) — convert to grams.
  const mg = t.match(/(\d+(?:\.\d+)?)\s*mg\b/)
  if (mg) {
    const v = parseFloat(mg[1])
    if (Number.isFinite(v) && v > 0) return Math.round((v / 1000) * 1000) / 1000
  }
  return null
}

// Clean a raw variant option into a short display label (drops bracketed
// parentheticals like strain synonyms and type tags).
function cleanOptionLabel(raw: string): string {
  return String(raw || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseSizeStringToGrams(str: unknown): number | null {
  if (!str) return null
  const raw = String(str).toLowerCase().trim().replace(/&nbsp;/g, " ").replace(/_/g, "-").replace(/\s+/g, " ").trim()
  if (/^eighth$|^8th$/.test(raw)) return 3.5
  if (/^1[/-]8[\s-]*(?:oz|ounce|ounces)$/.test(raw)) return 3.5
  if (/^3\.5[\s-]*(?:g|gram|grams)$/.test(raw)) return 3.5
  if (/^1[/-]2[\s-]*(?:lb|lbs|pound|pounds)$/.test(raw)) return 224
  if (/^1[/-]4[\s-]*(?:lb|lbs|pound|pounds)$/.test(raw)) return 112
  if (/^1[/-]4[\s-]*(?:oz|ounce|ounces)$/.test(raw)) return 7
  if (/^1[/-]2[\s-]*(?:oz|ounce|ounces)$/.test(raw)) return 14
  const s = raw.replace(/-/g, " ").replace(/\s+/g, " ").trim()
  if (/^half\s*pound$|^hp$/.test(s)) return 224
  if (/^quarter\s*pound$|^qp$/.test(s)) return 112
  if (/^lb$|^1\s*(?:lb|lbs|pound|pounds)$|^pound$/.test(s)) return 448
  if (/^28\s*g$|^1\s*oz$|^1oz$|^oz$|^ounce$|^one\s*ounce$/.test(s)) return 28
  if (/^14\s*g$|^half\s*oz$/.test(s)) return 14
  if (/^7\s*g$|^quarter\s*oz$/.test(s)) return 7
  if (/^3\.5\s*g$|^eighth$/.test(s)) return 3.5
  const m = s.match(/^(\d+(?:\.\d+)?)\s*g$/)
  if (m) {
    const v = parseFloat(m[1])
    if (Number.isFinite(v) && v > 0 && v <= 448) return v
  }
  return null
}

function formatPpgRange(min: number | null, max: number | null): string | null {
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return null
  if (Math.abs(min - max) < 0.01) return `$${min.toFixed(2)}/g`
  return `$${Math.min(min, max).toFixed(2)} - $${Math.max(min, max).toFixed(2)}/g`
}

type Summary = { minPrice: number | null; minPpg: number | null; maxPpg: number | null; anyAvailable: boolean }

function summarizeVariants(vars: Variant[]): Summary {
  let minPriceAll: number | null = null
  let minPriceAvail: number | null = null
  let minPpgAll: number | null = null
  let maxPpgAll: number | null = null
  let minPpgAvail: number | null = null
  let maxPpgAvail: number | null = null
  let any = false
  vars.forEach((v) => {
    const p = safeNum(v.price)
    if (!p || p <= 0) return
    if (minPriceAll === null || p < minPriceAll) minPriceAll = p
    if (v.available) {
      any = true
      if (minPriceAvail === null || p < minPriceAvail) minPriceAvail = p
    }
    if (v.grams) {
      const pp = p / v.grams
      if (minPpgAll === null || pp < minPpgAll) minPpgAll = pp
      if (maxPpgAll === null || pp > maxPpgAll) maxPpgAll = pp
      if (v.available) {
        if (minPpgAvail === null || pp < minPpgAvail) minPpgAvail = pp
        if (maxPpgAvail === null || pp > maxPpgAvail) maxPpgAvail = pp
      }
    }
  })
  return {
    minPrice: minPriceAvail !== null ? minPriceAvail : minPriceAll,
    minPpg: minPpgAvail !== null ? minPpgAvail : minPpgAll,
    maxPpg: maxPpgAvail !== null ? maxPpgAvail : maxPpgAll,
    anyAvailable: any,
  }
}

function toProduct(args: {
  id: string
  title: string
  storeName: string
  storeBaseUrl: string
  storeType: StoreType
  cartBaseUrl: string
  nativeId: string
  imageUrl: string
  category: string
  link: string
  publishedAt: string
  extraText: string
  variants: Variant[]
}): Product {
  const pricing = summarizeVariants(args.variants)
  const price = pricing.minPrice ?? 0
  // Live feeds return HTML-encoded titles; decode once so the clean title flows
  // to the card, dropdown labels, strain parsing, and email alerts alike.
  const title = decodeEntities(args.title)
  const searchData = `${title} ${args.category} ${args.storeName} ${stripHtml(args.extraText)}`.toLowerCase()
  // Title + category is authoritative; the description is only a fallback
  // signal so a CBD product from a THCA-branded store is not misfiled as THCA.
  const cannabinoid: Cannabinoid = detectCannabinoid(`${title} ${args.category}`, args.extraText)
  return {
    id: args.id,
    title,
    storeName: args.storeName,
    storeBaseUrl: args.storeBaseUrl,
    storeType: args.storeType,
    cartBaseUrl: args.cartBaseUrl,
    nativeId: args.nativeId,
    category: args.category || "Other",
    imageUrl: args.imageUrl,
    link: args.link,
    price,
    ppgFloat: pricing.minPpg,
    ppgDisplay: formatPpgRange(pricing.minPpg, pricing.maxPpg),
    // Potency comes from the listing/COA copy; title first, then description.
    potencyPct: extractPotencyPct(`${title} ${args.extraText}`),
    cannabinoid,
    extractedTags: extractTags(`${title} ${args.extraText}`),
    strainName: extractStrainName(title),
    variants: args.variants,
    isSoldOut: !pricing.anyAvailable,
    publishedAt: args.publishedAt || "",
    searchData,
  }
}

/* -------------------------------------------------------------------------- */
/*  Fetch helpers                                                             */
/* -------------------------------------------------------------------------- */

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      next: { revalidate: INVENTORY_TTL },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Shopify parsing                                                           */
/* -------------------------------------------------------------------------- */

type ShopifyVariant = { id?: number | string; title?: string; price?: string; available?: boolean }
type ShopifyProduct = {
  id: number | string
  title?: string
  handle?: string
  product_type?: string
  tags?: string[] | string
  body_html?: string
  published_at?: string
  images?: { src?: string }[]
  variants?: ShopifyVariant[]
}

function parseShopify(body: string, store: StoreConfig): Product[] {
  const data = JSON.parse(body) as { products?: ShopifyProduct[] }
  const raws = data.products || []
  const products: Product[] = []
  raws.forEach((prod) => {
    if (!prod || !prod.images || !prod.images.length) return
    const image = prod.images[0]?.src || ""
    if (!image) return
    // Product-level weight (e.g. "0.5g Vape") used as a fallback for variants
    // that are differentiated by flavor/strain rather than weight.
    const productGrams = detectGrams(prod.title || "")
    const variants: Variant[] = (prod.variants || []).map((v) => {
      const optRaw = v.title || ""
      const sizeGrams = detectGrams(optRaw)
      const grams = sizeGrams ?? productGrams ?? null
      return {
        variantId: v.id ? String(v.id) : "",
        title: optRaw,
        price: safeNum(v.price) ?? 0,
        grams,
        available: v.available === true,
        optionLabel: cleanOptionLabel(optRaw),
        weighted: sizeGrams != null,
      }
    })
    if (!variants.length) return
    const category = titleCase(prod.product_type || "Other")
    // Exclude apparel / accessories / paraphernalia — consumables only.
    const tagText = Array.isArray(prod.tags) ? prod.tags.join(" ") : prod.tags || ""
    if (isMerchandise(prod.title || "", `${category} ${tagText}`)) return
    products.push(
      toProduct({
        id: `${prod.id}_${store.id}`,
        title: prod.title || "",
        storeName: store.name,
        storeBaseUrl: store.baseUrl,
        storeType: store.type,
        cartBaseUrl: store.cartBaseUrl || store.baseUrl,
        nativeId: String(prod.id),
        imageUrl: image,
        category,
        link: appendTracking(`${store.baseUrl}/products/${prod.handle}`, store.affTag),
        publishedAt: prod.published_at || "",
        extraText: stripHtml(prod.body_html || ""),
        variants,
      }),
    )
  })
  return products
}

async function fetchShopifyStore(store: StoreConfig): Promise<Product[]> {
  for (const url of store.sources) {
    const body = await fetchText(url)
    if (!body || body.trim().charAt(0) !== "{") continue
    try {
      const parsed = parseShopify(body, store)
      if (parsed.length) return parsed
    } catch {
      // try next source
    }
  }
  return []
}

/* -------------------------------------------------------------------------- */
/*  WooCommerce parsing (Store API v1)                                        */
/* -------------------------------------------------------------------------- */

type WooPrices = {
  price?: string
  currency_minor_unit?: number
  price_range?: { min_amount?: string; max_amount?: string } | null
}
type WooImage = { src?: string; thumbnail?: string; large?: string; medium?: string }
type WooAttrTerm = { slug?: string; name?: string }
// Attributes appear in two shapes: on variations as { name, value }, and on
// parent products as { name, taxonomy, terms: [{ slug, name }] }.
type WooAttribute = { name?: string; value?: string; taxonomy?: string; terms?: WooAttrTerm[] }
// A variable product lists its child variations as { id, attributes:[{name,value}] }.
type WooVariationRef = { id: number; attributes?: WooAttribute[] }
type WooProduct = {
  id: number
  name?: string
  slug?: string
  type?: string
  permalink?: string
  description?: string
  short_description?: string
  date_created?: string
  date_created_gmt?: string
  is_in_stock?: boolean
  is_purchasable?: boolean
  prices?: WooPrices
  images?: WooImage[]
  categories?: { name?: string }[]
  attributes?: WooAttribute[]
  variations?: WooVariationRef[]
  parent?: number
}

// variationId -> live pricing/availability, fetched per parent product.
type WooPriceMap = Record<number, { price: number; available: boolean }>

// Read the "Weight" attribute slug from a variation reference (e.g. "oz").
function weightSlugFromRef(ref: WooVariationRef): string {
  let slug = ""
  ;(ref.attributes || []).forEach((a) => {
    if (/weight/i.test(a?.name || "") && a?.value) slug = String(a.value).toLowerCase().trim()
  })
  return slug
}

// Build slug -> grams from a parent product's Weight attribute terms
// (e.g. { slug: "oz", name: "28G" } -> 28).
function buildSlugGramsMap(prod: WooProduct): Record<string, number> {
  const map: Record<string, number> = {}
  ;(prod.attributes || []).forEach((a) => {
    const isWeight = /weight/i.test(a?.name || "") || /weight/i.test(a?.taxonomy || "")
    if (!isWeight || !Array.isArray(a.terms)) return
    a.terms.forEach((t) => {
      if (!t?.slug) return
      const g = parseSizeStringToGrams(t.name) ?? parseSizeStringToGrams(t.slug)
      if (g) map[String(t.slug).toLowerCase()] = g
    })
  })
  return map
}

function wooPrice(raw: unknown, prices?: WooPrices): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const minor = prices && prices.currency_minor_unit !== undefined ? Number(prices.currency_minor_unit) : 2
  const n = parseFloat(String(raw))
  return Number.isFinite(n) ? n / Math.pow(10, Number.isFinite(minor) ? minor : 2) : null
}

function extractWooImageUrl(img?: WooImage): string {
  if (!img) return ""
  const keys: (keyof WooImage)[] = ["src", "thumbnail", "large", "medium"]
  for (const k of keys) {
    const v = img[k]
    if (v && String(v).indexOf("http") === 0) return String(v)
  }
  return ""
}

function formatCleanSizeTitle(g: number | null): string {
  if (!g || g <= 0) return ""
  if (g === 3.5) return "3.5g"
  if (g === 7) return "7g"
  if (g === 14) return "14g"
  if (g === 28) return "1oz"
  if (g === 112) return "1/4 lb"
  if (g === 224) return "1/2 lb"
  if (g === 448) return "1 lb"
  return g > 448 ? "" : `${g}g`
}

// Build variants for one Woo product using its `variations` refs (weight slug)
// joined with the per-parent price map. Each real size tier becomes one variant
// with its own price and grams, so the cheapest-sort and dropdown are accurate.
function buildWooVariants(
  prod: WooProduct,
  base: number,
  sold: boolean,
  productGrams: number | null,
  priceMap: WooPriceMap,
): Variant[] {
  const refs = Array.isArray(prod.variations) ? prod.variations : []
  if (refs.length) {
    const slugGrams = buildSlugGramsMap(prod)
    const vars: Variant[] = []
    refs.forEach((ref) => {
      const p = priceMap[ref.id]
      if (!p || p.price <= 0) return // skip $0 / unpriced variations
      const slug = weightSlugFromRef(ref)
      const grams =
        (slug ? (slugGrams[slug] ?? parseSizeStringToGrams(slug)) : null) ?? productGrams ?? null
      const label = grams ? formatCleanSizeTitle(grams) : cleanOptionLabel(slug)
      vars.push({
        variantId: String(ref.id),
        title: label,
        price: p.price,
        grams,
        available: p.available,
        optionLabel: label,
        weighted: grams != null,
      })
    })
    if (vars.length) {
      // De-dupe identical size tiers, keeping the cheapest of each.
      const byKey: Record<string, Variant> = {}
      vars.forEach((v) => {
        const key = v.grams != null ? `g${v.grams}` : v.optionLabel || v.variantId
        if (!byKey[key] || v.price < byKey[key].price) byKey[key] = v
      })
      return Object.values(byKey).sort((a, b) => a.price - b.price)
    }
  }

  // Simple product (or no priced variations found): one base variant.
  return [
    {
      variantId: "",
      title: productGrams ? formatCleanSizeTitle(productGrams) : "",
      price: base || 0,
      grams: productGrams,
      available: !sold,
      optionLabel: productGrams ? formatCleanSizeTitle(productGrams) : "",
      weighted: productGrams != null,
    },
  ]
}

function parseWooProducts(products: WooProduct[], priceMap: WooPriceMap, store: StoreConfig): Product[] {
  const out: Product[] = []
  const seen: Record<string, boolean> = {}
  products.forEach((prod) => {
    if (!prod || !prod.id || !prod.images || !prod.images.length) return
    const title = prod.name || ""
    if (!title) return
    let image = ""
    for (const im of prod.images) {
      image = extractWooImageUrl(im)
      if (image) break
    }
    if (!image) return
    const id = `${prod.id}_${store.id}`
    if (seen[id]) return
    seen[id] = true

    let category = "Other"
    let catText = ""
    if (prod.categories && prod.categories.length) {
      category = titleCase(prod.categories[0].name || "Other")
      prod.categories.forEach((c) => (catText += ` ${c.name || ""}`))
    }
    // Exclude apparel / accessories / paraphernalia — consumables only.
    if (isMerchandise(title, catText)) return
    const permalink = prod.permalink || `${store.baseUrl}/product/${prod.slug || ""}/`
    const base = wooPrice(prod.prices?.price, prod.prices) || 0
    const sold = prod.is_in_stock === false || prod.is_purchasable === false
    const productGrams = detectGrams(title)
    const wholesale = /wholesale|bulk\s*order|volume\s*discount|pallet|bulk\s*pack/i.test(title)
    const variants = wholesale
      ? [
          {
            variantId: "",
            title: productGrams ? formatCleanSizeTitle(productGrams) : "",
            price: base,
            grams: productGrams,
            available: !sold,
            optionLabel: productGrams ? formatCleanSizeTitle(productGrams) : "",
            weighted: productGrams != null,
          },
        ]
      : buildWooVariants(prod, base, sold, productGrams, priceMap)

    // Skip products with no real price (e.g. $0 placeholder listings) so the
    // cheapest sort stays accurate.
    if (!variants.some((v) => v.price > 0)) return

    out.push(
      toProduct({
        id,
        title,
        storeName: store.name,
        storeBaseUrl: store.baseUrl,
        storeType: store.type,
        cartBaseUrl: store.cartBaseUrl || store.baseUrl,
        nativeId: String(prod.id),
        imageUrl: image,
        category,
        link: appendTracking(permalink, store.affTag),
        publishedAt: prod.date_created || prod.date_created_gmt || "",
        extraText: `${stripHtml(prod.description || "")} ${stripHtml(prod.short_description || "")} ${catText}`,
        variants,
      }),
    )
  })
  return out
}

// Fetch real per-variation prices for each variable product via the
// `?parent={id}` query (the bulk `type=variation` listing returns unpriced
// junk). Runs with bounded concurrency and a hard cap to keep latency in check;
// results are cached for INVENTORY_TTL.
async function fetchWooVariationPrices(store: StoreConfig, parentIds: number[]): Promise<WooPriceMap> {
  const map: WooPriceMap = {}
  const CONCURRENCY = 6
  const MAX_PARENTS = 200
  const ids = parentIds.slice(0, MAX_PARENTS)
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (pid) => {
        const body = await fetchText(
          `${store.baseUrl}/wp-json/wc/store/v1/products?type=variation&parent=${pid}&per_page=100`,
        )
        if (!body || body.trim().charAt(0) !== "[") return
        try {
          const arr = JSON.parse(body) as WooProduct[]
          arr.forEach((v) => {
            const price = wooPrice(v.prices?.price, v.prices)
            if (price != null && price > 0) {
              map[v.id] = {
                price,
                available: v.is_in_stock !== false && v.is_purchasable !== false,
              }
            }
          })
        } catch {
          // ignore this parent
        }
      }),
    )
  }
  return map
}

async function fetchWooStore(store: StoreConfig): Promise<Product[]> {
  // 1) Collect the full product list across all source pages.
  const rawProducts: WooProduct[] = []
  const seenIds = new Set<number>()
  for (const url of store.sources) {
    const body = await fetchText(url)
    if (!body || body.trim().charAt(0) !== "[") continue
    try {
      const data = JSON.parse(body) as WooProduct[]
      if (!Array.isArray(data)) continue
      data.forEach((p) => {
        if (p?.id && !seenIds.has(p.id)) {
          seenIds.add(p.id)
          rawProducts.push(p)
        }
      })
    } catch {
      // try next source
    }
  }

  // 2) Fetch prices for the variable products' variations.
  const variableIds = rawProducts
    .filter((p) => Array.isArray(p.variations) && p.variations.length > 0)
    .map((p) => p.id)
  const priceMap = await fetchWooVariationPrices(store, variableIds)

  // 3) Parse into unified products.
  const products: Product[] = []
  const seen: Record<string, boolean> = {}
  parseWooProducts(rawProducts, priceMap, store).forEach((p) => {
    if (!seen[p.id]) {
      seen[p.id] = true
      products.push(p)
    }
  })
  return products
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export type AggregateResult = {
  products: Product[]
  cachedAt: string
  storeStatus: { name: string; count: number; ok: boolean }[]
}

export async function getLiveInventory(): Promise<AggregateResult> {
  const results = await Promise.all(
    STORE_CONFIGS.map(async (store) => {
      try {
        const products = store.type === "woocommerce" ? await fetchWooStore(store) : await fetchShopifyStore(store)
        return { store, products, ok: products.length > 0 }
      } catch {
        return { store, products: [] as Product[], ok: false }
      }
    }),
  )

  const products = results.flatMap((r) => r.products)
  const storeStatus = results.map((r) => ({ name: r.store.name, count: r.products.length, ok: r.ok }))
  return { products, cachedAt: new Date().toISOString(), storeStatus }
}
