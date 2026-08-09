import { FREE_SHIP_THRESHOLD, type Product } from "./products"

// Every earnable badge. Order here defines display + filter priority.
export type BadgeId =
  | "pick"
  | "great-deal"
  | "bulk-value"
  | "new-drop"
  | "free-ship"
  | "top-shelf"
  | "low-stock"

export type BadgeMeta = {
  id: BadgeId
  label: string
  /** Solid chip styling (bg + text) for the colorful pill. */
  chipClass: string
  /** Small dot color used in the filter menu. */
  dotClass: string
  /** One-line explanation shown in the filter menu. */
  description: string
  /** Whether the chip renders in the card's badge row (low-stock has its own UI). */
  inRow: boolean
}

// Bright, high-energy palette (pinks / purples / blues) — intentionally louder
// than the core gold+lime brand so deal signals pop off the card.
export const BADGES: Record<BadgeId, BadgeMeta> = {
  pick: {
    id: "pick",
    label: "Legal-Leaf Pick",
    chipClass: "bg-gradient-to-r from-lime to-gold text-navy",
    dotClass: "bg-gradient-to-r from-lime to-gold",
    description: "Our top call: best $/g in its class, in stock, lab-tested.",
    inRow: true,
  },
  "great-deal": {
    id: "great-deal",
    label: "Great Deal",
    chipClass: "bg-[#ff2d87] text-white",
    dotClass: "bg-[#ff2d87]",
    description: "Priced 12%+ below the category average per gram.",
    inRow: true,
  },
  "bulk-value": {
    id: "bulk-value",
    label: "Bulk Value",
    chipClass: "bg-[#a855f7] text-white",
    dotClass: "bg-[#a855f7]",
    description: "Offers ounce+ sizes for stocking up.",
    inRow: true,
  },
  "new-drop": {
    id: "new-drop",
    label: "New Drop",
    chipClass: "bg-[#22d3ee] text-navy",
    dotClass: "bg-[#22d3ee]",
    description: "Freshly listed in the last two weeks.",
    inRow: true,
  },
  "free-ship": {
    id: "free-ship",
    label: "Free Shipping",
    chipClass: "bg-[#3b82f6] text-white",
    dotClass: "bg-[#3b82f6]",
    description: "Has a size that ships free.",
    inRow: true,
  },
  "top-shelf": {
    id: "top-shelf",
    label: "Top Shelf",
    chipClass: "bg-[#e11d8f] text-white",
    dotClass: "bg-[#e11d8f]",
    description: "Premium tier — priciest 15% of the market.",
    inRow: true,
  },
  "low-stock": {
    id: "low-stock",
    label: "Low Stock",
    chipClass: "bg-destructive text-navy",
    dotClass: "bg-destructive",
    description: "Only a couple of sizes left.",
    inRow: false,
  },
}

// Menu/filter order.
export const BADGE_ORDER: BadgeId[] = [
  "pick",
  "great-deal",
  "bulk-value",
  "new-drop",
  "free-ship",
  "top-shelf",
  "low-stock",
]

// Average price-per-gram keyed by cannabinoid+category, so we compare like with
// like. A bucket needs a few samples before we trust it.
export function computeAvgPpgByBucket(products: Product[]): Record<string, number> {
  const sums: Record<string, { total: number; n: number }> = {}
  for (const p of products) {
    if (p.isSoldOut || p.ppgFloat == null || p.ppgFloat <= 0) continue
    const key = `${p.cannabinoid}|${p.category}`
    const b = (sums[key] ??= { total: 0, n: 0 })
    b.total += p.ppgFloat
    b.n += 1
  }
  const avg: Record<string, number> = {}
  for (const [k, v] of Object.entries(sums)) if (v.n >= 4) avg[k] = v.total / v.n
  return avg
}

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

// Compute the full badge set for every product in one pass so the cards and the
// "Search by Badge" filter always agree.
export function computeProductBadges(products: Product[]): Map<string, BadgeId[]> {
  const avg = computeAvgPpgByBucket(products)

  // "Legal-Leaf Pick": lowest in-stock $/g per bucket, ≥10% under the average.
  const bestPerBucket: Record<string, { id: string; ppg: number }> = {}
  for (const p of products) {
    if (p.isSoldOut || p.ppgFloat == null || p.ppgFloat <= 0) continue
    const key = `${p.cannabinoid}|${p.category}`
    const cur = bestPerBucket[key]
    if (!cur || p.ppgFloat < cur.ppg) bestPerBucket[key] = { id: p.id, ppg: p.ppgFloat }
  }
  const pickIds = new Set<string>()
  for (const [key, b] of Object.entries(bestPerBucket)) {
    const a = avg[key]
    if (a && b.ppg <= a * 0.9) pickIds.add(b.id)
  }

  // "Top Shelf": priciest ~15% of the in-stock catalog.
  const prices = products
    .filter((p) => !p.isSoldOut && p.price > 0)
    .map((p) => p.price)
    .sort((a, b) => a - b)
  const premiumThreshold = prices.length ? prices[Math.floor(prices.length * 0.85)] : Infinity

  const now = Date.now()
  const map = new Map<string, BadgeId[]>()

  for (const p of products) {
    const badges: BadgeId[] = []
    if (p.isSoldOut) {
      map.set(p.id, badges)
      continue
    }

    if (pickIds.has(p.id)) badges.push("pick")

    const key = `${p.cannabinoid}|${p.category}`
    const a = avg[key]
    if (a && p.ppgFloat && p.ppgFloat < a && Math.round((1 - p.ppgFloat / a) * 100) >= 12)
      badges.push("great-deal")

    if (p.variants.some((v) => v.available && (v.grams ?? 0) >= 28)) badges.push("bulk-value")

    if (p.publishedAt && now - +new Date(p.publishedAt) <= FOURTEEN_DAYS) badges.push("new-drop")

    if (p.variants.some((v) => v.available && v.price >= FREE_SHIP_THRESHOLD))
      badges.push("free-ship")

    if (p.price >= premiumThreshold) badges.push("top-shelf")

    const availableCount = p.variants.filter((v) => v.available).length
    if (availableCount > 0 && availableCount <= 2) badges.push("low-stock")

    map.set(p.id, badges)
  }

  return map
}
