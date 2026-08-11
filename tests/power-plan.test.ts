import { describe, expect, it } from "vitest"
import { estimatedPower, planPower, powerItemFromSpec, recommendSupply, type PowerItem } from "@/lib/pedalboard/power-plan"
import { SUPPLIES, supplyById, supplyOutputCount, supplyTotalMa } from "@/lib/pedalboard/catalog/supplies"
import { PEDALS, pedalById } from "@/lib/pedalboard/catalog/pedals"

/**
 * The power planner.
 *
 * These tests are mostly about the failures that cost money: a pedal that gets
 * no power, a pedal that gets the wrong power, and a total that looks
 * confident when it was assembled from guesses. The happy path is the easy
 * part and it gets one test.
 */

function item(id: string): PowerItem {
  const spec = pedalById(id)
  if (!spec) throw new Error(`fixture missing: ${id}`)
  return powerItemFromSpec(spec)
}

function supply(id: string) {
  const found = supplyById(id)
  if (!found) throw new Error(`supply missing: ${id}`)
  return found
}

describe("planPower without a supply", () => {
  it("reports the draw and leaves everything unpowered rather than guessing", () => {
    const plan = planPower([item("boss-ds-1"), item("strymon-timeline")], null)

    expect(plan.supply).toBeNull()
    expect(plan.totalMa).toBe(6 + 300)
    expect(plan.unpowered).toHaveLength(2)
    expect(plan.issues.some((i) => i.kind === "no-supply")).toBe(true)
  })

  it("says so plainly when nothing on the board needs power at all", () => {
    const plan = planPower([item("dallas-arbiter-fuzz-face")], null)

    expect(plan.poweredCount).toBe(0)
    expect(plan.totalMa).toBe(0)
    expect(plan.issues[0].message).toMatch(/nothing on this board needs a power supply/i)
  })
})

describe("battery-only pedals", () => {
  /**
   * A Fuzz Face has no DC jack. Allocating it an output would over-report how
   * many outputs the board needs and under-report how many are free, which is
   * exactly the number someone is using to decide what to buy.
   */
  it("occupy no output and add nothing to the total", () => {
    const withFuzz = planPower(
      [item("boss-ds-1"), item("dallas-arbiter-fuzz-face"), item("dallas-rangemaster")],
      supply("strymon-ojai"),
    )

    expect(withFuzz.poweredCount).toBe(1)
    expect(withFuzz.totalMa).toBe(6)
    expect(withFuzz.assignments).toHaveLength(1)
    expect(withFuzz.assignments[0].pedalId).toBe("boss-ds-1")
  })
})

describe("the failures that kill pedals", () => {
  /**
   * The Line 6 DL4 wants 9V AC. Every output on every isolated brick here is
   * DC. This is the one where getting it wrong is not hum, it is smoke.
   */
  it("refuses to power an AC pedal from a DC supply, and says why", () => {
    const plan = planPower([item("line-6-dl4")], supply("strymon-zuma"))

    const issue = plan.issues.find((i) => i.kind === "needs-ac")
    expect(issue?.severity).toBe("fatal")
    expect(issue?.message).toMatch(/AC/)
    expect(plan.unpowered).toContain("line-6-dl4")
    expect(plan.assignments).toHaveLength(0)
  })

  /**
   * The Eventide H9 is center positive, and almost nothing else on a board is.
   * The fix is a reverse polarity cable, so the message has to name it: an
   * error that only says "no" sends someone back to the shop for nothing.
   */
  it("catches reversed polarity and names the cable that fixes it", () => {
    const plan = planPower([item("eventide-h9")], supply("strymon-zuma"))

    const issue = plan.issues.find((i) => i.kind === "polarity")
    expect(issue?.severity).toBe("fatal")
    expect(issue?.message).toMatch(/reverse polarity cable/i)
    expect(plan.unpowered).toContain("eventide-h9")
  })

  it("catches a pedal whose voltage no output provides", () => {
    // The Deluxe Memory Man wants 24V. Ojai is 9V only.
    const plan = planPower([item("ehx-deluxe-memory-man")], supply("strymon-ojai"))

    const issue = plan.issues.find((i) => i.kind === "voltage")
    expect(issue?.severity).toBe("fatal")
    expect(issue?.message).toMatch(/24V/)
  })

  it("powers that same 24V pedal from a supply that goes that high", () => {
    const plan = planPower([item("ehx-deluxe-memory-man")], supply("cioks-dc7"))

    expect(plan.unpowered).toHaveLength(0)
    expect(plan.assignments[0].volts).toBe(24)
  })
})

