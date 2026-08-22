import { describe, expect, it } from "vitest"
import { PEDAL_MODELS, genericModel, modelFor } from "@/lib/board/pedal-models"
import { enclosureSpec } from "@/lib/board/enclosure-3d"
import type { BoardItem } from "@/lib/board/model"
import { PEDALS as GUIDE_PEDALS } from "@/lib/stompbox/pedals"
import { PEDALS as CATALOG_PEDALS } from "@/lib/pedalboard/catalog/pedals"

/**
 * WHAT A MEASURED MODEL CLAIMS, and the near misses that make the claim false.
 *
 * A hand-modelled pedal is a confident picture of a specific product, printed
 * with that product's name, shown to somebody who is about to spend money. So
 * this file is the same shape as the ones guarding `matchGuideEntry` and
 * `creditsForGear`: mostly a list of things that must NOT match.
 *
 * Every case below was a real wrong render before it was a test. A Micro Amp
 * came up as a Phase 90, a Tube Screamer Mini as a full-size TS9, a Nano Big
 * Muff as the big one, a CE-1 as a CE-2, and a DD-2 with "DD-3" silkscreened
 * across its face. None of them threw, and none of them looked broken.
 */

function item(over: Partial<BoardItem> = {}): BoardItem {
  return {
    key: "g:test",
    name: "Test Pedal",
    maker: "Nobody",
    slot: "drive",
    source: "guide",
    imageUrl: null,
    catalogSlug: null,
    guideSlug: "test",
    engaged: true,
    circuitKnown: true,
    ...over,
  }
}

function found(maker: string | null, name: string) {
  return modelFor(item({ maker, name }))
}

describe("matching a pedal to a measured model", () => {
  it("finds the obvious ones", () => {
    expect(found("Boss", "DS-1")?.name).toBe("DS-1 Distortion")
    expect(found("Dunlop", "Cry Baby GCB95")?.name).toBe("Cry Baby")
    expect(found("ProCo", "RAT")?.name).toBe("RAT")
    expect(found("Klon", "Centaur")?.name).toBe("Centaur")
    expect(found("MXR", "Phase 90")?.name).toBe("Phase 90")
  })

  it("matches the maker the dataset actually uses, not the one we assumed", () => {
    /* The guide and the picker both call it Dallas Arbiter. An `arbiter`-only
       pattern is anchored past the "Dallas" and matched nothing at all, so the
       one round pedal on the site quietly rendered as a box. */
    expect(found("Dallas Arbiter", "Fuzz Face")?.style).toBe("round")
    expect(found("Dunlop", "Fuzz Face")?.style).toBe("round")
  })

  it("never hands one product's body and name to another", () => {
    /* Same brand, same casting in some cases, different pedal in all of them. */
    expect(found("MXR", "Micro Amp")).toBeNull()
    expect(found("Ibanez", "Tube Screamer Mini")).toBeNull()
    expect(found("Ibanez", "TS808 Tube Screamer")).toBeNull()
    expect(found("Electro-Harmonix", "Nano Big Muff Pi")).toBeNull()
    expect(found("Electro-Harmonix", "Little Big Muff")).toBeNull()
    /* A CE-1 is a mains-powered wedge, not the compact casting. */
    expect(found("Boss", "CE-1 Chorus Ensemble")).toBeNull()
  })

  it("keeps the brand scope, so a clone never borrows the original's body", () => {
    expect(found("Behringer", "Ultra Vibrato UV300")).toBeNull()
    expect(found("Joyo", "Vintage Overdrive")).toBeNull()
    /* The word alone is not enough anywhere on this site. */
    expect(found("Mooer", "Cry Baby")).toBeNull()
    expect(found(null, "DS-1")).toBeNull()
  })

  it("prints the model number of the pedal in front of you", () => {
    /* Two pairs share a casting exactly and differ only in the silkscreen,
       which is precisely why each gets its own entry rather than one loose
       pattern: a shared pattern would have to print one of them wrong. */
    const dd2 = found("Boss", "DD-2 Digital Delay")
    const dd3 = found("Boss", "DD-3 Digital Delay")
    expect(dd2?.legends[0].text).toBe("DD-2")
    expect(dd3?.legends[0].text).toBe("DD-3")
    expect(dd2?.width).toBe(dd3?.width)

    expect(found("ProCo", "RAT 2")?.legends[0].text).toBe("RAT 2")
    expect(found("ProCo", "RAT")?.legends[0].text).toBe("RAT")
  })
})

