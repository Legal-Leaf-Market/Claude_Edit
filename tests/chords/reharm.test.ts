import { describe, expect, it } from "vitest"
import { chordOf, chordPitchClasses } from "@/lib/chords/quality"
import { tritoneSub, alterDominant, extend, secondaryDominant } from "@/lib/chords/reharm"
import { pc } from "@/lib/chords/pitch"
import type { Key } from "@/lib/chords/key"

const C: Key = { tonic: 0, mode: "major" }

/**
 * THE THREE BUTTONS THAT LIED, pinned one at a time. Each of these was live in
 * the uploaded studio and each failed silently: a label changed and the notes
 * did not, or a hard-coded chord replaced whatever you pressed it on.
 */
describe("reharmonisation changes the notes", () => {
  it("substitutes the dominant a tritone away, not always Db7", () => {
    for (const root of [0, 2, 5, 7, 9, 11]) {
      const dom = chordOf(root, "dom7")!
      const out = tritoneSub(dom, C)
      expect(out.chord, `no sub for root ${root}`).not.toBeNull()
      expect(out.chord!.root).toBe(pc(root + 6))
    }
  })

  it("keeps the third and seventh across a tritone sub", () => {
    const g7 = chordOf(7, "dom7")!
    const sub = tritoneSub(g7, C).chord!
    const before = chordPitchClasses(g7)
    const after = chordPitchClasses(sub)
    /* B and F, the tritone, must survive. */
    expect(before.has(11) && after.has(11)).toBe(true)
    expect(before.has(5) && after.has(5)).toBe(true)
  })

  it("refuses to substitute anything that is not a dominant", () => {
    for (const id of ["maj7", "min7", "min7b5", "dim7", "69"]) {
      const out = tritoneSub(chordOf(0, id)!, C)
      expect(out.chord, `${id} should have no tritone sub`).toBeNull()
      expect(out.why).toMatch(/dominant/i)
    }
  })

  it("removes the natural fifth when it alters a dominant", () => {
    const g7 = chordOf(7, "dom7")!
    expect(chordPitchClasses(g7).has(pc(7 + 7))).toBe(true)
    const alt = alterDominant(g7, C).chord!
    expect(alt.quality.id).toBe("dom7alt")
    expect(chordPitchClasses(alt).has(pc(7 + 7))).toBe(false)
    expect(chordPitchClasses(alt).has(pc(7 + 1))).toBe(true)
  })

  it("alters back to plain, so the toggle is a toggle", () => {
    const g7 = chordOf(7, "dom7")!
    const alt = alterDominant(g7, C).chord!
    expect(alterDominant(alt, C).chord!.quality.id).toBe("dom7")
  })

  it("refuses to alter anything that is not a dominant", () => {
    expect(alterDominant(chordOf(0, "maj7")!, C).chord).toBeNull()
  })

  it("walks the extension ladder and then stops with a reason", () => {
    const dom7 = chordOf(7, "dom7")!
    const dom9 = extend(dom7, C).chord!
    expect(dom9.quality.id).toBe("dom9")
    const dom13 = extend(dom9, C).chord!
    expect(dom13.quality.id).toBe("dom13")
    const stop = extend(dom13, C)
    expect(stop.chord).toBeNull()
    expect(stop.why.length).toBeGreaterThan(20)
  })

  it("puts a secondary dominant a fifth above its target", () => {
    for (const root of [0, 3, 8]) {
      const target = chordOf(root, "min7")!
      const five = secondaryDominant(target, C).chord!
      expect(five.root).toBe(pc(root + 7))
      expect(five.quality.id).toBe("dom7")
    }
  })
})
