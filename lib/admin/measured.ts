/**
 * MEASURED REALITY: the only real numbers the family has.
 *
 * Everything else in lib/admin is an assumption. This file is the opposite:
 * observations, with their source and window recorded, so the assumptions can
 * be checked against something instead of against each other.
 *
 * All of it comes from legal-leafmarket.com. That is deliberate and it is the
 * whole point: Legal Leaf was the first of the five sites and is the one
 * proving the model. Gear Avail launched the day this file was written and has
 * no history of its own yet, so nothing here is Gear Avail data and none of it
 * is entered as Gear Avail actuals. It lives on this site's admin because this
 * is where the family rollup lives, and because the calibration it implies
 * applies to every site's assumptions, not just Legal Leaf's.
 *
 * A site's own real months still get entered on that site's own admin page.
 * See the module doc on sister-sites.ts for why that stays one-way.
 */

/** Where a number came from, so a stale figure is obvious rather than invisible. */
export type Measurement = {
  source: string
  window: string
  note?: string
}

export const WEB_SOURCE: Measurement = {
  source: "Vercel Analytics, legal-leafmarket.com production",
  window: "11 Jul 2026 to 10 Aug 2026 (30 days)",
  note:
    "The site was live for roughly the last three weeks of this window, so per-day rates are higher than a flat 30-day average implies.",
}

export const WEB_MEASURED = {
  visitors: 338,
  pageViews: 1067,
  bouncePct: 67,
  /** Visitors per route. Note how few get past the homepage. */
  topPages: [
    { path: "/", visitors: 330 },
    { path: "/consumables", visitors: 27 },
    { path: "/devices", visitors: 23 },
    { path: "/international", visitors: 19 },
    { path: "/sign-in", visitors: 8 },
    { path: "/sign-up", visitors: 7 },
  ],
  /**
   * Referrers by visitors. l.instagram.com is Instagram's link shim, which is
   * what a bio-link tap looks like server-side. It being the top referrer is
   * flatly incompatible with Meta Insights reporting 0 link clicks for the
   * same period, and the server-side number is the one to trust.
   * vercel.com is almost certainly our own dashboard clicks, not real demand.
   */
  referrers: [
    { host: "l.instagram.com", visitors: 80 },
    { host: "facebook.com", visitors: 15 },
    { host: "vercel.com", visitors: 10, selfTraffic: true },
    { host: "m.facebook.com", visitors: 9 },
    { host: "herballeafmarket.com", visitors: 5 },
    { host: "google.com", visitors: 3 },
    { host: "instagram.com", visitors: 3 },
  ],
  /** Custom events: visitors who fired it at least once, and total fires. */
  events: [
    { name: "page_view", visitors: 102, total: 556 },
    { name: "store_logo_filter", visitors: 8, total: 19 },
    { name: "outbound_click", visitors: 7, total: 41 },
    { name: "add_to_cart", visitors: 4, total: 10 },
    { name: "filter_used", visitors: 4, total: 8 },
  ],
  mobilePct: 63,
  topCountryPct: 82,
}

/**
 * Instagram, week by week. Reach is deduplicated by Meta so daily values do
 * not sum to the period figure; views and follows are the reliable series.
 *
 * linkClicks is recorded as reported and is believed WRONG: Meta reported zero
 * for all three weeks while Vercel logged 80 visitors from l.instagram.com in
 * the overlapping window. Kept because a metric that is provably broken is
 * itself worth writing down, so nobody re-derives a strategy from it.
 */
export const SOCIAL_SOURCE: Measurement = {
  source: "Meta Business Suite, Instagram (Facebook produced 0 views and 0 reach throughout)",
  window: "19 Jul 2026 to 8 Aug 2026 (three consecutive weeks)",
}

export const SOCIAL_WEEKS = [
  { week: "19 to 25 Jul", views: 98, reach: 21, interactions: 11, linkClicks: 0, profileVisits: 157, follows: 53 },
  { week: "26 Jul to 1 Aug", views: 148, reach: 32, interactions: 22, linkClicks: 0, profileVisits: 61, follows: 45 },
  { week: "2 to 8 Aug", views: 806, reach: 92, interactions: 139, linkClicks: 0, profileVisits: 150, follows: 234 },
]

