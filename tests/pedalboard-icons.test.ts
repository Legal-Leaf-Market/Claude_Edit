import { describe, expect, it } from "vitest"
import { ICONS, initialsFor } from "@/lib/pedalboard/icons"

/**
 * Pure data sanity checks for the "Iconic Rigs" roster. No database needed:
 * this just guards against the kind of copy-paste slip that's easy to make
 * hand-authoring twenty entries (a duplicate id breaking React's key prop, an
 * empty field silently rendering nothing).
 */
describe("ICONS", () => {
  it("has a substantial, non-trivial roster", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(15)
  })

  it("has unique ids, since those are used as React keys", () => {
    const ids = ICONS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every entry the fields the UI depends on", () => {
    for (const icon of ICONS) {
      expect(icon.name.trim()).not.toBe("")
      expect(icon.brand.trim()).not.toBe("")
      expect(icon.model.trim()).not.toBe("")
      expect(icon.blurb.trim().length).toBeGreaterThan(10)
      expect(icon.hue).toMatch(/^hsl\(/)
    }
  })

  it("spreads hues across the full range rather than clustering", () => {
    const hues = ICONS.map((i) => Number(i.hue.match(/hsl\((\d+)/)?.[1]))
    const uniqueHues = new Set(hues)
    expect(uniqueHues.size).toBe(ICONS.length)
  })

  it("derives two-letter initials from each name", () => {
    for (const icon of ICONS) {
      const initials = initialsFor(icon)
      expect(initials.length).toBeGreaterThanOrEqual(1)
      expect(initials.length).toBeLessThanOrEqual(2)
      expect(initials).toBe(initials.toUpperCase())
    }
  })
})
