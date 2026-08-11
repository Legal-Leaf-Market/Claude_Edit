import { describe, expect, it } from "vitest"
import {
  analyzeChain,
  EFFECTS,
  EFFECT_ORDER,
  EFFECT_TYPES,
  estimatePower,
  inferEffectType,
  type ChainItem,
} from "@/lib/pedalboard/chain"

/**
 * Signal chain analysis. Pure functions, no database.
 *
 * The behaviour worth pinning here is mostly about restraint: when the
 * analyser stays QUIET. A tool that flags every board as wrong is one a
 * shopper learns to ignore, so the tests below spend as much effort on the
 * cases that must produce no note as on the ones that must.
 */

function item(brand: string, model: string, key = `${brand}-${model}`): ChainItem {
  return { key, brand, model, type: inferEffectType(brand, model) }
}

describe("inferEffectType", () => {
  it("reads the common pedals off their names", () => {
    expect(inferEffectType("Boss", "TU-3 Tuner")).toBe("tuner")
    expect(inferEffectType("Dunlop", "Cry Baby Wah")).toBe("filter")
    expect(inferEffectType("MXR", "Dyna Comp")).toBe("compressor")
    expect(inferEffectType("Ibanez", "TS9 Tube Screamer")).toBe("drive")
    expect(inferEffectType("Electro-Harmonix", "Big Muff Pi")).toBe("drive")
    expect(inferEffectType("MXR", "Phase 90")).toBe("modulation")
    expect(inferEffectType("Boss", "DD-3 Digital Delay")).toBe("delay")
    expect(inferEffectType("Strymon", "Blue Sky Reverb")).toBe("reverb")
    expect(inferEffectType("DigiTech", "Whammy")).toBe("pitch")
    expect(inferEffectType("Boss", "RC-1 Loop Station")).toBe("looper")
  })

  /**
   * The ordering of TYPE_PATTERNS is load bearing and easy to break by adding
   * a new pattern in the wrong place. "Deluxe Memory Man" is the canonical
   * trap: it is a delay whose name contains no word a naive delay pattern
   * would match, while "Big Muff" is a drive that a loose modulation pattern
   * could steal if "muff" ever ended up after something broad.
   */
  it("resolves names that several patterns could claim", () => {
    expect(inferEffectType("Electro-Harmonix", "Deluxe Memory Man")).toBe("delay")
    expect(inferEffectType("Electro-Harmonix", "Electric Mistress Flanger")).toBe("modulation")
    expect(inferEffectType("Line 6", "DL4 Delay Modeler")).toBe("delay")
    expect(inferEffectType("Ibanez", "WH10 Wah")).toBe("filter")
  })

  it("falls back to drive, the most common thing on a board", () => {
    expect(inferEffectType("Some", "Unknown Widget")).toBe("drive")
  })

  it("does not drag non-pedals into the order rules", () => {
    expect(inferEffectType("Truetone", "1 Spot Power Supply", "Parts & Accessories")).toBe("utility")
    expect(inferEffectType("Ernie Ball", "Patch Cable", "Parts & Accessories")).toBe("utility")
  })
})

