"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  ActualsMap,
  ScenarioKey,
  SiteAssumptions,
  SiteKey,
} from "@/lib/operating-model"
import { count, money, runModel } from "@/lib/operating-model"
import {
  FACTS,
  METHOD_FOOTNOTE,
  METHOD_NOTES,
  NEXT_90_DAYS,
  PREPARED_ON,
  SCENARIOS,
  SITE_MAP,
  SITE_PROFILES,
} from "@/lib/operating-model-data"
import { RevenueChart } from "@/components/admin/model-chart"
import {
  AssumptionsPanel,
  DataActions,
  ScenarioPicker,
} from "@/components/admin/model-controls"
import {
  MerchantTable,
  MonthlyTable,
  QuarterlyTable,
  ReverseTable,
  SummaryTable,
  UnitEconomicsTable,
} from "@/components/admin/model-tables"
import { Card, Section, Stat } from "@/components/admin/model-ui"

const STORAGE_KEY = "llm.operating-model.v1"

type Overrides = Partial<Record<SiteKey, Partial<SiteAssumptions>>>

type Persisted = {
  version: 1
  scenario: ScenarioKey
  overrides: Overrides
  actuals: ActualsMap
  savedAt: number
}

const SECTIONS = [
  { id: "verdict", label: "Verdict" },
  { id: "facts", label: "The three facts" },
  { id: "engine", label: "Unit economics" },
  { id: "controls", label: "Assumptions" },
  { id: "trajectory", label: "Trajectory" },
  { id: "summary", label: "Summary" },
  { id: "quarterly", label: "Quarterly" },
  { id: "monthly", label: "Monthly & actuals" },
  { id: "stores", label: "By store" },
  { id: "reverse", label: "Reverse" },
  { id: "next", label: "Next 90 days" },
  { id: "method", label: "Method" },
]

