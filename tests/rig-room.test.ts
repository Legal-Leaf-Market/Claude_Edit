import { describe, expect, it } from "vitest"
import { buildScene, chainOrder, demoRig } from "@/lib/rig-room/scene"
import { encodeRig } from "@/lib/pedalboard/board-url"
import { PEDALS } from "@/lib/pedalboard/catalog/pedals"
import { BOARDS, DEFAULT_BOARD_ID } from "@/lib/pedalboard/catalog/boards"

/**
 * The rig room's geometry.
 *
 * These exist because the alternative is a canvas. Everything this file
 * asserts is arithmetic that would render as "approximately fine" and be
 * invisible to review: a pedal sunk an inch into the board, a cable joined to
 * the wrong neighbour, a shared link that silently drops half a rig. Keeping
 * the maths in lib/rig-room/scene.ts and out of the three.js component is what
 * makes any of it assertable at all.
 *
 * They also pin the property that justified building this in the web stack
 * rather than in a game engine: the scene is derived from the SAME catalogue
 * and the SAME codec the planner uses, so the two cannot disagree about what a
 * rig is.
 */

const first = (n: number) => PEDALS.filter((p) => !p.offBoard && !p.treadle).slice(0, n)

function rigOf(pedals: { id: string }[]) {
  return encodeRig({
    boardId: DEFAULT_BOARD_ID,
    supplyId: null,
    placements: pedals.map((p, i) => ({ key: p.id, xMm: 20 + i * 100, yMm: 60, rotation: 0 as const })),
  })
}

describe("buildScene", () => {
  it("reads the planner's own rig format, so a link opens rather than exports", () => {
    const pedals = first(3)
    const scene = buildScene(rigOf(pedals))

    expect(scene.isDemo).toBe(false)
    expect(scene.boxes.map((b) => b.key)).toEqual(pedals.map((p) => p.id))
  })

  /*
   * Every dimension comes from the catalogue. A 3D view that quietly rounded
   * pedals to a uniform block would lose the only thing it adds over the plan
   * view, and would make a Big Muff look like a Phase 90.
   */
  it("draws each pedal at its real catalogue size, including height", () => {
    const pedal = first(1)[0]
    const scene = buildScene(rigOf([pedal]))
    const box = scene.boxes[0]

    expect(box.widthMm).toBe(pedal.dims.widthMm)
    expect(box.depthMm).toBe(pedal.dims.depthMm)
    expect(box.heightMm).toBe(pedal.dims.heightMm)
  })

  it("falls back to a real board rather than inventing one", () => {
    const scene = buildScene(rigOf(first(2)))
    expect(BOARDS.some((b) => b.id === scene.board.id)).toBe(true)
  })

  /*
   * A shared link outlives a catalogue rename. Rendering a placeholder of
   * invented size at a real coordinate would be the 3D equivalent of
   * publishing a market price from two listings.
   */
  it("drops a pedal it cannot identify instead of guessing at its size", () => {
    const known = first(2)
    const encoded = encodeRig({
      boardId: DEFAULT_BOARD_ID,
      supplyId: null,
      placements: [
        { key: known[0].id, xMm: 20, yMm: 60, rotation: 0 },
        { key: "a-pedal-that-was-renamed", xMm: 140, yMm: 60, rotation: 0 },
        { key: known[1].id, xMm: 260, yMm: 60, rotation: 0 },
      ],
    })

    const scene = buildScene(encoded)

    expect(scene.boxes.map((b) => b.key)).toEqual([known[0].id, known[1].id])
  })

  /*
   * Rotation is delegated to the planner's boxOf, so a rotated pedal occupies
   * exactly the footprint the collision checker thinks it does. A second
   * implementation here is how the two views would drift apart.
   */
  it("swaps width and depth for a pedal turned on its side", () => {
    const pedal = first(1)[0]
    const upright = buildScene(
      encodeRig({ boardId: DEFAULT_BOARD_ID, supplyId: null, placements: [{ key: pedal.id, xMm: 20, yMm: 60, rotation: 0 }] }),
    ).boxes[0]
    const turned = buildScene(
      encodeRig({ boardId: DEFAULT_BOARD_ID, supplyId: null, placements: [{ key: pedal.id, xMm: 20, yMm: 60, rotation: 90 }] }),
    ).boxes[0]

    expect(turned.widthMm).toBe(upright.depthMm)
    expect(turned.depthMm).toBe(upright.widthMm)
  })

  it("renders a demonstration board rather than an empty room", () => {
    const scene = buildScene(null)

    expect(scene.isDemo).toBe(true)
    expect(scene.boxes.length).toBeGreaterThan(2)
    expect(scene.cables.length).toBe(scene.boxes.length - 1)
  })

  it("treats an unparseable rig as no rig at all", () => {
    expect(buildScene("not~a~rig").isDemo).toBe(true)
  })
})

