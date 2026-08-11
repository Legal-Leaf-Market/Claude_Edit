import { describe, expect, it } from "vitest"
import { planCables, STANDARD_PATCH_LENGTHS_MM } from "@/lib/pedalboard/cables"
import { autoArrange, type LayoutItem } from "@/lib/pedalboard/layout"
import { boardById } from "@/lib/pedalboard/catalog/boards"

/**
 * The patch cable plan.
 *
 * The point of this module is the count people get wrong and the lengths they
 * under-buy, so those are what the tests pin.
 */

function block(key: string, widthMm = 70, depthMm = 120): LayoutItem {
  return { key, label: key, widthMm, depthMm }
}

describe("patch count", () => {
  /**
   * The off-by-one that costs a second order. Nine pedals is EIGHT patches,
   * plus two instrument leads that are not patches at all.
   */
  it("is one fewer than the pedal count, with the two leads counted separately", () => {
    const items = Array.from({ length: 9 }, (_, i) => block(`p${i}`))
    const board = boardById("pedaltrain-novo-24")!
    const { placements } = autoArrange(board, items)

    const plan = planCables(items, placements)

    expect(plan.patchCount).toBe(8)
    expect(plan.instrumentLeads).toBe(2)
    expect(plan.notes[0]).toMatch(/plus a lead in from the guitar/i)
  })

  it("needs no patches for a single pedal, but still two leads", () => {
    const items = [block("only")]
    const board = boardById("pedaltrain-nano")!
    const { placements } = autoArrange(board, items)

    const plan = planCables(items, placements)
    expect(plan.patchCount).toBe(0)
    expect(plan.instrumentLeads).toBe(2)
  })

  it("plans nothing at all for an empty board", () => {
    const plan = planCables([], [])
    expect(plan.patchCount).toBe(0)
    expect(plan.instrumentLeads).toBe(0)
    expect(plan.hops).toHaveLength(0)
  })
})

describe("lengths", () => {
  it("only ever recommends a length you can actually buy", () => {
    const items = Array.from({ length: 6 }, (_, i) => block(`p${i}`))
    const board = boardById("pedaltrain-classic-2")!
    const { placements } = autoArrange(board, items)

    for (const hop of planCables(items, placements).hops) {
      expect(STANDARD_PATCH_LENGTHS_MM).toContain(hop.recommendedMm)
    }
  })

  /**
   * Erring long is free: you dress the slack under the board. Erring short
   * means another order, so the recommendation must always clear the gap.
   */
  it("always recommends more than the raw gap, never less", () => {
    const items = Array.from({ length: 5 }, (_, i) => block(`p${i}`))
    const board = boardById("pedaltrain-classic-2")!
    const { placements } = autoArrange(board, items)

    for (const hop of planCables(items, placements).hops) {
      expect(hop.recommendedMm).toBeGreaterThan(hop.gapMm)
    }
  })

  it("asks for more cable when the hop crosses rows than when it does not", () => {
    const items = [block("a"), block("b")]

    const sameRow = planCables(items, [
      { key: "a", xMm: 0, yMm: 0, rotation: 0 },
      { key: "b", xMm: 90, yMm: 0, rotation: 0 },
    ])
    const acrossRows = planCables(items, [
      { key: "a", xMm: 0, yMm: 0, rotation: 0 },
      { key: "b", xMm: 0, yMm: 300, rotation: 0 },
    ])

    expect(sameRow.hops[0].crossesRow).toBe(false)
    expect(acrossRows.hops[0].crossesRow).toBe(true)
    expect(acrossRows.hops[0].recommendedMm).toBeGreaterThan(sameRow.hops[0].recommendedMm)
  })

  it("groups the recommendation into a shopping list, shortest first", () => {
    const items = Array.from({ length: 6 }, (_, i) => block(`p${i}`))
    const board = boardById("pedaltrain-classic-2")!
    const { placements } = autoArrange(board, items)

    const plan = planCables(items, placements)
    const total = plan.byLength.reduce((sum, entry) => sum + entry.count, 0)

    expect(total).toBe(plan.patchCount)
    const lengths = plan.byLength.map((e) => e.lengthMm)
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths)
  })
})

describe("chain order versus board order", () => {
  /**
   * The reason a cable plan is worth having at all. Signal order is not
   * necessarily left-to-right, and a chain that doubles back needs longer runs
   * than the picture suggests.
   */
  it("measures the doubling-back, not the picture", () => {
    const items = [block("first"), block("second"), block("third")]
    const placements = [
      { key: "first", xMm: 0, yMm: 0, rotation: 0 as const },
      { key: "second", xMm: 600, yMm: 0, rotation: 0 as const },
      { key: "third", xMm: 90, yMm: 0, rotation: 0 as const },
    ]

    const plan = planCables(items, placements)

    // first -> second crosses the whole board and needs far more than
    // second -> third, which comes almost all the way back.
    expect(plan.hops[0].gapMm).toBeGreaterThan(400)
    expect(plan.hops[0].recommendedMm).toBeGreaterThanOrEqual(plan.hops[1].recommendedMm)
  })

  it("skips a chain entry that was never placed on the board", () => {
    const items = [block("a"), block("ghost"), block("b")]
    const placements = [
      { key: "a", xMm: 0, yMm: 0, rotation: 0 as const },
      { key: "b", xMm: 90, yMm: 0, rotation: 0 as const },
    ]

    const plan = planCables(items, placements)
    expect(plan.patchCount).toBe(1)
    expect(plan.hops[0].fromKey).toBe("a")
    expect(plan.hops[0].toKey).toBe("b")
  })
})

describe("notes", () => {
  it("warns that straight plugs eat a row", () => {
    const items = Array.from({ length: 5 }, (_, i) => block(`p${i}`))
    const board = boardById("pedaltrain-classic-2")!
    const { placements } = autoArrange(board, items, { plug: "straight" })

    const plan = planCables(items, placements, "straight")
    expect(plan.notes.some((n) => /straight plugs/i.test(n))).toBe(true)
  })

  it("suggests a solderless kit once a run gets long", () => {
    const items = [block("a"), block("b")]
    const plan = planCables(items, [
      { key: "a", xMm: 0, yMm: 0, rotation: 0 },
      { key: "b", xMm: 550, yMm: 0, rotation: 0 },
    ])

    expect(plan.notes.some((n) => /solderless/i.test(n))).toBe(true)
  })
})
