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
 * Which path actually happens, and what advisory does to that.
 *
 * The three paths above are not equally likely, and the difference between
 * them is roughly 6x by year 10. So the honest question is not "what does
 * the base case say" but "what is the probability-weighted outcome".
 *
 * Standing monthly advice from operators who have run this kind of business
 * belongs HERE and nowhere else in the model. It is not revenue, and it is
 * not a cost saving either: an unpaid advisor is not money saved, because
 * paid consultants were never in the budget. Booking it as either would be
 * inventing a number. What experienced advisors actually change is the odds
 * of executing well, which is exactly what these weights describe.
 *
 * The weights themselves are judgement, not measurement. They are the
 * softest input in this file, which is already the softer of the two models.
 */
export type ScenarioWeights = Record<DecadePath["key"], number>

/**
 * Solo, no outside input. Weighted toward conservative because the common
 * failure mode of a one-person business is not collapse, it is drift:
 * plausible-looking work that never compounds, with nobody asking why.
 */
export const WEIGHTS_UNADVISED: ScenarioWeights = {
  conservative: 0.55,
  base: 0.35,
  strong: 0.1,
}

/**
 * With standing monthly advisory from people who have operated in this
 * space. The shift is deliberately modest: advisors improve decisions, they
 * do not change the market, and the biggest risk to this business (a Google
 * core update) is not one an advisor can avert. Most of the movement is out
 * of the conservative case rather than into the strong one, because good
 * advice mostly prevents wasted years rather than manufacturing breakouts.
 */
export const WEIGHTS_ADVISED: ScenarioWeights = {
  conservative: 0.35,
  base: 0.47,
  strong: 0.18,
}

export type Advisor = {
  name: string
  relationship: string
  /** What this person is actually positioned to de-risk. */
  bringsToTheTable: string
  cadence: string
  /** Nothing is agreed yet; every one of these is a conversation not yet had. */
  status: "confirmed" | "to approach"
}

export const ADVISORS: Advisor[] = [
  {
    name: "George Lawrence",
    relationship: "Mentor; runs DrumSellers.com, a Sharetribe marketplace",
    bringsToTheTable:
      "Has operated a live instrument marketplace for years: seller acquisition, what makes sellers stay, and the operational reality of peer-to-peer listings. The one adviser here with direct sector experience, and a potential inventory partner in his own right.",
    cadence: "Monthly, proposed",
    status: "to approach",
  },
  {
    name: "Thomas Hume",
    relationship: "Mentor; consulting practice, Indianapolis",
    bringsToTheTable:
      "Consulting and business operations. Detail to be filled in once the practice is confirmed rather than assumed.",
    cadence: "Monthly, proposed",
    status: "to approach",
  },
]

/**
 * Warm introductions versus cold outreach.
 *
 * The boutique-maker channel was originally priced as cold outreach: find a
 * builder, email them, hope. That is the wrong model for this operator and
 * this market. Boutique instrument building is a scene, reputation travels
 * inside it, and an introduction from someone a builder already trusts is a
 * different act from an unsolicited email.
 *
 * The mechanism matters, because it is not the one you would guess. A warm
 * intro does NOT get you a better commission rate here: the rate is 3.5% by
 * choice, and deliberately low. What it changes is how many makers say yes,
 * and how fast. Since each maker is worth roughly five times more as a
 * promotional channel than as a commission line (their audience posts about
 * you; the commission is nearly a wash against the existing storefronts),
 * the network's value flows almost entirely through TRAFFIC.
 *
 * That is also why this is modelled as an acquisition rate rather than a
 * revenue multiplier. More makers signed, each bringing an audience, against
 * a business whose binding constraint is traffic and not monetisation.
 *
 * Magnitudes below are judgement. Warm intros are well understood to convert
 * better than cold outreach, but the specific ratio here is an assumption,
 * and it is doing real work in the output.
 */
export type OutreachMode = {
  key: "cold" | "warm"
  label: string
  /** Makers signed per month. */
  makersPerMonth: number
  /** Referred sessions per maker per month, once live. */
  sessionsPerMakerPerMonth: number
  detail: string
}

export const OUTREACH_MODES: Record<"cold" | "warm", OutreachMode> = {
  cold: {
    key: "cold",
    label: "Cold outreach",
    makersPerMonth: 1.25,
    sessionsPerMakerPerMonth: 80,
    detail:
      "Unsolicited email to builders with no shared context. Most go unanswered, and the ones that land still owe you nothing beyond a link.",
  },
  warm: {
    key: "warm",
    label: "Warm introductions",
    makersPerMonth: 3,
    sessionsPerMakerPerMonth: 120,
    detail:
      "Introductions through an existing network in the same scene. More say yes, they say yes sooner, and crucially they promote harder, because they are doing a favour for someone they know rather than accepting a commercial offer from a stranger. The higher per-maker traffic figure is that promotional difference, not a bigger audience.",
  },
}

/** Monthly referred sessions from makers signed to date, at a given month. */
export function makerTrafficAt(mode: OutreachMode, month: number): number {
  return Math.round(mode.makersPerMonth * month * mode.sessionsPerMakerPerMonth)
}

