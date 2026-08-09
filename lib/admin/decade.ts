/**
 * Years 3 to 10.
 *
 * A DELIBERATELY SEPARATE MODEL FROM engine.ts, and the distinction matters
 * when reading any number that comes out of here.
 *
 * engine.ts fits a curve through three session anchors and derives revenue
 * from unit economics that are mostly measurable: basket, commission rate,
 * conversion, attribution. Its 24-month output is grounded.
 *
 * This file does something far cruder. It takes the month-24 exit run rate
 * and applies a growth rate that decays toward a floor. That is an
 * assumption, not a derivation, and it is the single load-bearing input for
 * every decade figure: the spread between the conservative and strong paths
 * is roughly 6x by year 10, entirely from this one number. Treat the output
 * as a shape, not a forecast.
 *
 * Why a decaying growth rate at all: affiliate and content businesses
 * compound while they keep publishing and adding sources, then taper as the
 * addressable catalogue and the ranking positions saturate. Constant growth
 * would be fiction; a flat run rate would ignore that the catalogue keeps
 * growing. Decay toward a floor is the least-wrong of the three.
 *
 * NOT modelled, and each could dominate the result:
 *   - A Google core update. Affiliate content sites have been wiped out by
 *     these. This is the most likely single cause of the model being wrong.
 *   - A merchant terminating its programme, or GoAffPro changing terms.
 *   - Ten years of sustained effort, which is the real constraint.
 */

export type DecadePath = {
  key: "conservative" | "base" | "strong"
  label: string
  /** Growth applied in year 3. */
  startGrowth: number
  /** Growth asymptote in the later years. */
  floorGrowth: number
  /** How fast startGrowth decays toward floorGrowth, per year. */
  decay: number
  detail: string
}

export const DECADE_PATHS: DecadePath[] = [
  {
    key: "conservative",
    label: "Conservative",
    startGrowth: 0.2,
    floorGrowth: 0.04,
    decay: 0.75,
    detail:
      "The catalogue keeps growing and the boards keep people coming back, but nothing breaks out. No gated feed ever lands, subscriptions stay small, and growth settles into low single digits by the end of the decade.",
  },
  {
    key: "base",
    label: "Base",
    startGrowth: 0.35,
    floorGrowth: 0.08,
    decay: 0.8,
    detail:
      "Steady compounding: unconfirmed links get confirmed, boutique makers keep signing, at least one gated feed comes online, and the community boards give the site a direct-traffic base that does not depend on search rankings.",
  },
  {
    key: "strong",
    label: "Strong",
    startGrowth: 0.55,
    floorGrowth: 0.12,
    decay: 0.82,
    detail:
      "eBay production access lands and the boards become a destination in their own right. Subscriptions scale past a few hundred makers, which is the only route by which paid acquisition ever approaches breakeven.",
  },
]

export type DecadeYear = {
  year: number
  growth: number
  revenue: number
  costs: number
  salary: number
  retained: number
  cumulativeRevenue: number
  cumulativeRetained: number
}

export type DecadeInput = {
  /** Annualised revenue at month 24, from the 24-month model. */
  exitRunRate: number
  /** Revenue already booked in years 1 and 2. */
  priorRevenue: number
  /** Net already retained across years 1 and 2. */
  priorRetained: number
  /** Owner salary, taken from salaryFromYear onward. */
  salary?: number
  salaryFromYear?: number
  /** Hosting, tooling and ads. Grows with revenue, with a floor. */
  costRate?: number
  costFloor?: number
}

export function projectDecade(path: DecadePath, input: DecadeInput): DecadeYear[] {
  const {
    exitRunRate,
    priorRevenue,
    priorRetained,
    salary = 50_000,
    salaryFromYear = 3,
    costRate = 0.06,
    costFloor = 12_000,
  } = input

  let revenue = exitRunRate
  let cumulativeRevenue = priorRevenue
  let cumulativeRetained = priorRetained
  const years: DecadeYear[] = []

  for (let year = 3; year <= 10; year += 1) {
    const growth =
      path.floorGrowth + (path.startGrowth - path.floorGrowth) * Math.pow(path.decay, year - 3)
    revenue = revenue * (1 + growth)

    const costs = Math.max(costFloor, revenue * costRate)
    const paid = year >= salaryFromYear ? salary : 0
    const retained = revenue - costs - paid

    cumulativeRevenue += revenue
    cumulativeRetained += retained

    years.push({
      year,
      growth,
      revenue,
      costs,
      salary: paid,
      retained,
      cumulativeRevenue,
      cumulativeRetained,
    })
  }

  return years
}

/** First year where cumulative revenue crosses a target, or null within the horizon. */
export function yearReaching(years: DecadeYear[], target: number): number | null {
  return years.find((y) => y.cumulativeRevenue >= target)?.year ?? null
}

/**
 * Maker subscriptions: $5/mo for six months, then $20.
 *
 * Cohort-tracked because the step-up hits each cohort at ITS month six, not
 * at a shared calendar date, and because the churn spike at the step-up is
 * the whole risk of intro pricing. stepUpChurn is separate from baseline
 * churn for that reason.
 *
 * The honest caveat: this revenue is not chargeable until the site can send
 * a maker enough traffic to justify the price. Around 50 visits a month at a
 * $260 basket is roughly where $20 stops feeling like a bad deal, and the
 * site is well short of that per maker today.
 */
export type SubscriptionInput = {
  introPrice?: number
  fullPrice?: number
  introMonths?: number
  addPerMonth?: number
  monthlyChurn?: number
  stepUpChurn?: number
  months?: number
}

export function projectSubscriptions(input: SubscriptionInput = {}) {
  const {
    introPrice = 5,
    fullPrice = 20,
    introMonths = 6,
    addPerMonth = 4,
    monthlyChurn = 0.07,
    stepUpChurn = 0.3,
    months = 24,
  } = input

  const cohorts: { born: number; n: number }[] = []
  let total = 0
  const monthly: number[] = []

  for (let m = 1; m <= months; m += 1) {
    cohorts.push({ born: m, n: addPerMonth })
    let thisMonth = 0
    for (const cohort of cohorts) {
      const age = m - cohort.born
      if (age < 0) continue
      if (age === introMonths) cohort.n *= 1 - stepUpChurn
      else if (age > 0) cohort.n *= 1 - monthlyChurn
      thisMonth += cohort.n * (age < introMonths ? introPrice : fullPrice)
    }
    monthly.push(thisMonth)
    total += thisMonth
  }

  return {
    total,
    monthly,
    payingAtEnd: cohorts.reduce((sum, c) => sum + c.n, 0),
  }
}