/**
 * Share of affiliate outbound clicks that end in a purchase.
 *
 * Started as a placeholder at the middle of the usual 1-to-5-percent band. It is
 * now corroborated: Awin's own advertiser directory reports a conversion rate
 * per programme, and across the 227 advertisers reporting one the median is
 * 2.85 percent. So 3 percent was close to right for a general mix.
 *
 * It is NOT right for music. See AWIN_SECTOR_EVIDENCE below: Music & DVD runs a
 * median of 1.82 percent, so anything scoped to Gear Avail should use that and
 * will land roughly 40 percent below what this constant produces. Left at 3 here
 * because every figure derived from it in this file describes Legal Leaf, whose
 * own sector rate is not in that directory.
 */
export const ASSUMED_MERCHANT_CONVERSION_PCT = 3

/**
 * Observed performance from Awin's advertiser directory, 255 programmes across
 * many sectors (checked 10 Aug 2026). Real reported figures, not assumptions.
 *
 * The EPC line is the sharpest independent check on the whole model. Awin
 * reports earnings per CLICK, which maps onto an outbound click here. At the
 * measured 2.1 percent outbound-click rate, a $0.17 median EPC implies about
 * $0.0036 of revenue per session, against the $0.11 per session Legal Leaf's
 * model assumes. That is a third route to the same conclusion the funnel and
 * cost analyses reach, and it is the least flattering of the three.
 *
 * Carried with a caveat rather than plugged in: these are mostly EU retail
 * programmes paying 0 to 7 percent, while Legal Leaf's merchants pay 10 to 15,
 * so EPC does not transfer directly across sites. It transfers to Gear Avail,
 * which is the music site.
 */
export const AWIN_SECTOR_EVIDENCE = {
  source: "Awin advertiser directory, two exports combined, 11,272 unique advertisers",
  checkedOn: "10 Aug 2026",
  allSectors: { advertisersReporting: 227, medianConversionPct: 2.85, medianEpcUsd: 0.17 },
  /** Combined exports: 187 music advertisers, 78 of them publishing a product feed. */
  musicAdvertisersCombined: { total: 187, withProductFeed: 78 },
  musicAndDvd: {
    advertisers: 26,
    withProductFeed: 19,
    medianConversionPct: 1.82,
    p25ConversionPct: 1.11,
    p75ConversionPct: 3.68,
    medianEpcUsd: 0.17,
  },
  /** Music programmes with a live product feed, worth evaluating for ingestion. */
  notableMusicFeeds: [
    { programme: "Gear 4 Music", awinId: 1117, commissionPct: "3.5-5", cookieDays: 30, conversionPct: 1.546, approvalPct: 92.63, note: "Already named in CLAUDE.md as a target. Feed confirmed to exist" },
    { programme: "Yamaha (US)", awinId: 52029, commissionPct: "0-0", cookieDays: 30, conversionPct: 0.059, approvalPct: 100, note: "Major brand, 100% approval, but a 0.06% conversion rate and $0.01 EPC" },
    { programme: "Orangewood", awinId: 91431, commissionPct: "0-0", cookieDays: 30, conversionPct: 0.874, approvalPct: 8.04, note: "Guitars, healthy EPC, but rejects 92% of publisher applications" },
    { programme: "Zager Guitars", awinId: 97579, commissionPct: "0-0", cookieDays: 45, conversionPct: null, approvalPct: 0, note: "Longest cookie in the sector at 45 days. Launched Aug 2025, no performance history yet" },
  ],
  /**
   * THE ONE THAT MATTERED. Reverb was absent from the first 255-row page and
   * present in the full 11,038-row export, which is exactly why the negative was
   * not concluded from page one: Awin advertiser 67144, "Reverb (US)",
   * feedEnabled=yes, productReporting=yes, 30-day cookie, 100% approval rate,
   * live since Nov 2023, payment status green, EPC $0.24, conversion 1.06%.
   *
   * CLAUDE.md gated Reverb on a datafeed existing "if and only if Reverb
   * publishes one to publishers". It does. That unlocks the largest used and
   * vintage catalogue in the category through the one channel section 2 permits.
   * The API remains off limits and this changes nothing about that.
   *
   * Commission is not published in the directory (min and max are both 0), so
   * the rate stays unknown rather than guessed.
   */
  reverbConfirmed: { awinId: 67144, cookieDays: 30, approvalPct: 100, epcUsd: 0.24, conversionPct: 1.06, feedEnabled: true },
  /** Searched across all 11,272 combined advertisers and genuinely absent. */
  notOnAwin: ["Anderton's", "zZounds", "Thomann", "Full Compass", "Pineville Music", "Guitar Center"],
} as const

