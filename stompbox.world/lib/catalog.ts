/**
 * The Gear Avail pedal catalogue, read over HTTP.
 *
 * WHY HTTP AND NOT A SHARED IMPORT OR A SECOND DATABASE CLIENT. This site is
 * a separate Vercel project and the thing that keeps it cheap to run and safe
 * to hand to anyone is that it holds no credentials. Gear Avail owns the
 * database, the ingestion and the definition of what a pedal is; this site
 * reads the published slice and renders it. One connection string, one
 * ingestion path, one taxonomy.
 *
 * WHAT CHANGED, AND WHY THE GUIDE STILL HAS NO PRICES IN IT. CLAUDE.md used
 * to forbid a price anywhere on this site, on the reasoning that an entry
 * cannot say a pedal sounds thin while quoting a price for it. That rule was
 * lifted deliberately (see CLAUDE.md section 2a), but only halfway: the
 * catalogue is its own layer, on its own route, with its own components, and
 * `lib/pedals.ts` is untouched. A circuit entry still carries no price, no
 * merchant and no artist, so the sentence that says a pedal sounds thin is
 * still written by somebody with nothing riding on it.
 *
 * HOUSE RULE 2 APPLIES HERE: NOTHING THROWS. Gear Avail being down, slow, or
 * misconfigured must degrade this site to the guide it already was, never to
 * an error page. Every failure path returns an empty catalogue with a reason.
 */

export type CatalogPedal = {
  slug: string
  brand: string
  model: string
  imageUrl: string | null
  /** Null when the sample was too thin to mean anything. Print the reason, not a guess. */
  marketPriceCents: number | null
  sampleSize: number
  listingCount: number
  type: string
}

export type CatalogResult = {
  pedals: CatalogPedal[]
  /** Below this many listings Gear Avail withholds a market price. */
  minSample: number
  /** Set when the catalogue could not be read. The page says so and shows the guide. */
  error: string | null
}

const EMPTY: CatalogResult = { pedals: [], minSample: 3, error: null }

/**
 * Origin of the sister site, no trailing slash. Falls back to production for
 * the same reason SITE_URL does: an unset variable on a preview should still
 * point somewhere real rather than at localhost.
 */
export const GEAR_AVAIL_URL = (process.env.GEAR_AVAIL_URL || "https://gearavail.com").replace(
  /\/+$/,
  "",
)

/** The product page on Gear Avail, which is where buying actually happens. */
export function gearAvailProductUrl(slug: string): string {
  return `${GEAR_AVAIL_URL}/gear/${slug}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Parse defensively. The two sites deploy independently, so this one can be
 * running against a version of the API older or newer than it expects, and a
 * missing field should drop a row rather than blank the page.
 */
function toPedal(raw: unknown): CatalogPedal | null {
  if (!isRecord(raw)) return null
  const { slug, brand, model } = raw
  if (typeof slug !== "string" || !slug) return null
  if (typeof brand !== "string" || typeof model !== "string") return null
  const cents = raw.marketPriceCents
  return {
    slug,
    brand,
    model,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    marketPriceCents: typeof cents === "number" && Number.isFinite(cents) ? cents : null,
    sampleSize: typeof raw.sampleSize === "number" ? raw.sampleSize : 0,
    listingCount: typeof raw.listingCount === "number" ? raw.listingCount : 0,
    type: typeof raw.type === "string" ? raw.type : "other",
  }
}

export async function fetchCatalog(limit = 60): Promise<CatalogResult> {
  const url = `${GEAR_AVAIL_URL}/api/catalog/pedals?limit=${encodeURIComponent(String(limit))}`
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      /* Rebuilt hourly rather than per request. The catalogue moves on an
         ingestion cron, not on a page view, and an hour-stale market price is
         worth more than a slow page. */
      next: { revalidate: 3600 },
    })
    if (!response.ok) {
      return { ...EMPTY, error: `Gear Avail returned ${response.status}` }
    }
    const body: unknown = await response.json()
    if (!isRecord(body) || !Array.isArray(body.pedals)) {
      return { ...EMPTY, error: "Unexpected response shape" }
    }
    const minSample = typeof body.minSample === "number" ? body.minSample : EMPTY.minSample
    const pedals = body.pedals.map(toPedal).filter((p): p is CatalogPedal => p !== null)
    return { pedals, minSample, error: null }
  } catch (error) {
    return { ...EMPTY, error: error instanceof Error ? error.message : "Catalogue unreachable" }
  }
}

/**
 * Money, from cents, with no fake precision.
 *
 * Whole dollars: a market price is an average of other people's asking prices
 * and printing it to the cent claims an accuracy it does not have.
 */
export function formatMarketPrice(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents) || cents <= 0) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