function relativeTime(then: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

export function OperatingModel() {
  const [scenario, setScenario] = useState<ScenarioKey>("base")
  const [overrides, setOverrides] = useState<Overrides>({})
  const [actuals, setActuals] = useState<ActualsMap>({})
  const [hydrated, setHydrated] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const firstWrite = useRef(true)

  // Load once on mount. Reading during render would desync server and client HTML.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>
        if (parsed && parsed.version === 1) {
          if (parsed.scenario && parsed.scenario in SCENARIOS) setScenario(parsed.scenario)
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

  // Persist on change, but not on the hydrating pass.
  useEffect(() => {
    if (!hydrated) return
    if (firstWrite.current) {
      firstWrite.current = false
      return
    }
    const stamp = Date.now()
    const payload: Persisted = { version: 1, scenario, overrides, actuals, savedAt: stamp }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setSavedAt(stamp)
    } catch {
      setNotice("Could not save to this browser — storage is full or blocked.")
    }
  }, [hydrated, scenario, overrides, actuals])

  const getValue = useCallback(
    (site: SiteKey, field: keyof SiteAssumptions) =>
      overrides[site]?.[field] ?? SITE_MAP[site].assumptions[field],
    [overrides],
  )

  const setValue = useCallback(
    (site: SiteKey, field: keyof SiteAssumptions, next: number | null) => {
      setOverrides((prev) => {
        const forSite = { ...(prev[site] ?? {}) }
        if (next === null) delete forSite[field]
        else forSite[field] = next
        const copy = { ...prev, [site]: forSite }
        if (Object.keys(forSite).length === 0) delete copy[site]
        return copy
      })
    },
    [],
  )

  const getActual = useCallback(
    (site: SiteKey, month: number, field: "sessions" | "revenue") =>
      actuals[site]?.[month]?.[field] ?? null,
    [actuals],
  )

  const setActual = useCallback(
    (site: SiteKey, month: number, field: "sessions" | "revenue", next: number | null) => {
      setActuals((prev) => {
        const forSite = { ...(prev[site] ?? {}) }
        const entry = { ...(forSite[month] ?? {}) }
        if (next === null) delete entry[field]
        else entry[field] = next
        if (Object.keys(entry).length === 0) delete forSite[month]
        else forSite[month] = entry
        const copy = { ...prev, [site]: forSite }
        if (Object.keys(forSite).length === 0) delete copy[site]
        return copy
      })
    },
    [],
  )

  // All three scenarios are cheap to compute and let the verdict cite every column.
  const models = useMemo(
    () => ({
      bear: runModel(SITE_PROFILES, overrides, SCENARIOS.bear, actuals),
      base: runModel(SITE_PROFILES, overrides, SCENARIOS.base, actuals),
      bull: runModel(SITE_PROFILES, overrides, SCENARIOS.bull, actuals),
    }),
    [overrides, actuals],
  )
  const model = models[scenario]
  const t = model.totals

  const closedMonths = useMemo(
    () =>
      Object.values(actuals).reduce((sum, months) => {
        if (!months) return sum
        return (
          sum +
          Object.values(months).filter(
            (m) => typeof m.sessions === "number" && typeof m.revenue === "number",
          ).length
        )
      }, 0),
    [actuals],
  )

  const legal = model.sites.legal
  const legalRevShare = t.totalRevenue > 0 ? (legal.totalRevenue / t.totalRevenue) * 100 : 0
  const legalSessionShare =
    t.totalSessions > 0 ? (legal.totalSessions / t.totalSessions) * 100 : 0
  // Compare against the better of the two weak sites so "at least N×" holds for both.
  const weakest = Math.max(
    model.sites.nicotia.maturityRevPerSession,
    model.sites.kawaii.maturityRevPerSession,
  )
  const legalMultiple = weakest > 0 ? legal.maturityRevPerSession / weakest : 0
  const yearMultiple = t.year1Revenue > 0 ? t.year2Revenue / t.year1Revenue : 0

  const handleExport = useCallback(() => {
    const payload: Persisted = {
      version: 1,
      scenario,
      overrides,
      actuals,
      savedAt: Date.now(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `operating-model-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [scenario, overrides, actuals])

  const handleImport = useCallback((file: File) => {
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as Partial<Persisted>
        if (!parsed || parsed.version !== 1) throw new Error("unrecognised file")
        if (parsed.scenario && parsed.scenario in SCENARIOS) setScenario(parsed.scenario)
        setOverrides(parsed.overrides ?? {})
        setActuals(parsed.actuals ?? {})
        setNotice("Imported.")
      })
      .catch(() => setNotice("That file isn't an export of this model."))
  }, [])

  const handleReset = useCallback(() => {
    setOverrides({})
    setActuals({})
    setScenario("base")
    setNotice("Reset to the shipped assumptions.")
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const savedLabel = !hydrated
    ? ""
    : savedAt
      ? `Saved to this browser · ${relativeTime(savedAt)}`
      : "Nothing saved yet"

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-gold">
          Operating model · four-site affiliate family · prepared {PREPARED_ON}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-mint sm:text-5xl">
          Can this actually make money?
        </h1>
        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground">
          A 24-month projection for Legal Leaf Market, Nicotia Market, Herbal Leaf Market and
          KawaiiKatz, built from real commission rates, real catalogue sizes, and the affiliate
          links that are actually tracking today.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full border border-gold/30 bg-white/[0.05] px-3 py-1 text-gold">
            {model.monthLabels[0]} → {model.monthLabels[model.monthLabels.length - 1]}
          </span>
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-muted-foreground">
            24 months · 8 quarters
          </span>
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-muted-foreground">
            {closedMonths > 0
              ? `Re-anchored on ${closedMonths} closed month${closedMonths === 1 ? "" : "s"}`
              : "Model recalculates from your actuals"}
          </span>
          {hydrated ? (
            <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-muted-foreground">
              {savedLabel}
            </span>
          ) : null}
        </div>
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 border-y border-gold/15 py-3 text-xs font-bold">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-muted-foreground transition hover:text-lime">
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {notice ? (
        <p className="mt-4 rounded-xl border border-lime/30 bg-lime/10 px-4 py-2 text-sm font-bold text-lime">
          {notice}
        </p>
      ) : null}

      {/* ── verdict ─────────────────────────────────────────────────────── */}
      <Section
        id="verdict"
        eyebrow="Verdict"
        title="Yes, but only one of the four is a real business, and none of it is a traffic-free bet"
      >
        <div className="max-w-3xl space-y-4 text-sm font-medium leading-relaxed text-muted-foreground">
          <p>
            Your tech is genuinely good and it is not the constraint. The constraint is that three
            of your four sites are permanently locked out of paid advertising, so every visitor has
            to be earned rather than bought. Right now you have{" "}
            <strong className="font-black text-mint">{t.indexablePages} indexable pages</strong>{" "}
            across all four domains and a large share of your outbound clicks earn $0 because the
            affiliate relationships behind them aren't wired up.
          </p>
          <p>
            Fix those two things and the base case is realistic: roughly{" "}
            <strong className="font-black text-mint">{money(models.base.totals.year1Revenue)}</strong>{" "}
            in year one,{" "}
            <strong className="font-black text-mint">{money(models.base.totals.year2Revenue)}</strong>{" "}
            in year two, exiting month 24 at about{" "}
            <strong className="font-black text-mint">
              {money(models.base.totals.month24Revenue)}/month
            </strong>
            . Don't fix them and you're in the bear column, about{" "}
            <strong className="font-black text-mint">
              {money(models.bear.totals.totalRevenue)}
            </strong>{" "}
            across two years, which is a hobby. The upside case is a genuine{" "}
            <strong className="font-black text-mint">
              {money(models.bull.totals.exitRunRate)}
            </strong>{" "}
            run-rate, and it isn't fantasy, but it requires one channel to break out rather than
            four channels to grind.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Year 1 revenue" value={money(t.year1Revenue)} sub={`${SCENARIOS[scenario].label} case`} />
          <Stat
            label="Year 2 revenue"
            value={money(t.year2Revenue)}
            sub={`${yearMultiple.toFixed(1)}× year 1`}
          />
          <Stat
            label="Exit run-rate"
            value={`${money(t.exitRunRate)}/yr`}
            sub={`${money(t.month24Revenue)} in month 24`}
          />
          <Stat
            label="Blended rev / session"
            value={`$${t.blendedRevPerSession.toFixed(3)}`}
            sub={`${money(t.blendedRevPerSession * 1000)} per 1,000`}
          />
          <Stat
            label="Sessions needed, mo 24"
            value={count(t.month24Sessions)}
            sub={`≈ ${count(Math.round(t.month24Sessions / 30))} a day`}
          />
          <Stat label="Indexable pages today" value={String(t.indexablePages)} sub="across all four domains" />
        </div>

        <p className="mt-5 max-w-3xl text-xs font-medium leading-relaxed text-muted-foreground">
          Every number on this page is computed live from the assumptions below. Change them and
          everything moves with you: monthly, quarterly, per-site and total. Enter your real Vercel
          Analytics sessions and your real affiliate statements in the monthly tables and the
          forward projection re-anchors to what is actually happening.
        </p>
      </Section>

      {/* ── the three facts ─────────────────────────────────────────────── */}
      <Section id="facts" eyebrow="The three facts" title="What actually decides the outcome">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FACTS.map((fact) => (
            <Card key={fact.title} className="p-5">
              <p className="text-[0.65rem] font-black uppercase tracking-widest text-gold">
                {fact.tag}
              </p>
              <h3 className="mt-2 text-lg font-black leading-snug text-mint">{fact.title}</h3>
              <p className="mt-2.5 text-sm font-medium leading-relaxed text-muted-foreground">
                {fact.body}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── unit economics ──────────────────────────────────────────────── */}
      <Section
        id="engine"
        eyebrow="Engine · edit any cell"
        title="Unit economics: the number that governs everything"
        intro="An affiliate site's whole economy compresses into one figure: revenue per session. It is basket size × commission rate × the share of visitors who complete a purchase × the share of those purchases you actually get credited for. Everything else is traffic."
      >
        <UnitEconomicsTable model={model} getValue={getValue} setValue={setValue} />
        <Card className="mt-4 p-5">
          <p className="text-sm font-medium leading-relaxed text-muted-foreground">
            <strong className="font-black text-mint">The strategic read.</strong> Legal Leaf earns
            roughly{" "}
            <strong className="font-black text-mint">{legalMultiple.toFixed(1)}×</strong> what
            Nicotia or KawaiiKatz earn from the same visitor. In this scenario it produces{" "}
            <strong className="font-black text-mint">{legalRevShare.toFixed(0)}%</strong> of all
            revenue on <strong className="font-black text-mint">{legalSessionShare.toFixed(0)}%</strong>{" "}
            of all sessions. If your effort is finite, and it is, it belongs on Legal Leaf. And note
            what the KawaiiKatz row means: at{" "}
            <strong className="font-black text-mint">
              ${model.sites.kawaii.maturityRevPerSession.toFixed(3)}
            </strong>{" "}
            per session, a paid click would have to cost less than that to break even, against real
            Meta and Pinterest CPCs of 30¢–$1.50. KawaiiKatz cannot be bought into profitability at
            its current take rate. It needs higher-rate vendors, its own margin, or organic only.
          </p>
        </Card>
      </Section>

      {/* ── controls ────────────────────────────────────────────────────── */}
      <Section id="controls" eyebrow="Controls" title="Scenario and assumptions">
        <ScenarioPicker scenario={scenario} onChange={setScenario} />
        <div className="mt-6">
          <DataActions
            onExport={handleExport}
            onImport={handleImport}
            onReset={handleReset}
            savedLabel={savedLabel}
          />
        </div>
        <div className="mt-5">
          <AssumptionsPanel getValue={getValue} setValue={setValue} />
        </div>
      </Section>

      {/* ── trajectory ──────────────────────────────────────────────────── */}
      <Section
        id="trajectory"
        eyebrow="Trajectory"
        title="Monthly revenue, all four sites"
        intro={`${SCENARIOS[scenario].label} case. Stacked, so the top edge is total monthly revenue across all four sites — ${money(t.month24Revenue)} in ${model.monthLabels[23]}. Legal Leaf is the bottom band.`}
      >
        <RevenueChart model={model} />
      </Section>

      {/* ── summary ─────────────────────────────────────────────────────── */}
      <Section id="summary" eyebrow="Summary" title="By site, and in total">
        <SummaryTable model={model} />
      </Section>

      {/* ── quarterly ───────────────────────────────────────────────────── */}
      <Section id="quarterly" eyebrow="Quarterly" title="Eight quarters, by site">
        <div className="space-y-8">
          {model.order.map((key) => (
            <div key={key}>
              <p className="mb-3 text-sm font-bold text-mint">
                {model.sites[key].profile.name}
                <span className="ml-2 font-medium text-muted-foreground">quarterly</span>
              </p>
              <QuarterlyTable site={model.sites[key]} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── monthly ─────────────────────────────────────────────────────── */}
      <Section
        id="monthly"
        eyebrow="Monthly"
        title="Month by month, and where you enter actuals"
        intro="The two shaded columns in each table are yours. Enter real sessions and real earned commission for any month that has closed. As soon as a month has both, the model stops guessing about that month and re-anchors everything after it: forward traffic is scaled by how you are actually tracking against plan, and forward revenue per session is re-based on what you are genuinely earning per visitor while keeping the modelled improvement curve. Your entries save to this browser automatically."
      >
        <div className="space-y-8">
          {model.order.map((key) => (
            <div key={key}>
              <p className="mb-3 text-sm font-bold text-mint">
                {model.sites[key].profile.name}
                <span className="ml-2 font-medium text-muted-foreground">monthly</span>
              </p>
              <MonthlyTable
                site={model.sites[key]}
                getActual={getActual}
                setActual={setActual}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── by store ────────────────────────────────────────────────────── */}
      <Section
        id="stores"
        eyebrow="By store"
        title="Which merchants carry the money, and which earn nothing today"
        intro="Revenue is not spread evenly across your vendors, and the ones with the biggest catalogues are not always the ones that pay. This is the per-store picture as of today, with tracking status taken from what has actually been verified at each merchant's checkout."
      >
        <div className="space-y-8">
          {model.order.map((key) => (
            <MerchantTable key={key} site={model.sites[key]} />
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-xs font-medium leading-relaxed text-muted-foreground">
          Share-of-revenue figures are modelled from catalogue depth, in-stock rate, basket size and
          commission rate. They are estimates of mix, not measurements. Replace them as your
          affiliate dashboards report real numbers. A merchant marked <em>earns $0</em> is one where
          clicks are being sent and no commission can be credited.
        </p>
      </Section>

      {/* ── reverse ─────────────────────────────────────────────────────── */}
      <Section
        id="reverse"
        eyebrow="Reverse"
        title="What a given income actually requires"
        intro="Run the model backwards. At the blended revenue per session above, this is the traffic each income level demands, and what that means in daily visitors across the family."
      >
        <ReverseTable model={model} />
      </Section>

      {/* ── next 90 days ────────────────────────────────────────────────── */}
      <Section id="next" eyebrow="Next" title="The ninety days that move the projection">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {NEXT_90_DAYS.map((item, i) => (
            <Card key={item.title} className="p-5">
              <p className="text-[0.65rem] font-black uppercase tracking-widest text-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-lg font-black leading-snug text-mint">{item.title}</h3>
              <p className="mt-2.5 text-sm font-medium leading-relaxed text-muted-foreground">
                {item.body}
              </p>
              <p className="mt-3 border-t border-gold/15 pt-3 text-xs font-bold text-lime">
                {item.why}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── method ──────────────────────────────────────────────────────── */}
      <Section id="method" eyebrow="Method" title="How the model works, and where it is weakest">
        <ul className="max-w-3xl space-y-3">
          {METHOD_NOTES.map((note) => (
            <li
              key={note.slice(0, 40)}
              className="border-l-2 border-gold/30 pl-4 text-sm font-medium leading-relaxed text-muted-foreground"
            >
              {note}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          {METHOD_FOOTNOTE}
        </p>
        <footer className="mt-8 border-t border-gold/15 pt-5 text-xs font-medium leading-relaxed text-muted-foreground">
          <p>
            Built {PREPARED_ON} · sitemap counts measured live from the four production domains on
            that date.
          </p>
          <p className="mt-1.5">
            Market rates from published affiliate programme terms and 2026 industry benchmarks;
            platform advertising policies from Google, Meta and TikTok published standards.
          </p>
          <p className="mt-1.5">
            Projections are estimates under stated assumptions, not forecasts or guarantees. This is
            a planning tool for your own business, not investment advice.
          </p>
        </footer>
      </Section>
    </div>
  )
}
