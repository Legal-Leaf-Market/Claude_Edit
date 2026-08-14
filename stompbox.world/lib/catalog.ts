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
 * WHAT THE SLICE IS, AS OF THIS CHANGE. It is Gear Avail's own
 * /used/effects-pedals shelf, model by model: every pedal with at least one
 * LIVE listing behind it, most listed first. It used to be every pedal row
 * that had ever been ingested, ordered by price sample size, which meant this
 * site could open on pedals whose listings had all ended, ranked above ones
 * you could actually buy, under a heading that said "most listed first".
 *
 * WHY THE GUIDE STILL HAS NO PRICES IN IT. CLAUDE.md used to forbid a price
 * anywhere on this site, on the reasoning that an entry cannot say a pedal
 * sounds thin while quoting a price for it. That rule was lifted deliberately
 * (see CLAUDE.md section 2a), but only halfway: the catalogue is its own
 * layer, on its own route, with its own components, and `lib/pedals.ts` is
 * untouched. A circuit entry still carries no price, no merchant and no
 * artist, so the sentence that says a pedal sounds thin is still written by
 * somebody with nothing riding on it.
 *
 * HOUSE RULE 2 APPLIES HERE: NOTHING THROWS. Gear Avail being down, slow, or
 * misconfigured must degrade this site to the guide it already was, never to
 * an error page. Every failure path returns an empty catalogue with a reason.
 */

/**
 * Cache tag on the fetch below, so `/api/revalidate` can drop it the moment
 * Gear Avail redeploys rather than waiting out the fifteen minute window.
 * A page revalidate alone would re-render against a still-cached response.
 */
export const CATALOG_TAG = "gear-avail-catalog"

/** Which market a published median measures. New and used are never blended. */
export type PriceClass = "used" | "new"

export type CatalogPedal = {
  slug: string
  brand: string
  model: string
  imageUrl: string | null
  /** Null when the sample was too thin to mean anything. Print the reason, not a guess. */
  marketPriceCents: number | null
  /**
   * Which market `marketPriceCents` measures, null when there is no price.
   *
   * Load bearing rather than decoration: Gear Avail measures new and used
   * separately and falls back to the new median for gear only new retailers
   * stock. Printing that number under the words "typical used" would be this
   * site stating a fact its own source does not.
   */
  marketPriceClass: PriceClass | null
  /** Listings behind `marketPriceCents`, in its own class. */
  sampleSize: number
  /** Live listings on Gear Avail. At least 1: that is what puts a pedal here. */
  listingCount: number
  type: string
}

export type CatalogResult = {
  pedals: CatalogPedal[]
  /** Below this many listings in one class, Gear Avail withholds that median. */
  minSample: number
  /** Every pedal with live stock, not just the ones on this page of results. */
  total: number
  /** The Gear Avail page this slice comes from, absolute. */
  browseUrl: string
  /** Set when the catalogue could not be read. The page says so and shows the guide. */
  error: string | null
}

/**
 * Origin of the sister site, no trailing slash. Falls back to production for
 * the same reason SITE_URL does: an unset variable on a preview should still
 * point somewhere real rather than at localhost.
 */
export const GEAR_AVAIL_URL = (process.env.GEAR_AVAIL_URL || "https://gearavail.com").replace(
  /\/+$/,
  "",
)

/**
 * Where the catalogue comes from, used when the response does not say.
 * The endpoint sends its own path so that a route rename over there cannot
 * leave a dead link here, and this is the value from the day it was written.
 */
const DEFAULT_BROWSE_PATH = "/used/effects-pedals"

const EMPTY: CatalogResult = {
  pedals: [],
  /* Gear Avail's real floor (MIN_SAMPLE_SIZE), used only when the response
     omits it. It read 3 here for a while and the page printed that number in
     a sentence, which was this site stating a rule the sister site does not
     follow. */
  minSample: 5,
  total: 0,
  browseUrl: `${GEAR_AVAIL_URL}${DEFAULT_BROWSE_PATH}`,
  error: null,
}

