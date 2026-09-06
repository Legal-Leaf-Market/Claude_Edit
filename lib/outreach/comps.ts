import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { MIN_SAMPLE_SIZE, median } from "@/lib/deals/pricing"
import { fetchSoldOrders, type SoldOrder } from "@/lib/reverb/orders"

/**
 * What is this pedal actually worth, and what is the evidence.
 *
 * The outreach tool computes three offers off one number per row, and until now
 * that number came from a hand-typed table of about eighty pedals. That table is
 * honest about being a ballpark and deliberately carries no figure for another
 * thirty, but it is still somebody's memory of a price, and the offers made from
 * it are real money offered to a real person.
 *
 * This answers the same question from evidence instead, and reports the evidence
 * alongside so a number can be judged rather than trusted.
 *
 * WHAT IT WILL NOT DO, and this is the whole design.
 *
 * It refuses to suggest a number it cannot support. MIN_SAMPLE_SIZE is the same
 * floor the public site uses: below it the site publishes no market price and
 * says so in words, and quoting a seller a figure drawn from two listings would
 * be that rule broken where it costs somebody money rather than a page view.
 * A row with nothing behind it comes back with a null suggestion and a sentence
 * saying which of the three sources was empty.
 *
 * It never suggests from the NEW median. New retail sits well above used, so a
 * used-gear buy offer computed off it would be inflated on every row, in the
 * direction that costs us. The new median is reported because it is useful
 * context for a boxed pedal, and it is never the suggestion.
 *
 * OUR OWN SALES OUTRANK THE CATALOGUE, and the reason is what each one measures.
 * The catalogue holds ASKING prices: what sellers hope for. Our Reverb order
 * history holds what somebody actually paid us, in our own channel, for that
 * exact pedal. For deciding what to pay for one, a real sale beats a hopeful ask
 * every time. Reading our own shop's orders is the section 2 carve-out, not an
 * exception to it: it is our shop, our token, and nothing here writes anywhere.
 */

/** A median plus the sample it came from. The median is null below the floor. */
export type CompSample = {
  medianCents: number | null
  sampleSize: number
}

export type CompSource = "our-sales" | "catalogue-used" | "none"

export type Comp = {
  /** Echoed back so the caller can line results up with the rows it sent. */
  brand: string
  model: string
  /** The canonical row we matched, so a wrong match is visible rather than silent. */
  matchedAs: string | null
  slug: string | null
  used: CompSample
  fresh: CompSample
  live: { count: number; lowCents: number | null; highCents: number | null }
  ourSales: { count: number; medianCents: number | null; lastSoldAt: string | null }
  suggestedCents: number | null
  source: CompSource
  /** In words, what the suggestion rests on, or why there is not one. */
  basis: string
}

export type CompsResult = {
  comps: Comp[]
  /** Whether our own Reverb order history was readable this run, and why not. */
  salesNote: string
}

/** A sale is a data point; two is the least that can be called a pattern. */
const MIN_OWN_SALES = 2

type GearRow = {
  id: string
  slug: string
  brand: string
  model: string
  avg_used_price_cents: number | null
  price_sample_size: number
  avg_new_price_cents: number | null
  new_price_sample_size: number
  live_count: number
  low_cents: number | null
  high_cents: number | null
}

/**
 * Find the canonical row for each name, brand-scoped.
 *
 * Scoped to the brand for the same reason resolve.ts scopes MPN and fuzzy
 * matching to it: "Standard" under Gibson and "Standard" under Squier are
 * instruments an order of magnitude apart in price, and here that error would
 * come out as an offer.
 *
 * NOT scoped to Effects Pedals, unlike matchPedalsByName in the planner. A
 * seller's lot routinely has an amp or a tuner in it, and answering "no data"
 * for the amp because the query only looks at pedals would be a silent miss on
 * the most valuable row.
 */
async function matchGear(rows: { brand: string; model: string }[]): Promise<GearRow[]> {
  const named = rows.filter((r) => fullName(r))
  if (named.length === 0) return []

  const conditions = named.map((r) => {
    const brand = r.brand.trim()
    const model = r.model.trim()
    // Both columns filled: scope to the brand, as above.
    if (brand && model) {
      return sql`(g.brand ILIKE ${`%${brand}%`} AND g.model ILIKE ${`%${model}%`})`
    }
    // Only one filled, which happens whenever the listing parser did not
    // recognise the brand and dropped the whole name into the model column.
    // Matching the combined name is what stops "Yamaha P-125" reporting no
    // catalogue match while the gear sits right there. Not a merge decision,
    // so the looser test is safe: the row prints what it matched and a person
    // reads it.
    return sql`((g.brand || ' ' || g.model) ILIKE ${`%${fullName(r)}%`})`
  })

  const result = await db.execute<GearRow>(sql`
    SELECT
      g.id, g.slug, g.brand, g.model,
      g.avg_used_price_cents, g.price_sample_size,
      g.avg_new_price_cents, g.new_price_sample_size,
      COALESCE(l.live_count, 0)::int AS live_count,
      l.low_cents, l.high_cents
    FROM canonical_gear g
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS live_count,
             MIN(price_cents)::int AS low_cents,
             MAX(price_cents)::int AS high_cents
      FROM marketplace_listings ml
      WHERE ml.canonical_gear_id = g.id
        AND ml.listing_status = 'active'
    ) l ON TRUE
    WHERE ${sql.join(conditions, sql` OR `)}
    ORDER BY g.price_sample_size DESC, g.new_price_sample_size DESC
  `)

  return result.rows
}

