import { env } from "@/lib/env"

/**
 * Reverb's price guide: what a pedal actually SOLD for.
 *
 * WHY THIS IS NOT THE THING SECTION 2 FORBIDS, and the distinction is the whole
 * reason the file is allowed to exist.
 *
 * Section 2 bans the Reverb API for BUILDING THE CATALOGUE, and the term it
 * quotes is the use of API or member data "with a third-party advertising or
 * marketing platform, whether or not aggregated". Aggregating their listings
 * into marketplace_listings and publishing them on gearavail.com is exactly
 * that, and reverb-awin.ts exists so it never happens.
 *
 * This does none of it. It answers one question, for one person, at the moment
 * they are deciding what to offer somebody for their pedals, and the answer is
 * thrown away when the request ends. Four properties hold that shape, and each
 * is structural rather than a promise:
 *
 *   1. It is reachable only from /api/admin/outreach/comps, behind the admin
 *      passcode. There is no public caller and no cron.
 *   2. It writes nothing. This module holds no database import at all, and
 *      there is a test asserting that.
 *   3. Nothing it returns reaches marketplace_listings, a canonical row, a
 *      median, a deal badge, a search index or any public page. It reaches a
 *      number in an operator's browser.
 *   4. It is OFF unless REVERB_PRICE_GUIDE is set, so the decision can be
 *      withdrawn in one environment variable without a deploy.
 *
 * That is the same shape as the shop reader's carve-out rather than a second
 * exception to the rule: read for ourselves, never republished.
 *
 * IT IS ALSO THE ONLY SOURCE HERE THAT MEASURES SOLD PRICES. The catalogue
 * holds asking prices, which is what sellers hope for. For deciding what to pay
 * for a pedal, what one actually changed hands for is the better number, and
 * offering somebody money off a hopeful ask is how a lot gets overpaid for.
 *
 * ON THE ENDPOINTS. Reverb publishes a price guide and this is the documented
 * partner shape for it, but the exact path and field names could not be
 * verified from here without a live token. So this follows the pattern
 * shop.ts earned the hard way: a list of candidates tried in order, fields
 * bound by NAMED ALTERNATIVES rather than one guess, and the first raw object
 * carried back for the admin diagnostic. A wrong field bound silently is how
 * the shop page once advertised prices the shop was not asking.
 */

export type PriceGuideHit = {
  /** What Reverb calls the thing we matched, so a wrong match is visible. */
  title: string
  lowCents: number | null
  highCents: number | null
  /** Midpoint of the range, which is the single number an offer computes from. */
  midCents: number | null
  currency: string
}

export type PriceGuideResult =
  | { ok: true; hit: PriceGuideHit | null; source: string; raw?: Record<string, unknown> }
  | { ok: false; reason: string }

const ENDPOINTS = (query: string) => [
  `https://api.reverb.com/api/priceguide?query=${encodeURIComponent(query)}&per_page=5`,
  `https://api.reverb.com/api/price_guides?query=${encodeURIComponent(query)}&per_page=5`,
]

/** Reverb reports money as an object with cents on it. Cents is the only
 *  field worth doing arithmetic in. */
function cents(value: unknown): number | null {
  if (!value || typeof value !== "object") return null
  const money = value as Record<string, unknown>
  if (typeof money.amount_cents === "number") return money.amount_cents
  if (typeof money.amount === "string") {
    const n = Number(money.amount)
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }
  return null
}

/** Walk named alternatives, first hit wins. Same reason orders.ts does it:
 *  the shape is not ours and one guess is how a page of zeroes ships. */
function pickMoney(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const found = cents(raw[key])
    if (found !== null) return found
  }
  return null
}

function normalize(raw: Record<string, unknown>): PriceGuideHit | null {
  const estimate = (raw.estimated_value ?? raw.price_guide ?? raw) as Record<string, unknown>
  const lowCents = pickMoney(estimate, ["price_low", "low", "price_low_cents", "min"])
  const highCents = pickMoney(estimate, ["price_high", "high", "price_high_cents", "max"])
  if (lowCents === null && highCents === null) return null

  const title =
    typeof raw.title === "string"
      ? raw.title
      : typeof raw.name === "string"
        ? raw.name
        : "Reverb price guide"

  const midCents =
    lowCents !== null && highCents !== null
      ? Math.round((lowCents + highCents) / 2)
      : (lowCents ?? highCents)

  const currency = typeof estimate.currency === "string" ? estimate.currency : "USD"

  return { title: title.slice(0, 200), lowCents, highCents, midCents, currency }
}

/**
 * Look one pedal up.
 *
 * Never throws. Every failure comes back as a reason, because this is one
 * optional source inside a lookup that has two others, and a Reverb outage must
 * not take the catalogue half of the comps down with it.
 */
export async function fetchPriceGuide(query: string): Promise<PriceGuideResult> {
  if (!env.reverbShop.priceGuide) {
    return { ok: false, reason: "REVERB_PRICE_GUIDE is not set" }
  }
  const token = env.reverbShop.token
  if (!token) return { ok: false, reason: "REVERB_SHOP_TOKEN is not set" }

  const term = query.trim()
  if (!term) return { ok: true, hit: null, source: "no query" }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/hal+json",
    "Content-Type": "application/hal+json",
    "Accept-Version": "3.0",
  }

  const failures: string[] = []
  for (const url of ENDPOINTS(term)) {
    try {
      const res = await fetch(url, { headers, next: { revalidate: 3600 } })
      if (!res.ok) {
        /* The status only. A body can echo the request back, and the request
           carries the bearer token. */
        failures.push(`${new URL(url).pathname} -> ${res.status}`)
        continue
      }
      const body = (await res.json()) as Record<string, unknown>
      const rows = (Array.isArray(body.price_guides)
        ? body.price_guides
        : Array.isArray(body.priceguides)
          ? body.priceguides
          : Array.isArray(body.results)
            ? body.results
            : []) as Record<string, unknown>[]

      for (const row of rows) {
        const hit = normalize(row)
        if (hit) {
          return { ok: true, hit, source: new URL(url).pathname, raw: rows[0] }
        }
      }
      failures.push(`${new URL(url).pathname} -> 200, no usable estimate`)
    } catch (error) {
      failures.push(`${new URL(url).pathname} -> ${(error as Error).message}`)
    }
  }
  return { ok: false, reason: failures.join("; ") || "no endpoint answered" }
}
