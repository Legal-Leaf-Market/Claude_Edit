export const DISCOUNT_CODE = "JACOBKENNEDY"

// Discount applied at checkout via DISCOUNT_CODE. All four stores honor a flat
// 10% off. Per-store overrides can be added here later if that ever changes;
// keyed by store name (lowercased) so it survives live + fallback data alike.
const STORE_DISCOUNT_RATE: Record<string, number> = {}
const DEFAULT_DISCOUNT_RATE = 0.1

/** Fractional discount (e.g. 0.2 = 20% off) applied for a given store. */
export function discountRate(storeName: string): number {
  return STORE_DISCOUNT_RATE[storeName.trim().toLowerCase()] ?? DEFAULT_DISCOUNT_RATE
}

/** Discount as a whole-number percent for display (e.g. 20). */
export function discountPercent(storeName: string): number {
  return Math.round(discountRate(storeName) * 100)
}

/** Apply a store's code discount to an item price (shipping excluded). */
export function discountedPrice(storeName: string, price: number): number {
  return price * (1 - discountRate(storeName))
}

export type Cannabinoid = "thca" | "cbd" | "d8" | "d9" | "other"

export type StrainTag = "Sativa" | "Indica" | "Hybrid" | "Indoor" | "Greenhouse"

export type Variant = {
  title: string
  price: number
  grams: number | null
  available: boolean
  variantId: string
  // Raw distinguishing option for this variant (a weight like "28 Grams", or a
  // flavor/strain like "Sour Strawberry"). Used to build unique dropdown labels.
  optionLabel: string
  // True when this variant's own option encodes a weight (so the dropdown shows
  // a friendly size label); false when it is differentiated by flavor/strain.
  weighted: boolean
}

export type StoreType = "shopify" | "woocommerce"

export type Product = {
  id: string
  title: string
  storeName: string
  storeBaseUrl: string
  storeType: StoreType
  cartBaseUrl: string
  nativeId: string
  category: string
  imageUrl: string
  link: string
  price: number
  ppgFloat: number | null
  ppgDisplay: string | null
  // Dominant cannabinoid potency as a percentage (e.g. 25.8 for 25.8% THCa),
  // parsed from the title/description. Null when no lab figure is advertised.
  potencyPct: number | null
  cannabinoid: Cannabinoid
  extractedTags: StrainTag[]
  strainName: string
  variants: Variant[]
  isSoldOut: boolean
  publishedAt: string
  searchData: string
}

export type Store = { id: string; name: string; baseUrl: string }

// Live affiliate stores aggregated by Legal-Leaf Market.
// Names MUST match the `storeName` produced by the aggregator so the store filter works.
export const STORES: Store[] = [
  { id: "thcasmallbuds", name: "THCA Small Buds", baseUrl: "https://thcasmallbuds.com" },
  { id: "thcaking", name: "THCA King", baseUrl: "https://thcaking.com" },
  { id: "blacktiecbd", name: "Black Tie CBD", baseUrl: "https://www.blacktiecbd.net" },
  { id: "thca4cheap", name: "THCA4Cheap", baseUrl: "https://thca4cheap.com" },
]

// Cannabinoid detection patterns. Each returns the number of matches in a body
// of text so we can score by signal strength instead of first-match-wins.
const CANNABINOID_PATTERNS: { key: Exclude<Cannabinoid, "other">; re: RegExp }[] = [
  { key: "d8", re: /delta[\s._-]*8|\bd-?8\b|δ8|∆8/gi },
  { key: "d9", re: /delta[\s._-]*9|\bd-?9\b|δ9|∆9/gi },
  { key: "thca", re: /\bthc[\s._-]*a\b|\bthca\b/gi },
  { key: "cbd", re: /\bcbd\b|\bcbg\b|\bcbn\b|\bcbc\b|full[\s-]*spectrum/gi },
]

function scoreCannabinoids(text: string): Record<string, number> {
  const scores: Record<string, number> = { d8: 0, d9: 0, thca: 0, cbd: 0 }
  for (const { key, re } of CANNABINOID_PATTERNS) {
    const m = text.match(re)
    scores[key] = m ? m.length : 0
  }
  return scores
}

// When scores tie, resolve by specificity: an explicit CBD/CBG title beats a
// generic THCA store's boilerplate, and delta variants beat bare THCA.
const CANNABINOID_PRIORITY: Exclude<Cannabinoid, "other">[] = ["d8", "d9", "cbd", "thca"]

function pickTop(scores: Record<string, number>): Cannabinoid | null {
  const max = Math.max(...Object.values(scores))
  if (max <= 0) return null
  const leaders = CANNABINOID_PRIORITY.filter((k) => scores[k] === max)
  return leaders[0] ?? null
}

