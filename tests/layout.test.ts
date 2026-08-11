import { describe, expect, it } from "vitest"
import {
  autoArrange,
  boxOf,
  checkLayout,
  PLUG_PROFILES,
  railContact,
  smallestBoardFor,
  type LayoutItem,
} from "@/lib/pedalboard/layout"
import { BOARDS, boardById } from "@/lib/pedalboard/catalog/boards"
import { pedalById } from "@/lib/pedalboard/catalog/pedals"
import { findPedalSpec, resolvePedal } from "@/lib/pedalboard/catalog"
import type { BoardSpec } from "@/lib/pedalboard/catalog/types"

/**
 * The layout engine.
 *
 * The interesting cases are all the ones where a layout looks fine and is not
 * buildable: a pedal floating over a rail gap, two pedals with no room for the
 * plugs between them, a wah with nowhere for your foot. Those are what a
 * to-scale planner is for; drawing rectangles is the easy half.
 */

function board(id: string): BoardSpec {
  const found = boardById(id)
  if (!found) throw new Error(`board missing: ${id}`)
  return found
}

function item(pedalId: string, key = pedalId): LayoutItem {
  const spec = pedalById(pedalId)
  if (!spec) throw new Error(`pedal missing: ${pedalId}`)
  return {
    key,
    label: `${spec.brand} ${spec.model}`,
    widthMm: spec.dims.widthMm,
    depthMm: spec.dims.depthMm,
    treadle: spec.treadle,
  }
}

/** A plain rectangle, for geometry tests that should not depend on the catalogue. */
function block(key: string, widthMm: number, depthMm: number, treadle = false): LayoutItem {
  return { key, label: key, widthMm, depthMm, treadle }
}

describe("boxOf", () => {
  it("swaps width and depth on a quarter turn", () => {
    const b = block("a", 70, 120)
    expect(boxOf(b, { key: "a", xMm: 0, yMm: 0, rotation: 0 })).toEqual({ x0: 0, y0: 0, x1: 70, y1: 120 })
    expect(boxOf(b, { key: "a", xMm: 0, yMm: 0, rotation: 90 })).toEqual({ x0: 0, y0: 0, x1: 120, y1: 70 })
    expect(boxOf(b, { key: "a", xMm: 0, yMm: 0, rotation: 180 })).toEqual({ x0: 0, y0: 0, x1: 70, y1: 120 })
  })
})

describe("rails", () => {
  /**
   * The failure a rectangle-only planner cannot see. A Pedaltrain is parallel
   * rails with air between them, and a short pedal parked over the gap has
   * nothing under it to stick to.
   */
  it("catches a pedal floating over the gap between rails", () => {
    const classic = board("pedaltrain-classic-2")
    const gapCentre = (classic.rails[0].offsetMm + classic.rails[0].depthMm + classic.rails[1].offsetMm) / 2
    const small = block("floater", 60, 20)

    const issues = checkLayout(classic, [small], [
      { key: "floater", xMm: 100, yMm: gapCentre - 10, rotation: 0 },
    ])

    const offRail = issues.find((i) => i.kind === "off-rail")
    expect(offRail?.severity).toBe("fatal")
    expect(offRail?.message).toMatch(/floating over a gap/i)
  })

  it("accepts a pedal sitting squarely on a rail", () => {
    const classic = board("pedaltrain-classic-2")
    const rail = classic.rails[0]
    const pedal = block("ok", 70, 120)

    const issues = checkLayout(classic, [pedal], [
      { key: "ok", xMm: 20, yMm: rail.offsetMm, rotation: 0 },
    ])

    expect(issues.filter((i) => i.kind === "off-rail")).toHaveLength(0)
  })

  it("treats a solid-surface board as supported everywhere", () => {
    const temple = board("temple-audio-duo-17")
    const small = block("anywhere", 40, 30)

    const issues = checkLayout(temple, [small], [
      { key: "anywhere", xMm: 120, yMm: 90, rotation: 0 },
    ])

    expect(issues.filter((i) => i.kind === "off-rail")).toHaveLength(0)
  })

  it("measures contact across every rail a pedal touches", () => {
    const classic = board("pedaltrain-classic-2")
    const spanning = { x0: 0, y0: 0, x1: 100, y1: classic.usableDepthMm }
    const contact = railContact(classic, spanning)

    expect(contact.rails).toBe(classic.rails.length)
    expect(contact.total).toBeGreaterThan(0)
  })
})

