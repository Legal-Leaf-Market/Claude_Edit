"use client"

import type { ModelResult, SiteAssumptions, SiteKey, SiteProjection } from "@/lib/operating-model"
import { count, money, signedPercent } from "@/lib/operating-model"
import {
  attributableShare,
  INCOME_TARGETS,
  MERCHANTS,
  type MerchantRow,
} from "@/lib/operating-model-data"
import { NumberInput, Pill, Swatch, TableShell, Td, Th } from "@/components/admin/model-ui"

const rps = (n: number) => `$${n.toFixed(3)}`

// ── unit economics ──────────────────────────────────────────────────────────

export function UnitEconomicsTable({
  model,
  getValue,
  setValue,
}: {
  model: ModelResult
  getValue: (site: SiteKey, field: keyof SiteAssumptions) => number
  setValue: (site: SiteKey, field: keyof SiteAssumptions, next: number | null) => void
}) {
  return (
    <TableShell caption="Sources for the rates: hemp and CBD affiliate programmes commonly run 15–40% (a blended 15–17% is prudent given several of yours are coupon-code arrangements at 10%); nicotine programmes cluster at 8–15% with 10% the mode; anime and kawaii merchandise runs 5–20% with 8–10% typical. Ecommerce affiliate conversion benchmarks sit at 1–3% of sessions, average affiliate AOV $125. Comparison-shopper intent is high, which is why the model sits in the upper half of that band. It is also the single most sensitive input here.">
      <thead>
        <tr>
          <Th>Site</Th>
          <Th align="right">Basket</Th>
          <Th align="right">Commission</Th>
          <Th align="right">Conversion</Th>
          <Th align="right">
            Attribution
            <span className="block font-medium normal-case tracking-normal text-muted-foreground">
              at maturity
            </span>
          </Th>
          <Th align="right">
            Revenue per
            <span className="block font-medium normal-case tracking-normal text-muted-foreground">
              session
            </span>
          </Th>
          <Th align="right">Per 1,000</Th>
          <Th align="right">
            Indexable
            <span className="block font-medium normal-case tracking-normal text-muted-foreground">
              pages today
            </span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {model.order.map((key) => {
          const site = model.sites[key]
          return (
            <tr key={key} className="transition hover:bg-white/[0.03]">
              <Td>
                <span className="flex items-center gap-2 font-bold text-mint">
                  <Swatch color={site.profile.color} />
                  {site.profile.shortName}
                </span>
              </Td>
              <Td align="right">
                <NumberInput
                  label={`${site.profile.shortName} basket`}
                  prefix="$"
                  step={1}
                  value={getValue(key, "basket")}
                  onChange={(v) => setValue(key, "basket", v)}
                  className="ml-auto w-24"
                />
              </Td>
              <Td align="right">
                <NumberInput
                  label={`${site.profile.shortName} commission percent`}
                  suffix="%"
                  step={0.5}
                  value={getValue(key, "commissionPct")}
                  onChange={(v) => setValue(key, "commissionPct", v)}
                  className="ml-auto w-24"
                />
              </Td>
              <Td align="right">
                <NumberInput
                  label={`${site.profile.shortName} conversion percent`}
                  suffix="%"
                  step={0.05}
                  value={getValue(key, "conversionPct")}
                  onChange={(v) => setValue(key, "conversionPct", v)}
                  className="ml-auto w-24"
                />
              </Td>
              <Td align="right">
                <NumberInput
                  label={`${site.profile.shortName} attribution at month 24`}
                  suffix="%"
                  step={1}
                  max={100}
                  value={getValue(key, "attributionExitPct")}
                  onChange={(v) => setValue(key, "attributionExitPct", v)}
                  className="ml-auto w-24"
                />
              </Td>
              <Td align="right" numeric className="font-black text-mint">
                {rps(site.maturityRevPerSession)}
              </Td>
              <Td align="right" numeric>
                {money(site.maturityRevPerSession * 1000)}
              </Td>
              <Td align="right" numeric>
                {site.profile.indexablePages}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

// ── summary ─────────────────────────────────────────────────────────────────

export function SummaryTable({ model }: { model: ModelResult }) {
  const t = model.totals
  return (
    <TableShell caption="Exit run-rate is month 24 annualised — the number that matters if you ever want to sell one of these. Content sites in stable niches trade at roughly 30–40× monthly profit; restricted-category sites trade lower because the buyer inherits the same advertising ban. Commissions also pay on a lag: most programmes hold 30–60 days against refunds and require $50–$100 minimums, so cash arrives one to two months behind the revenue shown here.">
      <thead>
        <tr>
          <Th>Site</Th>
          <Th align="right">Year 1</Th>
          <Th align="right">Year 2</Th>
          <Th align="right">24-month total</Th>
          <Th align="right">Month 24</Th>
          <Th align="right">Exit run-rate</Th>
          <Th align="right">Sessions, mo 24</Th>
          <Th align="right">Share of revenue</Th>
        </tr>
      </thead>
      <tbody>
        {model.order.map((key) => {
          const s = model.sites[key]
          const share = t.totalRevenue > 0 ? (s.totalRevenue / t.totalRevenue) * 100 : 0
          return (
            <tr key={key} className="transition hover:bg-white/[0.03]">
              <Td>
                <span className="flex items-center gap-2 font-bold text-mint">
                  <Swatch color={s.profile.color} />
                  {s.profile.shortName}
                </span>
              </Td>
              <Td align="right" numeric>{money(s.year1Revenue)}</Td>
              <Td align="right" numeric>{money(s.year2Revenue)}</Td>
              <Td align="right" numeric className="font-bold text-mint">{money(s.totalRevenue)}</Td>
              <Td align="right" numeric>{money(s.month24Revenue)}</Td>
              <Td align="right" numeric>{money(s.exitRunRate)}</Td>
              <Td align="right" numeric>{count(s.month24Sessions)}</Td>
              <Td align="right" numeric>{share.toFixed(0)}%</Td>
            </tr>
          )
        })}
        <tr className="bg-white/[0.05]">
          <Td className="font-black text-gold">All four</Td>
          <Td align="right" numeric className="font-black text-mint">{money(t.year1Revenue)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(t.year2Revenue)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(t.totalRevenue)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(t.month24Revenue)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(t.exitRunRate)}</Td>
          <Td align="right" numeric className="font-black text-mint">{count(t.month24Sessions)}</Td>
          <Td align="right" numeric className="font-black text-mint">100%</Td>
        </tr>
      </tbody>
    </TableShell>
  )
}

// ── quarterly ───────────────────────────────────────────────────────────────

export function QuarterlyTable({ site }: { site: SiteProjection }) {
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Quarter</Th>
          <Th>Months</Th>
          <Th align="right">Sessions</Th>
          <Th align="right">Orders</Th>
          <Th align="right">Merchant GMV</Th>
          <Th align="right">Your revenue</Th>
          <Th align="right">Rev / session</Th>
          <Th align="right">vs prior Q</Th>
        </tr>
      </thead>
      <tbody>
        {site.quarters.map((q) => (
          <tr key={q.label} className="transition hover:bg-white/[0.03]">
            <Td className="font-bold text-mint">{q.label}</Td>
            <Td className="text-muted-foreground">{q.monthsLabel}</Td>
            <Td align="right" numeric>{count(q.sessions)}</Td>
            <Td align="right" numeric>{count(Math.round(q.orders))}</Td>
            <Td align="right" numeric>{money(q.gmv)}</Td>
            <Td align="right" numeric className="font-bold text-mint">{money(q.revenue)}</Td>
            <Td align="right" numeric>{rps(q.revPerSession)}</Td>
            <Td align="right" numeric className={q.changeVsPriorPct === null ? "text-muted-foreground" : "text-lime"}>
              {q.changeVsPriorPct === null ? "–" : signedPercent(q.changeVsPriorPct)}
            </Td>
          </tr>
        ))}
        <tr className="bg-white/[0.05]">
          <Td className="font-black text-gold">Total</Td>
          <Td className="text-muted-foreground">24 months</Td>
          <Td align="right" numeric className="font-black text-mint">{count(site.totalSessions)}</Td>
          <Td align="right" numeric className="font-black text-mint">{count(Math.round(site.totalOrders))}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(site.totalGmv)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(site.totalRevenue)}</Td>
          <Td align="right" numeric className="font-black text-mint">
            {rps(site.totalSessions > 0 ? site.totalRevenue / site.totalSessions : 0)}
          </Td>
          <Td align="right" className="text-muted-foreground">–</Td>
        </tr>
      </tbody>
    </TableShell>
  )
}

// ── monthly, with the two actuals columns ───────────────────────────────────

export function MonthlyTable({
  site,
  getActual,
  setActual,
}: {
  site: SiteProjection
  getActual: (site: SiteKey, month: number, field: "sessions" | "revenue") => number | null
  setActual: (
    site: SiteKey,
    month: number,
    field: "sessions" | "revenue",
    next: number | null,
  ) => void
}) {
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Month</Th>
          <Th align="right">Sessions</Th>
          <Th align="right">Rev/sess</Th>
          <Th align="right">Orders</Th>
          <Th align="right">GMV</Th>
          <Th align="right">Revenue</Th>
          <Th align="right" className="bg-lime/[0.07]">Actual sessions</Th>
          <Th align="right" className="bg-lime/[0.07]">Actual revenue</Th>
          <Th align="right">Variance</Th>
        </tr>
      </thead>
      <tbody>
        {site.months.map((m) => (
          <tr
            key={m.index}
            className={
              m.isActual
                ? "bg-lime/[0.04] transition hover:bg-lime/[0.07]"
                : "transition hover:bg-white/[0.03]"
            }
          >
            <Td className="font-bold text-mint">
              {m.label}
              {m.isActual ? (
                <span className="ml-2 align-middle text-[0.6rem] font-black uppercase tracking-wider text-lime">
                  actual
                </span>
              ) : null}
            </Td>
            <Td align="right" numeric>{count(m.sessions)}</Td>
            <Td align="right" numeric>{rps(m.revPerSession)}</Td>
            <Td align="right" numeric>{m.orders.toFixed(1)}</Td>
            <Td align="right" numeric>{money(m.gmv)}</Td>
            <Td align="right" numeric className="font-bold text-mint">{money(m.revenue)}</Td>
            <Td align="right" className="bg-lime/[0.04]">
              <NumberInput
                tone="actual"
                label={`${site.profile.shortName} actual sessions for ${m.label}`}
                placeholder="–"
                step={1}
                value={getActual(site.key, m.index, "sessions")}
                onChange={(v) => setActual(site.key, m.index, "sessions", v)}
                className="ml-auto w-28"
              />
            </Td>
            <Td align="right" className="bg-lime/[0.04]">
              <NumberInput
                tone="actual"
                label={`${site.profile.shortName} actual revenue for ${m.label}`}
                placeholder="–"
                prefix="$"
                step={1}
                value={getActual(site.key, m.index, "revenue")}
                onChange={(v) => setActual(site.key, m.index, "revenue", v)}
                className="ml-auto w-28"
              />
            </Td>
            <Td
              align="right"
              numeric
              className={
                m.revenueVariancePct === null
                  ? "text-muted-foreground"
                  : m.revenueVariancePct >= 0
                    ? "text-lime"
                    : "text-destructive"
              }
            >
              {m.revenueVariancePct === null ? "–" : signedPercent(m.revenueVariancePct)}
              {m.sessionsVariancePct !== null ? (
                <span className="block text-[0.65rem] font-medium text-muted-foreground">
                  {signedPercent(m.sessionsVariancePct)} sessions
                </span>
              ) : null}
            </Td>
          </tr>
        ))}
        <tr className="bg-white/[0.05]">
          <Td className="font-black text-gold">24-month total</Td>
          <Td align="right" numeric className="font-black text-mint">{count(site.totalSessions)}</Td>
          <Td align="right" numeric className="font-black text-mint">
            {rps(site.totalSessions > 0 ? site.totalRevenue / site.totalSessions : 0)}
          </Td>
          <Td align="right" numeric className="font-black text-mint">{count(Math.round(site.totalOrders))}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(site.totalGmv)}</Td>
          <Td align="right" numeric className="font-black text-mint">{money(site.totalRevenue)}</Td>
          <Td align="right" className="bg-lime/[0.04]" />
          <Td align="right" className="bg-lime/[0.04]" />
          <Td align="right" />
        </tr>
      </tbody>
    </TableShell>
  )
}

// ── merchants ───────────────────────────────────────────────────────────────

function statusPill(status: MerchantRow["status"]) {
  if (status === "tracking") return <Pill tone="good">tracking</Pill>
  if (status === "partial") return <Pill tone="warn">partial</Pill>
  return <Pill tone="bad">earns $0</Pill>
}

export function MerchantTable({ site }: { site: SiteProjection }) {
  const rows = MERCHANTS[site.key]
  const attributable = attributableShare(site.key)
  const dead = rows.filter((r) => r.status === "none").length
  return (
    <div>
      <p className="mb-3 text-sm font-bold text-mint">
        {site.profile.name}
        <span className="ml-2 font-medium text-muted-foreground">
          {rows.length} merchant rows · {dead} earning nothing today
        </span>
      </p>
      <TableShell>
        <thead>
          <tr>
            <Th>Merchant</Th>
            <Th>Platform / network</Th>
            <Th align="right">Rate</Th>
            <Th>Status</Th>
            <Th align="right">Share of site revenue</Th>
            <Th align="right">Year-2 revenue</Th>
            <Th>Note</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.merchant} className="transition hover:bg-white/[0.03]">
              <Td className="font-bold text-mint">{r.merchant}</Td>
              <Td className="text-muted-foreground">{r.platform}</Td>
              <Td align="right" numeric>{r.ratePct === null ? "–" : `${r.ratePct}%`}</Td>
              <Td>{statusPill(r.status)}</Td>
              <Td align="right" numeric>{r.sharePct}%</Td>
              <Td align="right" numeric className={r.status === "none" ? "text-muted-foreground" : "font-bold text-mint"}>
                {money((r.sharePct / 100) * site.year2Revenue)}
              </Td>
              <Td className="max-w-[22rem] whitespace-normal text-xs text-muted-foreground">
                {r.note}
              </Td>
            </tr>
          ))}
          <tr className="bg-white/[0.05]">
            <Td className="font-black text-gold">Attributable today</Td>
            <Td />
            <Td />
            <Td />
            <Td align="right" numeric className="font-black text-mint">{attributable}%</Td>
            <Td align="right" numeric className="font-black text-mint">
              {money((attributable / 100) * site.year2Revenue)}
            </Td>
            <Td className="text-xs text-muted-foreground">
              {100 - attributable}% of clicks currently uncredited
            </Td>
          </tr>
        </tbody>
      </TableShell>
    </div>
  )
}

