import { BOARDS, DEFAULT_BOARD_ID } from "@/lib/pedalboard/catalog/boards"
import { PEDALS } from "@/lib/pedalboard/catalog/pedals"
import { EFFECTS, EFFECT_ORDER, type EffectType } from "@/lib/pedalboard/chain"
import { boxOf } from "@/lib/pedalboard/layout"
import { decodeRig, type RigLayout } from "@/lib/pedalboard/board-url"
import type { BoardSpec, Mm, PedalSpec, Rotation } from "@/lib/pedalboard/catalog/types"

/**
 * A rig, turned into something a renderer can draw, in pure TypeScript.
 *
 * WHY THE GEOMETRY IS NOT IN THE RENDERER. Everything here is arithmetic on
 * millimetres, and arithmetic is worth testing. Putting it inside the three.js
 * component would make every one of these numbers reachable only through a
 * canvas, which nothing can assert against: a pedal an inch through the board
 * or a cable joined to the wrong neighbour would look approximately fine and
 * be invisible to CI. So this file computes, and the renderer only draws what
 * it is given.
 *
 * WHY IT REUSES THE PLANNER'S ENGINES rather than reimplementing them. This is
 * the reason a game engine was rejected for this: `boxOf` already knows how a
 * rotated pedal occupies space and `EFFECT_ORDER` already knows what plugs
 * into what, and a second copy of either in another language would drift the
 * way the condition classifier nearly did (CLAUDE.md section 8). The rig room
 * is a different VIEW of the planner's model, not a different model.
 *
 * COORDINATES. The planner's origin is the back left corner of the board's
 * usable area, x running right and y running FORWARD toward the player. This
 * keeps that exactly, and leaves the axis mapping to the renderer, so nothing
 * here has to think about which way a camera is pointing.
 */

/** Millimetres are the unit throughout, the same as the catalogue and the planner. */
export type SceneBox = {
  key: string
  label: string
  brand: string
  model: string
  type: EffectType
  /** Where the catalogue page for this pedal lives, when it has one. */
  gearSlug: string | null
  xMm: Mm
  yMm: Mm
  widthMm: Mm
  depthMm: Mm
  heightMm: Mm
  rotation: Rotation
  /** The LED colour for this effect family, so the renderer picks no palette. */
  colour: string
  /** Position in signal order, 1 based. Null for anything off the chain. */
  chainPosition: number | null
}

export type SceneCable = {
  fromKey: string
  toKey: string
  /** Jack positions, taken as the middle of the facing edges. */
  from: { xMm: Mm; yMm: Mm; zMm: Mm }
  to: { xMm: Mm; yMm: Mm; zMm: Mm }
}

export type RigScene = {
  board: BoardSpec
  boxes: SceneBox[]
  cables: SceneCable[]
  /** True when nothing was decodable and this is the demonstration rig. */
  isDemo: boolean
}

/**
 * Effect-family colours.
 *
 * Taken from the chain metadata rather than invented here, so the 3D view and
 * the 2D canvas agree about what a delay looks like. A pedal is identified by
 * its position and its label; the colour is a secondary cue, which is why it
 * being the same in both views matters more than it being pretty.
 */
function colourFor(type: EffectType): string {
  return EFFECTS[type]?.hue ?? "#8b8b8b"
}

/**
 * A pedal's height, which the 2D planner never needed.
 *
 * The catalogue records the tallest point INCLUDING knobs, because that is
 * what decides case clearance. It is the honest number to extrude by: a
 * Big Muff is not a flat rectangle, and drawing every pedal the same height
 * would lose the one thing a 3D view adds over the plan view.
 */
function heightOf(pedal: PedalSpec): Mm {
  return pedal.dims.heightMm
}

const PEDALS_BY_ID = new Map(PEDALS.map((p) => [p.id, p]))
const BOARDS_BY_ID = new Map(BOARDS.map((b) => [b.id, b]))

/**
 * Signal order for the pedals actually present.
 *
 * Ordered by effect family rather than by board position, because that is what
 * a cable follows: pedals get arranged in rows for space, and the cable runs
 * back and forth across the board in an order that has nothing to do with
 * left-to-right. Drawing cables between board neighbours would look tidier and
 * be a lie about how the rig is wired.
 */
export function chainOrder(boxes: Omit<SceneBox, "chainPosition">[]): string[] {
  const rank = new Map(EFFECT_ORDER.map((type, index) => [type, index]))
  return [...boxes]
    .sort((a, b) => {
      const byType = (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99)
      if (byType !== 0) return byType
      // Stable within a family: two drives keep their board order, which is
      // the only information available about which comes first.
      return a.xMm - b.xMm || a.key.localeCompare(b.key)
    })
    .map((b) => b.key)
}

/**
 * Where a patch cable leaves one pedal and enters the next.
 *
 * IT CONNECTS THE FACING EDGES, which is not a cosmetic choice. The catalogue
 * does not record where each pedal's jacks actually are, so the honest options
 * are to invent a fixed convention or to join the sides that face each other.
 * A fixed convention gets it wrong half the time: pedals are commonly wired
 * right to left, and this demo board runs left to right, so taking the output
 * from a fixed left face sent every cable wrapping around behind the pedal it
 * was reaching for. Cables that pass through the gear they connect are worse
 * than slightly idealised ones.
 *
 * Height is 60% of the pedal, capped at 25mm, which puts the ends where jacks
 * sit on a real enclosure and above the board rather than through it.
 */
