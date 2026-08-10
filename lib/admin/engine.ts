/**
 * The operating-model math. Ported from the same engine used on
 * legal-leafmarket.com's admin page (that site's own version runs four site
 * profiles through the identical `runModel`; Gear Avail's own page has
 * always called it with a single-element array). `lib/admin/all-sites.ts`
 * is what actually combines Gear Avail with the sister sites' own reference
 * data into one five-site view, using this same engine, unmodified.
 *
 * `runModel`'s optional `displayMonths` argument (default 24, the anchor
 * horizon) lets a caller ask for more months of the same fitted curve — a
 * decade view, for instance — without changing what the model is fit to.
 * See the doc comment on `makeRamp` for why that requires clamping the
 * conversion/attribution ramps rather than just running the loop longer.
 *
 * ── How the projection is built ─────────────────────────────────────────
 * 1. Traffic follows an S-curve in log space, fitted so it passes through
 *    the month-1, month-12 and month-24 session anchors exactly:
 *      ln sessions(t) = A + B · sigmoid(k · (t − t0))
 *    `k` (steepness) is a per-site constant; A, B and t0 are solved from the
 *    anchors by scanning for a sign change and bisecting. If no root exists
 *    for a pathological set of anchors, this falls back to piecewise-
 *    geometric interpolation so the page never renders NaN.
 * 2. A fixed monthly seasonality multiplier applies on top. The anchors
 *    describe the deseasonalised trend, so a month's sessions can sit
 *    slightly above or below its anchor.
 * 3. Conversion matures from 80% to 125% of the stated rate over the
 *    horizon; attribution capture ramps from today's rate to its month-24
 *    target. Both are normalised Weibull CDFs, reaching their end state
 *    exactly at month 24.
 * 4. revenue = sessions × conversion × basket × commission × attribution.
 *    GMV and orders are derived from revenue so that revenue/GMV always
 *    equals commission × attribution and GMV/orders always equals the
 *    basket — true for modelled and actuals-overridden months alike.
 *
 * Actuals entered for a closed month re-anchor everything after it — see
 * applyActuals().
 */

export const HORIZON_MONTHS = 24
/** Month 1 of the projection. `month` is 0-indexed, so 7 = August. */
export const MODEL_START = { year: 2026, month: 7 }

const CONVERSION_FLOOR = 0.8
const CONVERSION_CEILING = 1.25
const CONVERSION_RAMP = { scale: 11.1445, shape: 1.1606 }
const ATTRIBUTION_RAMP = { scale: 9.5411, shape: 1.2217 }

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/**
 * Normalised Weibull CDF: p(1..24) rising to exactly 1 at the horizon.
 *
 * Clamped at 1 for t > 24 rather than left to keep climbing. f(t)/f(24) is
 * a ratio against the value AT month 24, not a value that saturates at 1 on
 * its own; f itself keeps rising past t=24 (a Weibull CDF's true ceiling is
 * f(∞)=1, reached only in the limit), so beyond the 24-month anchor horizon
 * the raw ratio exceeds 1 and "125% of stated conversion" would silently
 * become 130%, then 140%, the further out a projection runs. Every month
 * beyond 24 is fully matured by construction (that's what the 24-month
 * horizon means), so clamping is the correct model of that, not a patch.
 */
function makeRamp(ramp: { scale: number; shape: number }) {
  const f = (t: number) => 1 - Math.exp(-Math.pow(t / ramp.scale, ramp.shape))
  const full = f(HORIZON_MONTHS)
  return (t: number) => Math.min(1, f(t) / full)
}
const conversionProgress = makeRamp(CONVERSION_RAMP)
const attributionProgress = makeRamp(ATTRIBUTION_RAMP)

/**
 * Fit ln(sessions) = A + B·sigmoid(k(t − t0)) through the three anchors.
 * Only t0 needs solving — A and B follow from it. Falls back to
 * piecewise-geometric interpolation if no root exists.
 */