describe("cable clearance", () => {
  /**
   * Two pedals touching edge to edge fit on screen and do not fit in life.
   * This is the check nobody else does well, so it gets pinned hard.
   */
  it("flags pedals with no room for a plug between them", () => {
    const b = board("pedaltrain-classic-2")
    const a = block("a", 70, 120)
    const c = block("b", 70, 120)
    const rail = b.rails[0].offsetMm

    const issues = checkLayout(
      b,
      [a, c],
      [
        { key: "a", xMm: 0, yMm: rail, rotation: 0 },
        { key: "b", xMm: 74, yMm: rail, rotation: 0 }, // 4mm apart
      ],
      { plug: "right" },
    )

    const tight = issues.find((i) => i.kind === "too-tight")
    expect(tight?.severity).toBe("warn")
    expect(tight?.message).toMatch(/no room for the plugs/i)
  })

  it("accepts the same pair once they are a right-angle plug apart", () => {
    const b = board("pedaltrain-classic-2")
    const rail = b.rails[0].offsetMm
    const gap = PLUG_PROFILES.right.gapMm

    const issues = checkLayout(
      b,
      [block("a", 70, 120), block("b", 70, 120)],
      [
        { key: "a", xMm: 0, yMm: rail, rotation: 0 },
        { key: "b", xMm: 70 + gap + 1, yMm: rail, rotation: 0 },
      ],
      { plug: "right" },
    )

    expect(issues.filter((i) => i.kind === "too-tight")).toHaveLength(0)
  })

  /** Flat plugs buy back 10mm a join, which is exactly why people use them. */
  it("passes a spacing on flat plugs that fails on straight ones", () => {
    const b = board("pedaltrain-classic-2")
    const rail = b.rails[0].offsetMm
    const placements = [
      { key: "a", xMm: 0, yMm: rail, rotation: 0 as const },
      { key: "b", xMm: 80, yMm: rail, rotation: 0 as const },
    ]
    const items = [block("a", 70, 120), block("b", 70, 120)]

    expect(checkLayout(b, items, placements, { plug: "flat" }).filter((i) => i.kind === "too-tight")).toHaveLength(0)
    expect(checkLayout(b, items, placements, { plug: "straight" }).filter((i) => i.kind === "too-tight").length).toBeGreaterThan(0)
  })
})

describe("overlap and bounds", () => {
  it("calls a genuine overlap fatal, not merely tight", () => {
    const b = board("pedaltrain-classic-2")
    const rail = b.rails[0].offsetMm
    const issues = checkLayout(b, [block("a", 70, 120), block("b", 70, 120)], [
      { key: "a", xMm: 0, yMm: rail, rotation: 0 },
      { key: "b", xMm: 30, yMm: rail, rotation: 0 },
    ])

    const overlap = issues.find((i) => i.kind === "overlap")
    expect(overlap?.severity).toBe("fatal")
  })

  it("catches a pedal hanging off the edge", () => {
    const b = board("pedaltrain-nano")
    const issues = checkLayout(b, [block("a", 70, 120)], [
      { key: "a", xMm: b.usableWidthMm - 20, yMm: 0, rotation: 0 },
    ])

    expect(issues.some((i) => i.kind === "off-board" && i.severity === "fatal")).toBe(true)
  })
})

describe("treadles", () => {
  it("asks for foot room in front of a wah at the board's front edge", () => {
    const b = board("pedaltrain-classic-2")
    const wah = item("dunlop-cry-baby")
    const issues = checkLayout(b, [wah], [
      { key: wah.key, xMm: 0, yMm: b.usableDepthMm - wah.depthMm, rotation: 0 },
    ])

    const tight = issues.find((i) => i.kind === "too-tight" && i.key === wah.key)
    expect(tight?.message).toMatch(/room to rock/i)
  })
})

