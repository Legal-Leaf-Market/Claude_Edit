/**
 * Operating model for the four-site affiliate family.
 *
 * Everything on the admin page is derived from this file. Nothing is hard-coded
 * downstream: change an assumption and every month, quarter, summary row, chart
 * band and reverse-lookup figure moves with it.
 *
 * ── How the projection is built ────────────────────────────────────────────
 *
 * 1. Traffic follows an S-curve in log space, fitted so it passes through the
 *    three session anchors (month 1, month 12, month 24) exactly:
 *
 *        ln sessions(t) = A + B · sigmoid(k · (t − t0))
 *
 *    `k` (steepness) is a per-site constant; A, B and t0 are solved from the
 *    anchors. The shape is slow while a new domain earns trust, steepest
 *    between roughly months 8–18, decelerating after.
 *
 * 2. A fixed per-category monthly seasonality multiplier is applied on top —
 *    April for hemp, January for nicotine, Q4 for tea and gifting, Black Friday
 *    through December for kawaii merchandise. The anchors describe the
 *    deseasonalised trend, so a month's displayed sessions can sit slightly
 *    above or below its anchor.
 *
 * 3. Conversion matures from 80% to 125% of the stated rate over the horizon,
 *    and attribution capture ramps from "today" to its month-24 target. Both
 *    ramps are normalised Weibull curves — fast early, decelerating, reaching
 *    their end state exactly at month 24. Attribution ramps faster than
 *    conversion because the affiliate wiring is fixed in the first quarter,
 *    while trust and reviews accumulate over the whole two years.
 *
 * 4. Revenue = sessions × conversion × basket × commission × attribution.
 *
 * Actuals entered for a closed month override that month and re-anchor
 * everything after it (see `applyActuals`).
 */

export const HORIZON_MONTHS = 24

/** Month 1 of the projection. `month` is 0-indexed, so 8 = September. */
export const MODEL_START = { year: 2026, month: 8 }

/** Conversion matures from 80% → 125% of the stated rate across the horizon. */
const CONVERSION_FLOOR = 0.8
const CONVERSION_CEILING = 1.25

/** Normalised Weibull maturation curves: p(t) = F(t) / F(24), so p(24) = 1. */
const CONVERSION_RAMP = { scale: 11.1445, shape: 1.1606 }
const ATTRIBUTION_RAMP = { scale: 9.5411, shape: 1.2217 }

export type SiteKey = "legal" | "kawaii" | "herbal" | "nicotia"
export type ScenarioKey = "bear" | "base" | "bull"

/** The eight numbers per site that the admin can edit. */
export type SiteAssumptions = {
  sessionsMonth1: number
  sessionsMonth12: number
  sessionsMonth24: number
  basket: number
  /** Whole percent, e.g. 15 for 15%. */
  commissionPct: number
  /** Whole percent, e.g. 1.5 for 1.50%. */
  conversionPct: number
  attributionNowPct: number
  attributionExitPct: number
}

export type AssumptionKey = keyof SiteAssumptions

export type SiteProfile = {
  key: SiteKey
  name: string
  shortName: string
  domain: string
  tagline: string
  /** Chart + legend colour. Validated for the dark surface; see the admin page. */
  color: string
  /** Multiplier per calendar month, index 0 = January. */
  seasonality: number[]
  /** Steepness of the log-space S-curve. */
  curveSteepness: number
  indexablePages: number
  assumptions: SiteAssumptions
}

export type ScenarioProfile = {
  key: ScenarioKey
  label: string
  headline: string
  detail: string
  sessions12: number
  sessions24: number
  conversion: number
  /** Bear case: the affiliate applications never get filed, so capture never improves. */
  freezeAttribution: boolean
}