function fitTrafficCurve(
  month1: number,
  month12: number,
  month24: number,
  steepness: number,
): (t: number) => number {
  const s1 = Math.max(month1, 1)
  const s12 = Math.max(month12, 1)
  const s24 = Math.max(month24, 1)

  const a1 = Math.log(s1)
  const a12 = Math.log(s12)
  const a24 = Math.log(s24)
  const span = a24 - a1

  // Past month 24, hold flat at the month-24 anchor rather than continuing
  // the month-12-to-24 slope in log-space indefinitely. The primary sigmoid
  // fit below naturally plateaus past its anchor horizon (that is what a
  // sigmoid does); this piecewise-linear stand-in for it has no such
  // built-in ceiling, and unlike the sigmoid path (only ever evaluated for
  // t in [1, 24] before displayMonths existed), a decade-length run now
  // asks this function for t up to 120. Left extrapolating, a mundane
  // non-monotonic anchor set (a modelled dip at month 12, say) compounds
  // that slope for 96 more months into session counts in the tens of
  // quintillions — silent, non-crashing, and meaningless.
  const geometricFallback = () => (t: number) => {
    if (t <= 1) return s1
    if (t <= 12) return Math.exp(a1 + ((a12 - a1) * (t - 1)) / 11)
    if (t <= 24) return Math.exp(a12 + ((a24 - a12) * (t - 12)) / 12)
    return s24
  }

  if (!Number.isFinite(span) || Math.abs(span) < 1e-9) return geometricFallback()

  const target = (a12 - a1) / span
  const residual = (t0: number) => {
    const u = sigmoid(steepness * (1 - t0))
    const v = sigmoid(steepness * (12 - t0))
    const w = sigmoid(steepness * (24 - t0))
    const denom = w - u
    if (Math.abs(denom) < 1e-15) return NaN
    return (v - u) / denom - target
  }

  // Scan for a sign change, then bisect. Robust to anchor sets that push the
  // root far outside the horizon.
  let lo: number | null = null
  let hi = 0
  let prevT: number | null = null
  let prevV: number | null = null
  for (let t = -400; t <= 400; t += 0.5) {
    const v = residual(t)
    if (!Number.isFinite(v)) {
      prevT = null
      prevV = null
      continue
    }
    if (prevV !== null && prevT !== null && prevV * v <= 0) {
      lo = prevT
      hi = t
      break
    }
    prevT = t
    prevV = v
  }
  if (lo === null) return geometricFallback()

  let low = lo
  let high = hi
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2
    const vm = residual(mid)
    if (!Number.isFinite(vm)) return geometricFallback()
    const vl = residual(low)
    if (!Number.isFinite(vl)) return geometricFallback()
    if (vl * vm <= 0) high = mid
    else low = mid
  }

  const t0 = (low + high) / 2
  const u = sigmoid(steepness * (1 - t0))
  const w = sigmoid(steepness * (24 - t0))
  const B = span / (w - u)
  const A = a1 - B * u
  if (!Number.isFinite(A) || !Number.isFinite(B)) return geometricFallback()

  return (t: number) => Math.exp(A + B * sigmoid(steepness * (t - t0)))
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function calendarMonth(t: number): number {
  return (MODEL_START.month + (t - 1)) % 12
}

function monthLabel(t: number): string {
  const absolute = MODEL_START.month + (t - 1)
  const year = MODEL_START.year + Math.floor(absolute / 12)
  return `${MONTH_NAMES[absolute % 12]} ${String(year % 100).padStart(2, "0")}`
}

export const MONTH_LABELS = Array.from({ length: HORIZON_MONTHS }, (_, i) => monthLabel(i + 1))

/** Same label generator, for a horizon other than the default 24 months. */
export function buildMonthLabels(months: number): string[] {
  return Array.from({ length: months }, (_, i) => monthLabel(i + 1))
}

export type Assumptions = {
  sessionsMonth1: number
  sessionsMonth12: number
  sessionsMonth24: number
  basket: number
  commissionPct: number
  conversionPct: number
  attributionNowPct: number
  attributionExitPct: number
}

export type Scenario = {
  key: string
  label: string
  headline: string
  detail: string
  sessions12: number
  sessions24: number
  conversion: number
  freezeAttribution: boolean
}

export type SiteProfile = {
  key: string
  name: string
  shortName: string
  domain: string
  tagline: string
  color: string
  /** Monthly multiplier, Jan=0..Dec=11. */
  seasonality: number[]
  curveSteepness: number
  indexablePages: number
  assumptions: Assumptions
}