// ── reverse lookup ──────────────────────────────────────────────────────────

export function ReverseTable({ model }: { model: ModelResult }) {
  const blended = model.totals.blendedRevPerSession
  const legal = model.sites.legal
  const legalRps =
    legal.month24Sessions > 0 ? legal.month24Revenue / legal.month24Sessions : 0

  return (
    <TableShell caption="The second column is the honest one. Legal Leaf alone needs far less traffic than the family average to hit the same number, because it earns several times more per visitor. That asymmetry is the entire argument for where your next hundred hours should go.">
      <thead>
        <tr>
          <Th>Monthly income</Th>
          <Th align="right">
            Sessions / month
            <span className="block font-medium normal-case tracking-normal text-muted-foreground">
              at blended economics
            </span>
          </Th>
          <Th align="right">Sessions / day</Th>
          <Th align="right">If it were all Legal Leaf</Th>
          <Th align="right">Legal Leaf sessions / day</Th>
          <Th align="right">Annualised</Th>
        </tr>
      </thead>
      <tbody>
        {INCOME_TARGETS.map((income) => {
          const sessions = blended > 0 ? income / blended : 0
          const legalSessions = legalRps > 0 ? income / legalRps : 0
          return (
            <tr key={income} className="transition hover:bg-white/[0.03]">
              <Td className="font-bold text-mint">
                {money(income)}
                {income === 8333 ? (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">($100k/yr)</span>
                ) : null}
              </Td>
              <Td align="right" numeric className="font-bold text-mint">{count(Math.round(sessions))}</Td>
              <Td align="right" numeric>{count(Math.round(sessions / 30))}</Td>
              <Td align="right" numeric>{count(Math.round(legalSessions))}</Td>
              <Td align="right" numeric>{count(Math.round(legalSessions / 30))}</Td>
              <Td align="right" numeric>{money(income * 12)}</Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}
