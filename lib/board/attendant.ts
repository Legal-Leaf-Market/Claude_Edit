import { analyzeChain, estimatePower, EFFECTS, type ChainItem } from "@/lib/pedalboard/chain"
import { planCables, type CablePlan } from "@/lib/pedalboard/cables"
import type { LayoutItem, Placement } from "@/lib/pedalboard/layout"
import { pedalBySlug } from "@/lib/stompbox/pedals"
import {
  effectTypeOf,
  engagedOf,
  orderBoard,
  slotLabel,
  slotReason,
  type BoardItem,
} from "@/lib/board/model"

/**
 * THE ATTENDANT.
 *
 * The brief for this page was "a shop that specialises in pedals, where the
 * person behind the counter tells you what each one does and exactly what you
 * will need". This module is that person. Everything they say is DERIVED, never
 * authored twice:
 *
 *   what it does      lib/stompbox/pedals.ts        the guide's circuit writeups
 *   where it goes     lib/stompbox/chain.ts         the slot, and its reason
 *   what is odd       lib/pedalboard/chain.ts       analyzeChain()
 *   what it draws     lib/pedalboard/chain.ts       estimatePower()
 *   what to wire it   lib/pedalboard/cables.ts      planCables()
 *
 * A GOOD ATTENDANT DOES NOT INVENT. That is the discipline, and it is the same
 * rule the assistant follows (section 14) and the deal badge follows (section
 * 8): where the circuit is not documented they say it has not been checked
 * rather than improvising, because a confident sentence about the wrong circuit
 * is worse, on a page somebody is about to spend money from, than no sentence.
 *
 * AND A GOOD ATTENDANT DOES NOT UPSELL. Nothing in this file reads a price, a
 * merchant or a commission. The remarks are identical on both domains, which is
 * exactly why they are allowed to be: the guide carries no commerce, and on the
 * aggregator what a shopper is told must never depend on who pays (section 17).
 */

export type RemarkTone =
  /** Plain information about the pedal in front of you. */
  | "info"
  /** Worth knowing before buying. */
  | "heads-up"
  /** We have not checked, and are saying so rather than guessing. */
  | "unchecked"

export type ItemRemark = { tone: RemarkTone; line: string }

/** The planner's chain item, for the engines that want brand and model. */
function chainItemOf(item: BoardItem): ChainItem {
  return {
    key: item.key,
    brand: item.maker ?? "",
    model: item.name,
    type: effectTypeOf(item),
  }
}

/**
 * What the attendant says as one pedal lands on the board.
 *
 * Short lines, the way they would be said across a counter. The full writeup is
 * one click away on the guide, and this is not a datasheet.
 */
export function remarksForItem(item: BoardItem): ItemRemark[] {
  const out: ItemRemark[] = []
  const guide = item.guideSlug ? pedalBySlug(item.guideSlug) : null

  if (guide) {
    /*
     * The guide's own sentences, verbatim. Not paraphrased: the value of that
     * dataset is that somebody checked the wording against the pedal, and a
     * reworded copy here would be a second thing to keep true.
     */
    out.push({ tone: "info", line: guide.circuit })
    out.push({ tone: "info", line: `Listen for: ${guide.listenFor}` })
  } else {
    out.push({
      tone: "unchecked",
      line: `Filed as ${slotLabel(item.slot).toLowerCase()} from its type. Nobody here has taken this circuit apart, so there is no description to give you.`,
    })
  }

  out.push({ tone: "info", line: `${slotLabel(item.slot)}. ${slotReason(item.slot)}` })

  if (item.wantsGuitarDirect) {
    out.push({
      tone: "heads-up",
      line: "Wants the guitar straight into it. Put a buffer in front and it stops behaving the way it was voiced.",
    })
  }

  if (item.digital) {
    out.push({
      tone: "heads-up",
      line: "Digital, so it draws more than the analog pedals around it and would rather not share an output.",
    })
  }

  return out
}

export type BoardAdvice = {
  /** The shopping list: supply, outputs, cables. "Exactly what you'll need." */
  needs: string[]
  /** Opinions from the chain and power engines, never from this file. */
  headsUp: string[]
  /** What could not be checked, said out loud rather than left as silence. */
  unchecked: string[]
  power: ReturnType<typeof estimatePower>
  /** Real cable lengths, once a board has been chosen and the pedals placed. */
  cables: CablePlan | null
}