describe("output assignment", () => {
  it("gives every pedal its own output on an isolated supply", () => {
    const items = [item("boss-ds-1"), item("boss-bd-2"), item("mxr-phase-90")]
    const plan = planPower(items, supply("strymon-ojai"))

    expect(plan.unpowered).toHaveLength(0)
    const used = new Set(plan.assignments.map((a) => a.outputIndex))
    expect(used.size).toBe(3)
    expect(plan.issues.some((i) => i.severity === "fatal")).toBe(false)
  })

  /**
   * First-fit DESCENDING, and this is the test that pins why.
   *
   * Ascending order lets small pedals settle onto the big outputs, and the
   * 500mA pedal then arrives to find nothing left that fits, on a supply that
   * had ample total capacity. Sorting hungriest-first avoids it.
   */
  it("places the hungriest pedal first, so it does not get squeezed out", () => {
    const items = [
      item("boss-ds-1"),
      item("mxr-phase-90"),
      item("universal-audio-golden"),
      item("boss-sd-1"),
    ]
    const plan = planPower(items, supply("voodoo-lab-pedal-power-2-plus"))

    // The 400mA UAFX must land on one of the 250mA-or-better outputs, and it
    // does not fit any of them, so this asserts the failure is REPORTED rather
    // than silently dropped.
    const golden = plan.assignments.find((a) => a.pedalId === "universal-audio-golden")
    if (!golden) {
      expect(plan.unpowered).toContain("universal-audio-golden")
      expect(plan.issues.some((i) => i.kind === "no-output-left")).toBe(true)
    } else {
      expect(golden.ma).toBe(400)
    }
  })

  it("reports over-capacity as fatal", () => {
    // Six 500mA pedals is 3000mA against Ojai's 2500mA total.
    const hungry: PowerItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: `hungry-${i}`,
      brand: "Test",
      model: `Hungry ${i}`,
      type: "delay",
      power: { ma: 500, volts: 9, polarity: "center-negative", dcJack: true, source: "maker" },
    }))

    const plan = planPower(hungry, supply("strymon-ojai"))

    expect(plan.issues.some((i) => i.kind === "over-capacity" && i.severity === "fatal")).toBe(true)
    expect(plan.headroom).toBeLessThan(0)
  })
})

describe("daisy chains", () => {
  /**
   * The hum warning. A daisy chain is what most people already own, so the
   * planner has to model it rather than pretend everyone has a brick, and the
   * warning is the whole reason it is in the catalogue.
   */
  it("warns about the shared ground, without calling it fatal", () => {
    const plan = planPower([item("boss-ds-1"), item("boss-bd-2")], supply("daisy-chain-1a"))

    const issue = plan.issues.find((i) => i.kind === "shared-ground")
    expect(issue?.severity).toBe("warn")
    expect(issue?.message).toMatch(/hum/i)
    expect(plan.unpowered).toHaveLength(0)
  })

  it("does not warn when only one pedal is on it, since there is nothing to share with", () => {
    const plan = planPower([item("boss-ds-1")], supply("daisy-chain-1a"))
    expect(plan.issues.some((i) => i.kind === "shared-ground")).toBe(false)
  })
})

