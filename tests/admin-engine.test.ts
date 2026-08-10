import { describe, expect, it } from "vitest"
import { runModel, type Assumptions, type SiteProfile, type Scenario } from "@/lib/admin/engine"

const ASSUMPTIONS: Assumptions = {
  sessionsMonth1: 150,
  sessionsMonth12: 2500,
  sessionsMonth24: 12000,
  basket: 120,
  commissionPct: 8,
  conversionPct: 1.3,
  attributionNowPct: 60,
  attributionExitPct: 90,
}

const PROFILE: SiteProfile = {
  key: "gearavail",
  name: "Gear Avail",
  shortName: "Gear Avail",
  domain: "gearavail.com",
  tagline: "test",
  color: "#f0a830",
  seasonality: Array(12).fill(1),
  curveSteepness: 0.26,
  indexablePages: 15,
  assumptions: ASSUMPTIONS,
}

const NEUTRAL_SCENARIO: Scenario = {
  key: "base",
  label: "Base",
  headline: "",
  detail: "",
  sessions12: 1,
  sessions24: 1,
  conversion: 1,
  freezeAttribution: false,
}

describe("runModel / traffic curve", () => {
  it("passes through the month-1, month-12 and month-24 session anchors", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const months = model.sites.gearavail.months
    // Seasonality is neutral (all 1s) here, so the fitted curve should land
    // on the anchors within rounding.
    expect(months[0].sessions).toBeCloseTo(ASSUMPTIONS.sessionsMonth1, -1)
    expect(months[11].sessions).toBeCloseTo(ASSUMPTIONS.sessionsMonth12, -1)
    expect(months[23].sessions).toBeCloseTo(ASSUMPTIONS.sessionsMonth24, -1)
  })

  it("never produces NaN or negative sessions across the horizon", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    for (const m of model.sites.gearavail.months) {
      expect(Number.isFinite(m.sessions)).toBe(true)
      expect(m.sessions).toBeGreaterThanOrEqual(0)
    }
  })

  it("falls back to geometric interpolation without throwing on a degenerate anchor set", () => {
    const flat: SiteProfile = {
      ...PROFILE,
      assumptions: { ...ASSUMPTIONS, sessionsMonth1: 100, sessionsMonth12: 100, sessionsMonth24: 100 },
    }
    const model = runModel([flat], undefined, NEUTRAL_SCENARIO, undefined)
    for (const m of model.sites.gearavail.months) {
      expect(Number.isFinite(m.sessions)).toBe(true)
    }
  })

  it("holds the geometric fallback flat past month 24 rather than extrapolating its slope forever", () => {
    // A dip-then-rise anchor set: no monotonic sigmoid can pass through all
    // three exactly, which routes this through the geometric fallback
    // instead of the primary curve fit. Extended to a decade, this used to
    // keep compounding the month-12-to-24 slope in log-space indefinitely,
    // reaching session counts in the tens of quintillions by month 120.
    const dip: SiteProfile = {
      ...PROFILE,
      assumptions: { ...ASSUMPTIONS, sessionsMonth1: 1000, sessionsMonth12: 50, sessionsMonth24: 5000 },
    }
    const model = runModel([dip], undefined, NEUTRAL_SCENARIO, undefined, 120)
    const months = model.sites.gearavail.months
    expect(months[23].sessions).toBeCloseTo(5000, -1)
    // Flat past the anchor horizon: month 30, 60, 90 and 120 all sit at the
    // month-24 level, not still climbing (or, before the fix, exploding).
    for (const i of [29, 59, 89, 119]) {
      expect(months[i].sessions).toBeCloseTo(months[23].sessions, -1)
    }
  })
})

describe("runModel / revenue identity", () => {
  it("keeps revenue/GMV equal to commission x attribution, and GMV/orders equal to basket", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const commission = ASSUMPTIONS.commissionPct / 100
    for (const m of model.sites.gearavail.months) {
      if (m.gmv === 0) continue
      const impliedCommissionTimesAttribution = m.revenue / m.gmv
      expect(impliedCommissionTimesAttribution).toBeGreaterThan(0)
      expect(impliedCommissionTimesAttribution).toBeLessThanOrEqual(commission)
      expect(m.gmv / m.orders).toBeCloseTo(ASSUMPTIONS.basket, 5)
    }
  })
})

describe("runModel / scenario multiplier", () => {
  it("scales session anchors and conversion without mutating the base assumptions", () => {
    const bull: Scenario = { ...NEUTRAL_SCENARIO, sessions12: 1.6, sessions24: 2.2, conversion: 1.15 }
    const base = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const bullModel = runModel([PROFILE], undefined, bull, undefined)
    expect(bullModel.sites.gearavail.month24Sessions).toBeGreaterThan(base.sites.gearavail.month24Sessions)
    expect(PROFILE.assumptions.sessionsMonth24).toBe(12000)
  })

  it("freezes attribution at today's rate in a bear-shaped scenario", () => {
    const bear: Scenario = { ...NEUTRAL_SCENARIO, freezeAttribution: true }
    const model = runModel([PROFILE], undefined, bear, undefined)
    expect(model.sites.gearavail.effective.attributionExitPct).toBe(ASSUMPTIONS.attributionNowPct)
  })
})

