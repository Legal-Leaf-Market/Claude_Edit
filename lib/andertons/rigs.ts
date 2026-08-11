import { matchPedalsByName, pedalBoardDetails, type PedalBoardEntry } from "@/lib/pedalboard/queries"
import { rigChainOrder, type Rig, type RigPedal } from "@/lib/rigs"

/**
 * How much of a documented artist rig Anderton's actually stocks.
 *
 * WHY THIS IS A STORE PAGE AND NOT A SHOPPING LIST. The rigs dataset says what
 * was on a board during a documented era; the catalogue says what one merchant
 * has today. Crossing them answers the question a shopper actually arrives
 * with, "how far can I get towards this sound in one order", and it is the
 * only page on the site where a store and the editorial dataset meet.
 *
 * THE HONEST-GAP RULE. A slot Anderton's does not stock is SHOWN, greyed,
 * rather than dropped. Hiding it would quietly redraw somebody's signal chain
 * into whatever happened to be in stock, which is the same dishonesty as
 * hiding a listing a shopper cannot buy (section 15) performed on the rig
 * instead of the listing. The count says "9 of 13" and means it.
 *
 * COMMISSION IS NOT AN INPUT. Ordering is chain order, which is a fact about
 * signal flow, and nothing here reads the sixteen brands Anderton's pays 4% on
 * (section 1). A rig is not promoted because its pedals pay better.
 */

/** Anderton's own source key, as declared in lib/stores.ts. */
export const ANDERTONS: string = "andertons"

export type AndertonsSlot = {
  brand: string
  model: string
  /** What the pedal was doing on the board, straight from the rigs dataset. */
  role: string
  signature: boolean
  /** True for amps and guitars, which are on the board but are not pedals. */
  notPedal: boolean
  /** Canonical gear slug, when the catalogue has this pedal at all. */
  gearSlug: string | null
  /** Anderton's cheapest live listing, new preferred: they are a new retailer. */
  priceCents: number | null
  /** The listing id behind that price, so the link can go through /go. */
  listingId: string | null
  inStock: boolean
}

export type RigCoverage = {
  rig: Rig
  slots: AndertonsSlot[]
  /** Slots Anderton's has live, out of the pedals we could look for. */
  stocked: number
  /** Pedal slots considered. Amps and guitars are excluded from the ratio. */
  total: number
  /** Sum of the stocked slots only, so it never implies a complete board. */
  subtotalCents: number | null
  complete: boolean
}

function pedalSlots(rig: Rig): RigPedal[] {
  return rigChainOrder(rig)
}

/**
 * Cheapest Anderton's price for one catalogue entry, new before used.
 *
 * New first because Anderton's is a new-retail feed: a used row there is
 * either an ex-demo or a mis-normalised condition, and quoting it as the
 * headline price would advertise something the shopper probably cannot get.
 * Falling back to used rather than showing nothing keeps the ex-demo visible.
 */
function andertonsPrice(entry: PedalBoardEntry | undefined): {
  priceCents: number | null
  listingId: string | null
} {
  const availability = entry?.bySource.find((s) => s.source === ANDERTONS)
  if (!availability || availability.count === 0) return { priceCents: null, listingId: null }

  const priceCents = availability.cheapestNewCents ?? availability.cheapestUsedCents ?? null
  return { priceCents, listingId: availability.cheapestListingId }
}

/**
 * Cross one rig against the catalogue.
 *
 * Two queries rather than one because they answer different questions:
 * `matchPedalsByName` turns "Ibanez / TS9 Tube Screamer" into a canonical
 * slug, and `pedalBoardDetails` turns slugs into live per-store availability.
 * Both are the same functions the rig detail page and the planner already use,
 * so this page cannot drift from them.
 */
export async function andertonsRigCoverage(rig: Rig): Promise<RigCoverage> {
  const slots = pedalSlots(rig)
  const lookups = slots.filter((p) => !p.notPedal)

  const matches = await matchPedalsByName(lookups.map((p) => ({ brand: p.brand, model: p.model }))).catch(() => [])
  const bySlot = new Map<string, string | null>()
  lookups.forEach((pedal, index) => {
    bySlot.set(`${pedal.brand}|${pedal.model}`, matches[index]?.matched?.slug ?? null)
  })

  const gearSlugs = [...new Set([...bySlot.values()].filter((s): s is string => Boolean(s)))]
  const details = await pedalBoardDetails(gearSlugs).catch(() => [])
  const detailBySlug = new Map(details.map((d) => [d.slug, d]))

  const resolved: AndertonsSlot[] = slots.map((pedal) => {
    const gearSlug = pedal.notPedal ? null : (bySlot.get(`${pedal.brand}|${pedal.model}`) ?? null)
    const { priceCents, listingId } = andertonsPrice(gearSlug ? detailBySlug.get(gearSlug) : undefined)

    return {
      brand: pedal.brand,
      model: pedal.model,
      role: pedal.role,
      signature: Boolean(pedal.signature),
      notPedal: Boolean(pedal.notPedal),
      gearSlug,
      priceCents,
      listingId,
      inStock: priceCents != null,
    }
  })

  const counted = resolved.filter((s) => !s.notPedal)
  const stockedSlots = counted.filter((s) => s.inStock)
  /*
   * The subtotal covers the stocked slots ONLY, and the copy beside it has to
   * say so. Presenting it as the price of the rig would quote a board that
   * cannot be bought, which is the same failure as publishing a market price
   * from two listings (section 8): a number that reads like a measurement and
   * is not one.
   */
  const subtotalCents = stockedSlots.length
    ? stockedSlots.reduce((sum, s) => sum + (s.priceCents ?? 0), 0)
    : null

  return {
    rig,
    slots: resolved,
    stocked: stockedSlots.length,
    total: counted.length,
    subtotalCents,
    complete: counted.length > 0 && stockedSlots.length === counted.length,
  }
}

/**
 * Coverage for many rigs, ranked by how much of each Anderton's can supply.
 *
 * Ranked by proportion rather than raw count so a four-pedal board that is
 * fully stocked outranks a sixteen-pedal one that is half there, which is the
 * order a shopper deciding what to build actually wants.
 */
export async function andertonsRigCoverages(rigs: Rig[]): Promise<RigCoverage[]> {
  const coverages = await Promise.all(rigs.map((rig) => andertonsRigCoverage(rig)))

  return coverages.sort((a, b) => {
    const ratio = (c: RigCoverage) => (c.total === 0 ? 0 : c.stocked / c.total)
    return ratio(b) - ratio(a) || b.stocked - a.stocked || a.rig.name.localeCompare(b.rig.name)
  })
}
