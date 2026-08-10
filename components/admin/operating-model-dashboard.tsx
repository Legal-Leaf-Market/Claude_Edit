"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  runModel,
  money,
  count,
  rps,
  signedPercent,
  HORIZON_MONTHS,
  type Assumptions,
  type ActualsForSite,
} from "@/lib/admin/engine"
import {
  SITE_PROFILE,
  SCENARIOS,
  SCENARIO_ORDER,
  MERCHANTS,
  FACTS,
  NEXT_90_DAYS,
  METHOD_NOTES,
  METHOD_FOOTNOTE,
  INCOME_TARGETS,
  ASSUMPTION_FIELDS,
  PREPARED_ON,
} from "@/lib/admin/reference-data"
import { RevenueChart } from "./revenue-chart"

const STORAGE_KEY = "gearavail.operating-model.v1"
type ScenarioKey = keyof typeof SCENARIOS

/*
 * Same two horizons the all-sites rollup offers, so the pair of pages agree.
 * 24 is the anchor horizon the model is actually fit against; 120 carries
 * that same fit out to ten years.
 */
const HORIZONS = [
  { key: "24", label: "2 years", months: 24 },
  { key: "120", label: "10 years", months: 120 },
] as const
type HorizonKey = (typeof HORIZONS)[number]["key"]

type Persisted = {
  version: 1
  scenario: ScenarioKey
  overrides: Partial<Assumptions>
  actuals: ActualsForSite
  savedAt: number
}

