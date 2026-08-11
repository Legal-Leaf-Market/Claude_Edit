import { describe, expect, it } from "vitest"
import { EFFECTS, EFFECT_TYPES } from "@/lib/pedalboard/chain"
import {
  allRecords,
  creditsForGear,
  DECADES,
  FEATURED_RIG_SLUGS,
  hueFor,
  initialsFor,
  rigChainOrder,
  rigFromSlug,
  rigsByEffectFamily,
  rigsWithEffectFamily,
  rigStats,
  RIGS,
  signaturePedal,
} from "@/lib/rigs"
import {
  decodeBoard,
  decodeSlot,
  encodeBoard,
  encodeSlot,
  MAX_SLOTS,
} from "@/lib/pedalboard/board-url"

/**
 * The curated rig dataset and the board URL codec. Pure data, no database.
 *
 * Hand-authoring two dozen entries with nested pedals and records invites
 * exactly the slips these guard against: a duplicate slug breaking a React
 * key or a route, an effect type that is not in the enum, a signature pedal
 * marked twice, a featured slug pointing at a rig that was renamed.
 */

describe("RIGS", () => {
  it("is a substantial set", () => {
    expect(RIGS.length).toBeGreaterThanOrEqual(20)
  })

  it("has unique slugs, since those are routes and React keys", () => {
    const slugs = RIGS.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("uses URL-safe slugs", () => {
    for (const rig of RIGS) {
      expect(rig.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it("fills every field the pages render", () => {
    for (const rig of RIGS) {
      expect(rig.name.trim()).not.toBe("")
      expect(rig.context.trim()).not.toBe("")
      expect(rig.genre.trim()).not.toBe("")
      expect(rig.era.trim()).not.toBe("")
      expect(rig.blurb.trim().length).toBeGreaterThan(40)
      expect(rig.pedals.length).toBeGreaterThanOrEqual(2)
      expect(rig.records.length).toBeGreaterThanOrEqual(1)
    }
  })

  it("uses a decade the filter UI actually offers", () => {
    for (const rig of RIGS) {
      expect(DECADES).toContain(rig.decade)
    }
  })

  it("gives every pedal a real effect type and a role", () => {
    for (const rig of RIGS) {
      for (const pedal of rig.pedals) {
        expect(EFFECT_TYPES).toContain(pedal.type)
        expect(EFFECTS[pedal.type]).toBeDefined()
        expect(pedal.brand.trim()).not.toBe("")
        expect(pedal.model.trim()).not.toBe("")
        expect(pedal.role.trim().length).toBeGreaterThan(15)
      }
    }
  })

  it("marks at most one signature pedal per rig", () => {
    for (const rig of RIGS) {
      expect(rig.pedals.filter((p) => p.signature).length).toBeLessThanOrEqual(1)
    }
  })

  it("does not list the same pedal twice on one board", () => {
    for (const rig of RIGS) {
      const keys = rig.pedals.map((p) => `${p.brand}|${p.model}`.toLowerCase())
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("gives every record a plausible year", () => {
    for (const rig of RIGS) {
      for (const record of rig.records) {
        expect(record.title.trim()).not.toBe("")
        expect(record.year).toBeGreaterThan(1955)
        expect(record.year).toBeLessThan(2027)
      }
    }
  })

  /**
   * The house rule from CLAUDE.md section 16, enforced where it is easiest to
   * break: a couple of thousand words of hand-written prose.
   */
  it("uses no em dashes anywhere in the copy", () => {
    for (const rig of RIGS) {
      const prose = [
        rig.blurb,
        ...rig.pedals.map((p) => p.role),
        ...rig.records.map((r) => r.note ?? ""),
      ].join(" ")
      expect(prose).not.toMatch(/—|–/)
    }
  })
})

describe("lookups", () => {
  it("resolves every featured slug, so the nav cannot point at a 404", () => {
    for (const slug of FEATURED_RIG_SLUGS) {
      expect(rigFromSlug(slug), `featured slug "${slug}" does not resolve`).not.toBeNull()
    }
  })

  it("returns null for an unknown slug rather than throwing", () => {
    expect(rigFromSlug("not-a-real-player")).toBeNull()
  })

  it("gives every rig a distinct hue and non-empty initials", () => {
    const hues = RIGS.map(hueFor)
    expect(new Set(hues).size).toBe(RIGS.length)
    for (const rig of RIGS) {
      const initials = initialsFor(rig)
      expect(initials.length).toBeGreaterThanOrEqual(1)
      expect(initials.length).toBeLessThanOrEqual(2)
      expect(initials).toBe(initials.toUpperCase())
    }
  })

  it("always finds a signature pedal, falling back to the first", () => {
    for (const rig of RIGS) {
      expect(rig.pedals).toContain(signaturePedal(rig))
    }
  })

  it("puts a rig's board into conventional signal order", () => {
    for (const rig of RIGS) {
      const ordered = rigChainOrder(rig)
      expect(ordered).toHaveLength(rig.pedals.length)
      const ranks = ordered.map((p) => EFFECTS[p.type].rank)
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    }
  })

  it("never offers an effect family filter that lands on an empty page", () => {
    for (const family of rigsByEffectFamily()) {
      expect(family.count).toBeGreaterThan(0)
      expect(rigsWithEffectFamily(family.slug).length).toBe(family.count)
    }
  })

  it("returns nothing for an unknown effect family rather than everything", () => {
    expect(rigsWithEffectFamily("not-a-family")).toEqual([])
  })

  it("sorts every record newest first", () => {
    const years = allRecords().map((r) => r.record.year)
    expect([...years].sort((a, b) => b - a)).toEqual(years)
  })

  it("counts what the index page prints", () => {
    const stats = rigStats()
    expect(stats.rigs).toBe(RIGS.length)
    expect(stats.records).toBe(RIGS.reduce((n, r) => n + r.records.length, 0))
    expect(stats.pedals).toBeGreaterThan(0)
  })
})

/**
 * The reverse index is the feature that justifies the dataset, and a WRONG
 * match here is worse than no match: it would print "Comfortably Numb" under
 * the wrong pedal on a page a shopper is about to spend money from. So the
 * near-miss cases matter more than the hits.
 */
describe("creditsForGear", () => {
  it("matches a catalogue row whose title carries extra words", () => {
    const credits = creditsForGear("Electro-Harmonix", "Big Muff Pi USA Reissue")
    expect(credits.length).toBeGreaterThan(0)
    expect(credits.some((c) => c.rig.slug === "jack-white")).toBe(true)
  })

  it("matches when the catalogue is TERSER than the dataset", () => {
    const credits = creditsForGear("Ibanez", "TS9")
    expect(credits.some((c) => c.rig.slug === "trey-anastasio")).toBe(true)
  })

  it("does not match across brands, however similar the model reads", () => {
    // Fender made a Blender. So, in a mis-categorised feed row, does a
    // kitchen appliance brand. Brand scoping is the only thing separating
    // them, exactly as it is for MPN matching in the resolver.
    expect(creditsForGear("Hamilton Beach", "Blender")).toEqual([])
    expect(creditsForGear("Boss", "Big Muff Pi")).toEqual([])
  })

  it("refuses to match on a token too short to mean anything", () => {
    expect(creditsForGear("Boss", "DD")).toEqual([])
    expect(creditsForGear("MXR", "")).toEqual([])
  })

  it("returns each credit with that rig's records attached, newest first", () => {
    for (const credit of creditsForGear("Dunlop", "Cry Baby")) {
      expect(credit.records.length).toBeGreaterThan(0)
      const years = credit.records.map((r) => r.year)
      expect([...years].sort((a, b) => b - a)).toEqual(years)
    }
  })
})

describe("board URL codec", () => {
  it("round-trips a catalogue slug", () => {
    const slot = { kind: "gear", slug: "boss-ds-1" } as const
    expect(decodeSlot(encodeSlot(slot))).toEqual(slot)
  })

  it("round-trips an off-catalogue pedal", () => {
    const slot = { kind: "off", brand: "Electro-Harmonix", model: "Big Muff Pi" } as const
    expect(decodeSlot(encodeSlot(slot))).toEqual(slot)
  })

  it("round-trips a mixed board", () => {
    const slots = [
      { kind: "gear", slug: "boss-ds-1" },
      { kind: "off", brand: "MXR", model: "Phase 90" },
      { kind: "gear", slug: "strymon-flint" },
    ] as const
    expect(decodeBoard(encodeBoard([...slots]))).toEqual([...slots])
  })

  /**
   * Both fields become ILIKE patterns downstream, so a crafted URL is the one
   * place untrusted text reaches a query. The slug shape is constrained to
   * what slugify() produces and the free-text fields are length capped.
   */
  it("rejects a slug that is not slug-shaped", () => {
    expect(decodeSlot("%25' OR 1=1--")).toBeNull()
    expect(decodeSlot("Has Spaces")).toBeNull()
    expect(decodeSlot("UPPERCASE")).toBeNull()
  })

  it("rejects an off-catalogue token missing either half", () => {
    expect(decodeSlot("~JustABrand")).toBeNull()
    expect(decodeSlot("~|OnlyAModel")).toBeNull()
    expect(decodeSlot("~")).toBeNull()
  })

  it("caps the length of the free-text halves", () => {
    const slot = decodeSlot(`~${"b".repeat(200)}|${"m".repeat(200)}`)
    expect(slot).not.toBeNull()
    if (slot?.kind === "off") {
      expect(slot.brand.length).toBeLessThanOrEqual(60)
      expect(slot.model.length).toBeLessThanOrEqual(80)
    }
  })

  it("drops duplicates, so one pedal cannot occupy two slots", () => {
    expect(decodeBoard("boss-ds-1,boss-ds-1,mxr-phase-90")).toHaveLength(2)
  })

  it("caps a crafted URL at the board limit", () => {
    const huge = Array.from({ length: 200 }, (_, i) => `pedal-${i}`).join(",")
    expect(decodeBoard(huge)).toHaveLength(MAX_SLOTS)
  })

  it("treats an empty or absent parameter as an empty board", () => {
    expect(decodeBoard("")).toEqual([])
    expect(decodeBoard(undefined)).toEqual([])
    expect(decodeBoard(",,,")).toEqual([])
  })
})
