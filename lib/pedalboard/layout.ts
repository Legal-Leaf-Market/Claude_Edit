import { rotatedFootprint, type BoardSpec, type Mm, type Rotation } from "./catalog/types"

/**
 * Where the pedals physically go.
 *
 * This is the part every planner has, so it is the part that has to be at
 * least as good as Pedal Playground's before any of the power or cable work
 * matters. Three things here go past what those tools do:
 *
 *   RAILS ARE CHECKED, NOT DRAWN. An open-frame board is parallel rails with
 *   gaps between them, and a pedal has to sit on one or bridge two. A planner
 *   that only checks the outer rectangle will happily approve a layout where a
 *   shallow pedal floats over a gap, which is a layout you cannot actually
 *   build.
 *
 *   CABLE SPACE IS PART OF THE FOOTPRINT. Two pedals touching edge to edge fit
 *   on screen and do not fit in life, because a right-angle jack needs about
 *   18mm and a straight one needs 45mm. The gap is a first-class input, not
 *   something the user is left to eyeball.
 *
 *   TREADLES GET FOOT ROOM. A wah is not just deep, it needs somewhere for the
 *   front of your foot to go while it rocks. Packing one flush against the
 *   board's front edge is a mistake nobody makes twice.
 *
 * COORDINATES. Origin is the BACK LEFT corner of the board's usable area, x
 * runs right, y runs forward toward the player. That matches how the rails are
 * measured in the catalogue and how the canvas draws, so nothing has to flip a
 * sign anywhere.
 */

export type Placement = {
  /** Slot key, matching the board slot it positions. */
  key: string
  xMm: Mm
  yMm: Mm
  rotation: Rotation
}

/** A thing being placed. Deliberately not a PedalSpec: off-catalogue pedals get laid out too. */
export type LayoutItem = {
  key: string
  label: string
  widthMm: Mm
  depthMm: Mm
  treadle?: boolean
}

export type LayoutIssueKind = "off-board" | "overlap" | "too-tight" | "off-rail" | "no-room"

export type LayoutIssue = {
  kind: LayoutIssueKind
  severity: "fatal" | "warn"
  /** The slot this is about. Null for issues about the board as a whole. */
  key: string | null
  message: string
}

export type LayoutResult = {
  placements: Placement[]
  issues: LayoutIssue[]
  /** Slot keys that would not fit at all. */
  unplaced: string[]
  usedAreaMm2: number
  boardAreaMm2: number
  /** 0..1. Above about 0.7 a board is full in practice, not at 1.0. */
  utilisation: number
}

/**
 * How much room the plug on the end of a patch cable needs.
 *
 * These gaps are between pedal EDGES, and they are why a board that looks
 * roomy on screen ends up unbuildable. Flat (pancake) plugs are what people
 * reach for precisely because they buy back 10mm per join.
 */
export const PLUG_PROFILES = {
  flat: { label: "Flat / pancake", gapMm: 8 },
  right: { label: "Right angle", gapMm: 18 },
  straight: { label: "Straight", gapMm: 45 },
} as const

export type PlugProfile = keyof typeof PLUG_PROFILES

/** Foot room in front of a treadle, so it can rock without hitting the edge. */
const TREADLE_TOE_ROOM_MM = 25

export type LayoutOptions = {
  plug?: PlugProfile
  /** Overrides the plug profile's gap when a specific number is wanted. */
  gapMm?: Mm
}

function gapFor(options: LayoutOptions = {}): Mm {
  return options.gapMm ?? PLUG_PROFILES[options.plug ?? "right"].gapMm
}

type Box = { x0: number; y0: number; x1: number; y1: number }

export function boxOf(item: LayoutItem, placement: Placement): Box {
  const { widthMm, depthMm } = rotatedFootprint(item, placement.rotation)
  return {
    x0: placement.xMm,
    y0: placement.yMm,
    x1: placement.xMm + widthMm,
    y1: placement.yMm + depthMm,
  }
}

/** Do two boxes come within `gap` of each other? Touching counts as too close. */
function tooClose(a: Box, b: Box, gap: number): boolean {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap
}

