import { describe, expect, it } from "vitest"
import {
  itemFromCatalog,
  itemFromGuide,
  matchGuideEntry,
  orderBoard,
  slotForEffectType,
  effectTypeOf,
  engagedOf,
  type BoardItem,
} from "@/lib/board/model"
import { EFFECT_ORDER } from "@/lib/pedalboard/chain"
import { PEDALS, pedalBySlug } from "@/lib/stompbox/pedals"

/**
 * The shared board model, and mostly the matcher.
 *
 * `matchGuideEntry` is the piece of this merge that can do real damage. Getting
 * it wrong does not throw and does not fail a build: it prints a confident
 * paragraph about the WRONG circuit, in the guide's authoritative voice, on a
 * page a shopper is about to spend money from. That is the same failure the
 * reverse rig index guards against by refusing to match "Hamilton Beach
 * Blender" to Kevin Shields, and it is worse here, because circuit prose reads
 * as fact rather than as trivia.
 *
 * So the bias is the entity resolver's (section 4): under-match rather than
 * over-match. An unmatched product still goes on the board and still gets
 * power, cable and position advice from its type. A mismatched one lies.
 */

describe("matchGuideEntry", () => {
  it("matches a product to its documented circuit", () => {
    expect(matchGuideEntry("Electro-Harmonix", "Big Muff Pi")?.slug).toBe("big-muff")
    expect(matchGuideEntry("Ibanez", "Tube Screamer")?.slug).toBe("tube-screamer")
    expect(matchGuideEntry("MXR", "Phase 90")?.slug).toBe("phase-90")
  })

  it("matches through the extra words a real feed title carries", () => {
    // Feed rows are not catalogue-clean. These are the shapes a listing title
    // actually takes, and the whole point of matching on a whole-word run.
    expect(matchGuideEntry("Electro-Harmonix", "Big Muff Pi Reissue")?.slug).toBe("big-muff")
    expect(matchGuideEntry("Ibanez", "TS9 Tube Screamer Overdrive Pedal")?.slug).toBe(
      "tube-screamer",
    )
    expect(matchGuideEntry("Dunlop", "Cry Baby Standard Wah GCB95")?.slug).toBe("cry-baby")
  })

  it("IS BRAND SCOPED, so a clone does not inherit the original's writeup", () => {
    /*
     * The single most valuable rule here. Every one of these is a real product
     * somebody sells, and none of them is the circuit the guide documented.
     * Printing the Electro-Harmonix Big Muff description under a Wren and Cuff
     * would be stating, in the guide's voice, something nobody checked.
     */
    expect(matchGuideEntry("Wren and Cuff", "Big Muff")).toBeNull()
    expect(matchGuideEntry("JHS", "Tube Screamer Mod")).toBeNull()
    expect(matchGuideEntry("Behringer", "Phase 90")).toBeNull()
    expect(matchGuideEntry("Mooer", "Cry Baby")).toBeNull()
  })

  it("does not let a fragment claim a paragraph", () => {
    // "Muff Fuzz" is a different pedal from the "Big Muff", and a bare
    // substring test would hand it the Big Muff's circuit description.
    expect(matchGuideEntry("Electro-Harmonix", "Muff Fuzz")).toBeNull()
    // "Screamer" alone is not "Tube Screamer".
    expect(matchGuideEntry("Ibanez", "Screamer Mini")).toBeNull()
  })

  it("keeps model numbers apart rather than normalising them away", () => {
    /*
     * A normaliser that stripped digits would merge these, which is the same
     * class of mistake `normalizeMpn()` rejects placeholders to avoid. DS-1 is
     * documented; DS-2 is a different pedal and must not borrow the writeup.
     */
    expect(matchGuideEntry("Boss", "DS-1 Distortion")?.slug).toBe("ds-1")
    expect(matchGuideEntry("Boss", "DS-2 Turbo Distortion")).toBeNull()
    expect(matchGuideEntry("Boss", "DD-2 Digital Delay")?.slug).toBe("dd-2")
    expect(matchGuideEntry("Boss", "DD-8 Digital Delay")).toBeNull()
  })

  it("returns null for a maker the guide has never documented", () => {
    expect(matchGuideEntry("Chase Bliss", "Mood MKII")).toBeNull()
    expect(matchGuideEntry(null, "Big Muff Pi")).toBeNull()
  })

  it("never matches anything to a non-pedal", () => {
    // Feeds carry cables, stands and supplies. None of them has a circuit.
    expect(matchGuideEntry("Truetone", "1 Spot Power Supply")).toBeNull()
    expect(matchGuideEntry("Ernie Ball", "Patch Cable")).toBeNull()
  })
})

