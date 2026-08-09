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