function applyScenario(base: Assumptions, scenario: Scenario): Assumptions {
  return {
    ...base,
    sessionsMonth12: base.sessionsMonth12 * scenario.sessions12,
    sessionsMonth24: base.sessionsMonth24 * scenario.sessions24,
    conversionPct: base.conversionPct * scenario.conversion,
    attributionExitPct: scenario.freezeAttribution ? base.attributionNowPct : base.attributionExitPct,
  }
}

/** Revenue per session once conversion and attribution have fully matured. */
function maturityRevPerSession(a: Assumptions): number {
  return (
    a.basket *
    (a.commissionPct / 100) *
    ((a.conversionPct / 100) * CONVERSION_CEILING) *
    (a.attributionExitPct / 100)
  )
}

function attributionAt(a: Assumptions, t: number): number {
  const now = a.attributionNowPct / 100
  const exit = a.attributionExitPct / 100
  return now + (exit - now) * attributionProgress(t)
}

function conversionAt(a: Assumptions, t: number): number {
  const maturity = CONVERSION_FLOOR + (CONVERSION_CEILING - CONVERSION_FLOOR) * conversionProgress(t)
  return (a.conversionPct / 100) * maturity
}

type RawRow = { sessions: number; revenue: number; revPerSession: number; attribution: number }

function projectSite(profile: SiteProfile, effective: Assumptions, months: number): RawRow[] {
  const curve = fitTrafficCurve(
    effective.sessionsMonth1,
    effective.sessionsMonth12,
    effective.sessionsMonth24,
    profile.curveSteepness,
  )
  const commission = effective.commissionPct / 100

  const rows: RawRow[] = []
  for (let i = 0; i < months; i += 1) {
    const t = i + 1
    const seasonal = profile.seasonality[calendarMonth(t)] ?? 1
    const sessions = Math.max(0, Math.round(curve(t) * seasonal))
    const conversion = conversionAt(effective, t)
    const attribution = attributionAt(effective, t)
    const revenue = sessions * conversion * effective.basket * commission * attribution
    rows.push({ sessions, revenue, revPerSession: sessions > 0 ? revenue / sessions : 0, attribution })
  }
  return rows
}

export type ActualEntry = { sessions?: number; revenue?: number }
export type ActualsForSite = Partial<Record<number, ActualEntry>>

/**
 * Re-anchor the projection on months that have closed.
 *
 * A month counts as closed only when BOTH real sessions and real earned
 * commission are present — revenue alone can't tell you whether you missed
 * on traffic or on yield. Once closed months exist:
 *   - forward traffic is scaled by how actual sessions are tracking vs plan
 *   - forward revenue per session is re-based on realised yield, while
 *     keeping the modelled improvement curve intact
 * Both indices are pooled totals rather than a per-month average, so one
 * freak month doesn't dominate.
 */
function applyActuals(
  raw: RawRow[],
  actuals: ActualsForSite | undefined,
): { rows: RawRow[]; closedMonths: number[] } {
  const closed: number[] = []
  if (actuals) {
    for (let t = 1; t <= raw.length; t += 1) {
      const entry = actuals[t]
      const s = entry?.sessions
      const r = entry?.revenue
      if (typeof s === "number" && s > 0 && typeof r === "number" && r >= 0) closed.push(t)
    }
  }
  if (closed.length === 0) return { rows: raw, closedMonths: [] }

  let actualSessions = 0
  let modelSessions = 0
  let actualRevenue = 0
  let modelRevenue = 0
  for (const t of closed) {
    const entry = actuals![t]!
    actualSessions += entry.sessions!
    actualRevenue += entry.revenue!
    modelSessions += raw[t - 1].sessions
    modelRevenue += raw[t - 1].revenue
  }

  const trafficIndex = modelSessions > 0 ? actualSessions / modelSessions : 1
  const actualRps = actualSessions > 0 ? actualRevenue / actualSessions : 0
  const modelRps = modelSessions > 0 ? modelRevenue / modelSessions : 0
  const yieldIndex = modelRps > 0 && actualRps > 0 ? actualRps / modelRps : 1

  const lastClosed = closed[closed.length - 1]
  const rows = raw.map((row, i) => {
    const t = i + 1
    const entry = actuals![t]
    const isClosed = closed.includes(t)
    if (isClosed) {
      const sessions = entry!.sessions!
      const revenue = entry!.revenue!
      return { ...row, sessions, revenue, revPerSession: sessions > 0 ? revenue / sessions : 0 }
    }
    if (t <= lastClosed) return row
    const sessions = Math.round(row.sessions * trafficIndex)
    const revPerSession = row.revPerSession * yieldIndex
    return { ...row, sessions, revPerSession, revenue: sessions * revPerSession }
  })

  return { rows, closedMonths: closed }
}

