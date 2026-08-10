"use client"

import { useMemo, useState } from "react"
import {
  MASTER_VENDOR_SITES,
  isEarningToday,
  optimisticRate,
  vendorTotals,
  type MasterVendorRow,
} from "@/lib/admin/master-vendors"

/**
 * The master vendor table: every merchant on all five sites, with the rate each
 * one actually pays.
 *
 * The "assume every pending programme is approved" toggle is the whole point of
 * the page. Without it the table answers "what earns today", which is already
 * on each site's own admin page. With it, the table answers the question worth
 * planning against: if every application in flight comes through, what is the
 * book of business? Those are different numbers and the difference is the work
 * still outstanding.
 */

function statusPill(status: MasterVendorRow["status"]) {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold"
  if (status === "tracking")
    return <span className={`${base} bg-emerald-500/15 text-emerald-400`}>tracking</span>
  if (status === "partial")
    return <span className={`${base} bg-amber-500/15 text-amber-400`}>partial</span>
  if (status === "pending")
    return <span className={`${base} bg-amber-500/15 text-amber-400`}>pending</span>
  if (status === "unconfirmed")
    return <span className={`${base} bg-amber-500/15 text-amber-400`}>unconfirmed</span>
  if (status === "paused")
    return (
      <span className={`${base} bg-[var(--secondary)] text-[var(--muted-foreground)]`}>paused</span>
    )
  return <span className={`${base} bg-red-500/15 text-red-400`}>earns $0</span>
}

function rateCell(row: MasterVendorRow, optimistic: boolean) {
  const live = row.ratePct
  const assumed = optimisticRate(row)

  if (optimistic && assumed === null) {
    return <span className="text-[var(--muted-foreground)]">no rate on record</span>
  }
  if (optimistic && !isEarningToday(row) && assumed !== null) {
    return (
      <span className="font-semibold text-[var(--gold)]">
        {assumed}%
        <span className="ml-1 text-[10px] font-normal text-[var(--muted-foreground)]">assumed</span>
      </span>
    )
  }
  if (live === null) return <span className="text-[var(--muted-foreground)]">–</span>
  return <span className="font-semibold text-[var(--cream)]">{live}%</span>
}

export function MasterVendorTable() {
  const [optimistic, setOptimistic] = useState(false)

  const family = useMemo(() => {
    const rows = MASTER_VENDOR_SITES.flatMap((s) => s.rows)
    return vendorTotals(rows)
  }, [])

  return (
    <section id="vendors" className="admin-section">
      <p className="eyebrow">Master table</p>
      <h2>Every vendor on every site, and what it pays</h2>
      <p className="intro">
        All {family.total} merchant relationships across the five sites in one place.
        {" "}
        {family.earningToday} of them are attributing money today. {family.approvableWithRate} have a
        rate on record but are not earning yet, which is the work outstanding.{" "}
        {family.rateUnknown} have no rate recorded anywhere in the five codebases.
      </p>
      <p className="intro">
        The sister sites&apos; rates are transcribed from Legal Leaf&apos;s own admin engine, which
        is the source Gear Avail&apos;s model was ported from. Gear Avail&apos;s rows are read live
        from its own reference data, so this table cannot drift from the page next door.{" "}
        <strong className="text-[var(--cream)]">
          Nothing here is estimated: a merchant with no published rate on record is shown as
          unknown rather than given a plausible number.
        </strong>
      </p>

      <div className="section-body">
        <label className="mb-4 inline-flex cursor-pointer items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--chip)] px-4 py-2">
          <input
            type="checkbox"
            checked={optimistic}
            onChange={(e) => setOptimistic(e.target.checked)}
            className="h-4 w-4 accent-[var(--sage)]"
          />
          <span className="text-sm font-semibold text-[var(--cream)]">
            Assume every pending programme is approved
          </span>
        </label>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Vendors, all sites" value={String(family.total)} sub="five sites combined" />
          <Stat
            label="Earning today"
            value={String(family.earningToday)}
            sub={`${Math.round((family.earningToday / family.total) * 100)}% of the book`}
          />
          <Stat
            label="Mean rate on record"
            value={family.meanRatePct === null ? "–" : `${family.meanRatePct.toFixed(1)}%`}
            sub="unweighted, rates on record only"
          />
          <Stat
            label="Mean if all approved"
            value={
              family.meanRateIfAllApprovedPct === null
                ? "–"
                : `${family.meanRateIfAllApprovedPct.toFixed(1)}%`
            }
            sub={`${family.rateUnknown} still unknown`}
          />
        </div>

        {MASTER_VENDOR_SITES.map((site) => {
          const t = vendorTotals(site.rows)
          return (
            <div key={site.key} className="mb-8">
              <p className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="font-display text-lg font-black tracking-[-0.01em]"
                  style={{ color: site.color }}
                >
                  {site.name}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {site.domain} · {t.total} vendors · {t.earningToday} earning today
                  {t.rateUnknown > 0 && ` · ${t.rateUnknown} with no rate on record`}
                </span>
              </p>
              <div className="table-wrap">
                <table className="model-table">
                  <thead>
                    <tr>
                      <th className="text-left">Vendor</th>
                      <th className="text-left">Platform / network</th>
                      <th className="text-right">Rate</th>
                      <th className="text-left">Status</th>
                      <th className="text-right">Share of site</th>
                      <th className="text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {site.rows.map((row) => (
                      <tr key={`${site.key}-${row.merchant}`}>
                        <td className="font-semibold text-[var(--cream)]">{row.merchant}</td>
                        <td className="text-[var(--muted-foreground)]">{row.platform}</td>
                        <td className="text-right">{rateCell(row, optimistic)}</td>
                        <td>{statusPill(row.status)}</td>
                        <td className="text-right text-[var(--muted-foreground)]">
                          {row.sharePct === null ? "–" : `${row.sharePct}%`}
                        </td>
                        <td className="max-w-[34ch] whitespace-normal text-xs text-[var(--muted-foreground)]">
                          {row.note || "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        <p className="table-caption">
          Share of site is modelled from catalogue depth, in-stock rate, basket and rate: an
          estimate of mix, not a measurement. Gear Avail shows no share because it models depth by
          real ingested catalogue count instead, which is on its own page. KawaiiKatz is the one
          place two sources disagree, and both are kept: its own repo records the rates its
          programmes advertise (10 to 25% across nine vendors), while the admin figures record what
          is actually wired up and attributing. A 20% rate with no affiliate ID in the code earns
          20% of nothing, so the admin view is the one used for revenue.
        </p>
      </div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--dim)]">{label}</p>
      <p className="mt-1 font-display text-2xl font-black text-[var(--cream)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</p>
    </div>
  )
}
