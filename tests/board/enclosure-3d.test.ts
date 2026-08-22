import { describe, expect, it } from "vitest"
import { enclosureSpec, isTreadle } from "@/lib/board/enclosure-3d"
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
    /*
     * A CLEARANCE TEST, NOT AN ORDERING ONE, and the treadle is why it had to
     * change. The first version asserted the legend sits in FRONT of the
     * switch, which is true of every stompbox and false of a wah: that one
     * prints its name on the heel and hides its switch under the toe, at the
     * opposite end. The invariant worth holding was never the order, it was
     * that the name does not land underneath a control.
     */
    for (const slot of SLOTS) {
      const spec = enclosureSpec(item({ slot: slot.id }))

      for (const sw of spec.switches) {
        const gap = Math.abs(spec.legendZ - sw.z)
        expect(gap, `${slot.id}: the legend is under the footswitch`).toBeGreaterThan(sw.radius)
      }

      for (const knob of spec.knobs) {
        const gap = Math.abs(spec.legendZ - knob.z)
        expect(gap, `${slot.id}: the legend is under a knob`).toBeGreaterThan(knob.radius)
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

/**
 * WHICH PEDALS ARE TREADLES.
 *
 * The shape test is a name match, and every name match on this site is one
 * loose regex away from being confidently wrong (see `matchGuideEntry` and
 * `creditsForGear`). The cases below are the near misses that matter: an
 * auto-wah and an envelope filter sit in the same slot as a real wah, carry
 * the same word, and are boxes with knobs.
 */
describe("telling a treadle from a box", () => {
  it("draws the wahs that actually rock as treadles", () => {
    const wahs = [
      { maker: "Dunlop", name: "Cry Baby GCB95" },
      { maker: "Vox", name: "V847 Wah" },
      { maker: "Dunlop", name: "Cry Baby Mini" },
      { maker: null, name: "Wah-Wah" },
    ]
    for (const wah of wahs) {
      expect(isTreadle(item({ slot: "filter", ...wah })), wah.name).toBe(true)
    }
  })

  it("does NOT turn an auto-wah or an envelope filter into a treadle", () => {
    /* All of these live in the filter slot and all of them are boxes. Getting
       one wrong draws a rocking foot pedal for something with four knobs. */
    const boxes = [
      { maker: "Boss", name: "AW-3 Dynamic Wah" },
      { maker: "Electro-Harmonix", name: "Q-Tron Envelope Filter" },
      { maker: "Mu-Tron", name: "Micro-Tron IV" },
      { maker: "Electro-Harmonix", name: "Bass Balls" },
      { maker: "MXR", name: "Auto Wah" },
      { maker: "Source Audio", name: "Spectrum Auto-Wah" },
    ]
    for (const box of boxes) {
      expect(isTreadle(item({ slot: "filter", ...box })), box.name).toBe(false)
    }
  })

  it("treats every volume pedal as a treadle, by definition rather than by name", () => {
    expect(isTreadle(item({ slot: "volume", maker: "Ernie Ball", name: "VP Jr" }))).toBe(true)
    expect(isTreadle(item({ slot: "volume", maker: null, name: "Anything At All" }))).toBe(true)
  })

  it("never calls a pedal in another slot a treadle, whatever it is named", () => {
    /* The word alone is not enough: the slot has to admit the possibility. */
    for (const slot of SLOTS) {
      if (slot.id === "volume" || slot.id === "filter") continue
      expect(isTreadle(item({ slot: slot.id, name: "Cry Baby Wah" })), slot.id).toBe(false)
    }
  })

  it("gives a treadle the parts a treadle has, and none of the ones it does not", () => {
    const spec = enclosureSpec(item({ slot: "filter", maker: "Dunlop", name: "Cry Baby" }))

    expect(spec.shape).toBe("treadle")
    expect(spec.treadle).not.toBeNull()
    /* No knobs at all: the only adjustment is the angle of your foot. */
    expect(spec.knobs).toHaveLength(0)
    /* The switch is the one under the toe, at the far end from the heel. */
    expect(spec.switches[0].z).toBeLessThan(0)

    const tr = spec.treadle!
    /* It rocks BETWEEN the cheeks, so it has to be narrower than the chassis. */
    expect(tr.plateWidth).toBeLessThan(spec.width)
    expect(tr.plateDepth).toBeLessThan(spec.depth)
    /* Tall at the heel, low at the toe. Flip these and the wedge points the
       wrong way, which is the one thing everybody would notice. */
    expect(tr.cheekHeelHeight).toBeGreaterThan(tr.cheekToeHeight)
    /* Toe up at rest, because a wah is sprung that way. */
    expect(tr.tilt).toBeGreaterThan(0)
    /* The axle sits up the cheek, not at chassis level: hinging it at the
       bottom drops the plate into a trough and it reads as a lid in a tray. */
    expect(tr.pivotY).toBeGreaterThan(0)
    /* The plate's heel must still clear the top of the cheek it nests in. */
    const heelDrop = (tr.plateDepth / 2 - tr.pivotZ) * Math.sin((tr.tilt * Math.PI) / 180)
    const plateHeelTop = tr.pivotY - heelDrop + tr.plateThickness / 2
    expect(plateHeelTop).toBeLessThan(tr.cheekHeelHeight)
  })

  it("leaves every box a box, with no treadle geometry hanging off it", () => {
    for (const slot of SLOTS) {
      if (slot.id === "volume") continue
      const spec = enclosureSpec(item({ slot: slot.id, name: "Test Pedal" }))
      expect(spec.shape, slot.id).toBe("box")
      expect(spec.treadle, slot.id).toBeNull()
    }
  })
})
