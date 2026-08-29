import { describe, expect, it } from "vitest"
import { pc } from "@/lib/chords/pitch"
import { chordOf, chordPitchClasses, requiredPitchClasses } from "@/lib/chords/quality"
import { tuningById, shapeToString, shapeNotes } from "@/lib/chords/fretboard"
import { voicingsFor, bestVoicing, totalMotion } from "@/lib/chords/voicing"

const std = tuningById("standard")

describe("the search finds shapes players already know", () => {
  it("finds the open C major", () => {
    const c = chordOf(0, "maj")!
    const shapes = voicingsFor(c, std, { limit: 40 }).map((v) => shapeToString(v.shape))
    expect(shapes).toContain("x-3-2-0-1-0")
  })

  it("finds the open E major", () => {
    const e = chordOf(4, "maj")!
    const shapes = voicingsFor(e, std, { limit: 40 }).map((v) => shapeToString(v.shape))
    expect(shapes).toContain("0-2-2-1-0-0")
  })

  it("finds the root-5 Dm7 bar", () => {
    const dm7 = chordOf(2, "min7")!
    const shapes = voicingsFor(dm7, std, { limit: 60 }).map((v) => shapeToString(v.shape))
    expect(shapes).toContain("x-5-7-5-6-5")
  })
})

describe("nothing it returns is a wrong chord", () => {
  const cases = [
    [0, "maj7"], [2, "min7"], [7, "dom7"], [1, "dom7s11"],
    [11, "min7b5"], [3, "maj9"], [8, "dom7alt"], [5, "min6"],
  ] as const

  it("plays only notes in the chord, and all the ones it must", () => {
    for (const [root, id] of cases) {
      const chord = chordOf(root, id)!
      const allowed = chordPitchClasses(chord)
      const needed = requiredPitchClasses(chord)
      const voicings = voicingsFor(chord, std, { limit: 12 })
      expect(voicings.length, `${id} on ${root} found nothing`).toBeGreaterThan(0)

      for (const v of voicings) {
        const notes = shapeNotes(std, v.shape)
        for (const n of notes) {
          expect(allowed.has(pc(n)), `${id}/${root} ${shapeToString(v.shape)} plays a foreign note`).toBe(true)
        }
        const present = new Set(notes.map((n) => pc(n)))
        for (const need of needed) {
          expect(present.has(need), `${id}/${root} ${shapeToString(v.shape)} is missing a required tone`).toBe(true)
        }
        expect(v.span).toBeLessThanOrEqual(4)
        expect(v.fingers).toBeLessThanOrEqual(4)
        expect(v.rootInBass).toBe(true)
      }
    }
  })

  it("keeps an altered dominant free of its natural fifth", () => {
    const alt = chordOf(7, "dom7alt")!
    for (const v of voicingsFor(alt, std, { limit: 10 })) {
      const notes = shapeNotes(std, v.shape).map((n) => pc(n - 7))
      expect(notes).not.toContain(7)
    }
  })

  it("makes a shell exactly root, third and seventh", () => {
    const g7 = chordOf(7, "dom7")!
    for (const v of voicingsFor(g7, std, { shell: true, limit: 8 })) {
      const degrees = new Set(shapeNotes(std, v.shape).map((n) => pc(n - 7)))
      expect([...degrees].sort((a, b) => a - b)).toEqual([0, 4, 10])
    }
  })
})

describe("other tunings are real, not relabelled", () => {
  it("voices a D major in DADGAD without borrowing a standard grip", () => {
    const d = chordOf(2, "maj")!
    const dadgad = tuningById("dadgad")
    const v = bestVoicing(d, dadgad)
    expect(v).not.toBeNull()
    for (const n of shapeNotes(dadgad, v!.shape)) {
      expect([2, 6, 9]).toContain(pc(n))
    }
  })
})

describe("motion is measured between pitches", () => {
  it("counts the cheapest assignment, not the string order", () => {
    expect(totalMotion([60, 64, 67], [60, 64, 67])).toBe(0)
    expect(totalMotion([60, 64, 67], [67, 64, 60])).toBe(0)
    expect(totalMotion([60], [62])).toBe(2)
  })
})