/** Whatever the two columns amount to, as one string. */
function fullName(row: { brand: string; model: string }): string {
  return `${row.brand.trim()} ${row.model.trim()}`.trim()
}

/** The same containment test the planner's matcher uses, both directions. */
function bestMatch(row: { brand: string; model: string }, candidates: GearRow[]): GearRow | null {
  const brand = row.brand.trim().toLowerCase()
  const model = row.model.trim().toLowerCase()
  if (!fullName(row)) return null

  if (brand && model) {
    return (
      candidates.find((c) => {
        const cb = c.brand.toLowerCase()
        const cm = c.model.toLowerCase()
        return cb.includes(brand) && (cm.includes(model) || model.includes(cm))
      }) ?? null
    )
  }

  const typed = fullName(row).toLowerCase()
  return (
    candidates.find((c) => `${c.brand} ${c.model}`.toLowerCase().includes(typed)) ?? null
  )
}

/**
 * Our own sold orders for one pedal.
 *
 * Matched on the order title, which is our own listing title and therefore
 * usually says the brand and the model plainly. Both words must appear: a
 * title-contains-model test alone would match "Boss DS-1" against an MXR
 * listing that mentioned a DS-1 in its description of the sound.
 */
function ownSales(row: { brand: string; model: string }, orders: SoldOrder[]) {
  const words = fullName(row).toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { count: 0, medianCents: null, lastSoldAt: null }

  // Every word has to appear. A title-contains-model test alone would match
  // "DS-1" against an MXR listing that mentioned one in its description.
  const hits = orders.filter((o) => {
    const t = o.title.toLowerCase()
    return o.soldCents != null && words.every((w) => t.includes(w))
  })

  const prices = hits.map((h) => h.soldCents!).filter((c) => c > 0)
  const dates = hits.map((h) => h.soldAt).filter((d): d is string => Boolean(d)).sort()

  return {
    count: prices.length,
    medianCents: prices.length >= MIN_OWN_SALES ? median(prices) : null,
    lastSoldAt: dates.length ? dates[dates.length - 1] : null,
  }
}

function describe(comp: Omit<Comp, "basis" | "suggestedCents" | "source">): {
  suggestedCents: number | null
  source: CompSource
  basis: string
} {
  if (comp.ourSales.medianCents != null) {
    return {
      suggestedCents: comp.ourSales.medianCents,
      source: "our-sales",
      basis: `Median of ${comp.ourSales.count} we actually sold on Reverb.`,
    }
  }
  if (comp.used.medianCents != null) {
    return {
      suggestedCents: comp.used.medianCents,
      source: "catalogue-used",
      basis: `Used median across ${comp.used.sampleSize} listings in the catalogue. Asking prices, not sold prices.`,
    }
  }

  // Everything below here is a refusal, and each one names what was missing so
  // it can be acted on rather than shrugged at.
  if (!comp.matchedAs) {
    return {
      suggestedCents: null,
      source: "none",
      basis: "Nothing in the catalogue matches this name. Price it by hand.",
    }
  }
  if (comp.ourSales.count === 1) {
    return {
      suggestedCents: null,
      source: "none",
      basis: "One past sale of our own and too few listings to publish a median. One sale is a data point, not a market. Price it by hand.",
    }
  }
  if (comp.used.sampleSize > 0) {
    return {
      suggestedCents: null,
      source: "none",
      basis: `Only ${comp.used.sampleSize} used listings, under the floor of ${MIN_SAMPLE_SIZE}. Price it by hand.`,
    }
  }
  if (comp.fresh.sampleSize > 0) {
    return {
      suggestedCents: null,
      source: "none",
      basis: "Matched, but every listing is new stock. A new median is the wrong number to buy a used pedal against. Price it by hand.",
    }
  }
  return {
    suggestedCents: null,
    source: "none",
    basis: "Matched, but no live listings and no price history yet. Price it by hand.",
  }
}

/**
 * Look up every row in one pass.
 *
 * One gear query and one orders fetch for the whole lot, rather than per row: a
 * twelve-pedal board would otherwise be twelve round trips to Reverb.
 */
export async function pullComps(rows: { brand: string; model: string }[]): Promise<CompsResult> {
  const candidates = await matchGear(rows)

  // Our own sold history is a bonus, never a requirement. An unconfigured or
  // failing Reverb token must leave the catalogue half working rather than
  // failing the whole lookup.
  let orders: SoldOrder[] = []
  let salesNote = ""
  try {
    const result = await fetchSoldOrders()
    if (result.ok) {
      orders = result.orders
      salesNote = `${orders.length} past sales read from our Reverb shop.`
    } else {
      salesNote = `Our own sales were not readable: ${result.reason}`
    }
  } catch {
    salesNote = "Our own sales were not readable this run."
  }

  const comps = rows.map((row) => {
    const gear = bestMatch(row, candidates)
    const partial = {
      brand: row.brand,
      model: row.model,
      matchedAs: gear ? `${gear.brand} ${gear.model}` : null,
      slug: gear?.slug ?? null,
      used: {
        medianCents: gear?.avg_used_price_cents ?? null,
        sampleSize: gear?.price_sample_size ?? 0,
      },
      fresh: {
        medianCents: gear?.avg_new_price_cents ?? null,
        sampleSize: gear?.new_price_sample_size ?? 0,
      },
      live: {
        count: gear?.live_count ?? 0,
        lowCents: gear?.low_cents ?? null,
        highCents: gear?.high_cents ?? null,
      },
      ourSales: ownSales(row, orders),
    }
    return { ...partial, ...describe(partial) }
  })

  return { comps, salesNote }
}