export type MonthRow = {
  index: number
  label: string
  sessions: number
  revPerSession: number
  orders: number
  gmv: number
  revenue: number
  actualSessions: number | null
  actualRevenue: number | null
  plannedRevenue: number
  plannedSessions: number
  revenueVariancePct: number | null
  sessionsVariancePct: number | null
  isActual: boolean
  isReanchored: boolean
}

export type QuarterRow = {
  index: number
  label: string
  monthsLabel: string
  sessions: number
  orders: number
  gmv: number
  revenue: number
  revPerSession: number
  changeVsPriorPct: number | null
}

function buildQuarters(months: MonthRow[]): QuarterRow[] {
  const quarters: QuarterRow[] = []
  for (let q = 0; q < Math.floor(months.length / 3); q += 1) {
    const slice = months.slice(q * 3, q * 3 + 3)
    const sessions = slice.reduce((s, m) => s + m.sessions, 0)
    const orders = slice.reduce((s, m) => s + m.orders, 0)
    const gmv = slice.reduce((s, m) => s + m.gmv, 0)
    const revenue = slice.reduce((s, m) => s + m.revenue, 0)
    const prior = quarters[q - 1]
    quarters.push({
      index: q + 1,
      label: `Q${q + 1}`,
      monthsLabel: `${slice[0].label} – ${slice[slice.length - 1].label}`,
      sessions,
      orders,
      gmv,
      revenue,
      revPerSession: sessions > 0 ? revenue / sessions : 0,
      changeVsPriorPct: prior && prior.revenue > 0 ? ((revenue - prior.revenue) / prior.revenue) * 100 : null,
    })
  }
  return quarters
}

export type SiteResult = {
  key: string
  profile: SiteProfile
  months: MonthRow[]
  quarters: QuarterRow[]
  /** Scoped to the first 24 months specifically, even on a longer run. */
  year1Revenue: number
  year2Revenue: number
  /** Full requested horizon, not just year1 + year2. */
  totalRevenue: number
  totalSessions: number
  totalOrders: number
  totalGmv: number
  /** The LAST month of whatever horizon was requested, not literally month 24 on an extended run. */
  finalMonthRevenue: number
  finalMonthSessions: number
  exitRunRate: number
  maturityRevPerSession: number
  effective: Assumptions
  closedMonths: number[]
}

export type ModelResult = {
  sites: Record<string, SiteResult>
  order: string[]
  totals: {
    year1Revenue: number
    year2Revenue: number
    totalRevenue: number
    finalMonthRevenue: number
    finalMonthSessions: number
    exitRunRate: number
    blendedRevPerSession: number
    totalSessions: number
    indexablePages: number
  }
  monthLabels: string[]
}