/**
 * Classify a product into a cannabinoid bucket for the top filter tabs.
 *
 * The title is the source of truth: a product literally titled "CBD Hemp
 * Flower" must be CBD even if it is sold by a THCA-branded store whose
 * description mentions THCA repeatedly. We therefore score the title first and
 * only fall back to the description when the title carries no cannabinoid
 * signal at all.
 */
export function detectCannabinoid(title: string, extra = ""): Cannabinoid {
  const fromTitle = pickTop(scoreCannabinoids(title))
  if (fromTitle) return fromTitle
  const fromExtra = pickTop(scoreCannabinoids(extra))
  if (fromExtra) return fromExtra
  return "other"
}

/**
 * Parse the dominant cannabinoid potency (as a percentage) from product text.
 * We only trust a number that sits next to a cannabinoid keyword (THC/THCa/CBD/
 * "total cannabinoids"), in either order, so marketing lines like "20% off" are
 * ignored. The strongest plausible reading wins (a COA's headline total beats
 * the 0.3% delta-9 compliance line). Returns null when nothing lab-like is found.
 */
export function extractPotencyPct(text: string): number | null {
  if (!text) return null
  const t = String(text)
  const candidates: number[] = []
  const push = (s: string | undefined) => {
    if (!s) return
    const n = parseFloat(s)
    if (Number.isFinite(n) && n >= 5 && n <= 95) candidates.push(n)
  }
  // keyword → number, e.g. "THCa: 25.8%", "Total Cannabinoids 30%"
  const keywordFirst = /(?:total\s+)?(?:thc[\s._-]*a?|cannabinoids?|cbd)\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*%/gi
  // number → keyword, e.g. "25.8% THCa"
  const numberFirst = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:total\s+)?(?:thc[\s._-]*a?|cannabinoids?|cbd)/gi
  let m: RegExpExecArray | null
  while ((m = keywordFirst.exec(t))) push(m[1])
  while ((m = numberFirst.exec(t))) push(m[1])
  if (!candidates.length) return null
  return Math.round(Math.max(...candidates) * 10) / 10
}

/**
 * Potency-adjusted value: dollars per 100mg of active cannabinoid, given a
 * price-per-gram and a potency percentage. A gram at pct% holds pct*10 mg of
 * cannabinoid, so cost/100mg = ppg * 10 / pct. This is the honest apples-to-
 * apples number — a cheap $/g at low potency loses to a pricier, stronger gram.
 */
export function pricePer100mg(ppg: number | null, pct: number | null): number | null {
  if (!ppg || ppg <= 0 || !pct || pct <= 0) return null
  return (ppg * 10) / pct
}

/** The best potency-adjusted value ($/100mg) for a product, or null. */
export function productValuePer100mg(product: Product): number | null {
  return pricePer100mg(product.ppgFloat, product.potencyPct)
}

