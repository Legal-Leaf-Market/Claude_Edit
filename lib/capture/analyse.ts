import { PEDAL_MODELS } from "@/lib/board/pedal-models"
import type { CaptureResult, CapturedProduct } from "./extract"

/**
 * TURN A RAW CAPTURE INTO THE ANSWER TO "IS THIS WORTH CHASING".
 *
 * The extractor's job is to keep everything. This one's job is to whittle, and
 * keeping those two apart is the whole design: the capture file stays on disk
 * unchanged, so a question nobody thought to ask on the first pass can be asked
 * later without browsing forty pages again. That was the rework this tool
 * exists to stop.
 *
 * WHAT IT REPORTS, and each of these was chosen because it decides something:
 *
 *   HOW MANY, AND HOW MUCH OF THE WHOLE. A count on its own reads as a
 *   catalogue size when it is really a page size, so the claimed total and the
 *   pagination are reported beside it. A capture holding 24 of 1,180 is a
 *   sample, and calling it a catalogue is how a week goes into a category that
 *   turns out to be forty products.
 *
 *   WHICH BRANDS, BY WEIGHT. The single most useful number when deciding
 *   whether a merchant is worth a feed application. A retailer whose top twenty
 *   brands are all ones we already carry is not new inventory.
 *
 *   HOW MANY WE COULD ALREADY RENDER. The site has 89 measured 3D models and
 *   almost nothing in the live catalogue reaches them, which is the actual
 *   bottleneck on the board builder. So a capture is scored against
 *   `PEDAL_MODELS` directly: "this page carries 37 pedals we have already
 *   modelled" is a far better reason to chase a merchant than a product count.
 *
 *   WHAT THE PRICES LOOK LIKE. Median rather than mean, for the reason section
 *   8 gives about every other price on this site: one optimist with a vintage
 *   listing drags a mean somewhere useless.
 *
 * NOTHING HERE WRITES A LISTING. An analysis is research; turning a captured
 * row into a `marketplace_listings` row is redistribution, and section 2
 * decides that separately on the basis of a feed or a published permission.
 * The two are kept in different files so the second cannot happen by accident
 * while doing the first.
 */

export type BrandTally = { brand: string; count: number; share: number }

export type ModelMatch = {
  /** What the page called it. */
  captured: string
  /** What our model table calls it. */
  model: string
  maker: string
  url: string | null
  priceCents: number | null
}

export type CaptureAnalysis = {
  pageUrl: string
  origin: string
  platform: string | null
  capturedAt: string

  total: number
  /** Distinct by URL, since the extractors overlap on purpose. */
  distinct: number
  withPrice: number
  withIdentifier: number

  coverage: {
    claimedTotal: number | null
    /** What fraction of the claimed total this capture actually holds. */
    capturedShare: number | null
    morePages: boolean
    notes: string[]
  }

  brands: BrandTally[]
  priceCents: { min: number; median: number; max: number } | null

  /** The reason to chase this merchant, or not. */
  modelled: { count: number; matches: ModelMatch[] }

  /** One paragraph a person can act on. */
  verdict: string
}

/**
 * Merge several captures of the same site into one analysis.
 *
 * Paging through a category means one file per page, and analysing them singly
 * gives twelve answers to one question. Deduplicated by URL, because the
 * extractors deliberately overlap (a product page yields a JSON-LD record AND
 * an OpenGraph one) and because consecutive pages repeat a few cards.
 */
