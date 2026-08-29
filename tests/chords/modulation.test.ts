import { describe, expect, it } from "vitest"
import { chordSymbol } from "@/lib/chords/quality"
import { keyName, numeralIn, type Key } from "@/lib/chords/key"
import { planModulation, pivotChords } from "@/lib/chords/modulation"

const K = (tonic: number, mode: "major" | "minor" = "major"): Key => ({ tonic, mode })

/**
 * THE BUG THIS FILE EXISTS TO PREVENT.
 *
 * The uploaded studio's planner read neither key dropdown: every strategy
 * emitted the same four hard-coded grips with the chosen names pasted on, and
 * asserted Am7 was the vi of the source and the ii of the target. True for
 * C to G. False for everything else it offered, silently.
 */
describe("the planner reads both keys", () => {
  it("finds a pivot that really belongs to both", () => {
    for (const [from, to] of [[0, 7], [7, 2], [3, 8], [10, 5], [2, 9]] as const) {
      const plan = planModulation(K(from), K(to), "pivot")
      expect(plan.steps.length, `${keyName(K(from))} -> ${keyName(K(to))}`).toBeGreaterThan(0)
      const pivot = plan.steps[1]
      expect(numeralIn(K(from), pivot.chord), "pivot is foreign to the source key").not.toBeNull()
      expect(numeralIn(K(to), pivot.chord), "pivot is foreign to the target key").not.toBeNull()
    }
  })

  it("gives a different pivot for a different pair", () => {
    const a = planModulation(K(0), K(7), "pivot").steps[1]
    const b = planModulation(K(3), K(10), "pivot").steps[1]
    expect(chordSymbol(a.chord, false)).not.toBe(chordSymbol(b.chord, false))
  })

  it("refuses to invent a pivot between distant keys", () => {
    const plan = planModulation(K(0), K(6), "pivot")
    expect(pivotChords(K(0), K(6))).toEqual([])
    expect(plan.steps).toEqual([])
    expect(plan.note).toMatch(/no pivot|not one diatonic/i)
  })

  it("always targets the destination's own dominant", () => {
    for (const to of [0, 1, 5, 8, 11]) {
      const plan = planModulation(K(2), K(to), "dominant")
      const v7 = plan.steps[1]
      expect(v7.chord.root).toBe((to + 7) % 12)
      expect(v7.chord.quality.id).toBe("dom7")
    }
  })

  it("puts the tritone sub a semitone above the destination", () => {
    for (const to of [0, 4, 9]) {
      const plan = planModulation(K(2), K(to), "tritone")
      expect(plan.steps[1].chord.root).toBe((to + 1) % 12)
      expect(plan.steps[1].chord.quality.family).toBe("dominant")
    }
  })

  it("says a chromatic mediant is not one when it is not", () => {
    const notAThird = planModulation(K(0), K(7), "chromatic-mediant")
    expect(notAThird.steps).toEqual([])
    expect(notAThird.note).toMatch(/not one/i)

    const isAThird = planModulation(K(0), K(4), "chromatic-mediant")
    expect(isAThird.steps.length).toBe(2)
  })

  it("never claims a common tone that is not there", () => {
    for (const from of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (const to of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        if (from === to) continue
        const plan = planModulation(K(from), K(to), "common-tone")
        if (!plan.steps.length) continue
        const a = new Set(plan.steps[0].chord.quality.degrees.map((d) => (from + d.semitones) % 12))
        const b = new Set(plan.steps[1].chord.quality.degrees.map((d) => (to + d.semitones) % 12))
        const shared = [...a].filter((p) => b.has(p))
        expect(shared.length, `${from} -> ${to} claims a common tone with none`).toBeGreaterThan(0)
      }
    }
  })

  it("names the same key as the same key", () => {
    const plan = planModulation(K(0), K(0), "pivot")
    expect(plan.steps).toEqual([])
    expect(plan.note).toMatch(/same key/i)
  })
})

describe("the prose is about these two keys", () => {
  it("names the actual pivot and the actual dominant", () => {
    const plan = planModulation(K(3), K(10), "pivot")
    expect(plan.note).toContain(chordSymbol(plan.steps[1].chord, true))
    expect(plan.note).toContain(keyName(K(3)))
    expect(plan.note).toContain(keyName(K(10)))
  })

  it("names the shared tritone in a tritone substitution", () => {
    /* G7 and Db7 share B and F. The explanation has to say so about the real
       pair, not about the pair somebody typed once. */
    const plan = planModulation(K(2), K(0), "tritone")
    expect(plan.note).toContain("B")
    expect(plan.note).toContain("F")
  })
})