describe("autoArrange", () => {
  it("places a small chain and reports honest utilisation", () => {
    const b = board("pedaltrain-classic-2")
    const items = [item("boss-tu-3"), item("ibanez-ts9"), item("boss-dd-3"), item("boss-rv-6")]

    const result = autoArrange(b, items)

    expect(result.unplaced).toHaveLength(0)
    expect(result.placements).toHaveLength(4)
    expect(result.utilisation).toBeGreaterThan(0)
    expect(result.utilisation).toBeLessThan(1)
    expect(result.issues.filter((i) => i.severity === "fatal")).toHaveLength(0)
  })

  it("keeps the given order left to right, which is signal order", () => {
    const b = board("pedaltrain-classic-2")
    const items = [item("boss-tu-3"), item("ibanez-ts9"), item("boss-dd-3")]

    const result = autoArrange(b, items)
    const xs = items.map((i) => result.placements.find((p) => p.key === i.key)!.xMm)

    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
  })

  it("produces a layout that passes its own checker", () => {
    const b = board("pedaltrain-novo-24")
    const items = [
      item("boss-tu-3"),
      item("ibanez-ts9"),
      item("ehx-big-muff-pi"),
      item("mxr-phase-90"),
      item("strymon-el-capistan"),
      item("strymon-flint"),
    ]

    const result = autoArrange(b, items)

    expect(result.unplaced).toHaveLength(0)
    // The arranger must not emit a layout its own validator rejects.
    expect(checkLayout(b, items, result.placements).filter((i) => i.severity === "fatal")).toHaveLength(0)
  })

  it("puts the treadle first, at the left end", () => {
    const b = board("pedaltrain-classic-2")
    const items = [item("boss-tu-3"), item("dunlop-cry-baby"), item("ibanez-ts9")]

    const result = autoArrange(b, items)
    const wah = result.placements.find((p) => p.key === "dunlop-cry-baby")!

    expect(wah.xMm).toBe(0)
  })

  it("reports what will not fit rather than dropping it silently", () => {
    const nano = board("pedaltrain-nano")
    const items = [
      item("ehx-big-muff-pi"),
      item("ehx-deluxe-memory-man"),
      item("boss-dd-500"),
      item("dunlop-cry-baby"),
    ]

    const result = autoArrange(nano, items)

    expect(result.unplaced.length).toBeGreaterThan(0)
    const noRoom = result.issues.find((i) => i.kind === "no-room")
    expect(noRoom?.severity).toBe("fatal")
    expect(noRoom?.message).toMatch(/bigger board|flat plugs/i)
  })

  /** The gap is a real constraint, so widening it must be able to cost a row. */
  it("fits fewer pedals on straight plugs than on flat ones", () => {
    const b = board("pedaltrain-metro-16")
    const items = Array.from({ length: 8 }, (_, i) => block(`p${i}`, 70, 120))

    const flat = autoArrange(b, items, { plug: "flat" })
    const straight = autoArrange(b, items, { plug: "straight" })

    expect(straight.unplaced.length).toBeGreaterThanOrEqual(flat.unplaced.length)
  })
})

describe("smallestBoardFor", () => {
  it("picks a board that genuinely takes the chain, not just one with the area", () => {
    const items = [item("boss-tu-3"), item("ibanez-ts9"), item("boss-dd-3")]
    const chosen = smallestBoardFor(BOARDS, items)

    expect(chosen).not.toBeNull()
    const result = autoArrange(chosen!, items)
    expect(result.unplaced).toHaveLength(0)
  })

  it("returns null when nothing in the list can take it", () => {
    const enormous = Array.from({ length: 60 }, (_, i) => block(`huge${i}`, 170, 140))
    expect(smallestBoardFor(BOARDS, enormous)).toBeNull()
  })

  it("needs a bigger board once a wah joins the chain", () => {
    const withoutWah = [item("boss-tu-3"), item("ibanez-ts9")]
    const withWah = [...withoutWah, item("dunlop-cry-baby")]

    const small = smallestBoardFor(BOARDS, withoutWah)
    const bigger = smallestBoardFor(BOARDS, withWah)

    expect(small).not.toBeNull()
    expect(bigger).not.toBeNull()
    const area = (b: BoardSpec) => b.usableWidthMm * b.usableDepthMm
    expect(area(bigger!)).toBeGreaterThanOrEqual(area(small!))
  })
})

describe("the board catalogue", () => {
  it("has unique ids and a usable area inside the box size", () => {
    const ids = BOARDS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const b of BOARDS) {
      expect(b.usableWidthMm, b.id).toBeGreaterThan(0)
      expect(b.usableDepthMm, b.id).toBeGreaterThan(0)
      expect(b.usableWidthMm, b.id).toBeLessThanOrEqual(b.labelWidthIn * 25.4)
      expect(b.usableDepthMm, b.id).toBeLessThanOrEqual(b.labelDepthIn * 25.4)
    }
  })

  it("keeps every rail inside the usable depth", () => {
    for (const b of BOARDS) {
      for (const rail of b.rails) {
        expect(rail.offsetMm, b.id).toBeGreaterThanOrEqual(0)
        expect(rail.offsetMm + rail.depthMm, b.id).toBeLessThanOrEqual(b.usableDepthMm + 0.5)
      }
    }
  })
})