// Noise words/phrases that are NOT part of a strain name. Order matters:
// multi-word phrases are stripped before single words.
const STRAIN_NOISE = [
  // cannabinoids
  "thc-a", "thc a", "thca", "thcp", "thc-p", "thcv", "delta[\\s-]*8", "delta[\\s-]*9",
  "delta[\\s-]*10", "\\bd8\\b", "\\bd9\\b", "\\bd10\\b", "\\bhhc\\b", "\\bthc\\b",
  "\\bcbd\\b", "\\bcbg\\b", "\\bcbn\\b", "full[\\s-]*spectrum",
  // product forms
  "pre[\\s-]*rolls?", "prerolls?", "moon\\s*rocks?", "moonrocks?", "small\\s*buds?",
  "smalls?", "\\bbuds?\\b", "\\bflower\\b", "\\bjoints?\\b", "\\bblunts?\\b",
  "\\bvapes?\\b", "cartridges?", "\\bcarts?\\b", "disposables?", "gummies", "gummy",
  "edibles?", "chocolates?", "tinctures?", "concentrates?", "\\bdabs?\\b", "\\bwax\\b",
  "rosin", "\\bresin\\b", "shatter", "diamonds?", "\\bkief\\b", "\\bhash\\b",
  "cigarettes?", "\\bcigs?\\b",
  // descriptors / marketing
  "exotic", "premium", "top[\\s-]*shelf", "\\bindoor\\b", "\\boutdoor\\b",
  "greenhouse", "light[\\s-]*dep", "\\bhemp\\b", "\\blegal\\b", "organic", "\\bcraft\\b",
  "boutique", "\\bsale\\b", "\\bnew\\b", "\\bjar\\b", "\\bbag\\b", "\\bpack\\b",
  "wholesale", "\\bbulk\\b", "samples?", "\\bstrains?\\b", "\\bsativa\\b", "\\bindica\\b",
  "\\bhybrid\\b", "\\bshake\\b", "\\btrim\\b", "popcorn", "\\bvalue\\b", "\\bbudget\\b",
  "\\bhigh\\b", "\\bhighest\\b", "potent", "potency", "\\bpowerful\\b", "\\bquality\\b",
  "\\bluxury\\b", "\\bluxe\\b", "signature", "\\bfeatured\\b", "limited", "edition",
  "\\bspecial\\b", "clearance", "\\bloud\\b", "\\bheavy\\b", "\\bfrosty\\b", "\\bsticky\\b",
  "\\bbest\\b", "prices?", "deals?", "specials?", "sampler", "bundle", "combo",
  "mystery", "\\bmix\\b", "assorted", "variety", "\\blb\\b", "pounds?", "\\bqp\\b", "\\bhp\\b",
  "mediums?", "larges?", "\\bxl\\b", "\\bxxl\\b", "grade\\s*[ab]", "tier",
  "\\d+\\s*(?:pk|pack|count|ct)\\b", "\\bpks?\\b", "harvest", "batch", "\\bfresh\\b",
  "20\\d\\d", // stray years like 2025/2026
  // store product-line / tier tags that ride along on titles
  "\\bvex\\b", "\\bentry\\b", "\\bstandard\\b", "\\bst\\b", "\\bultra\\b", "\\bdeluxe\\b",
  "light\\s*assist", "\\bassist\\b", "\\bdomes?\\b", "bluntz", "\\bpremer\\b",
  "\\breserve\\b", "\\bspirit\\b", "\\bsignature\\b", "\\bclassic\\b", "\\bpro\\b",
  "\\bed\\b", "\\bcd\\b", // Edition / CD tier abbreviations
  // extract / infused forms (named by process, not strain)
  "\\bbadder\\b", "\\bbatter\\b", "\\bcaviar\\b", "\\bsauce\\b", "\\blive\\b",
  "\\bcured\\b", "\\binfused\\b", "\\bboost\\b", "\\bdistillate\\b", "\\bisolate\\b",
  "extracts?", "terpenes?", "\\bliquid\\b", "\\beach\\b", "\\brich\\b",
  "autoflowers?", "auto[\\s-]*flowering", "\\bseeds?\\b", "\\bclones?\\b",
  // wellness / mood product-line phrasing (edibles, tinctures, drink mixes)
  "for\\s+(?:chill|bliss|sleep|euphoria|relief|energy|focus|calm|relax(?:ation)?|social|recovery|de[\\s-]*stress|destress)",
  "\\bbalance\\b", "\\brelief\\b", "\\bwellness\\b", "\\bcalm\\b", "\\bfocus\\b",
  // full cannabinoid names on isolate/distillate products
  "tetrahydrocannabivarin", "cannabidiol", "cannabigerol", "cannabinol", "\\bpure\\b",
  // variant/option parsing leftovers
  "\\boption\\b", "variation", "\\bdefault\\b", "\\btitle\\b", "\\bwhoop\\b", "\\bchews?\\b",
  // weights / units
  "\\d+(?:\\.\\d+)?\\s*(?:g|grams?|mg|oz|ounces?|lbs?|pounds?)\\b", "\\bounces?\\b",
  "\\d+[/-]\\d+\\s*(?:oz|ounce|lb|pound)?", "eighths?", "quarter\\s*pound", "half\\s*pound",
]

const STRAIN_NOISE_RE = new RegExp(`\\b(?:${STRAIN_NOISE.join("|")})`, "gi")

// Non-strain merchandise/accessories: these products should never populate the
// strain list or trigger an AI strain lookup.
const NON_STRAIN_RE =
  /\b(t[\s-]*shirt|shirt|hoodie|apparel|sticker|vinyl|decal|hat|beanie|cap|mug|poster|merch|grinder|tray|ashtray|lighter|rolling\s*papers?|papers?|cones?|tube|mylar|bag|baggie|lanyard|keychain|pin|gift\s*card|e-?gift|voucher|membership|subscription|accessor)\b/i

// Non-flower consumables that are named by product/flavor, not by a cannabis
// strain (beverages, mushroom products, pure-cannabinoid extracts). They are
// still real products, but they should NEVER populate the strain filter — a
// "strain" here would just be marketing/flavor noise.
const NON_FLOWER_RE =
  /\b(seltzers?|sodas?|beverages?|cocktails?|mocktails?|syrups?|elixirs?|gatorade|mushrooms?|shrooms?|amanita|psilocybin|ashwagandha|ginseng|turmeric|passion\s*flower|passionflower|chamomile|valerian|melatonin|ginkgo|elderberry|ashwaganda|lions?\s*mane)\b/i