describe("every measured model, as geometry", () => {
  it("is a real size in millimetres, not a placeholder", () => {
    for (const model of PEDAL_MODELS) {
      expect(model.width, model.name).toBeGreaterThan(20)
      expect(model.depth, model.name).toBeGreaterThan(20)
      expect(model.height, model.name).toBeGreaterThan(10)
      /* The largest thing here is a wah at 254mm. Anything past half a metre
         is a typo, and a typo in this file renders as a table. */
      expect(Math.max(model.width, model.depth), model.name).toBeLessThan(500)
    }
  })

  it("keeps every control on the face it is mounted on", () => {
    for (const model of PEDAL_MODELS) {
      for (const knob of model.knobs) {
        expect(Math.abs(knob.x) + knob.radius, `${model.name} knob`).toBeLessThanOrEqual(
          model.width / 2,
        )
        expect(Math.abs(knob.z) + knob.radius, `${model.name} knob`).toBeLessThanOrEqual(
          model.depth / 2,
        )
      }
      if (model.footswitch) {
        const sw = model.footswitch
        expect(Math.abs(sw.x) + sw.radius, `${model.name} switch`).toBeLessThanOrEqual(
          model.width / 2,
        )
        expect(Math.abs(sw.z) + sw.radius, `${model.name} switch`).toBeLessThanOrEqual(
          model.depth / 2,
        )
      }
    }
  })

  it("never lets two knobs in a row overlap", () => {
    for (const model of PEDAL_MODELS) {
      const rows = new Map<number, typeof model.knobs>()
      for (const knob of model.knobs) {
        const row = rows.get(knob.z) ?? []
        row.push(knob)
        rows.set(knob.z, row)
      }
      for (const row of rows.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x)
        for (let i = 1; i < sorted.length; i++) {
          expect(
            sorted[i].x - sorted[i - 1].x,
            `${model.name}: knobs ${i - 1} and ${i} render as one lump`,
          ).toBeGreaterThan(sorted[i].radius + sorted[i - 1].radius)
        }
      }
    }
  })

  it("gives a treadle its treadle, and nothing else one", () => {
    for (const model of PEDAL_MODELS) {
      if (model.style === "treadle") {
        /* A style with no geometry behind it falls silently through to the box
           branch in the viewer, which is exactly how the wah got lost once. */
        expect(model.treadle, model.name).toBeTruthy()
        expect(model.knobs, model.name).toHaveLength(0)
      } else {
        expect(model.treadle, model.name).toBeUndefined()
      }
    }
  })

  it("says what it is, in words, on every entry", () => {
    for (const model of PEDAL_MODELS) {
      expect(model.note.length, model.name).toBeGreaterThan(30)
      /* A measured model must not claim to be derived, and vice versa. The
         generic's disclaimer is the one sentence that keeps the pair honest. */
      expect(model.note, model.name).not.toContain("Not this pedal")
    }
  })

  it("leaves the generic saying plainly that it is not the real pedal", () => {
    const generic = genericModel(item(), enclosureSpec(item()))
    expect(generic.note).toContain("Not this pedal")
    /* And it must never be mistaken for a measured one by the matcher. */
    expect(modelFor(item())).toBeNull()
  })
})

describe("against the two datasets that actually reach the viewer", () => {
  /*
   * The match table is only worth anything if it matches the strings the site
   * really carries. Both of the bugs above were invisible to a unit test
   * written from the model file alone, because the model file is where the
   * wrong assumption lived.
   */
  it("resolves without throwing for every guide pedal and every catalogue pedal", () => {
    for (const pedal of GUIDE_PEDALS) {
      expect(() => modelFor(item({ maker: pedal.maker, name: pedal.name }))).not.toThrow()
    }
    for (const pedal of CATALOG_PEDALS) {
      expect(() => modelFor(item({ maker: pedal.brand, name: pedal.model }))).not.toThrow()
    }
  })

  it("finds a measured model for the pedals people came here for", () => {
    /* Not a coverage target: a floor, so a regex edit cannot quietly empty the
       table the way the Fuzz Face's did. */
    const matched = CATALOG_PEDALS.filter((pedal) =>
      modelFor(item({ maker: pedal.brand, name: pedal.model })),
    )
    expect(matched.length).toBeGreaterThanOrEqual(12)
  })

  it("prints a name the pedal in the dataset actually wears", () => {
    /*
     * The sharpest version of the near-miss rule. For every dataset entry that
     * DOES find a measured model, the printed legend has to be a substring of
     * what the dataset calls it, ignoring case and punctuation. That is what
     * catches a DD-2 wearing "DD-3" without anybody having to think of the
     * pair in advance.
     */
    const flat = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "")

    for (const pedal of CATALOG_PEDALS) {
      const model = modelFor(item({ maker: pedal.brand, name: pedal.model }))
      if (!model) continue
      const printed = flat(model.legends[0].text)
      expect(
        flat(pedal.model).includes(printed),
        `${pedal.brand} ${pedal.model} renders with "${model.legends[0].text}" on its face`,
      ).toBe(true)
    }
  })
})
