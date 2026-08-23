import { describe, expect, it } from "vitest"
import { PEDAL_MODELS, genericModel, modelFor } from "@/lib/board/pedal-models"
import { enclosureSpec } from "@/lib/board/enclosure-3d"
import type { BoardItem } from "@/lib/board/model"
import { PEDALS as GUIDE_PEDALS } from "@/lib/stompbox/pedals"
import { PEDALS as CATALOG_PEDALS } from "@/lib/pedalboard/catalog/pedals"
import { ENCLOSURES } from "@/lib/pedalboard/catalog/enclosures"

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
    expect(found("Electro-Harmonix", "Little Big Muff")).toBeNull()
    /* A CE-1 is a mains-powered wedge, not the compact casting. */
    expect(found("Boss", "CE-1 Chorus Ensemble")).toBeNull()
  })

  it("gives the small versions their own box rather than the big one's", () => {
    /*
     * The other half of the near-miss rule, and the better half. Narrowing a
     * pattern so a Tube Screamer Mini or a Nano Big Muff falls to the generic
     * is honest; modelling the box it is actually built in is right. What must
     * never happen is the one that used to: the small one wearing the big
     * one's dimensions.
     */
    const mini = found("Ibanez", "Tube Screamer Mini")
    const ts9 = found("Ibanez", "TS9 Tube Screamer")
    expect(mini?.name).toBe("Tube Screamer Mini")
    expect(mini!.width).toBeLessThan(ts9!.width)

    const nano = found("Electro-Harmonix", "Nano Big Muff Pi")
    const muff = found("Electro-Harmonix", "Big Muff Pi")
    expect(nano?.name).toBe("Nano Big Muff Pi")
    expect(nano!.width).toBeLessThan(muff!.width)
  })

  it("gives the TS808 the TS9's casting and its own number", () => {
    /*
     * The 808 used to fall to the generic because the finish was unverified.
     * The catalogue settles the shape, giving both the same 74 x 124 x 53 from
     * Ibanez, so the casting is confirmed shared rather than assumed and the
     * only thing left to keep apart is the print.
     */
    const ts808 = found("Ibanez", "TS808 Tube Screamer")
    const ts9 = found("Ibanez", "TS9 Tube Screamer")
    expect(ts808?.legends[0].text).toBe("TS808")
    expect(ts9?.legends[0].text).toBe("TS9")
    expect(ts808?.width).toBe(ts9?.width)
    expect(ts808?.depth).toBe(ts9?.depth)
  })

  it("gives the Micro Amp its own entry rather than the Phase 90's", () => {
    /*
     * This pair is why the near-miss rule exists. `micro` under MXR used to
     * catch a Micro Amp and render it orange with a chicken-head knob and
     * "PHASE 90" across the face. Narrowing the Phase 90 dropped it to the
     * generic, which was honest; giving it its own entry is the real fix, and
     * the assertion worth keeping is that the two never swap.
     */
    const microAmp = found("MXR", "Micro Amp")
    const phase90 = found("MXR", "Phase 90")
    expect(microAmp?.name).toBe("Micro Amp")
    expect(phase90?.name).toBe("Phase 90")
    expect(microAmp?.color).not.toBe(phase90?.color)
    expect(microAmp?.knobs).toHaveLength(1)
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
      for (const sw of model.footswitches) {
        expect(Math.abs(sw.x) + sw.radius, `${model.name} switch`).toBeLessThanOrEqual(
          model.width / 2,
        )
        expect(Math.abs(sw.z) + sw.radius, `${model.name} switch`).toBeLessThanOrEqual(
          model.depth / 2,
        )
      }
      for (const toggle of model.toggles ?? []) {
        expect(Math.abs(toggle.x) + 3, `${model.name} toggle`).toBeLessThanOrEqual(model.width / 2)
        expect(Math.abs(toggle.z) + 3, `${model.name} toggle`).toBeLessThanOrEqual(model.depth / 2)
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

  it("keeps the printed name clear of the knob labels", () => {
    /*
     * PRINT COLLIDING WITH PRINT, which the geometry tests cannot see because
     * nothing intersects: two bits of type land on the same square millimetre
     * of the decal and the canvas draws them over each other. On a Big Muff
     * that put "BIG MUFF PI" straight through the word TONE.
     *
     * The knob label is printed just in front of its shaft, which is the one
     * place it can go, so the legend is what has to move. Both are measured
     * from the same origin as everything else in the file.
     */
    const LABEL_OFFSET = 6
    /* `useSilkscreen` sets every knob label at this cap height. */
    const LABEL_SIZE = 3.4

    /* Every bit of print on the face, wherever it came from. */
    function printedOn(model: (typeof PEDAL_MODELS)[number]) {
      return [
        ...model.legends.map((l) => ({
          text: l.text,
          x: 0,
          z: l.z,
          size: l.size,
          owner: "legend",
        })),
        ...model.knobs
          .filter((k) => k.label)
          .map((k, i) => ({
            text: k.label,
            x: k.x,
            z: k.z + k.radius + LABEL_OFFSET,
            size: LABEL_SIZE,
            owner: `knob:${i}`,
          })),
      ]
    }

    /*
     * AND THE PARTS THAT SIT ON TOP OF THE PRINT. An LED is a solid, so no
     * clearance test on the geometry sees it land on a word: the Small Stone
     * put its indicator through the middle of "RATE" and every existing check
     * passed, because a 2mm dot and a decal do not intersect in any way the
     * knob tests measure.
     */
    for (const model of PEDAL_MODELS) {
      /* A toggle is a 6mm bushing with a lever standing out of it, so it hides
         print exactly the way an indicator does. Both go through the same
         check, sized for the larger of the two. */
      const solids = [
        ...(model.led
          ? [{ what: "LED", x: model.led.x, z: model.led.z, r: 3, tall: 2, owner: "led" }]
          : []),
        /* A bat lever stands about 10mm off the face and leans back. */
        ...(model.toggles ?? []).map((t) => ({
          what: "toggle",
          x: t.x,
          z: t.z,
          r: 3,
          tall: 10,
          owner: "toggle",
        })),
        /*
         * AND THE KNOBS, against every label but their OWN. A second row of
         * controls sits in front of the first row's labels, which is how a
         * Strymon came out with its small knobs planted on the words TIME and
         * REPEATS: no two knobs overlapped, no knob left the face, and the
         * print was still buried under a lump of plastic.
         */
        /*
         * A FADER IS A SLOT, NOT A POINT. The cap stands 3mm proud, but the
         * thing print must stay out of is the whole travel: a legend across a
         * GE-7's slots is a name written over eight holes.
         */
        ...(model.sliders ?? []).map((f) => ({
          what: "fader",
          x: f.x,
          z: f.z,
          r: 3,
          tall: 3,
          halfTravel: f.travel / 2,
          owner: "fader",
        })),
        ...model.knobs.map((k, i) => ({
          what: `${k.label || "a"} knob`,
          x: k.x,
          z: k.z,
          r: k.radius,
          tall: k.height,
          owner: `knob:${i}`,
        })),
      ]
      for (const solid of solids) {
        for (const print of printedOn(model)) {
          /*
           * A KNOB AND ITS OWN LABEL, and nothing else.
           *
           * This used to skip on POSITION: same x, close in z. Every legend is
           * centred at x = 0, so any control sitting at x = 0 got a free pass
           * against the pedal's name, and a DL4 shipped with its indicator
           * inside the "L". Matching on identity is what the exemption always
           * meant.
           */
          if (print.owner === solid.owner) continue
          /* Print that merely fails to intersect still reads as a part stuck
             to a letter, so this is the part's radius plus real air. */
          /*
           * MORE ROOM BEHIND A CONTROL THAN IN FRONT OF IT, because the viewer
           * looks down at the pedal from in front. A part that stands 10mm off
           * the face projects several millimetres up-screen, which is toward
           * the BACK of the pedal, so it hides print that is nowhere near it in
           * plan. Three separate models were fixed by eye for this before the
           * rule was written down: the reader sees a picture, not a plan.
           */
          const behind = print.z < solid.z
          /* A fader's footprint runs the length of its slot. */
          const reach = "halfTravel" in solid ? (solid.halfTravel as number) : 0
          /*
           * The factor is the camera's, not a guess. `PedalViewer3D` sits at
           * [1.35, 1.15, 1.85], which is 27 degrees above the deck, so a part
           * standing h off the face hides h / tan(27) behind it: very nearly
           * twice its height. That is why every knob label on every real pedal
           * here is printed in FRONT of its knob and never behind it.
           */
          const HIDES_BEHIND = 2
          const room = reach + solid.r + (behind ? solid.tall * HIDES_BEHIND : 2)
          const far =
            Math.abs(solid.x - print.x) > print.text.length * print.size * 0.35 + solid.r ||
            Math.abs(solid.z - print.z) > print.size / 2 + room
          expect(far, `${model.name}: the ${solid.what} sits on "${print.text}"`).toBe(true)
        }
      }
    }

    for (const model of PEDAL_MODELS) {
      for (const legend of model.legends) {
        for (const knob of model.knobs) {
          if (!knob.label) continue
          const labelZ = knob.z + knob.radius + LABEL_OFFSET
          /*
           * HALF OF EACH, PLUS REAL AIR. The first version of this counted
           * only half the legend and passed the Big Muff at an 8mm gap, which
           * the render showed as the two words touching: the label has a cap
           * height of its own, and print that merely fails to intersect still
           * reads as a mistake.
           */
          const clear = legend.size / 2 + LABEL_SIZE / 2 + 1.5
          expect(
            Math.abs(legend.z - labelZ),
            `${model.name}: "${legend.text}" is printed over the ${knob.label} label`,
          ).toBeGreaterThan(clear)
        }
      }
    }
  })

  it("keeps the faders and the screen on the face too", () => {
    /*
     * The newest two controls, held to the same rule as the knobs. A GE-7's
     * eight faders across a 73mm face is the tightest row on any pedal here,
     * so it is exactly where an off-by-one puts a cap over the edge.
     */
    for (const model of PEDAL_MODELS) {
      const faders = model.sliders ?? []
      for (const fader of faders) {
        expect(Math.abs(fader.x) + 3, `${model.name} fader`).toBeLessThanOrEqual(model.width / 2)
        expect(
          Math.abs(fader.z) + fader.travel / 2,
          `${model.name} fader travel`,
        ).toBeLessThanOrEqual(model.depth / 2)
        /* 0 is the bottom of the slot and 1 the top; outside that the cap is
           drawn off the end of its own track. */
        expect(fader.at, `${model.name} fader position`).toBeGreaterThanOrEqual(0)
        expect(fader.at, `${model.name} fader position`).toBeLessThanOrEqual(1)
      }

      const sorted = [...faders].sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i++) {
        expect(
          sorted[i].x - sorted[i - 1].x,
          `${model.name}: faders ${i - 1} and ${i} share a slot`,
        ).toBeGreaterThan(5.5)
      }

      if (model.screen) {
        const sc = model.screen
        expect(Math.abs(sc.x) + sc.width / 2, `${model.name} screen`).toBeLessThanOrEqual(
          model.width / 2,
        )
        expect(Math.abs(sc.z) + sc.depth / 2, `${model.name} screen`).toBeLessThanOrEqual(
          model.depth / 2,
        )
      }
    }
  })

  it("does not print underneath a screen", () => {
    /* A window is opaque and covers a rectangle rather than a dot, so it is
       the one solid the round-footprint check above cannot model. */
    for (const model of PEDAL_MODELS) {
      const sc = model.screen
      if (!sc) continue
      for (const legend of model.legends) {
        const overlapsX = Math.abs(legend.z - sc.z) < sc.depth / 2 + legend.size / 2
        const clearInX = Math.abs(0 - sc.x) > sc.width / 2 + legend.text.length * legend.size * 0.35
        expect(
          !overlapsX || clearInX,
          `${model.name}: "${legend.text}" is printed under the screen`,
        ).toBe(true)
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

  it("leaves no model in the table that nothing can reach", () => {
    /*
     * A MODEL NOBODY CAN MATCH IS WORSE THAN NO MODEL, because it looks like
     * coverage. Every entry here was written for a real product, so every
     * entry should be findable from the name that product goes by in one of
     * the two datasets.
     *
     * The Walrus Slö is why this exists. Its pattern ended in `\b`, and
     * JavaScript's word boundary is ASCII-only, so there is no boundary after
     * the "ö" in "Slö Reverb": the model sat in the table, fully written, and
     * matched nothing at all. The Fuzz Face had done the same thing when its
     * brand pattern did not allow for "Dallas Arbiter".
     */
    const reachable = new Set<string>()
    for (const pedal of CATALOG_PEDALS) {
      const model = modelFor(item({ maker: pedal.brand, name: pedal.model }))
      if (model) reachable.add(model.name)
    }
    for (const pedal of GUIDE_PEDALS) {
      const model = modelFor(item({ maker: pedal.maker, name: pedal.name }))
      if (model) reachable.add(model.name)
    }

    const orphans = PEDAL_MODELS.filter((m) => !reachable.has(m.name)).map((m) => m.name)
    expect(orphans, "modelled but unreachable from either dataset").toEqual([])
  })

  it("finds a measured model for the pedals people came here for", () => {
    /* Not a coverage target: a floor, so a regex edit cannot quietly empty the
       table the way the Fuzz Face's did. */
    const matched = CATALOG_PEDALS.filter((pedal) =>
      modelFor(item({ maker: pedal.brand, name: pedal.model })),
    )
    expect(matched.length).toBeGreaterThanOrEqual(12)
  })

  it("is the same size as the planner thinks it is", () => {
    /*
     * THE TEST THAT WOULD HAVE CAUGHT THE SWAP.
     *
     * The planner lays boards out from `lib/pedalboard/catalog`, which names a
     * standard enclosure per pedal and measures each one in a table with a
     * provenance marker. This file used to hand-type its own numbers, and the
     * two drifted: the Big Muff came out 89mm wide and the Small Stone 145,
     * which is the pair of them exchanged. The famous board hog rendered as
     * the narrow one and nothing failed, because nothing compared the files.
     *
     * `enc()` now reads that table, so this holds the invariant rather than
     * catching a typo: a pedal cannot be one size in the plan and another in
     * the picture of it.
     */
    let checked = 0

    for (const pedal of CATALOG_PEDALS) {
      const model = modelFor(item({ maker: pedal.brand, name: pedal.model }))
      if (!model) continue

      /*
       * EVERY MATCHED PEDAL, not only the ones in a named box. A Whammy, a DL4
       * and a PolyTune have no Hammond number but the catalogue still measures
       * them, because the layout engine has to place them, so there is no
       * pedal here whose size is only asserted in one file.
       */
      const box = pedal.enclosure ? ENCLOSURES[pedal.enclosure].dims : pedal.dims
      const where = `${pedal.brand} ${pedal.model} (${pedal.enclosure ?? "own figures"})`
      expect(model.width, `${where} width`).toBe(box.widthMm)
      expect(model.depth, `${where} depth`).toBe(box.depthMm)

      /*
       * HEIGHT IS EXEMPT FOR A TREADLE, and only for a treadle, because the
       * two files are measuring different things there. The table's 64mm is
       * the whole pedal with the plate standing at rest; `height` here is the
       * chassis the plate rocks on top of, which is much shallower. Asserting
       * them equal would force the chassis to swallow its own treadle.
       */
      if (model.style !== "treadle") {
        expect(model.height, `${where} height`).toBe(box.heightMm)
      }
      checked++
    }

    /* A floor, so a rename that stops every pedal matching cannot turn this
       into a test that walks nothing and passes. */
    expect(checked).toBeGreaterThanOrEqual(20)
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
      /* Brand AND model, because plenty of pedals print the maker's name and
         nothing else: a Vox wah wears "VOX" while the dataset calls it a
         V847. What this still forbids is the case it was written for, a DD-2
         wearing "DD-3", since neither string contains the other's number. */
      expect(
        flat(`${pedal.brand} ${pedal.model}`).includes(printed),
        `${pedal.brand} ${pedal.model} renders with "${model.legends[0].text}" on its face`,
      ).toBe(true)
    }
  })
})