function jackHeight(box: SceneBox): Mm {
  return Math.min(box.heightMm * 0.6, 25)
}

function cableEnds(from: SceneBox, to: SceneBox): { from: SceneCable["from"]; to: SceneCable["to"] } {
  const fromCentre = from.xMm + from.widthMm / 2
  const toCentre = to.xMm + to.widthMm / 2
  const goingRight = toCentre >= fromCentre

  return {
    from: {
      xMm: goingRight ? from.xMm + from.widthMm : from.xMm,
      yMm: from.yMm + from.depthMm / 2,
      zMm: jackHeight(from),
    },
    to: {
      xMm: goingRight ? to.xMm : to.xMm + to.widthMm,
      yMm: to.yMm + to.depthMm / 2,
      zMm: jackHeight(to),
    },
  }
}

/**
 * The demonstration rig, for arriving with no `?rig=` at all.
 *
 * An empty room would be a worse first impression than a made-up one, and
 * every pedal here is a real catalogue entry at its real size, so nothing on
 * screen is invented. Laid out along the front rail in signal order, which is
 * both the most legible arrangement and the one a player would recognise.
 */
export function demoRig(): RigLayout {
  const wanted = ["boss-ts9", "ibanez-ts9", "mxr-phase-90", "boss-ds-1", "boss-dd-3", "ehx-big-muff-pi"]
  const found = wanted.map((id) => PEDALS_BY_ID.get(id)).filter((p): p is PedalSpec => Boolean(p))

  // Fall back to the first few catalogue pedals that fit on a board, so this
  // never renders empty just because a slug was renamed.
  const chosen = (found.length >= 3 ? found : PEDALS.filter((p) => !p.offBoard && !p.treadle).slice(0, 5)).slice(0, 6)

  /*
   * 28mm between pedals rather than the 18 a tightly packed board uses. This
   * is the first thing a visitor sees, and at 18 the patch cables disappear
   * into the gaps entirely: realistic, and useless as an illustration of what
   * the room is for. A real rig laid out by the planner keeps whatever
   * spacing it was given.
   */
  let x = 20
  const placements = chosen.map((pedal) => {
    const placement = { key: pedal.id, xMm: x, yMm: 60, rotation: 0 as Rotation }
    x += pedal.dims.widthMm + 28
    return placement
  })

  return { boardId: DEFAULT_BOARD_ID, supplyId: null, placements }
}

/**
 * Build the scene from an encoded rig, or from the demo when there is none.
 *
 * Unknown placement keys are DROPPED rather than guessed at. A shared link can
 * outlive a catalogue rename, and rendering a placeholder box of invented size
 * at a real coordinate would be the 3D equivalent of publishing a market price
 * from two listings.
 */
export function buildScene(encoded: string | null | undefined): RigScene {
  const decoded = decodeRig(encoded)
  const isDemo = decoded.placements.length === 0
  const layout = isDemo ? demoRig() : decoded

  const board = BOARDS_BY_ID.get(layout.boardId ?? "") ?? BOARDS_BY_ID.get(DEFAULT_BOARD_ID) ?? BOARDS[0]

  const partial: Omit<SceneBox, "chainPosition">[] = []
  for (const placement of layout.placements) {
    const pedal = PEDALS_BY_ID.get(placement.key)
    if (!pedal) continue

    // boxOf owns rotation, so a rotated pedal occupies the same footprint here
    // as it does in the planner's collision checks.
    const box = boxOf(
      { key: placement.key, label: pedal.model, widthMm: pedal.dims.widthMm, depthMm: pedal.dims.depthMm },
      placement,
    )

    partial.push({
      key: placement.key,
      label: `${pedal.brand} ${pedal.model}`,
      brand: pedal.brand,
      model: pedal.model,
      type: pedal.type,
      gearSlug: pedal.id,
      xMm: box.x0,
      yMm: box.y0,
      widthMm: box.x1 - box.x0,
      depthMm: box.y1 - box.y0,
      heightMm: heightOf(pedal),
      rotation: placement.rotation,
      colour: colourFor(pedal.type),
    })
  }

  const order = chainOrder(partial)
  const positionOf = new Map(order.map((key, index) => [key, index + 1]))
  const boxes: SceneBox[] = partial.map((b) => ({ ...b, chainPosition: positionOf.get(b.key) ?? null }))

  const byKey = new Map(boxes.map((b) => [b.key, b]))
  const cables: SceneCable[] = []
  for (let i = 0; i < order.length - 1; i++) {
    const from = byKey.get(order[i])
    const to = byKey.get(order[i + 1])
    if (!from || !to) continue
    const ends = cableEnds(from, to)
    cables.push({ fromKey: from.key, toKey: to.key, from: ends.from, to: ends.to })
  }

  return { board, boxes, cables, isDemo }
}