export type FunnelCalibration = {
  visitors: number
  outboundClickers: number
  outboundClicks: number
  /** Share of visitors who reached any merchant at all. */
  outboundClickRatePct: number
  /** Orders if each merchant visit is its own chance to buy. */
  ordersPerClickBasis: number
  /** Orders if a person who clicks buys at most once. The conservative read. */
  ordersPerPersonBasis: number
}

export function funnelCalibration(): FunnelCalibration {
  const visitors = WEB_MEASURED.visitors
  const ev = WEB_MEASURED.events.find((e) => e.name === "outbound_click")!
  const conv = ASSUMED_MERCHANT_CONVERSION_PCT / 100
  return {
    visitors,
    outboundClickers: ev.visitors,
    outboundClicks: ev.total,
    outboundClickRatePct: (ev.visitors / visitors) * 100,
    ordersPerClickBasis: ev.total * conv,
    ordersPerPersonBasis: ev.visitors * conv,
  }
}

/**
 * How optimistic a site's conversion assumption looks against the one real
 * funnel we can see. Returns the range, because the two order bases above
 * differ by roughly six times and picking one would overstate the precision.
 */
export function optimismRange(conversionPct: number): { low: number; high: number } {
  const c = funnelCalibration()
  const assumedOrders = (c.visitors * conversionPct) / 100
  return {
    low: assumedOrders / c.ordersPerClickBasis,
    high: assumedOrders / c.ordersPerPersonBasis,
  }
}

/**
 * What entering a real month does to the projection, measured by running the
 * engine rather than reasoned about. Recorded here because the result is
 * counter-intuitive enough to be worth pinning down in writing.
 *
 * Legal Leaf's base case models month 1 at 607 sessions and $66.63. Measured:
 * 338 visitors and no confirmed commission.
 *
 * The perverse row is the first one. `applyActuals` guards yieldIndex behind
 * `actualRps > 0`, so a month that genuinely earned nothing is treated as
 * carrying no information about yield, the planned $0.11 per session survives
 * untouched, and the ten-year total lands ABOVE what a single real order would
 * produce. Entering the truth forecasts more than entering a sale.
 *
 * That guard is defensible rather than a bug: this engine's own notes record
 * that affiliate programmes hold 30 to 60 days against refunds and require $50
 * to $100 minimums, so $0 booked in month 1 is the expected state even when
 * real sales happened. The model simply cannot tell "nobody bought" from
 * "nobody has paid us yet".
 *
 * Which is the argument for recording outbound clicks as a first-class actual.
 * A click is observable the day it happens and does not wait on a payout
 * cycle, so it is the only early yield signal available.
 */
export const REANCHOR_TEST = {
  modelledMonth1: { label: "Aug 26", sessions: 607, revPerSession: 0.1098, revenue: 66.63 },
  measuredMonth1: { visitors: 338, confirmedRevenue: 0 },
  /** Each row: month-1 revenue entered, with sessions held at the measured 338. */
  rows: [
    { entered: 0, label: "what was actually earned", total24: 22023, total120: 295183, trafficIndex: 0.557, yieldIndex: 1.0 },
    { entered: 8.55, label: "exactly one order", total24: 5084, total120: 68032, trafficIndex: 0.557, yieldIndex: 0.23 },
    { entered: 21.4, label: "two and a half orders", total24: 12724, total120: 170279, trafficIndex: 0.557, yieldIndex: 0.577 },
    { entered: 66.63, label: "the model's own prediction", total24: 39618, total120: 530173, trafficIndex: 0.557, yieldIndex: 1.796 },
  ],
  baseline: { total24: 39618, total120: 530173 },
} as const


/* ============================================================
   TIME: two timesheets, a forward budget, and what it buys.
   ------------------------------------------------------------
   Deliberately kept simple. Hours by person, by week, by category.
   No rates on the timesheet, no task-level breakdown, nothing that
   needs maintaining to stay honest.

   It is here rather than in a spreadsheet because the projections
   above quietly assume this effort continues, and a plan whose only
   real input is unpriced founder time should say so on the page.
   ============================================================ */

export type TimeCategory = "rd" | "admin" | "sales"

export const TIME_CATEGORY_LABEL: Record<TimeCategory, string> = {
  rd: "Development",
  admin: "Admin",
  sales: "Sales",
}

