import type { SupplySpec } from "./types"

/**
 * Power supplies.
 *
 * THIS IS THE FEATURE PEDAL PLAYGROUND DOES NOT HAVE AT ALL, and it is the one
 * that actually saves people money and pedals. The two failures it prevents
 * are not cosmetic:
 *
 *   NOISE. Sharing one output between pedals through a daisy chain couples
 *   them through the supply, and the hum that produces is the thing people
 *   chase for months, buying cables and swapping pedals, when the answer was
 *   an isolated output.
 *
 *   DEAD PEDALS. Reversed polarity kills things. So does 9V into an 18V-only
 *   pedal, and so does a 9V DC output into the Line 6 DL4, which wants 9V AC.
 *
 * OUTPUTS ARE GROUPED, NOT ENUMERATED, because that is how supplies are
 * specified ("6 x 9V 100mA, 2 x 9V 250mA"). Expanding a group into individual
 * outputs is the planner's job.
 *
 * `source` says how much to trust each entry's output table. Supplies vary
 * per-output current far more than pedals vary their draw, so a supply whose
 * map is an estimate is marked as one and the planner declines to certify a
 * board on it. Better a tool that says "check this" than one that is
 * confidently wrong about whether your board will hum.
 */

export const SUPPLIES: SupplySpec[] = [
  {
    id: "strymon-ojai",
    brand: "Strymon",
    model: "Ojai",
    outputs: [{ count: 5, volts: [9], ma: 500, polarity: "center-negative", label: "1-5" }],
    isolated: true,
    dims: { widthMm: 102, depthMm: 64, heightMm: 32, source: "maker" },
    weightG: 340,
    mountsUnder: true,
    source: "maker",
    note: "Five outputs, every one 500mA. Unusually generous for its size, and it fits under a tiered board.",
  },
  {
    id: "strymon-zuma",
    brand: "Strymon",
    model: "Zuma",
    outputs: [
      { count: 7, volts: [9], ma: 500, polarity: "center-negative", label: "1-7" },
      {
        count: 2,
        volts: [9, 12, 18],
        ma: 500,
        polarity: "center-negative",
        label: "8-9 (switchable)",
      },
    ],
    isolated: true,
    dims: { widthMm: 267, depthMm: 64, heightMm: 32, source: "maker" },
    weightG: 907,
    mountsUnder: true,
    source: "maker",
    note: "Nine isolated outputs at 500mA each. The straightforward answer for a board full of digital pedals.",
  },
  {
    id: "truetone-cs7",
    brand: "Truetone",
    model: "1 SPOT Pro CS7",
    outputs: [
      { count: 4, volts: [9], ma: 100, polarity: "center-negative", label: "1-4" },
      { count: 2, volts: [9, 12], ma: 100, polarity: "center-negative", label: "5-6" },
      { count: 1, volts: [9, 12, 18], ma: 500, polarity: "center-negative", label: "7" },
    ],
    isolated: true,
    dims: { widthMm: 152, depthMm: 89, heightMm: 38, source: "estimate" },
    weightG: 680,
    mountsUnder: true,
    source: "estimate",
    note: "Output map is close but not verified against Truetone's own sheet. Check before relying on the 100mA outputs for a digital pedal.",
  },
  {
    id: "voodoo-lab-pedal-power-2-plus",
    brand: "Voodoo Lab",
    model: "Pedal Power 2 Plus",
    outputs: [
      { count: 6, volts: [9], ma: 100, polarity: "center-negative", label: "1-6" },
      { count: 2, volts: [9, 12], ma: 250, polarity: "center-negative", label: "7-8" },
    ],
    isolated: true,
    dims: { widthMm: 152, depthMm: 95, heightMm: 44, source: "estimate" },
    weightG: 900,
    mountsUnder: true,
    source: "estimate",
    note: "The long-time standard, but its outputs are mostly 100mA and it predates pedals that want 300mA+. Output map here is approximate; verify before trusting it with a Strymon.",
  },
  {
    id: "mxr-iso-brick",
    brand: "MXR",
    model: "M238 Iso-Brick",
    outputs: [
      { count: 2, volts: [9], ma: 100, polarity: "center-negative", label: "9V 100mA" },
      { count: 2, volts: [9], ma: 300, polarity: "center-negative", label: "9V 300mA" },
      { count: 2, volts: [9], ma: 450, polarity: "center-negative", label: "9V 450mA" },
      { count: 2, volts: [18], ma: 250, polarity: "center-negative", label: "18V" },
      { count: 2, volts: [6, 15], ma: 250, polarity: "center-negative", label: "variable" },
    ],
    isolated: true,
    dims: { widthMm: 172, depthMm: 82, heightMm: 38, source: "estimate" },
    weightG: 640,
    mountsUnder: true,
    source: "estimate",
    note: "Ten outputs across five different ratings, including a genuine 18V pair. Output map approximate.",
  },
  {
    id: "cioks-dc7",
    brand: "CIOKS",
    model: "DC7",
    outputs: [
      { count: 5, volts: [9, 12], ma: 660, polarity: "center-negative", label: "1-5" },
      { count: 2, volts: [9, 12, 18, 24], ma: 660, polarity: "center-negative", label: "6-7" },
    ],
    isolated: true,
    dims: { widthMm: 210, depthMm: 52, heightMm: 32, source: "estimate" },
    weightG: 560,
    mountsUnder: true,
    source: "estimate",
    note: "Very high current per output and it goes to 24V, which is what a Deluxe Memory Man needs. Output map approximate.",
  },
  {
    /*
     * Included deliberately, and deliberately unflattering.
     *
     * A daisy chain is what most people actually own, and a planner that only
     * lists bricks would silently assume everyone has one. Modelling it as a
     * single shared output is what lets the power planner explain the hum:
     * every pedal on it shares a ground, and the total is one budget rather
     * than a per-pedal one.
     */
    id: "daisy-chain-1a",
    brand: "Generic",
    model: "Daisy chain (1A adapter)",
    outputs: [{ count: 1, volts: [9], ma: 1000, polarity: "center-negative", label: "shared" }],
    isolated: false,
    dims: { widthMm: 60, depthMm: 40, heightMm: 30, source: "estimate" },
    weightG: 200,
    mountsUnder: true,
    source: "estimate",
    note: "NOT isolated. Every pedal shares one ground, which is the usual cause of hum on an otherwise fine board. Fine for a few analogue pedals, bad news for digital ones.",
  },
]

const BY_ID = new Map(SUPPLIES.map((s) => [s.id, s]))

export function supplyById(id: string): SupplySpec | null {
  return BY_ID.get(id) ?? null
}

/** Total current a supply can deliver, summed across every output. */
export function supplyTotalMa(supply: SupplySpec): number {
  return supply.outputs.reduce((sum, o) => sum + o.count * o.ma, 0)
}

/** How many separate outputs a supply has. */
export function supplyOutputCount(supply: SupplySpec): number {
  return supply.outputs.reduce((sum, o) => sum + o.count, 0)
}

/** Smallest total current first, so the picker reads as a ladder. */
export const SUPPLIES_BY_CAPACITY: SupplySpec[] = [...SUPPLIES].sort(
  (a, b) => supplyTotalMa(a) - supplyTotalMa(b),
)