describe("itemFromCatalog", () => {
  it("carries the guide's electrical facts through to a real product", () => {
    // THE MARRIAGE. A Fuzz Face you can buy should know it wants the guitar
    // directly, because that is what decides where it goes on the board.
    const item = itemFromCatalog({
      slug: "dallas-arbiter-fuzz-face",
      brand: "Dallas Arbiter",
      model: "Fuzz Face",
      imageUrl: null,
    })
    const guide = pedalBySlug("fuzz-face")
    expect(item?.guideSlug).toBe("fuzz-face")
    expect(item?.circuitKnown).toBe(true)
    expect(item?.wantsGuitarDirect).toBe(guide?.wantsGuitarDirect)
    expect(item?.slot).toBe(guide?.slot)
  })

  it("marks an unrecognised product as unchecked rather than guessing at it", () => {
    const item = itemFromCatalog({
      slug: "chase-bliss-mood",
      brand: "Chase Bliss",
      model: "Mood MKII",
      imageUrl: null,
      type: "delay",
    })
    expect(item?.circuitKnown).toBe(false)
    expect(item?.guideSlug).toBeNull()
    // It still gets a position, from its type. Unchecked is not unusable.
    expect(item?.slot).toBe("delay")
    // And no invented electrical claims.
    expect(item?.wantsGuitarDirect).toBeUndefined()
    expect(item?.digital).toBeUndefined()
  })

  it("keeps a product photo, which is the half the guide never had", () => {
    const item = itemFromCatalog({
      slug: "boss-ds-1",
      brand: "Boss",
      model: "DS-1 Distortion",
      imageUrl: "https://cdn.shopify.com/ds1.jpg",
      type: "drive",
    })
    expect(item?.imageUrl).toBe("https://cdn.shopify.com/ds1.jpg")
    expect(item?.catalogSlug).toBe("boss-ds-1")
  })

  it("refuses a product with no place in the signal chain", () => {
    // A power supply is a real thing to buy and not a thing to put between the
    // drive and the delay.
    expect(
      itemFromCatalog({
        slug: "truetone-1-spot",
        brand: "Truetone",
        model: "1 Spot Power Supply",
        imageUrl: null,
        type: "utility",
      }),
    ).toBeNull()
  })

  it("gives guide and catalogue items keys that cannot collide", () => {
    const fromGuide = itemFromGuide(PEDALS[0])
    const fromCatalog = itemFromCatalog({
      slug: PEDALS[0].slug,
      brand: PEDALS[0].maker,
      model: PEDALS[0].name,
      imageUrl: null,
    })
    // Same pedal, two sources, two keys: the share link has to tell them apart.
    expect(fromGuide.key).not.toBe(fromCatalog?.key)
  })
})

describe("slot mapping", () => {
  it("covers every planner type the guide has an opinion about", () => {
    for (const type of EFFECT_ORDER) {
      const slot = slotForEffectType(type)
      // looper and utility deliberately have no slot: one belongs after
      // everything, the other's position "depends entirely on the job".
      if (type === "looper" || type === "utility") expect(slot).toBeNull()
      else expect(slot, `no slot for planner type "${type}"`).not.toBeNull()
    }
  })

  it("round-trips a slot back to a planner type the power engine knows", () => {
    for (const pedal of PEDALS) {
      const item = itemFromGuide(pedal)
      // effectTypeOf feeds estimatePower and analyzeChain, so an unmapped slot
      // would silently cost a pedal its current draw.
      expect(EFFECT_ORDER).toContain(effectTypeOf(item))
    }
  })
})

describe("orderBoard", () => {
  const item = (key: string, slot: BoardItem["slot"]): BoardItem => ({
    key,
    name: key,
    maker: null,
    slot,
    source: "catalogue",
    imageUrl: null,
    catalogSlug: key,
    guideSlug: null,
    engaged: true,
    circuitKnown: false,
  })

  it("puts the board in signal order regardless of the order added", () => {
    const ordered = orderBoard([
      item("reverb", "reverb"),
      item("tuner", "tuner"),
      item("drive", "drive"),
    ])
    expect(ordered.map((i) => i.key)).toEqual(["tuner", "drive", "reverb"])
  })

  it("is STABLE within a slot, because which drive goes first is taste", () => {
    const ordered = orderBoard([item("a", "drive"), item("b", "drive"), item("c", "drive")])
    expect(ordered.map((i) => i.key)).toEqual(["a", "b", "c"])
  })

  it("keeps a bypassed pedal on the board and out of the signal", () => {
    const off = { ...item("off", "drive"), engaged: false }
    const board = [item("on", "drive"), off]
    expect(board).toHaveLength(2)
    expect(engagedOf(board).map((i) => i.key)).toEqual(["on"])
  })
})