// Apparel / accessories / paraphernalia that are NOT consumable hemp products.
// Kept conservative so real flower/edibles/concentrates are never excluded.
const MERCH_TITLE_RE =
  /\b(t[\s-]*shirt|\btee\b|tees|shirt|hoodie|sweat\s*shirt|crew\s*neck|sweater|jacket|apparel|clothing|beanie|snapback|trucker\s*hat|\bhat\b|\bcap\b|socks|joggers|sweatpants|sticker|decal|\bvinyl\b|\bpin\b|patch|poster|banner|\bflag\b|\bmug\b|tumbler|koozie|coozie|lanyard|keychain|key\s*chain|tote|backpack|bottle\s*opener|grinder|rolling\s*tray|ash\s*tray|ashtray|lighter|\btorch\b|dab\s*tool|dabber|\bbanger\b|\bnail\b|\bpipe\b|\bbong\b|\brig\b|bubbler|glass\s*ware|hand\s*pipe|water\s*pipe|papers?\b|\bcone\b|\bcones\b|gift\s*card|e-?gift|\bmerch\b|merchandise|accessor(?:y|ies)|apparel)\b/i

// Store category / product_type values that clearly denote non-consumables.
const MERCH_CATEGORY_RE =
  /\b(apparel|clothing|merch|merchandise|accessor|gear|glass|smoke\s*ware|paraphernalia|gift\s*card|swag|lifestyle|hats?|shirts?)\b/i

// Non-consumable checkout add-ons: shipping insurance, package/route protection,
// warranties, donations, tips, etc. These pollute the cheapest sort and are not
// products the user wants to browse.
const ADDON_RE =
  /\b(package\s*protection|shipping\s*protection|shipping\s*insurance|package\s*insurance|route\s*(?:protection|insurance)|order\s*protection|delivery\s*(?:guarantee|insurance|protection)|protection\s*plan|insurance|warranty|donation|donate|round\s*up|\btip\b|tips|priority\s*(?:processing|shipping)|signature\s*(?:required|confirmation)|carbon\s*(?:offset|neutral))\b/i

/** True when a product is merch/accessory/add-on rather than a consumable hemp product. */
export function isMerchandise(title: string, category = ""): boolean {
  if (MERCH_TITLE_RE.test(title)) return true
  if (ADDON_RE.test(title)) return true
  if (category && (MERCH_CATEGORY_RE.test(category) || ADDON_RE.test(category))) return true
  return false
}

// Trim / shake / kief: the low-grade byproducts (loose leaf, broken bits, resin
// dust). They sell for a few dollars a gram, so they dominate any "best $/g"
// sort and drown out real buds — exactly the clog we want to be able to hide.
// Word-boundaried so real strains are safe: "Milkshake"/"Handshake" don't match
// \bshake\b, and "trimmed" doesn't match \btrim\b.
const TRIM_SHAKE_RE =
  /\b(trim|shake|kief|keef|sugar\s*leaf|sugar\s*trim|leaf\s*trim|popcorn\s*shake)\b/i

/** True when a product is trim/shake/kief rather than whole flower. */
export function isTrimOrShake(
  product: Pick<Product, "title" | "category">,
): boolean {
  if (TRIM_SHAKE_RE.test(product.title)) return true
  if (product.category && TRIM_SHAKE_RE.test(product.category)) return true
  return false
}

// Connective / filler words that should never begin or end a strain name.
// NOTE: "og" is intentionally NOT here — it is part of real strains like
// "OG Kush", "Fire OG", "Tahoe OG", so trimming it would corrupt names.
const STRAIN_STOPWORDS = new Set([
  "and", "the", "with", "by", "for", "of", "a", "an", "x", "in", "on", "to",
  "our", "your", "new", "aaa", "aaaa", "aa",
])

// When the ENTIRE cleaned result collapses to one of these, it isn't a real
// strain name — it's a bare color, marketing word, or parsing leftover. These
// are rejected so the strain filter only lists genuine strains. Multi-word
// strains that merely CONTAIN these words (e.g. "Blue Dream", "White Widow",
// "Pink Runtz") are unaffected because the check is on the whole result.
const GENERIC_STRAIN_REJECT = new Set([
  "pink", "white", "black", "blue", "green", "red", "purple", "gold", "silver",
  "cheap", "plant", "plus", "queen", "king", "royal", "elite", "designer",
  "insane", "crazy", "relief", "sleep", "chill", "shot", "drink", "gas",
  "candy", "dank", "mob", "piff", "wooey", "minis", "mini", "smalls", "small",
  "fire", "loud", "cake", "mix", "og", "kush", "order", "shot", "relief",
  "cat", "rich", "peach", "liquid", "pure", "balance", "chill", "bliss",
])