export function runModel(
  profiles: SiteProfile[],
  overrides: Partial<Record<string, Partial<Assumptions>>> | undefined,
  scenario: Scenario,
  actuals: Partial<Record<string, ActualsForSite>> | undefined,
  /**
   * Months of output to generate. Defaults to the 24-month anchor horizon.
   * A longer value (120 for a decade) is a display/summation choice only:
   * the anchors and the ramp curves are still fit and normalised against 24,
   * exactly as the model was designed. The traffic S-curve naturally
   * approaches its own asymptote past month 24 (that is what a sigmoid
   * does); the conversion/attribution ramps are explicitly clamped at their
   * fully-matured value there (see makeRamp) rather than left to overshoot.
   */
  displayMonths: number = HORIZON_MONTHS,
): ModelResult {
  const sites: Record<string, SiteResult> = {}
  const order: string[] = []
  const labels = displayMonths === HORIZON_MONTHS ? MONTH_LABELS : buildMonthLabels(displayMonths)

  for (const profile of profiles) {
    order.push(profile.key)
    const base: Assumptions = { ...profile.assumptions, ...(overrides?.[profile.key] || {}) }
    const effective = applyScenario(base, scenario)

    const raw = projectSite(profile, effective, displayMonths)
    const { rows, closedMonths } = applyActuals(raw, actuals?.[profile.key])

    const commission = effective.commissionPct / 100
    const months: MonthRow[] = rows.map((row, i) => {
      const t = i + 1
      const entry = actuals?.[profile.key]?.[t]
      const hasSessions = typeof entry?.sessions === "number" && entry.sessions > 0
      const hasRevenue = typeof entry?.revenue === "number" && entry.revenue >= 0
      const isActual = hasSessions && hasRevenue

      // GMV and orders are derived so that revenue/GMV always equals
      // commission × attribution and GMV/orders always equals the basket.
      const denominator = commission * row.attribution
      const gmv = denominator > 0 ? row.revenue / denominator : 0
      const orders = effective.basket > 0 ? gmv / effective.basket : 0

      const planned = raw[i]
      return {
        index: t,
        label: labels[i],
        sessions: row.sessions,
        revPerSession: row.revPerSession,
        orders,
        gmv,
        revenue: row.revenue,
        actualSessions: hasSessions ? entry!.sessions! : null,
        actualRevenue: hasRevenue ? entry!.revenue! : null,
        plannedRevenue: planned.revenue,
        plannedSessions: planned.sessions,
        revenueVariancePct:
          isActual && planned.revenue > 0 ? ((entry!.revenue! - planned.revenue) / planned.revenue) * 100 : null,
        sessionsVariancePct:
          isActual && planned.sessions > 0 ? ((entry!.sessions! - planned.sessions) / planned.sessions) * 100 : null,
        isActual,
        isReanchored: !isActual && row.revenue !== planned.revenue,
      }
    })

    // Year 1 / year 2 stay scoped to the first 24 months specifically (the
    // original anchor horizon) even when displayMonths runs longer, since
    // that is what those two figures have always meant on this page.
    // totalRevenue sums the FULL requested horizon, not just year1 + year2 —
    // those would silently drop months 25+ on an extended run otherwise.
    const year1Revenue = months.slice(0, 12).reduce((s, m) => s + m.revenue, 0)
    const year2Revenue = months.slice(12, 24).reduce((s, m) => s + m.revenue, 0)
    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0)
    const last = months[months.length - 1]

    sites[profile.key] = {
      key: profile.key,
      profile,
      months,
      quarters: buildQuarters(months),
      year1Revenue,
      year2Revenue,
      totalRevenue,
      totalSessions: months.reduce((s, m) => s + m.sessions, 0),
      totalOrders: months.reduce((s, m) => s + m.orders, 0),
      totalGmv: months.reduce((s, m) => s + m.gmv, 0),
      finalMonthRevenue: last.revenue,
      finalMonthSessions: last.sessions,
      exitRunRate: last.revenue * 12,
      maturityRevPerSession: maturityRevPerSession(effective),
      effective,
      closedMonths,
    }
  }

  const list = order.map((k) => sites[k])
  const finalMonthRevenue = list.reduce((s, p) => s + p.finalMonthRevenue, 0)
  const finalMonthSessions = list.reduce((s, p) => s + p.finalMonthSessions, 0)

  return {
    sites,
    order,
    totals: {
      year1Revenue: list.reduce((s, p) => s + p.year1Revenue, 0),
      year2Revenue: list.reduce((s, p) => s + p.year2Revenue, 0),
      totalRevenue: list.reduce((s, p) => s + p.totalRevenue, 0),
      finalMonthRevenue,
      finalMonthSessions,
      exitRunRate: finalMonthRevenue * 12,
      blendedRevPerSession: finalMonthSessions > 0 ? finalMonthRevenue / finalMonthSessions : 0,
      totalSessions: list.reduce((s, p) => s + p.totalSessions, 0),
      indexablePages: list.reduce((s, p) => s + p.profile.indexablePages, 0),
    },
    monthLabels: labels,
  }
}

// ── formatting ────────────────────────────────────────────────────────────

export const money = (n: number, digits = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
export const count = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const rps = (n: number) => `$${n.toFixed(3)}`
export const signedPercent = (n: number, digits = 0) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`