/** The product page on Gear Avail, which is where buying actually happens. */
export function gearAvailProductUrl(slug: string): string {
  return `${GEAR_AVAIL_URL}/gear/${slug}`
}

/** The whole live pedal shelf on Gear Avail, for the rows that do not fit here. */
export function gearAvailPedalsUrl(): string {
  return `${GEAR_AVAIL_URL}${DEFAULT_BROWSE_PATH}`
}

/** How to label a median in one word, or null when there is nothing to label. */
export function marketPriceLabel(priceClass: PriceClass | null): string | null {
  if (priceClass === "used") return "typical used"
  if (priceClass === "new") return "typical new"
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function priceClassOf(raw: unknown): PriceClass | null {
  return raw === "used" || raw === "new" ? raw : null
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
  const marketPriceCents = typeof cents === "number" && Number.isFinite(cents) ? cents : null
  return {
    slug,
    brand,
    model,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    marketPriceCents,
    /* An older endpoint sends no class at all. Falling back to "used" would
       be a guess printed as a label, so an unlabelled price stays
       unlabelled and the card prints the number on its own. */
    marketPriceClass: marketPriceCents === null ? null : priceClassOf(raw.marketPriceClass),
    sampleSize: typeof raw.sampleSize === "number" ? raw.sampleSize : 0,
    listingCount: typeof raw.listingCount === "number" ? raw.listingCount : 0,
    type: typeof raw.type === "string" ? raw.type : "other",
  }
}

export async function fetchCatalog(limit = 120): Promise<CatalogResult> {
  const url = `${GEAR_AVAIL_URL}/api/catalog/pedals?limit=${encodeURIComponent(String(limit))}`
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      /* Fifteen minutes, matching the page that renders it. A longer window
         here would quietly win: the page can rebuild every fifteen minutes
         and still be handed an hour-old copy of this fetch, including an
         hour-old copy of a failure.
         The tag is the escape hatch from waiting out that window at all:
         /api/revalidate drops it when the sister site redeploys. */
      next: { revalidate: 900, tags: [CATALOG_TAG] },
    })
    if (!response.ok) {
      /* Read the reason out of the body when there is one. A 503 on its own
         reads as "the sister site is down", which is the wrong thing to go
         looking at when the real cause is a query that no longer matches the
         schema. That exact confusion nearly shipped: the first cut of the
         endpoint filtered on a column that does not exist, which would have
         thrown, been caught, and shown as a bare 503 forever. */
      const detail = await response
        .json()
        .then((body: unknown) =>
          isRecord(body) && typeof body.error === "string" ? body.error : null,
        )
        .catch(() => null)
      return {
        ...EMPTY,
        error: detail
          ? `Gear Avail returned ${response.status}: ${detail}`
          : `Gear Avail returned ${response.status}`,
      }
    }
    const body: unknown = await response.json()
    if (!isRecord(body) || !Array.isArray(body.pedals)) {
      return { ...EMPTY, error: "Unexpected response shape" }
    }
    const minSample = typeof body.minSample === "number" ? body.minSample : EMPTY.minSample
    const pedals = body.pedals.map(toPedal).filter((p): p is CatalogPedal => p !== null)
    const browsePath = typeof body.browsePath === "string" ? body.browsePath : DEFAULT_BROWSE_PATH
    return {
      pedals,
      minSample,
      /* A total below what actually arrived would print "showing 60 of 12",
         so the count in hand is the floor. */
      total: Math.max(typeof body.total === "number" ? body.total : 0, pedals.length),
      browseUrl: browsePath.startsWith("/")
        ? `${GEAR_AVAIL_URL}${browsePath}`
        : `${GEAR_AVAIL_URL}${DEFAULT_BROWSE_PATH}`,
      error: null,
    }
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