describe("runModel / actuals re-anchoring", () => {
  it("overrides a closed month with the entered actuals exactly", () => {
    const actuals = { gearavail: { 3: { sessions: 999, revenue: 42 } } }
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, actuals)
    const month3 = model.sites.gearavail.months[2]
    expect(month3.sessions).toBe(999)
    expect(month3.revenue).toBe(42)
    expect(month3.isActual).toBe(true)
  })

  it("scales forward months by the traffic and yield indices rather than leaving them untouched", () => {
    const withoutActuals = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const plannedMonth6 = withoutActuals.sites.gearavail.months[5]

    // Actual sessions running at double the model's plan for month 3.
    const plannedMonth3Sessions = withoutActuals.sites.gearavail.months[2].sessions
    const actuals = {
      gearavail: { 3: { sessions: plannedMonth3Sessions * 2, revenue: plannedMonth3Sessions * 2 * 0.05 } },
    }
    const reanchored = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, actuals)
    const month6 = reanchored.sites.gearavail.months[5]

    expect(month6.sessions).not.toBe(plannedMonth6.sessions)
    expect(month6.sessions).toBeGreaterThan(plannedMonth6.sessions)
  })

  it("does not re-anchor when only sessions or only revenue is entered, not both", () => {
    const actuals = { gearavail: { 3: { sessions: 999 } } }
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, actuals)
    expect(model.sites.gearavail.months[2].isActual).toBe(false)
    expect(model.sites.gearavail.closedMonths).toHaveLength(0)
  })
})

describe("runModel / overrides", () => {
  it("an override wins over the profile's shipped assumption", () => {
    const model = runModel([PROFILE], { gearavail: { basket: 250 } }, NEUTRAL_SCENARIO, undefined)
    expect(model.sites.gearavail.effective.basket).toBe(250)
  })
})

describe("runModel / extended horizon (displayMonths)", () => {
  it("produces exactly the requested number of months", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined, 120)
    expect(model.sites.gearavail.months).toHaveLength(120)
    expect(model.monthLabels).toHaveLength(120)
  })

  it("matches the default 24-month run exactly for months 1-24", () => {
    const standard = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const extended = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined, 120)
    for (let i = 0; i < 24; i += 1) {
      expect(extended.sites.gearavail.months[i].sessions).toBe(standard.sites.gearavail.months[i].sessions)
      expect(extended.sites.gearavail.months[i].revenue).toBeCloseTo(standard.sites.gearavail.months[i].revenue, 6)
    }
  })

  it("never lets conversion or attribution exceed their fully-matured value past month 24", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined, 120)
    const months = model.sites.gearavail.months
    // revPerSession is monotonic with the conversion/attribution ramps once
    // sessions are large enough that rounding noise washes out; the ramps
    // themselves must never imply more than fully-matured (ratio > 1 was
    // exactly the overshoot bug this displayMonths support had to fix).
    const month24RevPerSession = months[23].revPerSession
    for (let i = 24; i < months.length; i += 1) {
      expect(months[i].revPerSession).toBeLessThanOrEqual(month24RevPerSession * 1.001)
    }
  })

  it("sums the full extended horizon in totalRevenue, not just the first 24 months", () => {
    const model = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined, 120)
    const site = model.sites.gearavail
    const firstTwoYears = site.year1Revenue + site.year2Revenue
    expect(site.totalRevenue).toBeGreaterThan(firstTwoYears)
  })

  it("keeps year1Revenue and year2Revenue scoped to the first 24 months on a longer run", () => {
    const standard = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const extended = runModel([PROFILE], undefined, NEUTRAL_SCENARIO, undefined, 120)
    expect(extended.sites.gearavail.year1Revenue).toBeCloseTo(standard.sites.gearavail.year1Revenue, 6)
    expect(extended.sites.gearavail.year2Revenue).toBeCloseTo(standard.sites.gearavail.year2Revenue, 6)
  })
})

describe("runModel / multiple site profiles combined", () => {
  const SECOND_PROFILE: SiteProfile = {
    ...PROFILE,
    key: "second",
    name: "Second Site",
    assumptions: { ...ASSUMPTIONS, sessionsMonth1: 300, sessionsMonth12: 5000, sessionsMonth24: 24000 },
  }

  it("sums totals across every profile passed in", () => {
    const model = runModel([PROFILE, SECOND_PROFILE], undefined, NEUTRAL_SCENARIO, undefined)
    const expectedRevenue = model.sites.gearavail.totalRevenue + model.sites.second.totalRevenue
    const expectedSessions = model.sites.gearavail.totalSessions + model.sites.second.totalSessions
    expect(model.totals.totalRevenue).toBeCloseTo(expectedRevenue, 6)
    expect(model.totals.totalSessions).toBe(expectedSessions)
    expect(model.order).toEqual(["gearavail", "second"])
  })

  it("keeps each site's own effective assumptions independent of the other's overrides", () => {
    const model = runModel(
      [PROFILE, SECOND_PROFILE],
      { second: { basket: 999 } },
      NEUTRAL_SCENARIO,
      undefined,
    )
    expect(model.sites.second.effective.basket).toBe(999)
    expect(model.sites.gearavail.effective.basket).toBe(ASSUMPTIONS.basket)
  })
})
