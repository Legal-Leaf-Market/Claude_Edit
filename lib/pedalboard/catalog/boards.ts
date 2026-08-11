import { inToMm } from "./types"
import type { BoardSpec, Mm } from "./types"

/**
 * Pedalboards.
 *
 * THE NUMBER THAT MATTERS IS THE USABLE AREA, NOT THE ONE ON THE BOX. A
 * Pedaltrain Classic 2 is sold as 24 inches and it is 24 inches of frame; what
 * you can actually mount on is the rails inside that, minus the edge. A
 * planner that fits pedals into the box dimension will happily approve a
 * layout that does not fit the real board, which is the exact mistake this
 * tool exists to prevent, so `usableWidthMm` and `usableDepthMm` are what the
 * layout engine works in and the box size is display only.
 *
 * RAILS ARE A REAL CONSTRAINT, NOT A DECORATION. An open-frame board is a set
 * of parallel rails with gaps between them. A pedal has to sit on a rail or
 * bridge two, so a deep board with badly placed rails can fail a pedal that a
 * shallower board takes. The rails here are measured from the BACK edge of the
 * usable area forward, matching how the layout engine measures y.
 *
 * ORDERED SMALLEST FIRST, and by nothing else. Not by brand deals, not by
 * what a merchant pays: the same rule that governs the pedal catalogue and
 * every other list on this site.
 */

/** Two rails at the front and back of a shallow board, the Pedaltrain pattern. */
function twoRail(depthMm: Mm): BoardSpec["rails"] {
  return [
    { offsetMm: 0, depthMm: 32 },
    { offsetMm: depthMm - 32, depthMm: 32 },
  ]
}

/** Three rails: back, middle, front. Tiered boards from the Classic size up. */
function threeRail(depthMm: Mm): BoardSpec["rails"] {
  return [
    { offsetMm: 0, depthMm: 32 },
    { offsetMm: depthMm / 2 - 16, depthMm: 32 },
    { offsetMm: depthMm - 32, depthMm: 32 },
  ]
}

/** Four rails, for the deepest boards. */
function fourRail(depthMm: Mm): BoardSpec["rails"] {
  const step = (depthMm - 32) / 3
  return [0, 1, 2, 3].map((i) => ({ offsetMm: i * step, depthMm: 32 }))
}

/**
 * A solid-surface board: one "rail" covering the whole deck.
 *
 * Modelling it this way rather than special-casing solid boards means the
 * layout engine has exactly one rule (a pedal must sit on rail) instead of
 * two, and a solid board trivially satisfies it everywhere.
 */
function solid(depthMm: Mm): BoardSpec["rails"] {
  return [{ offsetMm: 0, depthMm }]
}

/** Usable area, inset from the frame by the edge the pedals cannot reach. */
function usable(widthIn: number, depthIn: number, insetMm = 6) {
  return {
    usableWidthMm: Math.round(inToMm(widthIn) - insetMm * 2),
    usableDepthMm: Math.round(inToMm(depthIn) - insetMm * 2),
  }
}