function overlapping(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

/**
 * Is this pedal actually supported by the board's rails?
 *
 * Supported means either sitting on one rail with real contact, or bridging
 * two, which is how a long pedal spans the gap on a Pedaltrain. The 18mm
 * threshold is roughly the width of the mounting surface a strip of hook and
 * loop needs to hold.
 */
const MIN_RAIL_CONTACT_MM = 18

export function railContact(board: BoardSpec, box: Box): { total: Mm; rails: number } {
  let total = 0
  let rails = 0
  for (const rail of board.rails) {
    const railY0 = rail.offsetMm
    const railY1 = rail.offsetMm + rail.depthMm
    const overlap = Math.min(box.y1, railY1) - Math.max(box.y0, railY0)
    if (overlap > 0) {
      total += overlap
      rails += 1
    }
  }
  return { total, rails }
}

/**
 * Check a layout somebody has arranged by hand (or that auto-arrange produced).
 *
 * Reports everything wrong rather than stopping at the first problem: a player
 * dragging pedals around wants to see all of it, and a list that changes
 * length as you fix things is how a tool feels responsive.
 */
export function checkLayout(
  board: BoardSpec,
  items: LayoutItem[],
  placements: Placement[],
  options: LayoutOptions = {},
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const gap = gapFor(options)
  const byKey = new Map(items.map((i) => [i.key, i]))

  const boxes: { key: string; item: LayoutItem; box: Box }[] = []
  for (const placement of placements) {
    const item = byKey.get(placement.key)
    if (!item) continue
    boxes.push({ key: placement.key, item, box: boxOf(item, placement) })
  }

  for (const { key, item, box } of boxes) {
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > board.usableWidthMm || box.y1 > board.usableDepthMm) {
      issues.push({
        kind: "off-board",
        severity: "fatal",
        key,
        message: `${item.label} hangs off the edge of the ${board.brand} ${board.model}.`,
      })
      // No point checking rails for something already off the board.
      continue
    }

    const contact = railContact(board, box)
    if (contact.rails === 0) {
      issues.push({
        kind: "off-rail",
        severity: "fatal",
        key,
        message: `${item.label} is floating over a gap between the rails, with nothing under it to mount to.`,
      })
    } else if (contact.rails === 1 && contact.total < MIN_RAIL_CONTACT_MM) {
      issues.push({
        kind: "off-rail",
        severity: "warn",
        key,
        message: `${item.label} only catches ${Math.round(contact.total)}mm of rail. It will mount, but there is not much for the hook and loop to hold.`,
      })
    }

    if (item.treadle && box.y1 > board.usableDepthMm - TREADLE_TOE_ROOM_MM) {
      issues.push({
        kind: "too-tight",
        severity: "warn",
        key,
        message: `${item.label} is a treadle right at the front edge. Leave about ${TREADLE_TOE_ROOM_MM}mm in front of it so your foot has room to rock it.`,
      })
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (overlapping(a.box, b.box)) {
        issues.push({
          kind: "overlap",
          severity: "fatal",
          key: b.key,
          message: `${a.item.label} and ${b.item.label} are on top of each other.`,
        })
      } else if (tooClose(a.box, b.box, gap)) {
        issues.push({
          kind: "too-tight",
          severity: "warn",
          key: b.key,
          message: `${a.item.label} and ${b.item.label} are closer than ${gap}mm. They fit on screen, but there is no room for the plugs between them.`,
        })
      }
    }
  }

  return issues
}

/**
 * Lay a chain out automatically.
 *
 * Rows front to back, each filled left to right IN THE ORDER GIVEN, which is
 * signal order. That is not an arbitrary choice: a board wired left to right
 * along the front is what most people build, it keeps patch runs short, and it
 * means the finished picture matches the chain diagram beside it.
 *
 * Front row first because the front rail is the one you stomp. Pedals you
 * switch constantly want to be nearest your foot, and the ones further back
 * tend to be set-and-forget.
 *
 * Treadles are pulled out and placed first, at the left end. They are much
 * deeper than everything else, so packing them in sequence would leave a
 * ragged hole in the middle of a row, and in practice a wah lives at one end
 * of the board anyway.
 */