/** One month of a single site's projection. */
export type MonthRow = {
  index: number
  label: string
  monthLabel: string
  sessions: number
  revPerSession: number
  orders: number
  gmv: number
  revenue: number
  actualSessions: number | null
  actualRevenue: number | null
  /** Modelled revenue before actuals overrode it — the thing variance is measured against. */
  plannedRevenue: number
  plannedSessions: number
  revenueVariancePct: number | null
  sessionsVariancePct: number | null
  isActual: boolean
  /** True once a closed month earlier in the series has re-anchored this one. */
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

export type SiteProjection = {
  key: SiteKey
  profile: SiteProfile
  months: MonthRow[]
  quarters: QuarterRow[]
  year1Revenue: number
  year2Revenue: number
  totalRevenue: number
  totalSessions: number
  totalOrders: number
  totalGmv: number
  month24Revenue: number
  month24Sessions: number
  exitRunRate: number
  /** Revenue per session once conversion and attribution have fully matured. */
  maturityRevPerSession: number
  /** Effective assumptions after the scenario multipliers are applied. */
  effective: SiteAssumptions
}

export type ModelResult = {
  sites: Record<SiteKey, SiteProjection>
  order: SiteKey[]
  totals: {
    year1Revenue: number
    year2Revenue: number
    totalRevenue: number
    month24Revenue: number
    month24Sessions: number
    exitRunRate: number
    blendedRevPerSession: number
    totalSessions: number
    indexablePages: number
  }
  monthLabels: string[]
}

/** Per-site, per-month actuals keyed by month index (1-based). */
export type ActualsMap = Partial<
  Record<SiteKey, Record<number, { sessions?: number | null; revenue?: number | null }>>
>

// ── curve maths ─────────────────────────────────────────────────────────────

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/** Normalised Weibull CDF: p(1..24) rising to exactly 1 at the horizon. */
function makeRamp({ scale, shape }: { scale: number; shape: number }) {
  const f = (t: number) => 1 - Math.exp(-Math.pow(t / scale, shape))
  const full = f(HORIZON_MONTHS)
  return (t: number) => f(t) / full
}

const conversionProgress = makeRamp(CONVERSION_RAMP)
const attributionProgress = makeRamp(ATTRIBUTION_RAMP)

/**
 * Fit ln(sessions) = A + B·sigmoid(k(t − t0)) through the three anchors.
 *
 * Only t0 needs solving — A and B follow from it. If no root exists for the
 * given anchors (e.g. a non-monotonic or degenerate set), fall back to
 * piecewise-geometric interpolation so the model always returns something
 * sensible rather than NaN.
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

  const geometricFallback = () => (t: number) => {
    if (t <= 1) return s1
    if (t <= 12) return Math.exp(a1 + ((a12 - a1) * (t - 1)) / 11)
    if (t <= 24) return Math.exp(a12 + ((a24 - a12) * (t - 12)) / 12)
    return Math.exp(a24 + ((a24 - a12) * (t - 24)) / 12)
  }

  if (!Number.isFinite(span) || Math.abs(span) < 1e-9) return geometricFallback()

  const target = (a12 - a1) / span
  const residual = (t0: number) => {
    const u = sigmoid(steepness * (1 - t0))
    const v = sigmoid(steepness * (12 - t0))
    const w = sigmoid(steepness * (24 - t0))
    const denom = w - u
    if (Math.abs(denom) < 1e-15) return Number.NaN
    return (v - u) / denom - target
  }

  // Scan for a sign change, then bisect. The scan makes this robust to anchor
  // sets that push the root far outside the horizon.
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

// ── labels ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Calendar month (0-indexed) for month `t` of the projection. */
export function calendarMonth(t: number): number {
  return (MODEL_START.month + (t - 1)) % 12
}

export function monthLabel(t: number): string {
  const absolute = MODEL_START.month + (t - 1)
  const year = MODEL_START.year + Math.floor(absolute / 12)
  return `${MONTH_NAMES[absolute % 12]} ${String(year % 100).padStart(2, "0")}`
}

export const MONTH_LABELS = Array.from({ length: HORIZON_MONTHS }, (_, i) => monthLabel(i + 1))

// ── the model ───────────────────────────────────────────────────────────────

function applyScenario(base: SiteAssumptions, scenario: ScenarioProfile): SiteAssumptions {
  return {
    ...base,
    sessionsMonth12: base.sessionsMonth12 * scenario.sessions12,
    sessionsMonth24: base.sessionsMonth24 * scenario.sessions24,
    conversionPct: base.conversionPct * scenario.conversion,
    attributionExitPct: scenario.freezeAttribution
      ? base.attributionNowPct
      : base.attributionExitPct,
  }
}

/**
 * Revenue per session once conversion and attribution have fully matured —
 * the figure the unit-economics table leads with.
 */
export function maturityRevPerSession(a: SiteAssumptions): number {
  return (
    a.basket *
    (a.commissionPct / 100) *
    ((a.conversionPct / 100) * CONVERSION_CEILING) *
    (a.attributionExitPct / 100)
  )
}

/** Attribution capture in month `t`, as a fraction. */
function attributionAt(a: SiteAssumptions, t: number): number {
  const now = a.attributionNowPct / 100
  const exit = a.attributionExitPct / 100
  return now + (exit - now) * attributionProgress(t)
}

/** Conversion rate in month `t`, as a fraction. */
function conversionAt(a: SiteAssumptions, t: number): number {
  const maturity =
    CONVERSION_FLOOR + (CONVERSION_CEILING - CONVERSION_FLOOR) * conversionProgress(t)
  return (a.conversionPct / 100) * maturity
}

type RawMonth = {
  sessions: number
  revenue: number
  revPerSession: number
  attribution: number
}

function projectSite(profile: SiteProfile, effective: SiteAssumptions): RawMonth[] {
  const curve = fitTrafficCurve(
    effective.sessionsMonth1,
    effective.sessionsMonth12,
    effective.sessionsMonth24,
    profile.curveSteepness,
  )
  const commission = effective.commissionPct / 100

  return Array.from({ length: HORIZON_MONTHS }, (_, i) => {
    const t = i + 1
    const seasonal = profile.seasonality[calendarMonth(t)] ?? 1
    const sessions = Math.max(0, Math.round(curve(t) * seasonal))
    const conversion = conversionAt(effective, t)
    const attribution = attributionAt(effective, t)
    const revenue = sessions * conversion * effective.basket * commission * attribution
    return {
      sessions,
      revenue,
      revPerSession: sessions > 0 ? revenue / sessions : 0,
      attribution,
    }
  })
}

/**
 * Re-anchor the projection on months that have closed.
 *
 * A month counts as closed only when BOTH real sessions and real earned
 * commission are present — revenue alone can't tell you whether you missed on
 * traffic or on yield. Once closed months exist:
 *
 *   • forward traffic is scaled by how actual sessions are tracking against plan
 *   • forward revenue per session is re-based on what a visitor genuinely earns,
 *     while keeping the modelled improvement curve intact
 *
 * Both indices are computed on pooled totals rather than a per-month average, so
 * one freak month doesn't dominate.
 */
function applyActuals(
  raw: RawMonth[],
  actuals: Record<number, { sessions?: number | null; revenue?: number | null }> | undefined,
): { rows: RawMonth[]; closedMonths: number[]; trafficIndex: number; yieldIndex: number } {
  const closed: number[] = []
  if (actuals) {
    for (let t = 1; t <= HORIZON_MONTHS; t += 1) {
      const entry = actuals[t]
      const s = entry?.sessions
      const r = entry?.revenue
      if (typeof s === "number" && s > 0 && typeof r === "number" && r >= 0) closed.push(t)
    }
  }
  if (closed.length === 0) {
    return { rows: raw, closedMonths: [], trafficIndex: 1, yieldIndex: 1 }
  }

  let actualSessions = 0
  let modelSessions = 0
  let actualRevenue = 0
  let modelRevenue = 0
  for (const t of closed) {
    const entry = actuals![t]!
    actualSessions += entry.sessions as number
    actualRevenue += entry.revenue as number
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
      const sessions = entry!.sessions as number
      const revenue = entry!.revenue as number
      return {
        ...row,
        sessions,
        revenue,
        revPerSession: sessions > 0 ? revenue / sessions : 0,
      }
    }
    if (t <= lastClosed) return row
    const sessions = Math.round(row.sessions * trafficIndex)
    const revPerSession = row.revPerSession * yieldIndex
    return { ...row, sessions, revPerSession, revenue: sessions * revPerSession }
  })

  return { rows, closedMonths: closed, trafficIndex, yieldIndex }
}

