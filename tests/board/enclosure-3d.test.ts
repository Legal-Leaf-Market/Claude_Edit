import { describe, expect, it } from "vitest"
import { enclosureSpec } from "@/lib/board/enclosure-3d"
import type { BoardItem } from "@/lib/board/model"
import { SLOTS } from "@/lib/stompbox/chain"

/**
 * The 3D pedal is generated, so its proportions are a CLAIM about real pedals
 * and belong under test the same way the chain order and the deal threshold
 * do. Nothing here renders anything: the spec is pure, which is exactly why it
 * lives in lib rather than inside the component.
 *
 * The knob-overlap test below is the reason this file exists. The first draft
 * spaced three knobs 15.75mm apart and made them 18mm wide, so the row
 * rendered as one lump, and nothing failed. Arithmetic that only reveals
 * itself in a screenshot is arithmetic a test should be holding.
 */

function item(over: Partial<BoardItem> = {}): BoardItem {
  return {
    key: "g:test",
    name: "Test Pedal",
    maker: "Nobody",
    slot: "fuzz",
    source: "guide",
    imageUrl: null,
    catalogSlug: null,
    guideSlug: "test",
    engaged: true,
    circuitKnown: true,
    ...over,
  }
}

describe("the generated enclosure", () => {
  it("gives every slot a box, so a new slot cannot render nothing", () => {
    for (const slot of SLOTS) {
      const spec = enclosureSpec(item({ slot: slot.id }))
      expect(spec.width, slot.id).toBeGreaterThan(0)
      expect(spec.depth, slot.id).toBeGreaterThan(0)
      expect(spec.height, slot.id).toBeGreaterThan(0)
    }
  })

  it("never lets two knobs in a row overlap", () => {
    for (const slot of SLOTS) {
      const spec = enclosureSpec(item({ slot: slot.id }))

      /* Group by row: knobs sharing a z are side by side. */
      const rows = new Map<number, typeof spec.knobs>()
      for (const knob of spec.knobs) {
        const row = rows.get(knob.z) ?? []
        row.push(knob)
        rows.set(knob.z, row)
      }

      for (const row of rows.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x)
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].x - sorted[i - 1].x
          const touching = sorted[i].radius + sorted[i - 1].radius
          expect(
            gap,
            `${slot.id}: knobs ${i - 1} and ${i} are ${gap.toFixed(1)}mm apart but ` +
              `${touching.toFixed(1)}mm of knob wide, so the row renders as one lump`,
          ).toBeGreaterThan(touching)
        }
      }
    }
  })

  it("keeps every knob inside the box it is mounted on", () => {
    for (const slot of SLOTS) {
      const spec = enclosureSpec(item({ slot: slot.id }))
      for (const knob of spec.knobs) {
        expect(Math.abs(knob.x) + knob.radius, slot.id).toBeLessThanOrEqual(spec.width / 2)
        expect(Math.abs(knob.z) + knob.radius, slot.id).toBeLessThanOrEqual(spec.depth / 2)
      }
    }
  })

  it("widens the box when the controls stop fitting, the way real ones do", () => {
    const fuzz = enclosureSpec(item({ slot: "fuzz" }))
    const delay = enclosureSpec(item({ slot: "delay" }))

    expect(fuzz.knobs).toHaveLength(3)
    expect(delay.knobs).toHaveLength(4)
    /* A 1590B cannot carry four knobs across 59.5mm, which is why four-knob
       pedals ship in a 1590BB. */
    expect(delay.width).toBeGreaterThan(fuzz.width)
  })

  it("puts the silkscreen clear of the footswitch and the knobs", () => {
    for (const slot of SLOTS) {
      const spec = enclosureSpec(item({ slot: slot.id }))
      const sw = spec.switches[0]

      /* The bug this pins: a fixed CSS percentage put the name underneath the
         switch on every layout that moved the free band. */
      expect(spec.legendZ, `${slot.id}: legend is on top of the footswitch`).toBeLessThan(
        sw.z - sw.radius,
      )

      for (const knob of spec.knobs) {
        expect(spec.legendZ, `${slot.id}: legend is on top of a knob`).toBeGreaterThan(
          knob.z + knob.radius,
        )
      }
    }
  })

  it("gives the treadle and the tuner no knobs rather than fake ones", () => {
    expect(enclosureSpec(item({ slot: "volume" })).knobs).toHaveLength(0)
    expect(enclosureSpec(item({ slot: "tuner" })).knobs).toHaveLength(0)
  })

  it("carries in, out and power, and puts the audio pair on opposite sides", () => {
    const spec = enclosureSpec(item())
    const audio = spec.jacks.filter((j) => j.kind === "audio")
    expect(audio).toHaveLength(2)
    expect(new Set(audio.map((j) => j.face))).toEqual(new Set(["left", "right"]))
    expect(spec.jacks.filter((j) => j.kind === "power")).toHaveLength(1)
  })

  it("takes the legend from the item and never invents one", () => {
    const spec = enclosureSpec(item({ name: "Big Muff Pi", maker: "Electro-Harmonix" }))
    expect(spec.legend).toBe("Big Muff Pi")
    expect(spec.sublegend).toBe("Electro-Harmonix")

    /* A guide entry with no maker prints no second line rather than a
       placeholder, the same way the enclosure card does. */
    expect(enclosureSpec(item({ maker: null })).sublegend).toBeNull()
  })

  it("tints from tokens only, so both themes resolve and no second colour is invented", () => {
    for (const slot of SLOTS) {
      const { tint } = enclosureSpec(item({ slot: slot.id }))
      expect(tint, `${slot.id} tint must be built from palette tokens`).toMatch(/var\(--/)
      /* Brass means "the signal trace" and exactly one thing on this site is
         allowed to be brass (section 16). */
      expect(tint, `${slot.id} must not paint a second thing brass`).not.toContain("--signal")
    }
  })

  it("is pure, so the viewer can call it during render", () => {
    const a = enclosureSpec(item())
    const b = enclosureSpec(item())
    expect(a).toEqual(b)
  })
})