export function autoArrange(
  board: BoardSpec,
  items: LayoutItem[],
  options: LayoutOptions = {},
): LayoutResult {
  const gap = gapFor(options)
  const placements: Placement[] = []
  const unplaced: string[] = []

  const treadles = items.filter((i) => i.treadle)
  const rest = items.filter((i) => !i.treadle)

  /*
   * Reserve toe room the moment a treadle is in play.
   *
   * Without this the arranger packs the wah flush to the front edge and then
   * its own checker warns about the layout it just produced, which makes the
   * tool look like it is arguing with itself. The whole front row moves back,
   * not just the treadle: the front row is the one you stomp, so the clearance
   * is useful there regardless.
   */
  const toeRoom = treadles.length > 0 ? TREADLE_TOE_ROOM_MM : 0

  // Rows are laid from the front edge backwards, each as deep as its tallest
  // member, so a row of compacts does not reserve a wah's worth of depth.
  let rowBackY = board.usableDepthMm - toeRoom
  let cursorX = 0
  let rowDepth = 0

  function startNewRow(depth: number): boolean {
    const nextBack = rowBackY - rowDepth - (rowDepth > 0 ? gap : 0)
    if (nextBack - depth < 0) return false
    rowBackY = nextBack
    cursorX = 0
    rowDepth = 0
    return true
  }

  function place(item: LayoutItem): boolean {
    const { widthMm, depthMm } = rotatedFootprint(item, 0)
    if (widthMm > board.usableWidthMm || depthMm > board.usableDepthMm) return false

    const needsNewRow = cursorX > 0 && cursorX + gap + widthMm > board.usableWidthMm
    if (needsNewRow && !startNewRow(depthMm)) return false

    // A taller item than the current row allows means the row has to deepen,
    // which can push it off the back of the board.
    if (depthMm > rowDepth && rowBackY - depthMm < 0) {
      if (!startNewRow(depthMm)) return false
    }

    const x = cursorX === 0 ? 0 : cursorX + gap
    if (x + widthMm > board.usableWidthMm) return false

    const y = rowBackY - depthMm
    if (y < 0) return false

    placements.push({ key: item.key, xMm: x, yMm: y, rotation: 0 })
    cursorX = x + widthMm
    rowDepth = Math.max(rowDepth, depthMm)
    return true
  }

  for (const item of [...treadles, ...rest]) {
    if (!place(item)) unplaced.push(item.key)
  }

  const byKey = new Map(items.map((i) => [i.key, i]))
  const usedAreaMm2 = placements.reduce((sum, p) => {
    const item = byKey.get(p.key)
    if (!item) return sum
    const { widthMm, depthMm } = rotatedFootprint(item, p.rotation)
    return sum + widthMm * depthMm
  }, 0)

  const boardAreaMm2 = board.usableWidthMm * board.usableDepthMm
  const issues = checkLayout(board, items, placements, options)

  if (unplaced.length > 0) {
    issues.push({
      kind: "no-room",
      severity: "fatal",
      key: null,
      message: `${unplaced.length} pedal${unplaced.length === 1 ? " does" : "s do"} not fit on the ${board.brand} ${board.model} with ${gap}mm for plugs. Try a bigger board, or flat plugs.`,
    })
  }

  return {
    placements,
    issues,
    unplaced,
    usedAreaMm2,
    boardAreaMm2,
    utilisation: boardAreaMm2 > 0 ? usedAreaMm2 / boardAreaMm2 : 0,
  }
}

/**
 * The smallest board in a list that takes this chain.
 *
 * Runs the real arranger rather than comparing areas, because area is not the
 * question: rails, row breaks and plug gaps all decide it, and a board with
 * ample area can still fail a chain of deep pedals.
 */
export function smallestBoardFor(
  boards: BoardSpec[],
  items: LayoutItem[],
  options: LayoutOptions = {},
): BoardSpec | null {
  const bySize = [...boards].sort(
    (a, b) => a.usableWidthMm * a.usableDepthMm - b.usableWidthMm * b.usableDepthMm,
  )
  for (const board of bySize) {
    const result = autoArrange(board, items, options)
    if (result.unplaced.length === 0 && result.issues.every((i) => i.severity !== "fatal")) {
      return board
    }
  }
  return null
}