/**
 * Where the pedals physically sit, when the player has picked a board.
 *
 * Optional because cable LENGTHS need geometry and the count does not. Without
 * a board the attendant can still say how many patches to buy; with one it can
 * say how long each should be, which is the difference between a hint and a
 * shopping list.
 */
export type Placed = { items: LayoutItem[]; placements: Placement[] }

/** Everything the attendant would tell you about the board as a whole. */
export function adviceForBoard(items: BoardItem[], placed?: Placed | null): BoardAdvice {
  const ordered = orderBoard(items)
  const live = engagedOf(ordered)

  /*
   * POWER IS SIZED ON EVERYTHING ON THE BOARD, NOT JUST WHAT IS SWITCHED ON.
   * A bypassed pedal is still plugged in and still drawing current, so a supply
   * bought for the engaged half browns out the moment the player stomps the
   * other half on. Chain advice is the opposite: it is about the signal, so it
   * only looks at what the signal actually passes through.
   */
  const power = estimatePower(ordered.map(chainItemOf))
  const analysis = analyzeChain(live.map(chainItemOf))
  const cables =
    placed && placed.placements.length > 0 ? planCables(placed.items, placed.placements) : null

  const needs: string[] = []
  const headsUp: string[] = []
  const unchecked: string[] = []

  if (ordered.length === 0) {
    return { needs, headsUp, unchecked, power, cables }
  }

  /* --- the shopping list, which is the part that was actually asked for --- */

  needs.push(
    `A supply of about ${power.recommendedSupplyMa}mA. The board draws roughly ${power.totalMa}mA, and the rest is headroom: these are typical draws rather than measured ones, and a supply run at its exact rating sags.`,
  )

  if (power.outputsNeeded > 0) {
    needs.push(
      `${power.outputsNeeded} isolated output${power.outputsNeeded === 1 ? "" : "s"}, one per pedal. Shared outputs are what cause the hum people blame on the pedals.`,
    )
  }

  if (power.highDrawCount > 0) {
    needs.push(
      `${power.highDrawCount} of these draw enough to want a high-current output rather than a place on a daisy chain.`,
    )
  }

  if (cables) {
    const lengths = cables.byLength
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.count} at ${entry.lengthMm}mm`)
      .join(", ")
    needs.push(
      `${cables.patchCount} patch cable${cables.patchCount === 1 ? "" : "s"}${lengths ? ` (${lengths})` : ""}, plus ${cables.instrumentLeads} instrument leads for the guitar and the amp.`,
    )
    for (const note of cables.notes) headsUp.push(note)
  } else if (live.length > 1) {
    needs.push(
      `${live.length - 1} patch cables between pedals, plus two instrument leads. Pick a board below and this turns into actual lengths.`,
    )
  }

  /* --- opinions, from the engines --- */

  for (const note of analysis.notes) headsUp.push(note.message)

  /* --- what was not checked --- */

  const undocumented = ordered.filter((item) => !item.circuitKnown)
  if (undocumented.length > 0) {
    unchecked.push(
      `${undocumented.length} of these (${undocumented.map((i) => i.name).join(", ")}) ${
        undocumented.length === 1 ? "is" : "are"
      } not in the circuit guide. Their position above comes from their type rather than from anybody reading the circuit, and the buffer and impedance advice leaves them out rather than assuming.`,
    )
  }

  return { needs, headsUp, unchecked, power, cables }
}

/**
 * The one line at the top of the panel.
 *
 * Counts what is on the board AND what is running, because four pedals with two
 * bypassed is a different rig from four pedals.
 */
export function boardSummary(items: BoardItem[]): string {
  if (items.length === 0) return "Nothing on the board yet."

  const ordered = orderBoard(items)
  const off = items.length - engagedOf(items).length
  const kinds = [...new Set(ordered.map((item) => EFFECTS[effectTypeOf(item)].label.toLowerCase()))]

  const spine = kinds.length <= 3 ? kinds.join(", then ") : `${kinds.length} kinds of pedal`
  const bypassed = off > 0 ? `, ${off} switched off` : ""
  return `${items.length} on the board${bypassed}. Guitar into ${spine}, then the amp.`
}