/**
 * One row per person per category per period. Categories stay separated
 * because they are not the same kind of hour: building ingestion is
 * development, chasing a GoAffPro approval is sales, reconciling a payout is
 * admin. Anyone tracking R&D needs the first isolated from the other two, and
 * a single blended total loses that distinction for good.
 */
export type TimesheetRow = {
  person: string
  period: string
  category: TimeCategory
  hoursPerWeek: number
  weeks: number
}

export const TIMESHEET: TimesheetRow[] = [
  { person: "Jake", period: "3 weeks to 10 Aug 2026", category: "rd", hoursPerWeek: 50, weeks: 3 },
  { person: "Jake", period: "3 weeks to 10 Aug 2026", category: "sales", hoursPerWeek: 5, weeks: 3 },
  { person: "Jake", period: "3 weeks to 10 Aug 2026", category: "admin", hoursPerWeek: 0, weeks: 3 },
  { person: "Brayton", period: "3 weeks to 10 Aug 2026", category: "rd", hoursPerWeek: 2, weeks: 3 },
]

/**
 * Not on the timesheet and not recoverable: all five sites were mocked up in
 * Google Apps Script before any of these repos existed, with the tooling
 * walking from Gemini to Copilot with Opus to Claude Code. Logged as prose
 * rather than as hours, because a guessed number would be worse than none.
 */
export const UNLOGGED_PRIOR_WORK =
  "Apps Script mock-ups of all five storefronts, pre-dating version control. Real hours, deliberately not estimated."

export const WEEKS_LOGGED = 3

export function hoursFor(filter: { person?: string; category?: TimeCategory } = {}): number {
  return TIMESHEET.filter(
    (r) =>
      (filter.person === undefined || r.person === filter.person) &&
      (filter.category === undefined || r.category === filter.category),
  ).reduce((sum, r) => sum + r.hoursPerWeek * r.weeks, 0)
}

export function people(): string[] {
  return Array.from(new Set(TIMESHEET.map((r) => r.person)))
}

/** Hours a week the team is actually putting in, derived from the timesheet. */
export function hoursPerWeekTotal(): number {
  return hoursFor() / WEEKS_LOGGED
}

/**
 * Notional hourly rate, used only to put a figure on time contributed.
 *
 * Nobody draws money from this business: nothing has been taken out and
 * everything earned is reinvested, so the hours on the timesheet are sweat
 * equity rather than an unpaid wage bill. This rate values that contribution at
 * a modest contract development rate. It is not a salary, not a debt the
 * business owes anyone, and nothing in the revenue model reads it. Not
 * accounting or tax advice.
 */
export const NOTIONAL_RATE_USD = 75

/** Development hours only. Admin and sales are tracked but are not R&D. */
export function rdInvestmentUsd(rate = NOTIONAL_RATE_USD): number {
  return hoursFor({ category: "rd" }) * rate
}

/* ------------------------------------------------------------
   THE TIME BUDGET, AND HOW ROBUST IT LETS THINGS GET
   ------------------------------------------------------------ */

/**
 * Hours a week each person has available GOING FORWARD.
 *
 * Deliberately separate from the timesheet, which records the launch sprint.
 * 57 hours a week got five sites live; it is not the ongoing commitment and
 * planning against it would be planning against a number nobody promised.
 * This is the figure the backlog and the break-even below are paced from.
 */
export const AVAILABILITY: Array<{ person: string; hoursPerWeek: number }> = [
  { person: "Jake", hoursPerWeek: 25 },
  { person: "Brayton", hoursPerWeek: 5 },
]

export function availableHoursPerWeek(): number {
  return AVAILABILITY.reduce((sum, a) => sum + a.hoursPerWeek, 0)
}

/**
 * The backlog that stands between today's funnel and a working one, priced in
 * hours. These are estimates, and they are the honest kind: each is a task
 * already identified elsewhere in this admin or in CLAUDE.md, not invented to
 * fill a table.
 *
 * `unlocks` says what the work actually buys, because hours spent on something
 * that does not move the funnel are indistinguishable from hours not spent.
 */
export type BacklogItem = {
  task: string
  hours: number
  unlocks: string
  category: TimeCategory
}

