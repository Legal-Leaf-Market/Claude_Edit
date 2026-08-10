import { describe, expect, it } from "vitest"
import { runModel } from "@/lib/admin/engine"
import { SISTER_SITE_PROFILES } from "@/lib/admin/sister-sites"
import { SCENARIOS } from "@/lib/admin/reference-data"
import { ALL_SITE_PROFILES, runAllSites, combinedMonths } from "@/lib/admin/all-sites"

/**
 * Guards against the sister-site reference data silently drifting from what
 * it was ported from. Session/revenue totals only match the sister sites'
 * own pinned acceptance numbers (ADMIN-OPERATING-MODEL.md on
 * Legal-Leaf-Market/Code_Backup) to within a few percent, not exactly — see
 * the MODEL_START comment in sister-sites.ts for why that gap is expected
 * rather than a porting error. maturityRevPerSession does not depend on
 * calendar alignment at all, so THAT figure is checked exactly: any drift
 * there means an assumption was mistyped, not a calendar-offset artifact.
 */
describe("sister-site reference data", () => {
  it("reproduces the pinned maturity revenue-per-session exactly, per site", () => {
    const model = runModel(SISTER_SITE_PROFILES, undefined, SCENARIOS.base, undefined)
    expect(model.sites.legal.maturityRevPerSession).toBeCloseTo(0.24, 3)
    expect(model.sites.kawaii.maturityRevPerSession).toBeCloseTo(0.055, 3)
    expect(model.sites.herbal.maturityRevPerSession).toBeCloseTo(0.141, 3)
    expect(model.sites.nicotia.maturityRevPerSession).toBeCloseTo(0.072, 3)
  })

  it("lands within 5% of the sister sites' own pinned 24-month base-case acceptance numbers", () => {
    const model = runModel(SISTER_SITE_PROFILES, undefined, SCENARIOS.base, undefined)
    const t = model.totals
    expect(t.month24Revenue).toBeGreaterThan(8390 * 0.95)
    expect(t.month24Revenue).toBeLessThan(8390 * 1.05)
    expect(t.exitRunRate).toBeGreaterThan(100679 * 0.95)
    expect(t.exitRunRate).toBeLessThan(100679 * 1.05)
    expect(t.month24Sessions).toBeGreaterThan(68241 * 0.95)
    expect(t.month24Sessions).toBeLessThan(68241 * 1.05)
  })

  it("lands within 5% of the pinned bear/bull acceptance numbers too", () => {
    const bear = runModel(SISTER_SITE_PROFILES, undefined, SCENARIOS.bear, undefined)
    const bull = runModel(SISTER_SITE_PROFILES, undefined, SCENARIOS.bull, undefined)
    expect(bear.totals.totalRevenue).toBeGreaterThan(15371 * 0.95)
    expect(bear.totals.totalRevenue).toBeLessThan(15371 * 1.05)
    expect(bull.totals.exitRunRate).toBeGreaterThan(254715 * 0.95)
    expect(bull.totals.exitRunRate).toBeLessThan(254715 * 1.05)
  })
})

describe("all-sites combination", () => {
  it("combines Gear Avail with all four sister sites", () => {
    expect(ALL_SITE_PROFILES).toHaveLength(5)
    expect(ALL_SITE_PROFILES.map((p) => p.key)).toEqual(["gearavail", "legal", "kawaii", "herbal", "nicotia"])
  })

  it("combined totals equal the sum of every individual site's totals", () => {
    const model = runAllSites(SCENARIOS.base)
    const list = model.order.map((k) => model.sites[k])
    const expectedRevenue = list.reduce((s, site) => s + site.totalRevenue, 0)
    const expectedSessions = list.reduce((s, site) => s + site.totalSessions, 0)
    expect(model.totals.totalRevenue).toBeCloseTo(expectedRevenue, 6)
    expect(model.totals.totalSessions).toBe(expectedSessions)
  })

  it("respects a requested decade horizon", () => {
    const model = runAllSites(SCENARIOS.base, 120)
    expect(model.monthLabels).toHaveLength(120)
    for (const key of model.order) {
      expect(model.sites[key].months).toHaveLength(120)
    }
  })

  it("combinedMonths sums revenue and sessions across every site, month by month", () => {
    const model = runAllSites(SCENARIOS.base)
    const months = combinedMonths(model)
    expect(months).toHaveLength(24)
    const list = model.order.map((k) => model.sites[k])
    const expectedMonth1Revenue = list.reduce((s, site) => s + site.months[0].revenue, 0)
    expect(months[0].revenue).toBeCloseTo(expectedMonth1Revenue, 6)
  })
})
