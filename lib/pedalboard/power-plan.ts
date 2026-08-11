import { EFFECTS, type EffectType } from "@/lib/pedalboard/chain"
import { supplyOutputCount, supplyTotalMa } from "./catalog/supplies"
import type { PedalSpec, PowerSpec, SupplySpec } from "./catalog/types"

/**
 * Does this board actually power up?
 *
 * Pedal Playground, the best-known planner, has no power planning at all. The
 * Pedaltrain app has none. RockBoard's configurator has some. That gap is why
 * this file exists, and the two failures it prevents are not cosmetic:
 *
 *   DEAD PEDALS. Reversed polarity kills things. So does 9V into a pedal that
 *   wants 18V, and so does any DC output at all into a Line 6 DL4, which wants
 *   9V AC. These are the errors worth shouting about.
 *
 *   HUM. Sharing one output across several pedals couples them through the
 *   supply. The resulting noise is what people chase for months, buying cables
 *   and swapping pedals, when the answer was an isolated output.
 *
 * THE RULE THAT SHAPES EVERYTHING BELOW: this plan is advice, not a
 * certificate. Half the current figures in the catalogue are typical draws for
 * a kind of circuit rather than a manufacturer's spec, and several supplies'
 * output maps are approximate. A tool that presents "your board draws 812mA"
 * with the same confidence whether it summed nine spec sheets or nine guesses
 * is lying by omission, so `confidence` is computed from the provenance of the
 * inputs and every surface that prints a total prints that beside it.
 *
 * ASSIGNMENT IS FIRST-FIT DESCENDING, deliberately. Optimal bin packing is
 * NP-hard and pointless here: boards have under twenty pedals, and a player
 * needs to understand why a pedal landed where it did far more than they need
 * the last 4% of an output's capacity. Hungriest pedal first onto the smallest
 * output that can take it, which is also roughly how a person does it by hand.
 */

export type PowerIssueKind =
  | "no-supply"
  | "polarity"
  | "voltage"
  | "needs-ac"
  | "no-output-left"
  | "over-capacity"
  | "shared-ground"
  | "doubled-up"
  | "estimated-only"

export type PowerIssue = {
  kind: PowerIssueKind
  /** "fatal" kills or fails to power a pedal. "warn" is noise or a caution. */
  severity: "fatal" | "warn"
  /** Which pedal, by id. Null for issues about the board as a whole. */
  pedalId: string | null
  message: string
}

export type OutputAssignment = {
  pedalId: string
  /** The maker's own label for the output, so the plan names something real. */
  outputLabel: string
  /** Index within the expanded output list, so two "1-7" outputs are distinct. */
  outputIndex: number
  volts: number
  ma: number
  /** How much of that output's current this pedal uses, 0..1+. */
  load: number
}

export type PowerPlan = {
  /** Pedals needing a DC output at all, which excludes battery-only fuzz. */
  poweredCount: number
  totalMa: number
  supply: SupplySpec | null
  supplyTotalMa: number
  assignments: OutputAssignment[]
  /** Pedals that could not be given an output, by id. */
  unpowered: string[]
  issues: PowerIssue[]
  /**
   * How much the numbers above are worth.
   *
   *   "spec"      every input came from a manufacturer figure
   *   "mixed"     some inputs are typical draws or approximate output maps
   *   "estimated" mostly guesses; treat the total as an order of magnitude
   */
  confidence: "spec" | "mixed" | "estimated"
  /** Headroom as a fraction of the supply's total, negative when over. */
  headroom: number
}

/** A pedal the planner can reason about, whether or not it is in the catalogue. */
export type PowerItem = {
  id: string
  brand: string
  model: string
  type: EffectType
  power: PowerSpec
}

/**
 * Fall back to the effect type's typical draw for a pedal we have no spec for.
 *
 * Marked `estimate` so it drags `confidence` down, which is the point: a board
 * of unknown pedals should not report a confident total.
 */
export function estimatedPower(type: EffectType): PowerSpec {
  return {
    ma: EFFECTS[type].typicalMa,
    volts: 9,
    polarity: "center-negative",
    dcJack: true,
    source: "estimate",
  }
}

export function powerItemFromSpec(spec: PedalSpec): PowerItem {
  return { id: spec.id, brand: spec.brand, model: spec.model, type: spec.type, power: spec.power }
}

/** One physical output, after expanding the catalogue's grouped counts. */
type Output = {
  index: number
  label: string
  volts: number[]
  ma: number
  polarity: PowerSpec["polarity"]
  ac: boolean
  remainingMa: number
  /** Non-isolated supplies share one ground across everything plugged in. */
  isolated: boolean
}