export const BACKLOG: BacklogItem[] = [
  {
    task: "Get visitors off the homepage into categories and merchants",
    hours: 40,
    unlocks:
      "The 2.1% outbound-click rate. Worth about 10x on revenue at flat traffic, and 92% of visitors currently never leave /.",
    category: "rd",
  },
  {
    task: "Confirm the referral codes that are set but unverified",
    hours: 20,
    unlocks:
      "Attribution capture, currently assumed at 60%, meaning four orders in ten go uncredited. Includes the eight KawaiiKatz GoAffPro codes and Gear Avail's unconfirmed stores.",
    category: "sales",
  },
  {
    task: "Land the gated feeds already applied for",
    hours: 30,
    unlocks:
      "eBay production access, Reverb, Gear4music, the CJ trio, Anderton's via Impact. Catalogue depth, and the largest addressable used-gear inventory there is.",
    category: "sales",
  },
  {
    task: "Record outbound clicks as a first-class actual",
    hours: 12,
    unlocks:
      "An early yield signal that does not wait 30 to 60 days on a payout cycle, which is the gap the re-anchor test above exposes.",
    category: "rd",
  },
  {
    task: "SEO depth on the category and gear pages",
    hours: 60,
    unlocks:
      "Organic traffic, the only channel that compounds without ongoing hours. Google referred 3 visitors last month.",
    category: "rd",
  },
]

export type BudgetOutlook = {
  hoursPerWeek: number
  backlogHours: number
  weeksToClear: number
  /** Share of the week left over once the backlog is cleared at this rate. */
  sustainable: boolean
}

/**
 * How long the backlog takes at a given weekly budget.
 *
 * The `sustainable` flag is the point of this function rather than an
 * afterthought. The launch sprint ran at 57 hours a week between two people,
 * which is not a rate anyone holds for ten years, and the projections above
 * silently assume the effort continues. Pacing off declared forward
 * availability instead of off the sprint is what makes the plan honest: 30
 * hours a week is a commitment somebody can actually keep.
 */
export function budgetOutlook(hoursPerWeek = availableHoursPerWeek()): BudgetOutlook {
  const backlogHours = BACKLOG.reduce((sum, b) => sum + b.hours, 0)
  return {
    hoursPerWeek,
    backlogHours,
    weeksToClear: hoursPerWeek > 0 ? backlogHours / hoursPerWeek : Infinity,
    sustainable: hoursPerWeek <= 40,
  }
}

/* ------------------------------------------------------------
   WHAT IT TAKES TO PAY THE TEAM
   ------------------------------------------------------------ */

/**
 * Payout the business actually receives per order, at a site's own basket,
 * commission and attribution. Attribution is the term nobody expects: at 60%
 * capture, four orders in ten are never credited.
 */
export function payoutPerOrder(basket: number, commissionPct: number, attributionPct: number): number {
  return basket * (commissionPct / 100) * (attributionPct / 100)
}

export type Breakeven = {
  targetHourlyUsd: number
  monthlyRevenueNeeded: number
  ordersNeeded: number
  visitorsNeededAtCurrentFunnel: number
  visitorsNeededAtFixedFunnel: number
}

/**
 * What it takes to pay everyone on the timesheet a given hourly rate.
 *
 * "Current funnel" uses the measured 2.1% outbound-click rate. "Fixed funnel"
 * assumes 20%, which is the single biggest lever available and costs no extra
 * traffic.
 */
export function breakeven(
  targetHourlyUsd: number,
  payoutPerOrderUsd: number,
  fixedOutboundClickRatePct = 20,
): Breakeven {
  const monthlyHours = availableHoursPerWeek() * 4.333
  const monthlyRevenueNeeded = targetHourlyUsd * monthlyHours
  const ordersNeeded = monthlyRevenueNeeded / payoutPerOrderUsd
  const conv = ASSUMED_MERCHANT_CONVERSION_PCT / 100
  const current = funnelCalibration().outboundClickRatePct / 100
  return {
    targetHourlyUsd,
    monthlyRevenueNeeded,
    ordersNeeded,
    visitorsNeededAtCurrentFunnel: ordersNeeded / (current * conv),
    visitorsNeededAtFixedFunnel: ordersNeeded / ((fixedOutboundClickRatePct / 100) * conv),
  }
}

/* ------------------------------------------------------------
   THE DRAW PLAN
   ------------------------------------------------------------ */

/**
 * First year anybody takes money out of profit. Until then every dollar is
 * reinvested and the hours are sweat equity.
 *
 * Stating it matters because it changes what the break-even ladder above is
 * for. It is not a shortfall being funded now, it is a target for year 3.
 */
export const FIRST_DRAW_YEAR = 3