export function analyseCaptures(captures: CaptureResult[]): CaptureAnalysis {
  if (captures.length === 0) throw new Error("No captures to analyse.")

  const all: CapturedProduct[] = captures.flatMap((c) => c.products)

  /*
   * DEDUPE, PREFERRING THE RICHER RECORD. Two extractors finding one product
   * is the normal case, and the JSON-LD one carries a brand and an identifier
   * while the DOM one carries a name and a price scraped off a card. Keeping
   * whichever arrived first would throw away half the fields at random, so the
   * winner is the one with more of them filled in.
   */
  const score = (p: CapturedProduct): number =>
    [p.title, p.brand, p.priceCents, p.sku, p.gtin, p.mpn, p.imageUrl].filter(Boolean).length

  const byKey = new Map<string, CapturedProduct>()
  for (const product of all) {
    const key = product.url ?? `${product.title ?? ""}|${product.priceCents ?? ""}`
    const existing = byKey.get(key)
    if (!existing || score(product) > score(existing)) byKey.set(key, product)
  }
  const distinct = [...byKey.values()]

  /* ---- brands ---- */
  const brandCounts = new Map<string, number>()
  for (const product of distinct) {
    const brand = product.brand?.trim()
    if (!brand) continue
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1)
  }
  const brands: BrandTally[] = [...brandCounts.entries()]
    .map(([brand, count]) => ({ brand, count, share: count / distinct.length }))
    .sort((a, b) => b.count - a.count)

  /* ---- prices ---- */
  const prices = distinct
    .map((p) => p.priceCents)
    .filter((c): c is number => typeof c === "number" && c > 0)
    .sort((a, b) => a - b)
  const priceCents =
    prices.length === 0
      ? null
      : {
          min: prices[0],
          /* Median, for section 8's reason: one optimist ruins a mean. */
          median: prices[Math.floor(prices.length / 2)],
          max: prices[prices.length - 1],
        }

  /* ---- what we could already render ---- */
  /*
   * Matched with the model table's OWN patterns rather than a looser rule
   * invented here. Those patterns are deliberately narrow, and every
   * loosening of them in the past printed one pedal's name on another pedal's
   * body. A count that is too low is a fine error here; a count that is too
   * high would send somebody chasing a merchant for models it does not stock.
   *
   * The brand pattern is tried against the captured brand AND the title,
   * because a category page's cards usually put the maker in the product name
   * and carry no brand field at all.
   */
  const matches: ModelMatch[] = []
  for (const product of distinct) {
    const title = product.title ?? ""
    if (!title) continue

    /*
     * THE BRAND PATTERNS ARE ANCHORED (`/^boss$/i`), because they were written
     * to test a board item's `maker` field, which is exactly "Boss". Testing
     * one against a whole product title fails every time, and the fix is NOT
     * to unanchor them: CLAUDE.md is explicit that every past loosening of
     * these printed one pedal's name on another pedal's body.
     *
     * So candidates are offered to the pattern instead. A captured record
     * either carries an explicit brand, or the maker is the first word or two
     * of the title, which covers "Boss DS-1" and the two-word makers
     * ("Electro-Harmonix" is one word, but "Dallas Arbiter" and "Chase Bliss"
     * are not, and the Fuzz Face already went unmatched once for exactly that).
     */
    const words = title.split(/\s+/)
    const candidates = [product.brand, words[0], words.slice(0, 2).join(" ")].filter(
      (candidate): candidate is string => Boolean(candidate),
    )

    const model = PEDAL_MODELS.find(
      (entry) =>
        candidates.some((candidate) => entry.match.brand.test(candidate.trim())) &&
        entry.match.model.test(title),
    )
    if (!model) continue

    matches.push({
      captured: title,
      model: model.name,
      maker: model.maker,
      url: product.url,
      priceCents: product.priceCents,
    })
  }

  /* ---- coverage ---- */
  const claimedTotal = captures.reduce<number | null>(
    (max, c) => (c.coverage.claimedTotal == null ? max : Math.max(max ?? 0, c.coverage.claimedTotal)),
    null,
  )
  const morePages = captures.some((c) => Boolean(c.coverage.nextPageUrl) || c.coverage.pageLinks.length > 0)
  const notes = [...new Set(captures.flatMap((c) => c.coverage.notes))]

  const capturedShare = claimedTotal && claimedTotal > 0 ? distinct.length / claimedTotal : null

  /* ---- the paragraph ---- */
  const first = captures[0]
  const parts: string[] = []

  parts.push(
    `${distinct.length} distinct products across ${captures.length} capture${captures.length === 1 ? "" : "s"} of ${first.origin}.`,
  )

  if (capturedShare != null && capturedShare < 0.9) {
    parts.push(
      `THIS IS A SAMPLE, NOT THE CATALOGUE: the site claims ${claimedTotal} and this holds ${Math.round(capturedShare * 100)}% of that. Page through the rest before concluding anything about the range.`,
    )
  } else if (morePages) {
    parts.push("There is more paging available, so treat this as partial until it runs out.")
  }

  if (brands.length > 0) {
    const top = brands.slice(0, 5).map((b) => `${b.brand} (${b.count})`)
    parts.push(`Top brands: ${top.join(", ")}.`)
  } else {
    parts.push(
      "No brand field on any record, which is normal for a DOM capture off a custom platform. Brand has to come from the title instead.",
    )
  }

  if (priceCents) {
    const money = (c: number) => `$${(c / 100).toFixed(0)}`
    parts.push(
      `Prices ${money(priceCents.min)} to ${money(priceCents.max)}, median ${money(priceCents.median)}.`,
    )
  }

  parts.push(
    matches.length > 0
      ? `${matches.length} of these are pedals we already have measured 3D models for, which is the number worth acting on.`
      : "None of these match a measured 3D model, so this merchant would add catalogue but not fill the board builder.",
  )

  return {
    pageUrl: first.pageUrl,
    origin: first.origin,
    platform: first.platform,
    capturedAt: first.capturedAt,
    total: all.length,
    distinct: distinct.length,
    withPrice: prices.length,
    withIdentifier: distinct.filter((p) => p.gtin || p.mpn || p.sku).length,
    coverage: { claimedTotal, capturedShare, morePages, notes },
    brands,
    priceCents,
    modelled: { count: matches.length, matches: matches.slice(0, 200) },
    verdict: parts.join(" "),
  }
}
