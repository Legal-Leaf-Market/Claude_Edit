import { describe, expect, it } from "vitest"
import { FAMILY_ORDER, PEDALS, pedalBySlug, pedalsByFamily } from "@/lib/pedals"

describe("the pedal dataset", () => {
  it("has unique slugs", () => {
    const slugs = PEDALS.map((pedal) => pedal.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("uses url-safe slugs", () => {
    for (const pedal of PEDALS) {
      expect(pedal.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it("fills in every field a page renders, so no entry can ship half written", () => {
    for (const pedal of PEDALS) {
      expect(pedal.name.length, pedal.slug).toBeGreaterThan(0)
      expect(pedal.maker.length, pedal.slug).toBeGreaterThan(0)
      expect(pedal.summary.length, pedal.slug).toBeGreaterThan(30)
      expect(pedal.circuit.length, pedal.slug).toBeGreaterThan(120)
      expect(pedal.listenFor.length, pedal.slug).toBeGreaterThan(120)
      expect(pedal.controls.length, pedal.slug).toBeGreaterThan(0)
      expect(FAMILY_ORDER).toContain(pedal.family)
    }
  })

  /**
   * The dataset's own rule, enforced rather than remembered.
   *
   * Prototypes, production runs, revisions and reissues all disagree about
   * what year a pedal "is", so a four-digit year in this field would be a
   * precision nothing in this repo can back up.
   */
  it("keeps eras at decade level and never states a precise year", () => {
    for (const pedal of PEDALS) {
      expect(pedal.era, pedal.slug).toMatch(/\d{4}s/)
      expect(pedal.era, pedal.slug).not.toMatch(/\d{4}(?!s)/)
    }
  })

  it("looks a pedal up by slug and returns undefined for anything else", () => {
    expect(pedalBySlug("tube-screamer")?.name).toBe("Tube Screamer")
    expect(pedalBySlug("nope")).toBeUndefined()
  })

  it("groups by family without dropping or duplicating an entry", () => {
    const grouped = pedalsByFamily().flatMap((group) => group.pedals)
    expect(grouped).toHaveLength(PEDALS.length)
    expect(new Set(grouped.map((pedal) => pedal.slug)).size).toBe(PEDALS.length)
  })

  /**
   * The absence that matters most.
   *
   * A rig changes between tours and between takes, so "this pedal is on that
   * record" is a claim that needs a source. A wrong credit printed beside a
   * circuit description reads as fact, so the dataset carries no artist field
   * at all and this test is what stops one being added casually.
   */
  it("carries no artist attribution field", () => {
    const forbidden = ["artist", "artists", "usedBy", "players", "famousFor", "credits"]
    for (const pedal of PEDALS) {
      for (const key of forbidden) {
        expect(Object.keys(pedal), pedal.slug).not.toContain(key)
      }
    }
  })
})