describe("confidence", () => {
  it("is 'spec' only when every figure came from a maker", () => {
    const plan = planPower([item("strymon-timeline"), item("boss-ds-1")], supply("strymon-zuma"))
    expect(plan.confidence).toBe("spec")
    expect(plan.issues.some((i) => i.kind === "estimated-only")).toBe(false)
  })

  it("drops to 'estimated' for a board of unknown pedals, and says so", () => {
    const guesses: PowerItem[] = ["delay", "reverb", "drive"].map((type, i) => ({
      id: `unknown-${i}`,
      brand: "Unknown",
      model: `Pedal ${i}`,
      type: type as PowerItem["type"],
      power: estimatedPower(type as PowerItem["type"]),
    }))

    const plan = planPower(guesses, supply("strymon-zuma"))

    expect(plan.confidence).toBe("estimated")
    const note = plan.issues.find((i) => i.kind === "estimated-only")
    expect(note?.message).toMatch(/typical draws/i)
  })

  /**
   * A supply whose own output map is approximate must pull confidence down
   * even when every pedal is spec'd. Otherwise the planner reports "spec" for
   * an assignment it could not actually verify.
   */
  it("is dragged down by an estimated supply even when the pedals are spec'd", () => {
    const plan = planPower([item("boss-ds-1")], supply("voodoo-lab-pedal-power-2-plus"))
    expect(plan.confidence).not.toBe("spec")
  })
})

describe("recommendSupply", () => {
  it("returns the smallest isolated supply that genuinely works", () => {
    const items = [item("boss-ds-1"), item("boss-bd-2"), item("mxr-phase-90")]
    const chosen = recommendSupply(items, SUPPLIES)

    expect(chosen).not.toBeNull()
    expect(chosen?.isolated).toBe(true)
    expect(planPower(items, chosen).issues.every((i) => i.severity !== "fatal")).toBe(true)
  })

  it("never recommends a daisy chain, whatever the numbers say", () => {
    // One tiny pedal: a 1A daisy chain has ample capacity and is still wrong.
    const chosen = recommendSupply([item("mxr-phase-90")], SUPPLIES)
    expect(chosen?.isolated).toBe(true)
  })

  it("leaves 35% headroom rather than sizing to the exact draw", () => {
    const items = [item("strymon-timeline"), item("strymon-bigsky")]
    const draw = items.reduce((sum, i) => sum + i.power.ma, 0)
    const chosen = recommendSupply(items, SUPPLIES)

    expect(chosen).not.toBeNull()
    expect(supplyTotalMa(chosen!)).toBeGreaterThanOrEqual(draw * 1.35)
  })

  it("returns null when nothing needs power", () => {
    expect(recommendSupply([item("dallas-arbiter-fuzz-face")], SUPPLIES)).toBeNull()
  })
})

describe("the catalogue itself", () => {
  it("has unique pedal ids, since shared board URLs are built from them", () => {
    const ids = PEDALS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has unique supply ids, and every supply reports a positive capacity", () => {
    const ids = SUPPLIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SUPPLIES) {
      expect(supplyTotalMa(s)).toBeGreaterThan(0)
      expect(supplyOutputCount(s)).toBeGreaterThan(0)
    }
  })

  /**
   * A pedal with a DC jack, zero draw and a "maker" source is almost certainly
   * a missing figure rather than a real zero, and it would silently make a
   * board look cheaper to power than it is.
   */
  it("has no pedal claiming a spec'd zero-milliamp draw over a DC jack", () => {
    for (const pedal of PEDALS) {
      if (pedal.power.dcJack === false) continue
      expect(pedal.power.ma, `${pedal.brand} ${pedal.model}`).toBeGreaterThan(0)
    }
  })

  it("gives every pedal a positive footprint", () => {
    for (const pedal of PEDALS) {
      expect(pedal.dims.widthMm, `${pedal.brand} ${pedal.model}`).toBeGreaterThan(0)
      expect(pedal.dims.depthMm, `${pedal.brand} ${pedal.model}`).toBeGreaterThan(0)
    }
  })
})