function relativeTime(then: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

const inputCls =
  "h-8 w-24 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 text-right text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"

function statusPill(status: string) {
  if (status === "tracking")
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">tracking</span>
  if (status === "pending")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">pending</span>
  if (status === "unconfirmed")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">unconfirmed</span>
  if (status === "paused")
    return <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">paused</span>
  return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">earns $0</span>
}

const SECTIONS = [
  { id: "verdict", label: "Verdict" },
  { id: "facts", label: "The three facts" },
  { id: "engine", label: "Unit economics" },
  { id: "controls", label: "Assumptions" },
  { id: "trajectory", label: "Trajectory" },
  { id: "quarterly", label: "Quarterly" },
  { id: "monthly", label: "Monthly & actuals" },
  { id: "stores", label: "By store" },
  { id: "reverse", label: "Reverse" },
  { id: "next", label: "Next 90 days" },
  { id: "method", label: "Method" },
]

export function OperatingModelDashboard() {
  const [scenario, setScenario] = useState<ScenarioKey>("base")
  /*
   * Ten years is the default view. The model's anchors are still the 24-month
   * ones (see the note rendered next to this control): a longer horizon is a
   * display and summation choice, carrying the same fitted curve out to its
   * own asymptote, not a second fit against decade-length evidence.
   */
  const [horizon, setHorizon] = useState<HorizonKey>("120")
  const [overrides, setOverrides] = useState<Partial<Assumptions>>({})
  const [actuals, setActuals] = useState<ActualsForSite>({})
  const [hydrated, setHydrated] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted
        if (parsed && parsed.version === 1) {
          if (parsed.scenario && SCENARIOS[parsed.scenario]) setScenario(parsed.scenario)
          if (parsed.overrides) setOverrides(parsed.overrides)
          if (parsed.actuals) setActuals(parsed.actuals)
          if (typeof parsed.savedAt === "number") setSavedAt(parsed.savedAt)
        }
      }
    } catch {
      // A corrupt or unreadable entry must never block the page.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const stamp = Date.now()
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, scenario, overrides, actuals, savedAt: stamp }),
      )
      setSavedAt(stamp)
    } catch {
      setNotice("Could not save to this browser: storage is full or blocked.")
    }
  }, [scenario, overrides, actuals, hydrated])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const horizonMonths = HORIZONS.find((h) => h.key === horizon)!.months

  const models = useMemo(() => {
    const byKey = { [SITE_PROFILE.key]: overrides }
    const actualsByKey = { [SITE_PROFILE.key]: actuals }
    return {
      bear: runModel([SITE_PROFILE], byKey, SCENARIOS.bear, actualsByKey, horizonMonths),
      base: runModel([SITE_PROFILE], byKey, SCENARIOS.base, actualsByKey, horizonMonths),
      bull: runModel([SITE_PROFILE], byKey, SCENARIOS.bull, actualsByKey, horizonMonths),
    }
  }, [overrides, actuals, horizonMonths])

  const model = models[scenario]
  const site = model.sites[SITE_PROFILE.key]
  const t = model.totals
  const active = SCENARIOS[scenario]

  function setOverride(field: keyof Assumptions, raw: string) {
    const next = raw.trim() === "" ? undefined : Number(raw)
    setOverrides((prev) => {
      const copy = { ...prev }
      if (next === undefined || Number.isNaN(next)) delete copy[field]
      else copy[field] = next
      return copy
    })
  }

  function getValue(field: keyof Assumptions): number {
    return overrides[field] ?? SITE_PROFILE.assumptions[field]
  }

  function setActual(monthIndex: number, field: "sessions" | "revenue", raw: string) {
    const next = raw.trim() === "" ? undefined : Number(raw)
    setActuals((prev) => {
      const entry = { ...(prev[monthIndex] || {}) }
      if (next === undefined || Number.isNaN(next)) delete entry[field]
      else entry[field] = next
      const copy = { ...prev }
      if (Object.keys(entry).length === 0) delete copy[monthIndex]
      else copy[monthIndex] = entry
      return copy
    })
  }

  function exportData() {
    const payload = { version: 1, scenario, overrides, actuals, savedAt: Date.now() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `operating-model-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function importData(file: File) {
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text)
        if (!parsed || parsed.version !== 1) throw new Error("unrecognised file")
        if (parsed.scenario && SCENARIOS[parsed.scenario as ScenarioKey]) setScenario(parsed.scenario)
        setOverrides(parsed.overrides || {})
        setActuals(parsed.actuals || {})
        setNotice("Imported.")
      })
      .catch(() => setNotice("That file isn't an export of this model."))
  }

  function resetAll() {
    if (!window.confirm("Reset every assumption and every actual you have entered? This cannot be undone.")) return
    setOverrides({})
    setActuals({})
    setScenario("base")
    setNotice("Reset to the shipped assumptions.")
  }

  const closedTotal = site.closedMonths.length
  const savedLabel = !hydrated ? "" : savedAt ? `Saved to this browser · ${relativeTime(savedAt)}` : "Nothing saved yet"

  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {})
    window.location.href = "/admin/sign-in"
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">
            Operating model · prepared {PREPARED_ON}
          </p>
          <div className="flex items-center gap-2">
            <a
              href="/admin/all-sites"
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
            >
              All 5 sites combined →
            </a>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--cream)] disabled:opacity-50"
            >
              {signingOut ? "Leaving…" : "Exit admin"}
            </button>
          </div>
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--cream)] sm:text-3xl">
          Can this actually make money?
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          A {horizonMonths === 24 ? "two-year" : "ten-year"} projection for Gear Avail, built from
          the real live catalogue and the affiliate links that are actually confirmed today.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 font-medium text-[var(--amber)]">
            {model.monthLabels[0]} → {model.monthLabels[model.monthLabels.length - 1]}
          </span>
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[var(--muted-foreground)]">
            {horizonMonths} months · {horizonMonths / 3} quarters
          </span>
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[var(--muted-foreground)]">
            {closedTotal > 0 ? `Re-anchored on ${closedTotal} closed month${closedTotal === 1 ? "" : "s"}` : "Recalculates from your actuals"}
          </span>
          {hydrated && <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[var(--muted-foreground)]">{savedLabel}</span>}
        </div>
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-[var(--muted-foreground)] hover:text-[var(--amber)]">
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {notice && (
        <p role="status" className="mb-6 rounded-lg bg-[var(--secondary)] px-4 py-2 text-sm text-[var(--cream)]">
          {notice}
        </p>
      )}

      {/* Verdict */}
      <section id="verdict" className="admin-section">
        <p className="eyebrow">Verdict</p>
        <h2>Realistic, if the confirmations and one gated feed land</h2>
        <div className="section-body">
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <p>
              The site is not the constraint: real inventory from {SITE_PROFILE.tagline.toLowerCase()}{" "}
              is already live, and unlike the affiliate sites in this family that deal in
              restricted categories, this one can legally advertise. The constraint right now is
              that roughly a third of live catalogue by product count has no confirmed referral
              link, and every gated feed (eBay, Reverb, Sweetwater, Gear4music, the CJ trio) is
              paused pending an approval, not a technical blocker.
            </p>
            <p>
              Fix those two things and the base case is realistic: roughly{" "}
              <strong className="text-[var(--cream)]">{money(models.base.totals.year1Revenue)}</strong> in
              year one, <strong className="text-[var(--cream)]">{money(models.base.totals.year2Revenue)}</strong> in
              year two, exiting month 24 around{" "}
              <strong className="text-[var(--cream)]">{money(models.base.totals.month24Revenue)}/month</strong>. Leave
              them unfixed and it's the bear column, about{" "}
              <strong className="text-[var(--cream)]">{money(models.bear.totals.totalRevenue)}</strong> across two
              years. The upside case is a genuine{" "}
              <strong className="text-[var(--cream)]">{money(models.bull.totals.exitRunRate)}</strong> exit
              run-rate if one channel (most likely eBay production access) actually breaks
              through.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Year 1 revenue" value={money(t.year1Revenue)} sub={`${active.label} case`} />
            <Stat
              label="Year 2 revenue"
              value={money(t.year2Revenue)}
              sub={`${(t.year1Revenue > 0 ? t.year2Revenue / t.year1Revenue : 0).toFixed(1)}× year 1`}
            />
            <Stat label="Exit run-rate" value={`${money(t.exitRunRate)}/yr`} sub={`${money(t.month24Revenue)} in month ${horizonMonths}`} />
            <Stat label="Blended rev / session" value={`$${t.blendedRevPerSession.toFixed(3)}`} sub={money(t.blendedRevPerSession * 1000) + " per 1,000"} />
            <Stat label={`Sessions needed, mo ${horizonMonths}`} value={count(t.month24Sessions)} sub={`≈ ${count(Math.round(t.month24Sessions / 30))} a day`} />
            <Stat label="Indexable pages today" value={String(t.indexablePages)} sub="category pages; gear pages scale automatically" />
          </div>
        </div>
      </section>

      {/* Facts */}
      <section id="facts" className="admin-section">
        <p className="eyebrow">The three facts</p>
        <h2>What actually decides the outcome</h2>
        <div className="section-body grid gap-4 sm:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.title} className="panel p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">{f.tag}</p>
              <h3 className="mb-2 text-base font-semibold text-[var(--cream)]">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Unit economics */}
      <section id="engine" className="admin-section">
        <p className="eyebrow">Engine · edit any cell</p>
        <h2>Unit economics: the number that governs everything</h2>
        <p className="intro">
          An affiliate site's whole economy compresses into one figure: revenue per session. Basket
          size × commission rate × the share of visitors who complete a purchase × the share of
          those purchases actually credited. Everything else is traffic.
        </p>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Basket</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">Conversion</th>
                  <th className="text-right">Attribution, mo 24</th>
                  <th className="text-right">Rev / session</th>
                  <th className="text-right">Per 1,000</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="num-affix">$</span>
                    <input
                      type="number"
                      className={inputCls}
                      value={getValue("basket")}
                      step={5}
                      onChange={(e) => setOverride("basket", e.target.value)}
                    />
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      className={inputCls}
                      value={getValue("commissionPct")}
                      step={0.5}
                      onChange={(e) => setOverride("commissionPct", e.target.value)}
                    />
                    <span className="num-affix">%</span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      className={inputCls}
                      value={getValue("conversionPct")}
                      step={0.05}
                      onChange={(e) => setOverride("conversionPct", e.target.value)}
                    />
                    <span className="num-affix">%</span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      className={inputCls}
                      value={getValue("attributionExitPct")}
                      step={1}
                      max={100}
                      onChange={(e) => setOverride("attributionExitPct", e.target.value)}
                    />
                    <span className="num-affix">%</span>
                  </td>
                  <td className="text-right font-semibold text-[var(--amber)]">{rps(site.maturityRevPerSession)}</td>
                  <td className="text-right">{money(site.maturityRevPerSession * 1000)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="table-caption">
            Ecommerce affiliate conversion benchmarks sit at 1–3% of sessions; average affiliate AOV
            runs around $125. GoAffPro (and similar small-merchant programmes) typically run 5–15%
            commission, but none of these 11 stores' actual rates have been confirmed from their
            dashboards yet: the 8% shown is a placeholder, not a measurement.
          </p>
        </div>
      </section>

      {/* Controls */}
      <section id="controls" className="admin-section">
        <p className="eyebrow">Controls</p>
        <h2>Scenario and assumptions</h2>
        <div className="section-body">
          <div role="radiogroup" aria-label="Scenario" className="flex gap-2">
            {SCENARIO_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === scenario}
                onClick={() => setScenario(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  key === scenario
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] text-[var(--cream)] hover:bg-[var(--secondary)]"
                }`}
              >
                {SCENARIOS[key].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <strong className="text-[var(--cream)]">{active.headline}.</strong> {active.detail}
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            The scenario multiplies the assumptions below, it does not replace them. Edit a number
            and all three scenarios move with it.
          </p>

          <div role="radiogroup" aria-label="Horizon" className="mt-4 flex gap-2">
            {HORIZONS.map((h) => (
              <button
                key={h.key}
                type="button"
                role="radio"
                aria-checked={h.key === horizon}
                onClick={() => setHorizon(h.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  h.key === horizon
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--line)] text-[var(--cream)] hover:bg-[var(--secondary)]"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          {horizon === "120" && (
            <p className="mt-2 max-w-[68ch] text-xs leading-relaxed text-[var(--muted-foreground)]">
              The ten-year view is the same fitted curve carried out to its own asymptote, not a new
              fit: every anchor still sits inside the first 24 months, and nothing past month 24 is
              new evidence. Conversion and attribution are both fully matured there (clamped, not
              extrapolated further up), so the traffic S-curve is doing all the remaining work. Read
              the later years as the shape the assumptions imply if nothing changes for a decade,
              which is the least likely thing about them. The further out you read, the softer the
              number.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportData} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--secondary)]">
              Export
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
            >
              Import
            </button>
            <button type="button" onClick={resetAll} className="rounded-lg border border-[var(--destructive)] px-3 py-1.5 text-xs font-medium text-[var(--destructive)] hover:bg-[var(--secondary)]">
              Reset all
            </button>
            <span className="text-xs text-[var(--muted-foreground)]">{savedLabel}</span>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importData(file)
                e.target.value = ""
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ASSUMPTION_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs text-[var(--muted-foreground)]">{field.label}</span>
                <input
                  type="number"
                  step={field.step}
                  value={getValue(field.key)}
                  onChange={(e) => setOverride(field.key, e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Chart */}
      <section id="trajectory" className="admin-section">
        <p className="eyebrow">Trajectory</p>
        <h2>Monthly revenue</h2>
        <p className="intro">
          {active.label} case, {money(t.month24Revenue)} in {model.monthLabels[23]}.
        </p>
        <div className="section-body">
          <RevenueChart months={site.months} color={SITE_PROFILE.color} />
        </div>
      </section>

      {/* Quarterly */}
      <section id="quarterly" className="admin-section">
        <p className="eyebrow">Quarterly</p>
        <h2>Eight quarters</h2>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Quarter</th>
                  <th className="text-left">Months</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Merchant GMV</th>
                  <th className="text-right">Your revenue</th>
                  <th className="text-right">Rev / session</th>
                  <th className="text-right">vs prior Q</th>
                </tr>
              </thead>
              <tbody>
                {site.quarters.map((q) => (
                  <tr key={q.index}>
                    <td className="font-semibold text-[var(--amber)]">{q.label}</td>
                    <td className="text-[var(--muted-foreground)]">{q.monthsLabel}</td>
                    <td className="text-right">{count(q.sessions)}</td>
                    <td className="text-right">{count(Math.round(q.orders))}</td>
                    <td className="text-right">{money(q.gmv)}</td>
                    <td className="text-right font-semibold text-[var(--amber)]">{money(q.revenue)}</td>
                    <td className="text-right">{rps(q.revPerSession)}</td>
                    <td className={`text-right ${q.changeVsPriorPct === null ? "text-[var(--muted-foreground)]" : q.changeVsPriorPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {q.changeVsPriorPct === null ? "–" : signedPercent(q.changeVsPriorPct)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--border)] font-semibold">
                  <td colSpan={2}>Total ({horizonMonths} months)</td>
                  <td className="text-right">{count(site.totalSessions)}</td>
                  <td className="text-right">{count(Math.round(site.totalOrders))}</td>
                  <td className="text-right">{money(site.totalGmv)}</td>
                  <td className="text-right text-[var(--amber)]">{money(site.totalRevenue)}</td>
                  <td className="text-right">{rps(site.totalSessions > 0 ? site.totalRevenue / site.totalSessions : 0)}</td>
                  <td className="text-right text-[var(--muted-foreground)]">–</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Monthly + actuals */}
      <section id="monthly" className="admin-section">
        <p className="eyebrow">Monthly</p>
        <h2>Month by month, and where you enter actuals</h2>
        <p className="intro">
          The two shaded columns are yours. Enter real sessions and real earned commission for any
          month that has closed. As soon as a month has both, the model stops guessing about that
          month and re-anchors everything after it. Entries save to this browser automatically.
        </p>
        {horizonMonths > HORIZON_MONTHS && (
          <p className="intro">
            This table stays at the first {HORIZON_MONTHS} months even on the ten-year view, because
            that is the window the model is anchored in. An actual entered for month 87 has nothing
            to re-anchor: the curve is already fully matured by then, so it would be a number the
            model quietly ignores. The chart and the totals above do run the full{" "}
            {horizonMonths} months.
          </p>
        )}
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Month</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Rev/sess</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">GMV</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Actual sessions</th>
                  <th className="text-right">Actual revenue</th>
                  <th className="text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {site.months.slice(0, HORIZON_MONTHS).map((m) => {
                  const varianceCls =
                    m.revenueVariancePct === null
                      ? "text-[var(--muted-foreground)]"
                      : m.revenueVariancePct >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                  return (
                    <tr key={m.index} className={m.isActual ? "bg-[var(--secondary)]/40" : ""}>
                      <td className="font-semibold text-[var(--amber)]">
                        {m.label}
                        {m.isActual && (
                          <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                            actual
                          </span>
                        )}
                      </td>
                      <td className="text-right">{count(m.sessions)}</td>
                      <td className="text-right">{rps(m.revPerSession)}</td>
                      <td className="text-right">{m.orders.toFixed(1)}</td>
                      <td className="text-right">{money(m.gmv)}</td>
                      <td className="text-right font-semibold text-[var(--amber)]">{money(m.revenue)}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          placeholder="–"
                          className={inputCls}
                          value={m.actualSessions ?? ""}
                          onChange={(e) => setActual(m.index, "sessions", e.target.value)}
                        />
                      </td>
                      <td className="text-right">
                        <span className="num-affix">$</span>
                        <input
                          type="number"
                          placeholder="–"
                          className={inputCls}
                          value={m.actualRevenue ?? ""}
                          onChange={(e) => setActual(m.index, "revenue", e.target.value)}
                        />
                      </td>
                      <td className={`text-right ${varianceCls}`}>
                        {m.revenueVariancePct === null ? "–" : signedPercent(m.revenueVariancePct)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* By store */}
      <section id="stores" className="admin-section">
        <p className="eyebrow">By store</p>
        <h2>Which merchants carry the catalogue, and which earn nothing today</h2>
        <p className="intro">
          Catalogue counts are the real ingested listing counts from production. Status reflects
          what's actually confirmed: "tracking" means a real, working referral link is wired up;
          everything else earns $0 right now regardless of how much inventory it carries.
        </p>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Platform</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Catalogue</th>
                  <th className="text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {MERCHANTS.map((row) => (
                  <tr key={row.merchant}>
                    <td className="font-semibold text-[var(--amber)]">{row.merchant}</td>
                    <td className="text-[var(--muted-foreground)]">{row.platform}</td>
                    <td>{statusPill(row.status)}</td>
                    <td className="text-right">{row.catalogueCount > 0 ? count(row.catalogueCount) : "–"}</td>
                    <td className="max-w-xs whitespace-normal text-xs text-[var(--muted-foreground)]">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Reverse */}
      <section id="reverse" className="admin-section">
        <p className="eyebrow">Reverse</p>
        <h2>What a given income actually requires</h2>
        <p className="intro">
          Run the model backwards. At the blended revenue per session above, this is the traffic
          each income level demands.
        </p>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Monthly income</th>
                  <th className="text-right">Sessions / month</th>
                  <th className="text-right">Sessions / day</th>
                  <th className="text-right">Annualised</th>
                </tr>
              </thead>
              <tbody>
                {INCOME_TARGETS.map((income) => {
                  const sessions = t.blendedRevPerSession > 0 ? income / t.blendedRevPerSession : 0
                  return (
                    <tr key={income}>
                      <td className="font-semibold text-[var(--amber)]">
                        {money(income)}
                        {income === 8333 && <span className="ml-2 text-xs text-[var(--muted-foreground)]">($100k/yr)</span>}
                      </td>
                      <td className="text-right font-semibold text-[var(--amber)]">{count(Math.round(sessions))}</td>
                      <td className="text-right">{count(Math.round(sessions / 30))}</td>
                      <td className="text-right">{money(income * 12)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Next 90 days */}
      <section id="next" className="admin-section">
        <p className="eyebrow">Next</p>
        <h2>The ninety days that move the projection</h2>
        <div className="section-body grid gap-4 sm:grid-cols-2">
          {NEXT_90_DAYS.map((item, i) => (
            <div key={item.title} className="panel p-4">
              <p className="text-2xl font-bold text-[var(--secondary)]">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mb-2 mt-1 text-base font-semibold text-[var(--cream)]">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{item.body}</p>
              <p className="mt-2 text-xs italic text-[var(--amber)]">{item.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="admin-section">
        <p className="eyebrow">Method</p>
        <h2>How the model works, and where it is weakest</h2>
        <div className="section-body">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {METHOD_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">{METHOD_FOOTNOTE}</p>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--cream)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</p>
    </div>
  )
}
