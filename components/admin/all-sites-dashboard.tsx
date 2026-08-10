"use client"

import { useMemo, useState } from "react"
import { money, count, rps, signedPercent } from "@/lib/admin/engine"
import { SCENARIOS, SCENARIO_ORDER, PREPARED_ON } from "@/lib/admin/reference-data"
import { SISTER_SITES_PREPARED_ON } from "@/lib/admin/sister-sites"
import { runAllSites, combinedMonths, ALL_SITE_PROFILES } from "@/lib/admin/all-sites"
import { RevenueChart } from "./revenue-chart"

type ScenarioKey = keyof typeof SCENARIOS
const HORIZONS = [
  { key: "24", label: "24 months", months: 24 },
  { key: "120", label: "Decade", months: 120 },
] as const
type HorizonKey = (typeof HORIZONS)[number]["key"]

const COMBINED_COLOR = "#f0a830"

/**
 * Read-only rollup of all five sites' operating models through the SAME
 * engine each site's own admin page uses. There is no override editor and
 * no actuals entry here on purpose: each site's own page (on its own
 * domain) is the place assumptions get tuned and real months get entered,
 * and this page would silently drift out of sync with that if it kept a
 * second, separate copy of the same state. This page answers one question
 * — "what does the whole family add up to" — from each site's last-known
 * shipped assumptions, nothing more.
 */