/**
 * Family revenue in year 3 as the model projects it, and the same figures
 * discounted by the optimism range the measured funnel implies.
 *
 * Both columns are shown deliberately. The raw projection is what the
 * assumptions produce; the discounted band is what one real month of funnel
 * data suggests those assumptions are worth. Publishing only the first would
 * be the mistake this whole panel exists to prevent.
 */
export const YEAR_3_PROJECTION = {
  hoursPerMonth: 130,
  cases: [
    { scenario: "Bear", annual: 29868, monthly: 2489, hourly: 19.15 },
    { scenario: "Base", annual: 149271, monthly: 12439, hourly: 95.69 },
    { scenario: "Bull", annual: 384193, monthly: 32016, hourly: 246.3 },
  ],
} as const

/** Apply the measured funnel's optimism range to a projected figure. */
export function discountedByFunnel(value: number, conversionPct: number): { low: number; high: number } {
  const r = optimismRange(conversionPct)
  return { low: value / r.high, high: value / r.low }
}

/**
 * GOING FULL TIME. Read as an option, not a necessity.
 *
 * This is explicitly a long play and nobody's income depends on it. The
 * operator has a tech career funding the runway; the current employer may sell
 * in roughly two years, which is a job change in a field where pivoting is
 * straightforward, not a cliff. Capacity is expected to open up around then.
 *
 * That framing matters for how every number in this admin should be read. It is
 * not a survival plan and the hourly figures are not a threshold anyone has to
 * clear to keep the lights on. They are a yardstick for when the business has
 * grown enough to be worth taking money out of, which is a different and much
 * less urgent question.
 *
 * The one piece of real arithmetic: going full time LOWERS the hourly rate at
 * any given revenue, because the same money spreads over more hours. More time
 * is only worth spending on work that compounds.
 */
export const FULL_TIME = {
  targetYear: FIRST_DRAW_YEAR,
  hoursPerWeek: 40,
  note:
    "Optional, not forced. A tech career funds the runway, the current employer may sell in about two years, and pivoting to another role in that field is straightforward. Capacity is expected to open up rather than income to disappear.",
}

export function fullTimeHoursPerMonth(): number {
  return FULL_TIME.hoursPerWeek * 4.333
}

/** Hourly rate a given monthly revenue supports at full-time hours. */
export function fullTimeHourly(monthlyRevenue: number): number {
  return monthlyRevenue / fullTimeHoursPerMonth()
}

/* ------------------------------------------------------------
   COSTS. The side of the ledger the model does not have.
   ------------------------------------------------------------ */

/**
 * Real all-in monthly run-rate, stated by the operator on 10 Aug 2026:
 * hosting across five Vercel projects, five domains, database, email, and AI
 * tooling including Claude. Grown over time and treated as necessary spend
 * rather than discretionary.
 *
 * This figure supersedes two others in this codebase, and BOTH were wrong:
 *
 *   reference-data.ts METHOD_FOOTNOTE  "well under $100/month"   ~$1,200/yr
 *   decade.ts costFloor                 $12,000/yr floor
 *   actual                              $250/month              = $3,000/yr
 *
 * The footnote understates by two and a half times, mostly because it lists
 * Vercel, Neon and Resend and omits AI tooling entirely, which is now the
 * largest line. The decade.ts floor overstates by four times. Neither was
 * checked against a bank statement, which is the whole reason this constant
 * exists.
 *
 * Note also what `engine.ts` does with costs: nothing. It has no cost field and
 * emits revenue only, so every headline figure on both dashboards is GROSS.
 */
export const MONTHLY_COSTS_USD = 250

export function annualCostsUsd(): number {
  return MONTHLY_COSTS_USD * 12
}

export type Pnl = {
  revenue: number
  costs: number
  /** Revenue less costs. No salary is drawn before FIRST_DRAW_YEAR. */
  net: number
  costsAsPctOfRevenue: number
  /** Net per hour at the declared forward availability. */
  netPerHour: number
}

/** A year's P&L at the real cost run-rate. */
export function pnl(annualRevenue: number): Pnl {
  const costs = annualCostsUsd()
  const net = annualRevenue - costs
  return {
    revenue: annualRevenue,
    costs,
    net,
    costsAsPctOfRevenue: annualRevenue > 0 ? (costs / annualRevenue) * 100 : Infinity,
    netPerHour: net / (availableHoursPerWeek() * 4.333 * 12),
  }
}
