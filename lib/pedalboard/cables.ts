import { rotatedFootprint, type Mm } from "./catalog/types"
import { PLUG_PROFILES, type LayoutItem, type Placement, type PlugProfile } from "./layout"

/**
 * The patch cables a board actually needs.
 *
 * Pedal Playground does not do this and neither does the Pedaltrain app. It
 * matters because patch cables are where a board quietly costs another eighty
 * pounds after you thought you had finished buying, and because the count is
 * not the obvious one: a nine-pedal board needs eight patches BETWEEN the
 * pedals plus a lead in and a lead out, and people buy a six-pack and come up
 * short.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not pretend to know where the
 * jacks are. Side-jack and top-jack pedals route completely differently, no
 * feed carries jack positions, and measuring from the wrong edge would produce
 * confident numbers that are wrong by 50mm. So every length here is derived
 * from the GAP BETWEEN PEDAL EDGES plus a routing allowance, and then rounded
 * UP to a length you can actually buy. Erring long is free (you dress the
 * slack under the board); erring short means another order.
 */

/** Patch lengths people actually sell, in mm. 6", 9", 12", 18", 24". */
export const STANDARD_PATCH_LENGTHS_MM = [152, 229, 305, 457, 610] as const

/**
 * Slack on top of the straight-line gap.
 *
 * A patch cable does not run point to point: it leaves the jack, turns, and
 * dresses along the rail. This allowance is what stops the plan recommending
 * a 6" cable for a 5" gap that in practice needs 9".
 */
const ROUTING_SLACK_MM = 60

export type PatchHop = {
  /** Slot key the signal leaves. */
  fromKey: string
  /** Slot key the signal arrives at. */
  toKey: string
  fromLabel: string
  toLabel: string
  /** Straight-line gap between the two footprints, edges not centres. */
  gapMm: Mm
  /** What to buy: the next standard length at or above gap plus slack. */
  recommendedMm: Mm
  /** True when the hop crosses rows, which needs a longer, dressed run. */
  crossesRow: boolean
}

export type CablePlan = {
  hops: PatchHop[]
  /** Patches between pedals. Always one fewer than the number of pedals. */
  patchCount: number
  /**
   * Total patches to buy, including the lead from the guitar and the lead to
   * the amp. Those two are usually full-size instrument cables rather than
   * patches, so they are counted separately and named.
   */
  instrumentLeads: number
  /** How many of each standard length, so it reads as a shopping list. */
  byLength: { lengthMm: Mm; count: number }[]
  plug: PlugProfile
  notes: string[]
}

function centre(item: LayoutItem, placement: Placement) {
  const { widthMm, depthMm } = rotatedFootprint(item, placement.rotation)
  return {
    x: placement.xMm + widthMm / 2,
    y: placement.yMm + depthMm / 2,
    w: widthMm,
    d: depthMm,
  }
}

/**
 * Edge-to-edge gap between two placed pedals.
 *
 * Centre distance minus half of each footprint along the dominant axis, which
 * approximates the gap a cable actually has to cross without pretending to
 * know which edge the jacks are on.
 */
function edgeGap(
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number },
): { gap: Mm; crossesRow: boolean } {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const horizontalGap = Math.max(0, dx - (a.w + b.w) / 2)
  const verticalGap = Math.max(0, dy - (a.d + b.d) / 2)
  // A hop counts as crossing rows when the vertical separation is the bigger
  // part of the journey, which is when a cable has to be dressed around
  // rather than run straight along a rail.
  const crossesRow = verticalGap > horizontalGap
  return { gap: Math.hypot(horizontalGap, verticalGap), crossesRow }
}

function nextStandardLength(mm: Mm): Mm {
  for (const length of STANDARD_PATCH_LENGTHS_MM) {
    if (length >= mm) return length
  }
  return STANDARD_PATCH_LENGTHS_MM[STANDARD_PATCH_LENGTHS_MM.length - 1]
}

/**
 * Plan the patching for a board.
 *
 * `chain` is in SIGNAL order, which is not necessarily left-to-right on the
 * board: that difference is exactly what makes a cable plan worth having,
 * since a chain that doubles back needs longer runs than its picture suggests.
 */
export function planCables(
  chain: LayoutItem[],
  placements: Placement[],
  plug: PlugProfile = "right",
): CablePlan {
  const byKey = new Map(placements.map((p) => [p.key, p]))
  const notes: string[] = []
  const hops: PatchHop[] = []

  const placed = chain.filter((item) => byKey.has(item.key))

  for (let i = 0; i < placed.length - 1; i++) {
    const from = placed[i]
    const to = placed[i + 1]
    const a = centre(from, byKey.get(from.key)!)
    const b = centre(to, byKey.get(to.key)!)
    const { gap, crossesRow } = edgeGap(a, b)

    const needed = gap + ROUTING_SLACK_MM + (crossesRow ? 40 : 0)
    hops.push({
      fromKey: from.key,
      toKey: to.key,
      fromLabel: from.label,
      toLabel: to.label,
      gapMm: Math.round(gap),
      recommendedMm: nextStandardLength(needed),
      crossesRow,
    })
  }

  const counts = new Map<Mm, number>()
  for (const hop of hops) {
    counts.set(hop.recommendedMm, (counts.get(hop.recommendedMm) ?? 0) + 1)
  }

  const byLength = [...counts.entries()]
    .map(([lengthMm, count]) => ({ lengthMm, count }))
    .sort((a, b) => a.lengthMm - b.lengthMm)

  if (hops.length > 0) {
    notes.push(
      `${hops.length} patch cable${hops.length === 1 ? "" : "s"} between pedals, plus a lead in from the guitar and a lead out to the amp.`,
    )
  }

  const longest = hops.reduce((max, h) => Math.max(max, h.recommendedMm), 0)
  if (longest >= 457) {
    notes.push(
      "At least one run is long enough that a solderless kit will be cheaper than buying it in single cables.",
    )
  }

  if (plug === "straight" && hops.length > 2) {
    notes.push(
      `Straight plugs need ${PLUG_PROFILES.straight.gapMm}mm between pedals, against ${PLUG_PROFILES.right.gapMm}mm for right-angle. On a board this size that is most of a row.`,
    )
  }

  if (hops.some((h) => h.crossesRow)) {
    notes.push(
      "Some hops cross between rows. Those want a little more length than the gap suggests, so the cable can be dressed rather than pulled taut across a rail.",
    )
  }

  return {
    hops,
    patchCount: hops.length,
    instrumentLeads: placed.length > 0 ? 2 : 0,
    byLength,
    plug,
    notes,
  }
}