describe("matching a listing to a physical spec", () => {
  it("finds a spec through the noise a feed title carries", () => {
    expect(findPedalSpec("Boss", "DS-1 Distortion Pedal")?.id).toBe("boss-ds-1")
    expect(findPedalSpec("BOSS", "  ds-1   distortion ")?.id).toBe("boss-ds-1")
    expect(findPedalSpec("Ibanez", "TS9 Tube Screamer Overdrive")?.id).toBe("ibanez-ts9")
  })

  it("resolves brand synonyms seen in real feeds", () => {
    expect(findPedalSpec("EHX", "Big Muff Pi")?.id).toBe("ehx-big-muff-pi")
    expect(findPedalSpec("Electro-Harmonix", "Big Muff Pi")?.id).toBe("ehx-big-muff-pi")
    expect(findPedalSpec("Jim Dunlop", "Cry Baby GCB95")?.id).toBe("dunlop-cry-baby")
  })

  /**
   * The bias that matters, and the same one CLAUDE.md section 4 takes: a pedal
   * with no spec is drawn at a neutral default and labelled an estimate, which
   * is a small inaccuracy. A pedal matched to the WRONG spec is laid out at
   * the wrong size and powered against the wrong draw, which is a confident
   * lie.
   */
  it("refuses to match across brands", () => {
    expect(findPedalSpec("Squier", "Big Muff Pi")).toBeNull()
    expect(findPedalSpec("Behringer", "TS9 Tube Screamer")).toBeNull()
  })

  it("returns null rather than guessing at an unknown pedal", () => {
    expect(findPedalSpec("Boss", "XY-9000 Imaginary")).toBeNull()
    expect(findPedalSpec("", "")).toBeNull()
  })

  it("prefers the longest matching name when two could apply", () => {
    // "Nano Big Muff Pi" must not be won by the plain "Big Muff Pi" entry.
    expect(findPedalSpec("Electro-Harmonix", "Nano Big Muff Pi")?.id).toBe("ehx-nano-big-muff")
  })
})

describe("resolvePedal", () => {
  it("marks an unmatched pedal as estimated rather than pretending", () => {
    const resolved = resolvePedal("Nobody", "Mystery Fuzz", "drive")
    expect(resolved.matched).toBe(false)
    expect(resolved.spec).toBeNull()
    expect(resolved.dims.source).toBe("estimate")
    expect(resolved.dims.widthMm).toBeGreaterThan(0)
  })

  it("still spots a treadle it has no spec for, since one eats a lot of board", () => {
    expect(resolvePedal("Nobody", "Vintage Wah", "filter").treadle).toBe(true)
    expect(resolvePedal("Nobody", "Volume Pedal", "volume").treadle).toBe(true)
    expect(resolvePedal("Nobody", "Mystery Fuzz", "drive").treadle).toBe(false)
  })

  it("carries the real dimensions through for a pedal it does know", () => {
    const resolved = resolvePedal("Boss", "DS-1 Distortion", "drive")
    expect(resolved.matched).toBe(true)
    expect(resolved.dims.widthMm).toBe(73)
    expect(resolved.dims.source).not.toBe("estimate")
  })
})

describe("autoArrange and the checker agree", () => {
  /**
   * The arranger must never produce a layout its own validator complains
   * about. It did: a wah was packed flush to the front edge and then warned
   * about for having no toe room, which makes the tool look like it is
   * arguing with itself.
   */
  it("leaves toe room, so a wah it placed does not trip its own treadle warning", () => {
    const b = board("pedaltrain-classic-2")
    const items = [item("dunlop-cry-baby"), item("boss-ds-1"), item("boss-dd-3")]

    const result = autoArrange(b, items)

    expect(result.unplaced).toHaveLength(0)
    const treadleWarnings = result.issues.filter(
      (i) => i.key === "dunlop-cry-baby" && /room to rock/i.test(i.message),
    )
    expect(treadleWarnings).toHaveLength(0)
  })

  it("emits no issues at all for a chain that comfortably fits", () => {
    const b = board("pedaltrain-novo-24")
    const items = [item("boss-tu-3"), item("ibanez-ts9"), item("boss-dd-3")]

    expect(autoArrange(b, items).issues).toHaveLength(0)
  })
})