function expandOutputs(supply: SupplySpec): Output[] {
  const outputs: Output[] = []
  for (const group of supply.outputs) {
    for (let i = 0; i < group.count; i++) {
      outputs.push({
        index: outputs.length,
        label: group.count > 1 ? `${group.label} (${i + 1})` : group.label,
        volts: group.volts,
        ma: group.ma,
        polarity: group.polarity,
        ac: group.ac ?? false,
        remainingMa: group.ma,
        isolated: supply.isolated,
      })
    }
  }
  return outputs
}

/** Does this output suit this pedal at all, ignoring how much is left on it? */
function compatible(output: Output, power: PowerSpec): boolean {
  if ((power.ac ?? false) !== output.ac) return false
  if (!output.volts.includes(power.volts)) return false
  if (output.polarity !== power.polarity) return false
  return true
}

/**
 * Plan the power for a board.
 *
 * Pass `supply: null` to get the totals and a recommendation without
 * committing to a product, which is the state the builder starts in.
 */
export function planPower(items: PowerItem[], supply: SupplySpec | null): PowerPlan {
  const issues: PowerIssue[] = []

  // Battery-only pedals occupy no output. Counting them would over-report how
  // many outputs a board needs, and under-report how many are free.
  const powered = items.filter((item) => item.power.dcJack !== false)
  const totalMa = powered.reduce((sum, item) => sum + item.power.ma, 0)

  const anyEstimated = powered.some((item) => item.power.source === "estimate")
  const supplyEstimated = supply != null && supply.source === "estimate"
  const allSpec = powered.length > 0 && !anyEstimated && !supplyEstimated
  const mostlyEstimated =
    powered.length > 0 &&
    powered.filter((item) => item.power.source === "estimate").length > powered.length / 2

  const confidence: PowerPlan["confidence"] = allSpec
    ? "spec"
    : mostlyEstimated
      ? "estimated"
      : "mixed"

  if (anyEstimated || supplyEstimated) {
    issues.push({
      kind: "estimated-only",
      severity: "warn",
      pedalId: null,
      message:
        "Some figures here are typical draws for the kind of pedal rather than the maker's own spec. Good enough to size a supply, not a guarantee: check the sticker before you rely on it.",
    })
  }

  if (!supply) {
    return {
      poweredCount: powered.length,
      totalMa,
      supply: null,
      supplyTotalMa: 0,
      assignments: [],
      unpowered: powered.map((item) => item.id),
      issues: [
        {
          kind: "no-supply",
          severity: "warn",
          pedalId: null,
          message:
            powered.length === 0
              ? "Nothing on this board needs a power supply yet."
              : `${powered.length} pedal${powered.length === 1 ? "" : "s"} need power, drawing about ${totalMa}mA in total. Pick a supply to check it properly.`,
        },
        ...issues,
      ],
      confidence,
      headroom: 0,
    }
  }

  const capacity = supplyTotalMa(supply)
  const outputs = expandOutputs(supply)
  const assignments: OutputAssignment[] = []
  const unpowered: string[] = []

  /*
   * Hungriest first. A 500mA pedal placed last finds every big output already
   * part-used by pedals that would have fitted anywhere, which is the classic
   * first-fit failure and the reason descending order is worth the sort.
   */
  const queue = [...powered].sort((a, b) => b.power.ma - a.power.ma)

  for (const item of queue) {
    const name = `${item.brand} ${item.model}`

    if (item.power.ac) {
      const acOutput = outputs.find((o) => o.ac && compatible(o, item.power))
      if (!acOutput) {
        unpowered.push(item.id)
        issues.push({
          kind: "needs-ac",
          severity: "fatal",
          pedalId: item.id,
          message: `${name} needs ${item.power.volts}V AC, and ${supply.brand} ${supply.model} has no AC output. A DC output will not run it and can damage it. Use its own adapter.${item.power.note ? ` ${item.power.note}` : ""}`,
        })
        continue
      }
    }

    const rightVoltage = outputs.filter((o) => o.volts.includes(item.power.volts))
    if (rightVoltage.length === 0) {
      unpowered.push(item.id)
      issues.push({
        kind: "voltage",
        severity: "fatal",
        pedalId: item.id,
        message: `${name} wants ${item.power.volts}V and no output on ${supply.brand} ${supply.model} provides it.`,
      })
      continue
    }

    const rightPolarity = rightVoltage.filter((o) => o.polarity === item.power.polarity)
    if (rightPolarity.length === 0) {
      // Recoverable with a reverse-polarity cable, so it is fatal as planned
      // but the message says how to fix it rather than just refusing.
      unpowered.push(item.id)
      issues.push({
        kind: "polarity",
        severity: "fatal",
        pedalId: item.id,
        message: `${name} is ${item.power.polarity.replace("-", " ")}, and every output here is ${rightVoltage[0].polarity.replace("-", " ")}. Use a reverse polarity cable, or an output you can flip. Plugging it in as is will not work.${item.power.note ? ` ${item.power.note}` : ""}`,
      })
      continue
    }

    const usable = rightPolarity.filter((o) => compatible(o, item.power))
    const fitting = usable
      .filter((o) => o.remainingMa >= item.power.ma)
      // Smallest output that still has room: keeps the big ones free for the
      // pedals that actually need them.
      .sort((a, b) => a.ma - b.ma || a.remainingMa - b.remainingMa)

    /*
     * ONE PEDAL PER OUTPUT ON AN ISOLATED SUPPLY.
     *
     * Plain first-fit packs several pedals onto the first output with room,
     * which is exactly wrong here: the reason to buy an isolated brick is that
     * each output is its own transformer winding, and two pedals sharing one
     * are no longer isolated FROM EACH OTHER. The capacity arithmetic looks
     * fine and the board hums, which is the failure this whole module exists
     * to prevent.
     *
     * So untouched outputs are used first, and doubling up only happens when
     * there are genuinely more pedals than outputs. When it does happen it is
     * reported, because it is a real compromise rather than a detail.
     */
    const untouched = fitting.filter((o) => o.remainingMa === o.ma)
    const chosen = supply.isolated ? (untouched[0] ?? fitting[0]) : fitting[0]

    if (supply.isolated && chosen && untouched.length === 0) {
      issues.push({
        kind: "doubled-up",
        severity: "warn",
        pedalId: item.id,
        message: `${name} has to share output ${chosen.label} with another pedal: there are more pedals than outputs on ${supply.brand} ${supply.model}. It will work, but those two are no longer isolated from each other, which is the usual source of hum.`,
      })
    }

    if (!chosen) {
      unpowered.push(item.id)
      issues.push({
        kind: "no-output-left",
        severity: "fatal",
        pedalId: item.id,
        message: `Nothing left for ${name}, which wants ${item.power.ma}mA at ${item.power.volts}V. Every compatible output on ${supply.brand} ${supply.model} is already spoken for.`,
      })
      continue
    }

    chosen.remainingMa -= item.power.ma
    assignments.push({
      pedalId: item.id,
      outputLabel: chosen.label,
      outputIndex: chosen.index,
      volts: item.power.volts,
      ma: item.power.ma,
      load: chosen.ma > 0 ? item.power.ma / chosen.ma : 0,
    })
  }

  if (!supply.isolated && powered.length > 1) {
    issues.push({
      kind: "shared-ground",
      severity: "warn",
      pedalId: null,
      message: `${supply.brand} ${supply.model} is not isolated: all ${powered.length} pedals share one ground. That is the usual cause of hum on a board that is otherwise fine, and it gets worse the more digital pedals are on it.`,
    })
  }

  if (totalMa > capacity) {
    issues.push({
      kind: "over-capacity",
      severity: "fatal",
      pedalId: null,
      message: `This board wants about ${totalMa}mA and ${supply.brand} ${supply.model} delivers ${capacity}mA in total.`,
    })
  }

  return {
    poweredCount: powered.length,
    totalMa,
    supply,
    supplyTotalMa: capacity,
    assignments,
    unpowered,
    issues,
    confidence,
    headroom: capacity > 0 ? (capacity - totalMa) / capacity : 0,
  }
}

/**
 * The smallest catalogue supply that powers this board with room to grow.
 *
 * HEADROOM IS 1.35, not 1.0. Two independent reasons, and both are the same
 * reason a 100mA output is not the right home for a 100mA pedal: several of
 * these draws are typical rather than measured and a specific pedal can be
 * well over its type's typical, and a supply run at its exact rating sags
 * under transients, which is audible.
 */
export function recommendSupply(items: PowerItem[], candidates: SupplySpec[]): SupplySpec | null {
  const powered = items.filter((item) => item.power.dcJack !== false)
  if (powered.length === 0) return null

  const needMa = powered.reduce((sum, item) => sum + item.power.ma, 0) * 1.35
  const needOutputs = powered.length

  const viable = candidates
    .filter((supply) => {
      if (!supply.isolated) return false
      if (supplyTotalMa(supply) < needMa) return false
      if (supplyOutputCount(supply) < needOutputs) return false
      // A recommendation must actually work, so run the real planner and
      // reject anything with a fatal issue rather than trusting the totals.
      return planPower(items, supply).issues.every((issue) => issue.severity !== "fatal")
    })
    .sort((a, b) => supplyTotalMa(a) - supplyTotalMa(b))

  return viable[0] ?? null
}