// Collapse a raw product title into a clean, human strain name. Cannabinoid,
// product-form, marketing, and weight noise are stripped, delimiter-separated
// descriptor tails are dropped, and leftover filler words are trimmed. Returns
// "" when nothing strain-like remains.
// Live store feeds (Shopify) frequently return HTML-encoded titles, e.g.
// "Pre-Roll &#8211; Sample" or "Rock &amp; Roll". Decode the common entities so
// titles render cleanly everywhere (card, dropdown, email) and strain parsing
// isn't polluted by leftovers like "8211". Framework-free (no DOM) so it is safe
// on the server.
export function decodeEntities(input: string): string {
  if (!input) return ""
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16))
      } catch {
        return " "
      }
    })
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n))
      } catch {
        return " "
      }
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractStrainName(rawTitle: string): string {
  if (!rawTitle) return ""
  if (NON_STRAIN_RE.test(rawTitle)) return ""
  if (NON_FLOWER_RE.test(rawTitle)) return ""

  // Normalize separators, then prefer the segment BEFORE the first descriptor
  // delimiter (" - ", "|", ",", ":") since strain names lead most titles.
  const normalized = String(rawTitle)
    .replace(/[–—]/g, "-")
    .replace(/[(){}\[\]]/g, " ")
  const segments = normalized.split(/\s*[-|,:]\s+|\s+[-|]\s*/).map((x) => x.trim()).filter(Boolean)

  const clean = (seg: string): string => {
    let s = seg
      .replace(/\d+(?:\.\d+)?\s*%/g, " ") // potency percentages
      .replace(STRAIN_NOISE_RE, " ")
      .replace(/[^a-zA-Z0-9'\s#-]/g, " ")
      .replace(/#\s*\d+/g, " ")
      .replace(/\b\d+(?:\.\d+)?\b/g, " ") // standalone numbers
      .replace(/\s*-\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    // Trim leading/trailing single letters and stopwords.
    let words = s.split(" ").filter(Boolean)
    while (words.length && (words[0].length < 2 || STRAIN_STOPWORDS.has(words[0].toLowerCase())))
      words.shift()
    while (
      words.length &&
      (words[words.length - 1].length < 2 || STRAIN_STOPWORDS.has(words[words.length - 1].toLowerCase()))
    )
      words.pop()
    return words.join(" ").trim()
  }

  // Use the first segment that yields a valid strain; fall back to the whole title.
  const candidates = [...segments, normalized]
  for (const cand of candidates) {
    const s = clean(cand)
    if (s.length < 3) continue
    const words = s.split(" ")
    if (words.length > 5) continue // long leftovers are descriptions, not strains
    if (!/[a-zA-Z]{2,}/.test(s)) continue
    if (words.every((w) => STRAIN_STOPWORDS.has(w.toLowerCase()))) continue
    // Reject bare colors / marketing words / parsing leftovers that aren't a
    // real strain on their own (multi-word strains containing them are fine).
    if (GENERIC_STRAIN_REJECT.has(s.toLowerCase())) continue
    // Title-case, but keep known all-caps acronyms uppercased.
    return s.replace(/\w\S*/g, (t) =>
      /^(gmo|gsc|mac|ak|og|thc)$/i.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(),
    )
  }
  return ""
}

// Lenient, DISPLAY-ONLY strain label. `extractStrainName` is deliberately strict
// so the strain FILTER only ever lists genuine strains; but on a product CARD we
// want EVERY consumable to surface a Strain Info button and to prefix its size
// dropdown with a name. This guarantees a non-empty label by:
//   1. using the strict strain when available (covers the vast majority),
//   2. else keeping generic/short single words the strict pass rejects
//      (e.g. "White", "Piff") after stripping form/marketing noise,
//   3. else falling back to the first title segment with only weights/symbols
//      removed (so even an oddball like "Pre-Roll – Sample" shows something).
// NEVER use this for filtering or cross-store grouping.
export function displayStrainName(rawTitle: string): string {
  const strict = extractStrainName(rawTitle)
  if (strict) return strict
  if (!rawTitle) return ""

  const titleCase = (s: string) =>
    s.replace(/\w\S*/g, (t) =>
      /^(gmo|gsc|mac|ak|og|thc|thca|cbd|piff)$/i.test(t)
        ? t.toUpperCase()
        : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(),
    )

  const normalized = String(rawTitle).replace(/[–—]/g, "-").replace(/[(){}\[\]]/g, " ")
  const segments = normalized
    .split(/\s*[-|,:]\s+|\s+[-|]\s*/)
    .map((x) => x.trim())
    .filter(Boolean)

  const lenientClean = (seg: string): string => {
    const s = seg
      .replace(/\d+(?:\.\d+)?\s*%/g, " ")
      .replace(STRAIN_NOISE_RE, " ")
      .replace(/[^a-zA-Z0-9'\s#-]/g, " ")
      .replace(/#\s*\d+/g, " ")
      .replace(/\b\d+(?:\.\d+)?\b/g, " ")
      .replace(/\s*-\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const words = s.split(" ").filter(Boolean)
    while (words.length && (words[0].length < 2 || STRAIN_STOPWORDS.has(words[0].toLowerCase())))
      words.shift()
    while (
      words.length &&
      (words[words.length - 1].length < 2 ||
        STRAIN_STOPWORDS.has(words[words.length - 1].toLowerCase()))
    )
      words.pop()
    return words.join(" ").trim()
  }

  // Unlike the strict pass, we keep short/generic leftovers (no reject list).
  for (const cand of [...segments, normalized]) {
    const s = lenientClean(cand)
    if (s.length >= 2 && s.split(" ").length <= 5 && /[a-zA-Z]{2,}/.test(s)) return titleCase(s)
  }

  // Last-ditch: first segment with only weights/percentages/symbols removed.
  const bare = (segments[0] || normalized)
    .replace(/\d+(?:\.\d+)?\s*%/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|grams?|mg|oz|ounces?|lbs?|pounds?)\b/gi, " ")
    .replace(/[^a-zA-Z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return bare ? titleCase(bare) : ""
}

const IMG = {
  thca: "/products/thca-flower.png",
  cbd: "/products/cbd-flower.png",
  d8: "/products/delta8-gummies.png",
  preroll: "/products/prerolls.png",
  concentrate: "/products/concentrate.png",
  d9: "/products/delta9-chocolate.png",
}

// Size in grams -> friendly label
export function sizeLabel(g: number | null): string {
  switch (g) {
    case 3.5:
      return "Eighth (3.5g)"
    case 7:
      return "Quarter (7g)"
    case 14:
      return "Half Oz (14g)"
    case 28:
      return "Ounce (28g)"
    case 112:
      return "QP (112g)"
    case 224:
      return "HP (224g)"
    case 448:
      return "Pound (448g)"
    default:
      return g ? `${g}g` : "Option"
  }
}

function flowerVariants(basePerGram: number, storeId: string): Variant[] {
  const sizes = [3.5, 7, 14, 28]
  return sizes.map((g, i) => ({
    title: sizeLabel(g),
    // give bigger sizes a better per-gram deal
    price: Math.round(g * basePerGram * (1 - i * 0.06) * 100) / 100,
    grams: g,
    available: !(storeId === "thca4cheap" && g === 3.5),
    variantId: `${storeId}-${g}`,
    optionLabel: sizeLabel(g),
    weighted: true,
  }))
}

function unitVariants(prices: { label: string; price: number }[], storeId: string): Variant[] {
  return prices.map((p, i) => ({
    title: p.label,
    price: p.price,
    grams: null,
    available: true,
    variantId: `${storeId}-u${i}`,
    optionLabel: p.label,
    weighted: false,
  }))
}

function ppgFrom(variants: Variant[]): { ppgFloat: number | null; ppgDisplay: string | null } {
  const withGrams = variants.filter((v) => v.grams && v.available)
  if (!withGrams.length) return { ppgFloat: null, ppgDisplay: null }
  const best = Math.min(...withGrams.map((v) => v.price / (v.grams as number)))
  return { ppgFloat: best, ppgDisplay: `$${best.toFixed(2)}/g` }
}

type Seed = {
  id: string
  title: string
  storeId: string
  category: string
  image: string
  cannabinoid: Cannabinoid
  tags: StrainTag[]
  variants: Variant[]
  isSoldOut?: boolean
  publishedAt: string
  // Advertised lab potency line, e.g. "Total THC 24.6%". Optional demo data so
  // sample mode still exercises the potency-adjusted value feature.
  potencyText?: string
}

function buildSeeds(): Seed[] {
  return [
    {
      id: "p1",
      title: "Blue Dream THCa Flower",
      storeId: "thcasmallbuds",
      category: "Flower",
      image: IMG.thca,
      cannabinoid: "thca",
      tags: ["Sativa", "Greenhouse"],
      variants: flowerVariants(8.5, "smallbuds"),
      publishedAt: "2025-07-14",
      potencyText: "Total THCa 22.4%",
    },
    {
      id: "p2",
      title: "Granddaddy Purple THCa Indoor",
      storeId: "thcaking",
      category: "Flower",
      image: IMG.thca,
      cannabinoid: "thca",
      tags: ["Indica", "Indoor"],
      variants: flowerVariants(11.0, "kings"),
      publishedAt: "2025-07-18",
      potencyText: "THCa 31.2%",
    },
    {
      id: "p3",
      title: "Wedding Cake THCa Premium",
      storeId: "blacktiecbd",
      category: "Flower",
      image: IMG.thca,
      cannabinoid: "thca",
      tags: ["Hybrid", "Indoor"],
      variants: flowerVariants(12.5, "blacktie"),
      publishedAt: "2025-07-10",
      potencyText: "Total THCa 28.9%",
    },
    {
      id: "p4s",
      title: "Mixed THCa Shake & Trim",
      storeId: "thca4cheap",
      category: "Flower",
      image: IMG.thca,
      cannabinoid: "thca",
      tags: ["Hybrid", "Greenhouse"],
      // Deliberately dirt-cheap $/g byproduct — exactly what "Hide Trim/Shake"
      // keeps out of the price-per-gram model so real buds aren't buried.
      variants: flowerVariants(2.5, "thca4cheap"),
      publishedAt: "2025-07-01",
      potencyText: "THCa 14.2%",
    },
    {
      id: "p4",
      title: "Sour Diesel THCa Budget Ounce",
      storeId: "thca4cheap",
      category: "Flower",
      image: IMG.thca,
      cannabinoid: "thca",
      tags: ["Sativa", "Greenhouse"],
      variants: flowerVariants(6.0, "thca4cheap"),
      publishedAt: "2025-07-02",
      potencyText: "THCa 17.8%",
    },
    {
      id: "p5",
      title: "Lifter CBD Hemp Flower",
      storeId: "blacktiecbd",
      category: "Flower",
      image: IMG.cbd,
      cannabinoid: "cbd",
      tags: ["Sativa", "Greenhouse"],
      variants: flowerVariants(5.5, "blacktie"),
      publishedAt: "2025-06-28",
    },
    {
      id: "p6",
      title: "Bubba Kush CBD Indoor",
      storeId: "thcasmallbuds",
      category: "Flower",
      image: IMG.cbd,
      cannabinoid: "cbd",
      tags: ["Indica", "Indoor"],
      variants: flowerVariants(7.0, "smallbuds"),
      publishedAt: "2025-07-05",
    },
    {
      id: "p7",
      title: "Delta-8 Watermelon Gummies 25mg",
      storeId: "thcaking",
      category: "Edibles",
      image: IMG.d8,
      cannabinoid: "d8",
      tags: ["Hybrid"],
      variants: unitVariants(
        [
          { label: "10-count", price: 19.99 },
          { label: "30-count", price: 44.99 },
          { label: "60-count", price: 79.99 },
        ],
        "kings",
      ),
      publishedAt: "2025-07-16",
    },
    {
      id: "p8",
      title: "Delta-8 Mixed Fruit Gummies",
      storeId: "thca4cheap",
      category: "Edibles",
      image: IMG.d8,
      cannabinoid: "d8",
      tags: ["Hybrid"],
      variants: unitVariants(
        [
          { label: "20-count", price: 24.99 },
          { label: "40-count", price: 39.99 },
        ],
        "thca4cheap",
      ),
      isSoldOut: true,
      publishedAt: "2025-06-20",
    },
    {
      id: "p9",
      title: "Delta-9 Dark Chocolate Bar 100mg",
      storeId: "blacktiecbd",
      category: "Edibles",
      image: IMG.d9,
      cannabinoid: "d9",
      tags: ["Hybrid"],
      variants: unitVariants(
        [
          { label: "Single bar", price: 15.0 },
          { label: "3-pack", price: 39.0 },
        ],
        "blacktie",
      ),
      publishedAt: "2025-07-19",
    },
    {
      id: "p10",
      title: "Pineapple Express Pre-Roll 5-Pack",
      storeId: "thcasmallbuds",
      category: "Pre-Rolls",
      image: IMG.preroll,
      cannabinoid: "thca",
      tags: ["Sativa", "Greenhouse"],
      variants: unitVariants(
        [
          { label: "5-pack", price: 29.99 },
          { label: "10-pack", price: 54.99 },
        ],
        "smallbuds",
      ),
      publishedAt: "2025-07-12",
    },
    {
      id: "p11",
      title: "Live Rosin Concentrate 1g",
      storeId: "thcaking",
      category: "Concentrates",
      image: IMG.concentrate,
      cannabinoid: "thca",
      tags: ["Hybrid", "Indoor"],
      variants: unitVariants(
        [
          { label: "1 gram", price: 34.99 },
          { label: "2 grams", price: 64.99 },
        ],
        "kings",
      ),
      publishedAt: "2025-07-17",
    },
    {
      id: "p12",
      title: "CBD Full-Spectrum Vape Cart",
      storeId: "blacktiecbd",
      category: "Concentrates",
      image: IMG.concentrate,
      cannabinoid: "cbd",
      tags: ["Hybrid"],
      variants: unitVariants(
        [
          { label: "0.5g cart", price: 24.99 },
          { label: "1g cart", price: 39.99 },
        ],
        "blacktie",
      ),
      publishedAt: "2025-06-30",
    },
  ]
}

// Seeded sample catalog. Used only as a last-resort fallback when the live
// aggregator returns nothing (e.g. all store feeds are unreachable).
export function getFallbackProducts(): Product[] {
  return buildSeeds().map((s) => {
    const store = STORES.find((st) => st.id === s.storeId) as Store
    const available = s.variants.filter((v) => v.available)
    const price = available.length ? Math.min(...available.map((v) => v.price)) : s.variants[0].price
    const { ppgFloat, ppgDisplay } = ppgFrom(s.variants)
    return {
      id: s.id,
      title: s.title,
      storeName: store.name,
      storeBaseUrl: store.baseUrl,
      storeType: "shopify",
      cartBaseUrl: store.baseUrl,
      nativeId: s.id,
      category: s.category,
      imageUrl: s.image,
      link: `${store.baseUrl}/products/${s.id}`,
      price,
      ppgFloat,
      ppgDisplay,
      potencyPct: extractPotencyPct(`${s.title} ${s.potencyText ?? ""}`),
      cannabinoid: s.cannabinoid,
      extractedTags: s.tags,
      strainName: extractStrainName(s.title),
      variants: s.variants,
      isSoldOut: !!s.isSoldOut,
      publishedAt: s.publishedAt,
      searchData: `${s.title} ${store.name} ${s.category} ${s.tags.join(" ")}`.toLowerCase(),
    }
  })
}

// Order subtotal (per store) at or above which shipping is estimated free.
export const FREE_SHIP_THRESHOLD = 100

// Flat per-store shipping rate used below the free-shipping threshold. These
// are Legal-Leaf estimates — each store charges its real rate at its own
// checkout — kept in one place so the card and cart agree.
export function storeShippingRate(storeName: string): number {
  const store = storeName.toLowerCase()
  if (store.includes("thca4cheap")) return 9.99
  if (store.includes("black tie")) return 8.99
  if (store.includes("small buds")) return 7.99
  if (store.includes("king")) return 7.99
  return 8.99
}

// Estimated shipping for a whole store order given its item subtotal.
export function storeShippingEstimate(storeName: string, subtotal: number): number {
  if (subtotal >= FREE_SHIP_THRESHOLD) return 0
  return storeShippingRate(storeName)
}

// Estimated shipping for a specific line-item price (free over the threshold).
export function variantShipping(product: Product, price: number): number {
  if (price >= FREE_SHIP_THRESHOLD) return 0
  return storeShippingRate(product.storeName)
}

export function getShippingEstimate(product: Product): number {
  return variantShipping(product, product.price)
}

// Out-the-door cost (discounted item + estimated shipping) for the product's
// base price. Reflects the DISCOUNT_CODE savings the shopper actually pays.
export function getBudgetTotal(product: Product): number {
  const net = discountedPrice(product.storeName, product.price)
  return net + variantShipping(product, net)
}

// Out-the-door cost (discounted item + estimated shipping) for a single variant.
export function variantBudgetTotal(product: Product, variant: Variant): number {
  const net = discountedPrice(product.storeName, variant.price)
  return net + variantShipping(product, net)
}

// Variants that satisfy the active minimum-quantity and budget constraints.
// A variant qualifies when it is available, meets the gram threshold (when set),
// and its landed cost fits the budget (when set). Sizes without gram data are
// excluded whenever a minimum quantity is requested.
export function qualifyingVariants(
  product: Product,
  minGrams: number,
  budget: number,
): Variant[] {
  return product.variants.filter((v) => {
    if (!v.available) return false
    if (minGrams > 0 && (v.grams == null || v.grams < minGrams)) return false
    if (budget > 0 && variantBudgetTotal(product, v) > budget) return false
    return true
  })
}