export function AllSitesDashboard() {
  const [scenario, setScenario] = useState<ScenarioKey>("base")
  const [horizon, setHorizon] = useState<HorizonKey>("24")

  const horizonMonths = HORIZONS.find((h) => h.key === horizon)!.months

  const models = useMemo(() => {
    return {
      bear: runAllSites(SCENARIOS.bear, horizonMonths),
      base: runAllSites(SCENARIOS.base, horizonMonths),
      bull: runAllSites(SCENARIOS.bull, horizonMonths),
    }
  }, [horizonMonths])

  const model = models[scenario]
  const t = model.totals
  const active = SCENARIOS[scenario]
  const chartMonths = useMemo(() => combinedMonths(model), [model])
  const siteRows = model.order.map((k) => model.sites[k])

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
            All sites · Gear Avail prepared {PREPARED_ON} · sister sites prepared {SISTER_SITES_PREPARED_ON}
          </p>
          <div className="flex items-center gap-2">
            <a
              href="/admin/operating-model"
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
            >
              ← Gear Avail only
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
          The whole affiliate family, combined
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Gear Avail plus Legal Leaf Market, Herbal Leaf Market, Nicotia Market and KawaiiKatz, run
          through the same projection engine each site's own admin page uses. This page is a
          read-only rollup of each site's last-known shipped assumptions — it does not edit them,
          and it does not see real actuals entered on any site's own page. Go there to change what a
          site actually assumes about itself.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 font-medium text-[var(--amber)]">
            {model.monthLabels[0]} → {model.monthLabels[model.monthLabels.length - 1]}
          </span>
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[var(--muted-foreground)]">
            {ALL_SITE_PROFILES.length} sites combined
          </span>
        </div>
      </header>

      {horizon === "120" && (
        <p className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 px-4 py-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          The decade view is the same fitted traffic curve carried out to its own natural asymptote,
          not a new fit: nothing past month 24 is a new anchor point. Conversion and attribution are
          both fully matured (clamped, not extrapolated further upward) for every month past 24 —
          see the Method section on each site's own page for why that clamp is the mathematically
          honest choice rather than letting either ratio climb past 100% of its stated ceiling the
          longer the horizon runs.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
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
        <div role="radiogroup" aria-label="Horizon" className="flex gap-2">
          {HORIZONS.map((h) => (
            <button
              key={h.key}
              type="button"
              role="radio"
              aria-checked={h.key === horizon}
              onClick={() => setHorizon(h.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                h.key === horizon
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] text-[var(--cream)] hover:bg-[var(--secondary)]"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-[var(--muted-foreground)]">
        <strong className="text-[var(--cream)]">{active.headline}.</strong> {active.detail}
      </p>

      <section className="admin-section" id="totals">
        <p className="eyebrow">Combined</p>
        <h2>{horizon === "120" ? "Decade" : "24-month"} totals, all five sites</h2>
        <div className="section-body grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Total revenue" value={money(t.totalRevenue)} sub={`${active.label} case, ${horizonMonths} months`} />
          <Stat label="Exit run-rate" value={`${money(t.exitRunRate)}/yr`} sub={`${money(t.month24Revenue)} in the final month`} />
          <Stat label="Blended rev / session" value={rps(t.blendedRevPerSession)} sub={money(t.blendedRevPerSession * 1000) + " per 1,000"} />
          <Stat label="Total sessions" value={count(t.totalSessions)} sub={`${count(t.month24Sessions)} in the final month`} />
          <Stat label="Indexable pages" value={String(t.indexablePages)} sub="across all five sites today" />
          <Stat label="Sites combined" value={String(ALL_SITE_PROFILES.length)} sub="Gear Avail + 4 sister sites" />
        </div>
      </section>

      <section className="admin-section" id="chart">
        <p className="eyebrow">Trajectory</p>
        <h2>Combined monthly revenue</h2>
        <p className="intro">
          {active.label} case, summed across all five sites — {money(t.month24Revenue)} in the final
          month shown.
        </p>
        <div className="section-body">
          <RevenueChart months={chartMonths} color={COMBINED_COLOR} />
        </div>
      </section>

      <section className="admin-section" id="by-site">
        <p className="eyebrow">By site</p>
        <h2>How the total splits up</h2>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Site</th>
                  <th className="text-left">Domain</th>
                  <th className="text-right">Total revenue</th>
                  <th className="text-right">Share</th>
                  <th className="text-right">Exit run-rate</th>
                  <th className="text-right">Total sessions</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.map((s) => (
                  <tr key={s.key}>
                    <td className="font-semibold" style={{ color: s.profile.color }}>
                      {s.profile.shortName}
                    </td>
                    <td className="text-[var(--muted-foreground)]">{s.profile.domain}</td>
                    <td className="text-right">{money(s.totalRevenue)}</td>
                    <td className="text-right">
                      {t.totalRevenue > 0 ? `${((s.totalRevenue / t.totalRevenue) * 100).toFixed(1)}%` : "–"}
                    </td>
                    <td className="text-right">{money(s.exitRunRate)}/yr</td>
                    <td className="text-right">{count(s.totalSessions)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--border)] font-semibold">
                  <td colSpan={2}>Total</td>
                  <td className="text-right text-[var(--amber)]">{money(t.totalRevenue)}</td>
                  <td className="text-right">100%</td>
                  <td className="text-right text-[var(--amber)]">{money(t.exitRunRate)}/yr</td>
                  <td className="text-right">{count(t.totalSessions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="table-caption">
            Gear Avail's own assumptions live in this codebase (lib/admin/reference-data.ts) and stay
            current with real ingestion and referral-confirmation status. The four sister sites'
            figures are ported from their own admin page as of {SISTER_SITES_PREPARED_ON}
            {" "}(lib/admin/sister-sites.ts) and will drift from whatever that page shows today if
            their assumptions have changed since — re-port from there rather than trusting this page
            as current for those four.
          </p>
        </div>
      </section>

      <section className="admin-section" id="quarterly">
        <p className="eyebrow">Quarterly</p>
        <h2>Combined, by quarter</h2>
        <div className="section-body">
          <div className="table-wrap">
            <table className="model-table">
              <thead>
                <tr>
                  <th className="text-left">Quarter</th>
                  <th className="text-left">Months</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Rev / session</th>
                  <th className="text-right">vs prior Q</th>
                </tr>
              </thead>
              <tbody>
                {combinedQuarters(siteRows, model.monthLabels).map((q) => (
                  <tr key={q.index}>
                    <td className="font-semibold text-[var(--amber)]">{q.label}</td>
                    <td className="text-[var(--muted-foreground)]">{q.monthsLabel}</td>
                    <td className="text-right">{count(q.sessions)}</td>
                    <td className="text-right font-semibold text-[var(--amber)]">{money(q.revenue)}</td>
                    <td className="text-right">{rps(q.revPerSession)}</td>
                    <td
                      className={`text-right ${q.changeVsPriorPct === null ? "text-[var(--muted-foreground)]" : q.changeVsPriorPct >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {q.changeVsPriorPct === null ? "–" : signedPercent(q.changeVsPriorPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Combined quarters, summed the same way combinedMonths sums months — no per-site engine call needed. */
function combinedQuarters(
  siteRows: ReturnType<typeof runAllSites>["sites"][string][],
  monthLabels: string[],
) {
  const length = siteRows[0]?.months.length ?? 0
  const quarters: {
    index: number
    label: string
    monthsLabel: string
    sessions: number
    revenue: number
    revPerSession: number
    changeVsPriorPct: number | null
  }[] = []

  for (let q = 0; q < Math.floor(length / 3); q += 1) {
    const start = q * 3
    const end = start + 3
    const sessions = siteRows.reduce(
      (sum, s) => sum + s.months.slice(start, end).reduce((a, m) => a + m.sessions, 0),
      0,
    )
    const revenue = siteRows.reduce(
      (sum, s) => sum + s.months.slice(start, end).reduce((a, m) => a + m.revenue, 0),
      0,
    )
    const prior = quarters[q - 1]
    quarters.push({
      index: q + 1,
      label: `Q${q + 1}`,
      monthsLabel: `${monthLabels[start]} – ${monthLabels[end - 1]}`,
      sessions,
      revenue,
      revPerSession: sessions > 0 ? revenue / sessions : 0,
      changeVsPriorPct: prior && prior.revenue > 0 ? ((revenue - prior.revenue) / prior.revenue) * 100 : null,
    })
  }
  return quarters
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