/** Probability-weighted outcome across the three paths. */
export function expectedOutcome(
  weights: ScenarioWeights,
  input: DecadeInput,
): { expectedRevenue10yr: number; expectedRetained10yr: number; expectedYear10RunRate: number } {
  let revenue = 0
  let retained = 0
  let runRate = 0

  for (const path of DECADE_PATHS) {
    const years = projectDecade(path, input)
    const final = years[years.length - 1]
    const w = weights[path.key]
    revenue += final.cumulativeRevenue * w
    retained += final.cumulativeRetained * w
    runRate += final.revenue * w
  }

  return {
    expectedRevenue10yr: revenue,
    expectedRetained10yr: retained,
    expectedYear10RunRate: runRate,
  }
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

/**
 * The subscriber rebate, phased in.
 *
 * Structure: a shopper earns a share of the commission the purchase generated.
 * They can cash it out to PayPal at half value, or spend it at full value with
 * one of the vendors. That 2x differential is what makes it affordable -- you
 * only pay full freight on the half that takes credit, unredeemed credit never
 * costs anything, and credit that IS spent triggers an order you earn
 * commission on.
 *
 * WHY IT IS PHASED RATHER THAN LAUNCHED. At today's mix Gear Avail earns about
 * $7.64 on a $191 order, roughly 4% of the sale. A rebate at 40% of commission
 * costs about a quarter of revenue and needs roughly a third more orders just
 * to break even. Launching it in year one spends margin that does not exist on
 * retention the community boards already provide free. It becomes affordable
 * once eBay volume supports better negotiated rates and the boutique share of
 * orders grows, which is why the schedule below starts in year three.
 *
 * Naming matters and is not cosmetic: this is a LOYALTY REBATE, never a
 * dividend or profit share. Sharing profits with non-shareholders can create a
 * security, with the registration and disclosure obligations that implies.
 */
export type RebatePhase = { fromYear: number; shareOfCommission: number; note: string }

export const REBATE_SCHEDULE: RebatePhase[] = [
  { fromYear: 1, shareOfCommission: 0, note: "Announced as coming, not yet live. Anticipation costs nothing." },
  { fromYear: 3, shareOfCommission: 0.20, note: "Reads as ~0.8% back. Small enough to absorb, real enough to matter." },
  { fromYear: 5, shareOfCommission: 0.40, note: "Reads as ~1.6% back, once volume and rates support it." },
]

/**
 * What a rebate actually costs, net of the things that give money back:
 * half-value cash-outs, breakage on unredeemed credit, and the commission
 * earned when credit is spent at a vendor.
 */
export function rebateNetCost({
  revenuePerOrder,
  basket,
  shareOfCommission,
  cashOutRate = 0.35,
  breakage = 0.3,
}: {
  revenuePerOrder: number
  basket: number
  shareOfCommission: number
  cashOutRate?: number
  breakage?: number
}) {
  const face = revenuePerOrder * shareOfCommission
  const cashCost = cashOutRate * face * 0.5
  const creditRedeemed = (1 - cashOutRate) * face * (1 - breakage)
  const commissionBack = creditRedeemed * (revenuePerOrder / basket)
  const net = cashCost + creditRedeemed - commissionBack
  return {
    face,
    net,
    shareOfRevenue: revenuePerOrder > 0 ? net / revenuePerOrder : 0,
    readsAsPctOfSale: basket > 0 ? face / basket : 0,
  }
}

/** The rebate share in force for a given year. */
export function rebateShareForYear(year: number): number {
  let share = 0
  for (const phase of REBATE_SCHEDULE) if (year >= phase.fromYear) share = phase.shareOfCommission
  return share
}

/**
 * Local shops.
 *
 * A different animal from every other source here, and priced differently on
 * purpose. A local shop with a few hundred instruments and no e-commerce
 * checkout cannot be paid on commission, because there is usually no
 * trackable online sale: the referral ends in someone walking through a door.
 * Charging a flat subscription is the honest description of what is actually
 * delivered, which is presence and traffic, not conversion.
 *
 * It is also the diversification the affiliate model lacks. Subscription
 * revenue does not move with search rankings, which is the risk most likely
 * to break everything else in this projection.
 *
 * Same sequencing rule as the maker subscriptions: unsellable until the site
 * can show a shop real referral numbers, which is why the schedule starts in
 * year three rather than at launch. Listing itself stays free -- the fee buys
 * a richer store page, never rank.
 */
export type LocalShopInput = {
  /** Shops signed per month once the programme opens. */
  addPerMonth?: number
  monthlyPrice?: number
  /** Local businesses churn less than online merchants once they see walk-ins. */
  monthlyChurn?: number
  startMonth?: number
  months?: number
}

export function projectLocalShops(input: LocalShopInput = {}) {
  const {
    addPerMonth = 1,
    monthlyPrice = 35,
    monthlyChurn = 0.03,
    startMonth = 25, // year 3
    months = 120,
  } = input

  let paying = 0
  let total = 0
  const monthly: number[] = []

  for (let m = 1; m <= months; m += 1) {
    if (m >= startMonth) paying = paying * (1 - monthlyChurn) + addPerMonth
    const revenue = paying * monthlyPrice
    monthly.push(revenue)
    total += revenue
  }

  return { total, monthly, payingAtEnd: paying }
}