function buildQuarters(months: MonthRow[]): QuarterRow[] {
  const quarters: QuarterRow[] = []
  for (let q = 0; q < HORIZON_MONTHS / 3; q += 1) {
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
      changeVsPriorPct:
        prior && prior.revenue > 0 ? ((revenue - prior.revenue) / prior.revenue) * 100 : null,
    })
  }
  return quarters
}

export function runModel(
  profiles: SiteProfile[],
  overrides: Partial<Record<SiteKey, Partial<SiteAssumptions>>>,
  scenario: ScenarioProfile,
  actuals: ActualsMap,
): ModelResult {
  const sites = {} as Record<SiteKey, SiteProjection>
  const order: SiteKey[] = []

  for (const profile of profiles) {
    order.push(profile.key)
    const base: SiteAssumptions = { ...profile.assumptions, ...(overrides[profile.key] ?? {}) }
    const effective = applyScenario(base, scenario)

    const raw = projectSite(profile, effective)
    const { rows } = applyActuals(raw, actuals[profile.key])

    const commission = effective.commissionPct / 100
    const months: MonthRow[] = rows.map((row, i) => {
      const t = i + 1
      const entry = actuals[profile.key]?.[t]
      const hasSessions = typeof entry?.sessions === "number" && (entry.sessions as number) > 0
      const hasRevenue = typeof entry?.revenue === "number" && (entry.revenue as number) >= 0
      const isActual = hasSessions && hasRevenue

      // GMV and orders are derived so that revenue/GMV always equals
      // commission × attribution and GMV/orders always equals the basket —
      // true for both modelled and re-anchored months.
      const denominator = commission * row.attribution
      const gmv = denominator > 0 ? row.revenue / denominator : 0
      const orders = effective.basket > 0 ? gmv / effective.basket : 0

      const planned = raw[i]
      return {
        index: t,
        label: MONTH_LABELS[i],
        monthLabel: MONTH_LABELS[i],
        sessions: row.sessions,
        revPerSession: row.revPerSession,
        orders,
        gmv,
        revenue: row.revenue,
        actualSessions: hasSessions ? (entry!.sessions as number) : null,
        actualRevenue: hasRevenue ? (entry!.revenue as number) : null,
        plannedRevenue: planned.revenue,
        plannedSessions: planned.sessions,
        revenueVariancePct:
          isActual && planned.revenue > 0
            ? (((entry!.revenue as number) - planned.revenue) / planned.revenue) * 100
            : null,
        sessionsVariancePct:
          isActual && planned.sessions > 0
            ? (((entry!.sessions as number) - planned.sessions) / planned.sessions) * 100
            : null,
        isActual,
        isReanchored: !isActual && row.revenue !== planned.revenue,
      }
    })

    const year1Revenue = months.slice(0, 12).reduce((s, m) => s + m.revenue, 0)
    const year2Revenue = months.slice(12).reduce((s, m) => s + m.revenue, 0)
    const last = months[months.length - 1]

    sites[profile.key] = {
      key: profile.key,
      profile,
      months,
      quarters: buildQuarters(months),
      year1Revenue,
      year2Revenue,
      totalRevenue: year1Revenue + year2Revenue,
      totalSessions: months.reduce((s, m) => s + m.sessions, 0),
      totalOrders: months.reduce((s, m) => s + m.orders, 0),
      totalGmv: months.reduce((s, m) => s + m.gmv, 0),
      month24Revenue: last.revenue,
      month24Sessions: last.sessions,
      exitRunRate: last.revenue * 12,
      maturityRevPerSession: maturityRevPerSession(effective),
      effective,
    }
  }

  const list = order.map((k) => sites[k])
  const month24Revenue = list.reduce((s, p) => s + p.month24Revenue, 0)
  const month24Sessions = list.reduce((s, p) => s + p.month24Sessions, 0)

  return {
    sites,
    order,
    totals: {
      year1Revenue: list.reduce((s, p) => s + p.year1Revenue, 0),
      year2Revenue: list.reduce((s, p) => s + p.year2Revenue, 0),
      totalRevenue: list.reduce((s, p) => s + p.totalRevenue, 0),
      month24Revenue,
      month24Sessions,
      exitRunRate: month24Revenue * 12,
      blendedRevPerSession: month24Sessions > 0 ? month24Revenue / month24Sessions : 0,
      totalSessions: list.reduce((s, p) => s + p.totalSessions, 0),
      indexablePages: list.reduce((s, p) => s + p.profile.indexablePages, 0),
    },
    monthLabels: MONTH_LABELS,
  }
}

// ── formatting ──────────────────────────────────────────────────────────────

export const money = (n: number, digits = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

export const money2 = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export const count = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const percent = (n: number, digits = 0) => `${n >= 0 ? "" : ""}${n.toFixed(digits)}%`

export const signedPercent = (n: number, digits = 0) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`