describe("cables", () => {
  /*
   * THE POINT OF DRAWING THEM AT ALL. Pedals are arranged in rows to fit a
   * board, so board order and signal order are different. Cabling between
   * board neighbours would look tidier and be a lie about how the rig is
   * wired.
   */
  it("runs in signal order rather than board order", () => {
    const delay = PEDALS.find((p) => p.type === "delay" && !p.offBoard)
    const drive = PEDALS.find((p) => p.type === "drive" && !p.offBoard)
    expect(delay && drive).toBeTruthy()

    // Delay placed FIRST on the board, drive second.
    const encoded = encodeRig({
      boardId: DEFAULT_BOARD_ID,
      supplyId: null,
      placements: [
        { key: delay!.id, xMm: 20, yMm: 60, rotation: 0 },
        { key: drive!.id, xMm: 200, yMm: 60, rotation: 0 },
      ],
    })

    const scene = buildScene(encoded)
    const byKey = new Map(scene.boxes.map((b) => [b.key, b]))

    // The drive still comes first in the chain, despite sitting to the right.
    expect(byKey.get(drive!.id)?.chainPosition).toBe(1)
    expect(byKey.get(delay!.id)?.chainPosition).toBe(2)
    expect(scene.cables[0].fromKey).toBe(drive!.id)
    expect(scene.cables[0].toKey).toBe(delay!.id)
  })

  it("joins every pedal exactly once, with no cable to nowhere", () => {
    const scene = buildScene(rigOf(first(4)))
    const keys = new Set(scene.boxes.map((b) => b.key))

    expect(scene.cables).toHaveLength(3)
    for (const cable of scene.cables) {
      expect(keys.has(cable.fromKey)).toBe(true)
      expect(keys.has(cable.toKey)).toBe(true)
      expect(cable.fromKey).not.toBe(cable.toKey)
    }
  })

  it("needs no cable for a single pedal", () => {
    expect(buildScene(rigOf(first(1))).cables).toHaveLength(0)
  })

  /** Jacks sit above the board, never through it. */
  it("puts cable ends at a plausible jack height", () => {
    const scene = buildScene(rigOf(first(3)))
    for (const cable of scene.cables) {
      expect(cable.from.zMm).toBeGreaterThan(0)
      expect(cable.to.zMm).toBeGreaterThan(0)
    }
  })
})

describe("chainOrder", () => {
  it("is stable for two pedals of the same family, using board position", () => {
    const boxes = [
      { key: "b", xMm: 200, type: "drive" as const },
      { key: "a", xMm: 20, type: "drive" as const },
    ].map((b) => ({ ...b, label: b.key, brand: "", model: "", gearSlug: null, yMm: 0, widthMm: 10, depthMm: 10, heightMm: 10, rotation: 0 as const, colour: "#fff" }))

    expect(chainOrder(boxes)).toEqual(["a", "b"])
  })
})

describe("demoRig", () => {
  it("uses only real catalogue pedals, so nothing on screen is invented", () => {
    const ids = new Set(PEDALS.map((p) => p.id))
    for (const placement of demoRig().placements) {
      expect(ids.has(placement.key)).toBe(true)
    }
  })

  it("lays them out on a real board", () => {
    expect(BOARDS.some((b) => b.id === demoRig().boardId)).toBe(true)
  })
})
