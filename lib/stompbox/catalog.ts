import { countLiveModels, headlinePrice, liveModels } from "@/lib/catalog/live-models"
import { categoryFromSlug } from "@/lib/categories"
import { MIN_SAMPLE_SIZE } from "@/lib/deals/pricing"
import { inferEffectType } from "@/lib/pedalboard/chain"

/**
 * The pedal slice of the Gear Avail catalogue, read in process.
 *
 * THIS USED TO BE AN HTTP FETCH, AND THE MERGE IS WHY IT IS NOT.
 *
 * stompbox.world was its own Vercel project with no database and no
 * credentials, so it read the published slice from `/api/catalog/pedals` over
 * the wire. That boundary bought something real and it cost something real,
 * and the cost is worth writing down because it is the bug the merge deletes:
 * both projects built from the same commit at the same time, and the guide
 * prerendered its catalogue page by fetching an endpoint belonging to the
 * deployment being replaced. A commit touching both raced itself and shipped
 * the PREVIOUS version's numbers on the other domain, where nothing in either
 * repository would show it. CLAUDE.md section 20 records that happening, and
 * `/api/revalidate` plus a Vercel webhook existed only to narrow the window.
 *
 * One deployment cannot race itself. The fetch, the cache tag, the webhook and
 * the fifteen-minute self-healing window are all gone, and this module calls
 * the same `liveModels()` the aggregator's own `/used/effects-pedals` page
 * calls. Section 7's rule, "never fork the logic", now holds by construction
 * rather than by two files agreeing to stay in step.
 *
 * WHAT THE CREDENTIAL BOUNDARY BECAME. It was physical: a separate project
 * could not reach the database because it had no connection string. It is now
 * a rule this file is the only sanctioned crossing of, and `tests/stompbox/
 * boundary.test.ts` is what enforces it. Nothing else under `app/stompbox`,
 * `components/stompbox` or `lib/stompbox` may import ingestion, admin or
 * affiliate code. That is a genuine downgrade from physics to discipline, and
 * it was taken knowingly.
 *
 * WHAT IS STILL DELIBERATELY WITHHELD, AND WHY THE MERGE DOES NOT RELAX IT.
 * No merchant names, no deep links, no per-listing prices, the cheapest active
 * asking price included. `liveModels()` computes that price because the
 * aggregator's own pages print it; this projection drops it, exactly as the
 * HTTP endpoint did. The reason never had anything to do with the transport:
 * partner terms restrict redistributing feed rows, stompbox.world is still a
 * SECOND DOMAIN, and serving those rows there is the same act whether they
 * arrive over a socket or a function call. The medians are our own aggregate,
 * computed from listings we ingested, and are ours to publish. A reader who
 * wants to buy goes to `/gear/[slug]`, where attribution and click accounting
 * already work.
 *
 * NOTHING THROWS. A failure returns an empty catalogue with a reason and the
 * page renders the guide it already was. That rule outlived the transport: a
 * query that no longer matches the schema is now the likeliest cause, and the
 * page prints the reason rather than showing a bare error.
 */

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
   * Load bearing rather than decoration: new and used are measured separately
   * and the headline falls back to the new median for gear only new retailers
   * stock. Printing that number under the words "typical used" would be the
   * guide stating a fact its own source does not.
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
  /** Below this many listings in one class, no median is published for it. */
  minSample: number
  /** Every pedal with live stock, not just the ones on this page of results. */
  total: number
  /** The aggregator page this slice comes from. */
  browsePath: string
  /** Set when the catalogue could not be read. The page says so and shows the guide. */
  error: string | null
}

const PEDAL_SLUG = "effects-pedals"

/** Resolved through the same table `/used/[category]` uses, so they cannot drift. */
const PEDAL_CATEGORY = categoryFromSlug(PEDAL_SLUG) ?? "Effects Pedals"

/** The shelf these rows come from, and where the overflow link points. */
export const BROWSE_PATH = `/used/${PEDAL_SLUG}`

/**
 * Absolute origin of the aggregator, for links that must survive being
 * rendered on stompbox.world.
 *
 * Still absolute after the merge: the guide's own domain is a different origin
 * from `gearavail.com`, so a bare `/gear/big-muff` in a page served at
 * `stompbox.world` points at a route that does not exist there. Defaults to
 * production rather than localhost, for the same reason `SITE_URL` does.
 */
export const GEAR_AVAIL_URL = (
  process.env.GEAR_AVAIL_URL ||
  /* The aggregator's own origin, which is the same deployment. */
  process.env.SITE_URL ||
  "https://gearavail.com"
).replace(/\/+$/, "")

/** The product page on Gear Avail, which is where buying actually happens. */
export function gearAvailProductUrl(slug: string): string {
  return `${GEAR_AVAIL_URL}/gear/${slug}`
}

/** The whole live pedal shelf on Gear Avail, for the rows that do not fit here. */
export function gearAvailPedalsUrl(): string {
  return `${GEAR_AVAIL_URL}${BROWSE_PATH}`
}

/** How to label a median in one word, or null when there is nothing to label. */
export function marketPriceLabel(priceClass: PriceClass | null): string | null {
  if (priceClass === "used") return "typical used"
  if (priceClass === "new") return "typical new"
  return null
}

const EMPTY: CatalogResult = {
  pedals: [],
  minSample: MIN_SAMPLE_SIZE,
  total: 0,
  browsePath: BROWSE_PATH,
  error: null,
}

export async function fetchCatalog(limit = 120): Promise<CatalogResult> {
  const query = { category: PEDAL_CATEGORY }

  try {
    const [models, total] = await Promise.all([
      liveModels({ ...query, limit }),
      countLiveModels(query),
    ])

    const pedals: CatalogPedal[] = models.map((model) => {
      const headline = headlinePrice(model)
      return {
        slug: model.slug,
        brand: model.brand,
        model: model.model,
        imageUrl: model.imageUrl,
        marketPriceCents: headline.cents,
        marketPriceClass: headline.cents === null ? null : headline.basis,
        sampleSize: headline.sampleSize,
        listingCount: model.listingCount,
        type: inferEffectType(model.brand, model.model, PEDAL_CATEGORY),
      }
    })

    return {
      pedals,
      minSample: MIN_SAMPLE_SIZE,
      /* A total below what actually arrived would print "showing 60 of 12",
         so the count in hand is the floor. */
      total: Math.max(total, pedals.length),
      browsePath: BROWSE_PATH,
      error: null,
    }
  } catch (error) {
    return { ...EMPTY, error: error instanceof Error ? error.message : "Catalogue unreadable" }
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