export const BOARDS: BoardSpec[] = [
  {
    id: "pedaltrain-nano",
    brand: "Pedaltrain",
    model: "Nano",
    labelWidthIn: 14,
    labelDepthIn: 5.5,
    ...usable(14, 5.5),
    heightMm: 36,
    weightG: 320,
    rails: twoRail(Math.round(inToMm(5.5) - 12)),
    underMount: false,
    tiered: false,
    note: "Two rails and no room underneath. A supply lives off the board or on a bracket.",
  },
  {
    id: "pedaltrain-nano-plus",
    brand: "Pedaltrain",
    model: "Nano+",
    labelWidthIn: 18,
    labelDepthIn: 5.5,
    ...usable(18, 5.5),
    heightMm: 36,
    weightG: 410,
    rails: twoRail(Math.round(inToMm(5.5) - 12)),
    underMount: false,
    tiered: false,
    aliases: ["Nano Plus"],
  },
  {
    id: "pedaltrain-metro-16",
    brand: "Pedaltrain",
    model: "Metro 16",
    labelWidthIn: 16,
    labelDepthIn: 8,
    ...usable(16, 8),
    heightMm: 36,
    weightG: 730,
    rails: twoRail(Math.round(inToMm(8) - 12)),
    underMount: false,
    tiered: false,
  },
  {
    id: "rockboard-duo-2-1",
    brand: "RockBoard",
    model: "Duo 2.1",
    labelWidthIn: 18.3,
    labelDepthIn: 5.6,
    usableWidthMm: 452,
    usableDepthMm: 131,
    heightMm: 40,
    weightG: 900,
    rails: twoRail(131),
    underMount: true,
    tiered: false,
    note: "Cable channels through the frame, so patch cables can run under rather than around.",
  },
  {
    id: "pedaltrain-metro-20",
    brand: "Pedaltrain",
    model: "Metro 20",
    labelWidthIn: 20,
    labelDepthIn: 8,
    ...usable(20, 8),
    heightMm: 36,
    weightG: 770,
    rails: twoRail(Math.round(inToMm(8) - 12)),
    underMount: false,
    tiered: false,
  },
  {
    id: "temple-audio-duo-17",
    brand: "Temple Audio",
    model: "Duo 17",
    labelWidthIn: 17,
    labelDepthIn: 12.5,
    ...usable(17, 12.5),
    heightMm: 44,
    weightG: 1600,
    rails: solid(Math.round(inToMm(12.5) - 12)),
    underMount: true,
    tiered: false,
    note: "Solid surface with Temple's own quick-release mounting plates, so pedals go anywhere rather than on a rail.",
  },
  {
    id: "pedaltrain-classic-jr",
    brand: "Pedaltrain",
    model: "Classic Jr",
    labelWidthIn: 18,
    labelDepthIn: 12.5,
    ...usable(18, 12.5),
    heightMm: 89,
    weightG: 1360,
    rails: threeRail(Math.round(inToMm(12.5) - 12)),
    underMount: true,
    tiered: true,
  },
  {
    id: "pedaltrain-novo-18",
    brand: "Pedaltrain",
    model: "Novo 18",
    labelWidthIn: 18,
    labelDepthIn: 14.5,
    ...usable(18, 14.5),
    heightMm: 89,
    weightG: 1800,
    rails: threeRail(Math.round(inToMm(14.5) - 12)),
    underMount: true,
    tiered: true,
    note: "Flat-topped rails rather than the Classic's angled ones, which suits pedals with side jacks.",
  },
  {
    id: "rockboard-tres-3-1",
    brand: "RockBoard",
    model: "Tres 3.1",
    labelWidthIn: 20.3,
    labelDepthIn: 9.4,
    usableWidthMm: 503,
    usableDepthMm: 228,
    heightMm: 45,
    weightG: 1500,
    rails: threeRail(228),
    underMount: true,
    tiered: false,
  },
  {
    id: "pedaltrain-classic-1",
    brand: "Pedaltrain",
    model: "Classic 1",
    labelWidthIn: 22,
    labelDepthIn: 12.5,
    ...usable(22, 12.5),
    heightMm: 89,
    weightG: 1600,
    rails: threeRail(Math.round(inToMm(12.5) - 12)),
    underMount: true,
    tiered: true,
  },
  {
    id: "temple-audio-trio-21",
    brand: "Temple Audio",
    model: "Trio 21",
    labelWidthIn: 21,
    labelDepthIn: 15.5,
    ...usable(21, 15.5),
    heightMm: 52,
    weightG: 2200,
    rails: solid(Math.round(inToMm(15.5) - 12)),
    underMount: true,
    tiered: false,
  },
  {
    id: "pedaltrain-classic-2",
    brand: "Pedaltrain",
    model: "Classic 2",
    labelWidthIn: 24,
    labelDepthIn: 12.5,
    ...usable(24, 12.5),
    heightMm: 89,
    weightG: 1700,
    rails: threeRail(Math.round(inToMm(12.5) - 12)),
    underMount: true,
    tiered: true,
    note: "The default big board. If a documented rig fits anything, it fits this.",
  },
  {
    id: "pedaltrain-novo-24",
    brand: "Pedaltrain",
    model: "Novo 24",
    labelWidthIn: 24,
    labelDepthIn: 14.5,
    ...usable(24, 14.5),
    heightMm: 89,
    weightG: 2100,
    rails: fourRail(Math.round(inToMm(14.5) - 12)),
    underMount: true,
    tiered: true,
  },
  {
    id: "rockboard-quad-4-2",
    brand: "RockBoard",
    model: "Quad 4.2",
    labelWidthIn: 24.3,
    labelDepthIn: 12.8,
    usableWidthMm: 604,
    usableDepthMm: 314,
    heightMm: 50,
    weightG: 2400,
    rails: fourRail(314),
    underMount: true,
    tiered: false,
  },
  {
    id: "temple-audio-duo-34",
    brand: "Temple Audio",
    model: "Duo 34",
    labelWidthIn: 34,
    labelDepthIn: 21.5,
    ...usable(34, 21.5),
    heightMm: 60,
    weightG: 4300,
    rails: solid(Math.round(inToMm(21.5) - 12)),
    underMount: true,
    tiered: false,
    note: "A touring-size board. If this is not big enough the answer is a rack, not a bigger board.",
  },
  {
    id: "pedaltrain-terra-42",
    brand: "Pedaltrain",
    model: "Terra 42",
    labelWidthIn: 42,
    labelDepthIn: 16,
    ...usable(42, 16),
    heightMm: 102,
    weightG: 4500,
    rails: fourRail(Math.round(inToMm(16) - 12)),
    underMount: true,
    tiered: true,
  },
]

/** Smallest usable area first, which is the order the picker shows. */
export const BOARDS_BY_SIZE: BoardSpec[] = [...BOARDS].sort(
  (a, b) => a.usableWidthMm * a.usableDepthMm - b.usableWidthMm * b.usableDepthMm,
)

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]))

export function boardById(id: string): BoardSpec | null {
  return BY_ID.get(id) ?? null
}

/** The board a fresh builder session starts on. */
export const DEFAULT_BOARD_ID = "pedaltrain-classic-2"