describe("EFFECTS", () => {
  it("covers every effect type", () => {
    for (const type of EFFECT_TYPES) {
      expect(EFFECTS[type]).toBeDefined()
      expect(EFFECTS[type].label.trim()).not.toBe("")
      expect(EFFECTS[type].why.trim().length).toBeGreaterThan(20)
      expect(EFFECTS[type].hue).toMatch(/^#/)
    }
  })

  it("gives every type a distinct rank, so the sort is deterministic", () => {
    const ranks = EFFECT_TYPES.map((t) => EFFECTS[t].rank)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it("orders the canonical chain the way every source describes it", () => {
    const canonical = ["tuner", "filter", "compressor", "drive"]
    expect(EFFECT_ORDER.slice(0, 4)).toEqual(canonical)
    expect(EFFECT_ORDER.indexOf("delay")).toBeLessThan(EFFECT_ORDER.indexOf("reverb"))
    expect(EFFECT_ORDER.indexOf("modulation")).toBeLessThan(EFFECT_ORDER.indexOf("delay"))
    expect(EFFECT_ORDER.at(-1)).toBe("utility")
  })
})

describe("analyzeChain", () => {
  it("says nothing about a conventional chain", () => {
    const chain = [
      item("Boss", "TU-3 Tuner"),
      item("Dunlop", "Cry Baby Wah"),
      item("Ibanez", "TS9 Tube Screamer"),
      item("Boss", "DD-3 Digital Delay"),
    ]
    const result = analyzeChain(chain)
    expect(result.inConventionalOrder).toBe(true)
    expect(result.notes).toHaveLength(0)
  })

  it("says nothing about an empty or single-pedal board", () => {
    expect(analyzeChain([]).notes).toHaveLength(0)
    expect(analyzeChain([item("Ibanez", "TS9 Tube Screamer")]).notes).toHaveLength(0)
  })

  it("flags a tuner that is not first", () => {
    const chain = [item("Ibanez", "TS9 Tube Screamer"), item("Boss", "TU-3 Tuner")]
    const notes = analyzeChain(chain).notes
    expect(notes.some((n) => n.severity === "flag" && /tuner is not first/i.test(n.message))).toBe(
      true,
    )
  })

  it("flags ambience running into a drive", () => {
    const chain = [item("Boss", "DD-3 Digital Delay"), item("Electro-Harmonix", "Big Muff Pi")]
    const notes = analyzeChain(chain).notes
    expect(notes.some((n) => /every repeat gets distorted/i.test(n.message))).toBe(true)
  })

  /**
   * The two-position threshold. An EQ (rank 50) after a pitch shifter (55) is
   * one position out and must stay quiet; a wah (20) after a delay (70) is
   * miles out and must not. Without this floor the analyser fires on chains
   * nobody would consider unusual, which is how it stops being read.
   */
  it("ignores a difference of one position but reports a real inversion", () => {
    const adjacent = [item("DigiTech", "Whammy"), item("Boss", "GE-7 Equalizer")]
    expect(analyzeChain(adjacent).notes).toHaveLength(0)

    const far = [item("Boss", "DD-3 Digital Delay"), item("Dunlop", "Cry Baby Wah")]
    expect(analyzeChain(far).notes.length).toBeGreaterThan(0)
  })

  it("suggests a conventional order without applying it", () => {
    const chain = [
      item("Boss", "DD-3 Digital Delay"),
      item("Boss", "TU-3 Tuner"),
      item("Ibanez", "TS9 Tube Screamer"),
    ]
    const result = analyzeChain(chain)

    expect(result.inConventionalOrder).toBe(false)
    expect(result.suggested.map((i) => i.type)).toEqual(["tuner", "drive", "delay"])
    // The input is untouched: nothing here reorders a shopper's board for them.
    expect(chain.map((i) => i.type)).toEqual(["delay", "tuner", "drive"])
  })

  it("attaches every note to a slot that is actually on the board", () => {
    const chain = [
      item("Boss", "DD-3 Digital Delay"),
      item("Dunlop", "Cry Baby Wah"),
      item("Boss", "TU-3 Tuner"),
    ]
    const keys = new Set(chain.map((i) => i.key))
    for (const note of analyzeChain(chain).notes) {
      expect(keys.has(note.key)).toBe(true)
    }
  })
})

describe("estimatePower", () => {
  it("is zero for an empty board", () => {
    const power = estimatePower([])
    expect(power.totalMa).toBe(0)
    expect(power.outputsNeeded).toBe(0)
  })

  it("sums typical draws and leaves headroom over the total", () => {
    const chain = [
      item("Boss", "TU-3 Tuner"),
      item("Ibanez", "TS9 Tube Screamer"),
      item("Boss", "DD-3 Digital Delay"),
    ]
    const power = estimatePower(chain)

    expect(power.totalMa).toBe(
      EFFECTS.tuner.typicalMa + EFFECTS.drive.typicalMa + EFFECTS.delay.typicalMa,
    )
    expect(power.recommendedSupplyMa).toBeGreaterThan(power.totalMa)
    // Rounded to something a supply is actually sold in.
    expect(power.recommendedSupplyMa % 100).toBe(0)
  })

  it("counts the digital pedals that want an output of their own", () => {
    const chain = [
      item("Boss", "DD-3 Digital Delay"),
      item("Strymon", "Blue Sky Reverb"),
      item("Ibanez", "TS9 Tube Screamer"),
    ]
    expect(estimatePower(chain).highDrawCount).toBe(2)
  })

  /** A passive volume pedal draws nothing and must not be counted as an output. */
  it("does not ask for an output for a pedal that draws nothing", () => {
    const chain = [{ key: "v", brand: "Ernie Ball", model: "VP Jr", type: "volume" as const }]
    expect(estimatePower(chain).outputsNeeded).toBe(0)
  })
})
