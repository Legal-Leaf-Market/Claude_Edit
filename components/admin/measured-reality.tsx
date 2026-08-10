import {
  WEB_SOURCE,
  WEB_MEASURED,
  SOCIAL_SOURCE,
  SOCIAL_WEEKS,
  REANCHOR_TEST,
  ASSUMED_MERCHANT_CONVERSION_PCT,
  BACKLOG,
  NOTIONAL_RATE_USD,
  TIMESHEET,
  TIME_CATEGORY_LABEL,
  UNLOGGED_PRIOR_WORK,
  WEEKS_LOGGED,
  AVAILABILITY,
  FIRST_DRAW_YEAR,
  FULL_TIME,
  YEAR_3_PROJECTION,
  availableHoursPerWeek,
  fullTimeHourly,
  fullTimeHoursPerMonth,
  breakeven,
  budgetOutlook,
  discountedByFunnel,
  funnelCalibration,
  hoursFor,
  hoursPerWeekTotal,
  optimismRange,
  payoutPerOrder,
  people,
  rdInvestmentUsd,
  type TimeCategory,
} from "@/lib/admin/measured"
import { SISTER_SITE_PROFILES } from "@/lib/admin/sister-sites"
import { money, count } from "@/lib/admin/engine"

/**
 * The measured-reality panel: the only page in this admin that is evidence
 * rather than assumption.
 *
 * It sits last on purpose. Everything above it is a projection, and this is the
 * section that says how far the one real funnel is from those projections.
 */

const legal = SISTER_SITE_PROFILES.find((p) => p.key === "legal")!.assumptions
const PAYOUT_NOW = payoutPerOrder(legal.basket, legal.commissionPct, legal.attributionNowPct)
const PAYOUT_EXIT = payoutPerOrder(legal.basket, legal.commissionPct, legal.attributionExitPct)
const HOURLY_TARGETS = [1, 5, 15, 25]
const CATEGORIES = Object.keys(TIME_CATEGORY_LABEL) as TimeCategory[]
const OUTLOOK = budgetOutlook()

export function MeasuredReality() {
  const c = funnelCalibration()
  const opt = optimismRange(legal.conversionPct)

  return (
    <section id="measured" className="admin-section">
      <p className="eyebrow">Measured</p>
      <h2>What is actually happening, as opposed to projected</h2>
      <p className="intro">
        Every other number in this admin is an assumption. These are observations.{" "}
        <strong className="text-[var(--cream)]">
          All of them come from legal-leafmarket.com, which was the first of the five sites and is
          the one proving the model.
        </strong>{" "}
        Gear Avail launched the day this was written, so it has no history of its own yet and none of
        this is entered as its actuals.
      </p>

      <div className="section-body">
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Visitors, 30 days" value={count(WEB_MEASURED.visitors)} sub={`${count(WEB_MEASURED.pageViews)} page views`} />
          <Stat label="Reached a merchant" value={`${c.outboundClickRatePct.toFixed(1)}%`} sub={`${c.outboundClickers} of ${c.visitors} visitors`} />
          <Stat label="Confirmed revenue" value="$0" sub="41 outbound clicks, nothing paid yet" />
          <Stat label="Hours invested" value={`${hoursFor()}`} sub={`5 sites live in ${WEEKS_LOGGED} weeks, ${hoursPerWeekTotal()} h/week`} />
        </div>

        <h3 className="mb-1 font-display text-lg font-black text-[var(--cream)]">The funnel, and where it breaks</h3>
        <p className="table-caption mb-3 mt-0">
          {WEB_SOURCE.source}. {WEB_SOURCE.window}. {WEB_SOURCE.note}
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Step</th>
                <th className="text-right">Visitors</th>
                <th className="text-right">Share of traffic</th>
                <th className="text-left">Reading</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold text-[var(--cream)]">Arrived</td>
                <td className="text-right">{count(WEB_MEASURED.visitors)}</td>
                <td className="text-right">100%</td>
                <td className="text-xs text-[var(--muted-foreground)]">{WEB_MEASURED.bouncePct}% bounced</td>
              </tr>
              <tr>
                <td className="font-semibold text-[var(--cream)]">Landed on /</td>
                <td className="text-right">{count(330)}</td>
                <td className="text-right">97.6%</td>
                <td className="text-xs text-[var(--muted-foreground)]">
                  Only {27 + 23 + 19} reached a category page, so roughly 92% never got past the homepage
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-[var(--cream)]">Reached a merchant</td>
                <td className="text-right text-[var(--red)]">{c.outboundClickers}</td>
                <td className="text-right text-[var(--red)]">{c.outboundClickRatePct.toFixed(1)}%</td>
                <td className="text-xs text-[var(--muted-foreground)]">
                  {c.outboundClicks} clicks from {c.outboundClickers} people, about 6 each: a few engaged
                  users, not a flow
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-[var(--cream)]">Bought something</td>
                <td className="text-right">unknown</td>
                <td className="text-right">–</td>
                <td className="text-xs text-[var(--muted-foreground)]">
                  Estimated {c.ordersPerPersonBasis.toFixed(2)} to {c.ordersPerClickBasis.toFixed(2)} orders at an
                  assumed {ASSUMED_MERCHANT_CONVERSION_PCT}% merchant conversion
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          This is the finding that matters. Legal Leaf assumes{" "}
          <strong className="text-[var(--cream)]">{legal.conversionPct}% of visitors buy</strong>, which on{" "}
          {c.visitors} visitors is {((c.visitors * legal.conversionPct) / 100).toFixed(1)} orders. But only{" "}
          {c.outboundClickers} visitors reached a merchant at all, so that would need most of them to
          purchase. The assumption is optimistic by roughly{" "}
          <strong className="text-[var(--cream)]">{opt.low.toFixed(1)}x to {opt.high.toFixed(1)}x</strong>{" "}
          depending on whether each merchant visit counts as its own chance to buy or a person is
          capped at one order. Traffic is not the problem: normalised for three live weeks the
          run-rate is roughly 500 a month against a 600 assumption.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">Instagram, and one broken metric</h3>
        <p className="table-caption mb-3 mt-0">{SOCIAL_SOURCE.source}. {SOCIAL_SOURCE.window}.</p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Week</th>
                <th className="text-right">Views</th>
                <th className="text-right">Reach</th>
                <th className="text-right">Interactions</th>
                <th className="text-right">Follows</th>
                <th className="text-right">Link clicks</th>
              </tr>
            </thead>
            <tbody>
              {SOCIAL_WEEKS.map((w) => (
                <tr key={w.week}>
                  <td className="font-semibold text-[var(--cream)]">{w.week}</td>
                  <td className="text-right">{count(w.views)}</td>
                  <td className="text-right">{count(w.reach)}</td>
                  <td className="text-right">{count(w.interactions)}</td>
                  <td className="text-right text-[var(--sage)]">{count(w.follows)}</td>
                  <td className="text-right text-[var(--muted-foreground)]">{w.linkClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          Week three is a real breakout: views up 5.4x, interactions 6.3x, follows 5.2x, and 332
          follows across the three weeks.{" "}
          <strong className="text-[var(--cream)]">The link-clicks column is wrong, not zero.</strong>{" "}
          Meta reported none for all three weeks while Vercel logged 80 visitors from
          l.instagram.com, its bio-link shim, in the overlapping window. Instagram is the single
          largest referrer to the site. Facebook reported 0 views and 0 reach throughout, yet still
          referred 24 visitors, so it is mismeasured too rather than merely dormant. Trust the
          server-side numbers.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">
          What a real month does to the projection
        </h3>
        <p className="table-caption mb-3 mt-0">
          Legal Leaf&apos;s base case models month 1 ({REANCHOR_TEST.modelledMonth1.label}) at{" "}
          {count(REANCHOR_TEST.modelledMonth1.sessions)} sessions and{" "}
          {money(REANCHOR_TEST.modelledMonth1.revenue)}. Measured:{" "}
          {count(REANCHOR_TEST.measuredMonth1.visitors)} visitors and no confirmed commission. Each
          row below holds sessions at the measured figure and varies only the revenue entered.
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Revenue entered</th>
                <th className="text-right">24-month total</th>
                <th className="text-right">10-year total</th>
                <th className="text-right">Traffic index</th>
                <th className="text-right">Yield index</th>
              </tr>
            </thead>
            <tbody>
              {REANCHOR_TEST.rows.map((r) => (
                <tr key={r.entered}>
                  <td className="font-semibold text-[var(--cream)]">
                    {money(r.entered)}{" "}
                    <span className="font-normal text-[var(--muted-foreground)]">({r.label})</span>
                  </td>
                  <td className="text-right">{money(r.total24)}</td>
                  <td className="text-right">{money(r.total120)}</td>
                  <td className="text-right">{r.trafficIndex.toFixed(3)}</td>
                  <td className={`text-right ${r.yieldIndex === 1 ? "text-[var(--red)]" : ""}`}>
                    {r.yieldIndex.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          <strong className="text-[var(--cream)]">
            Entering the truth forecasts more than entering a sale.
          </strong>{" "}
          A $0 month leaves the yield index at exactly 1.000, because applyActuals guards it behind
          actualRps &gt; 0 and reads &quot;earned nothing&quot; as &quot;no information about
          yield&quot;. The optimistic {money(REANCHOR_TEST.modelledMonth1.revPerSession)} per session
          survives and the ten-year total lands at {money(295183)}, above the {money(68032)} a single
          real order produces. That guard is defensible rather than a bug: programmes hold 30 to 60
          days against refunds and require $50 to $100 minimums, so $0 in month 1 is expected even
          when sales happened. The model cannot tell &quot;nobody bought&quot; from &quot;nobody has
          paid us yet&quot;, which is the argument for recording outbound clicks as a first-class
          actual. A click is visible the day it happens and waits on no payout cycle.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">Timesheets</h3>
        <p className="table-caption mb-3 mt-0">
          {WEEKS_LOGGED} weeks to 10 Aug 2026. Categories stay separate because they are not the same
          kind of hour, and development has to be isolated from admin and sales to be reportable as
          R&amp;D. Not logged: {UNLOGGED_PRIOR_WORK}
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Person</th>
                {CATEGORIES.map((k) => (
                  <th key={k} className="text-right">{TIME_CATEGORY_LABEL[k]}</th>
                ))}
                <th className="text-right">Total</th>
                <th className="text-right">Per week</th>
              </tr>
            </thead>
            <tbody>
              {people().map((person) => (
                <tr key={person}>
                  <td className="font-semibold text-[var(--cream)]">{person}</td>
                  {CATEGORIES.map((k) => (
                    <td key={k} className="text-right">{hoursFor({ person, category: k })} h</td>
                  ))}
                  <td className="text-right font-semibold text-[var(--cream)]">{hoursFor({ person })} h</td>
                  <td className="text-right text-[var(--muted-foreground)]">
                    {(hoursFor({ person }) / WEEKS_LOGGED).toFixed(0)} h
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Team</td>
                {CATEGORIES.map((k) => (
                  <td key={k} className="text-right">{hoursFor({ category: k })} h</td>
                ))}
                <td className="text-right text-[var(--gold)]">{hoursFor()} h</td>
                <td className="text-right text-[var(--gold)]">{hoursPerWeekTotal().toFixed(0)} h</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          Nobody is drawing anything. No money has been taken out and everything earned goes back
          in, so these hours are{" "}
          <strong className="text-[var(--cream)]">sweat equity rather than a cost</strong>: at a
          notional ${NOTIONAL_RATE_USD}/hour the development time alone represents{" "}
          {money(rdInvestmentUsd())} contributed to the business against $0 withdrawn. The rate exists
          to put a figure on the contribution, not to imply a wage owed, and nothing in the revenue
          model reads it.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">
          The time budget, and how robust it lets things get
        </h3>
        <p className="table-caption mb-3 mt-0">
          The backlog between today&apos;s funnel and a working one, priced in hours. Every item is a
          task already identified in this admin or in CLAUDE.md rather than invented to fill a table.
          What it unlocks matters more than what it costs: hours spent on something that does not move
          the funnel are indistinguishable from hours not spent.
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Work</th>
                <th className="text-right">Hours</th>
                <th className="text-left">Type</th>
                <th className="text-left">What it unlocks</th>
              </tr>
            </thead>
            <tbody>
              {BACKLOG.map((b) => (
                <tr key={b.task}>
                  <td className="font-semibold text-[var(--cream)]">{b.task}</td>
                  <td className="text-right">{b.hours} h</td>
                  <td className="text-[var(--muted-foreground)]">{TIME_CATEGORY_LABEL[b.category]}</td>
                  <td className="max-w-[46ch] whitespace-normal text-xs text-[var(--muted-foreground)]">
                    {b.unlocks}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total backlog</td>
                <td className="text-right text-[var(--gold)]">{OUTLOOK.backlogHours} h</td>
                <td colSpan={2} className="text-[var(--muted-foreground)]">
                  {OUTLOOK.weeksToClear.toFixed(1)} weeks at the {availableHoursPerWeek()} h/week
                  available going forward
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          The timesheet records a launch sprint of {hoursPerWeekTotal().toFixed(0)} hours a week, which
          is why five sites exist at all and is not a rate anyone holds for ten years. Going forward
          the declared budget is{" "}
          <strong className="text-[var(--cream)]">
            {AVAILABILITY.map((a) => `${a.person} ${a.hoursPerWeek}`).join(", ")}, {availableHoursPerWeek()} hours
            a week
          </strong>
          , and everything below is paced off that rather than off the sprint. It clears the backlog in{" "}
          {OUTLOOK.weeksToClear.toFixed(1)} weeks and, at under 40 hours, it is a commitment somebody
          can actually keep, which is the difference between a plan and a burst. The remaining
          fragility is concentration rather than volume: spend the budget first on the work that keeps
          paying with no further hours, the SEO and confirmed-link items, ahead of the content and
          outreach that stop the day someone stops.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">
          Year {FIRST_DRAW_YEAR}, the first draw
        </h3>
        <p className="table-caption mb-3 mt-0">
          No money comes out before year {FIRST_DRAW_YEAR}. So the question is not what the business
          earns now, it is what year {FIRST_DRAW_YEAR} supports at {availableHoursPerWeek()} hours a
          week ({YEAR_3_PROJECTION.hoursPerMonth} a month). The right column is the same projection
          discounted by the optimism the measured funnel implies, and it is the honest one until the
          funnel is fixed.
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Case</th>
                <th className="text-right">Year {FIRST_DRAW_YEAR} revenue</th>
                <th className="text-right">Per month</th>
                <th className="text-right">As an hourly rate</th>
                <th className="text-right">Hourly, funnel-corrected</th>
                <th className="text-right">Full time, corrected</th>
              </tr>
            </thead>
            <tbody>
              {YEAR_3_PROJECTION.cases.map((c) => {
                const d = discountedByFunnel(c.hourly, legal.conversionPct)
                return (
                  <tr key={c.scenario}>
                    <td className="font-semibold text-[var(--cream)]">{c.scenario}</td>
                    <td className="text-right">{money(c.annual)}</td>
                    <td className="text-right">{money(c.monthly)}</td>
                    <td className="text-right text-[var(--muted-foreground)]">
                      ${c.hourly.toFixed(2)}/h
                    </td>
                    <td className="text-right font-semibold text-[var(--gold)]">
                      ${d.low.toFixed(2)} to ${d.high.toFixed(2)}/h
                    </td>
                    <td className="text-right text-[var(--red)]">
                      $
                      {discountedByFunnel(fullTimeHourly(c.monthly), legal.conversionPct).low.toFixed(2)}{" "}
                      to $
                      {discountedByFunnel(fullTimeHourly(c.monthly), legal.conversionPct).high.toFixed(2)}/h
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          This is the whole business case in one row. The base case reads as{" "}
          <strong className="text-[var(--cream)]">$95.69 an hour in year {FIRST_DRAW_YEAR}</strong>,
          which is a real wage for the time being put in. Corrected for the funnel actually measured,
          the same case is{" "}
          <strong className="text-[var(--cream)]">
            ${discountedByFunnel(YEAR_3_PROJECTION.cases[1].hourly, legal.conversionPct).low.toFixed(2)} to $
            {discountedByFunnel(YEAR_3_PROJECTION.cases[1].hourly, legal.conversionPct).high.toFixed(2)} an hour
          </strong>
          , which is not. The gap between those two numbers is not traffic and it is not more hours:
          it is the 2.1% of visitors who currently reach a merchant. Fixing that is what turns a
          token year-{FIRST_DRAW_YEAR} draw into a wage, and it is 40 hours of the{" "}
          {OUTLOOK.backlogHours}-hour backlog.
        </p>
        <p className="table-caption">
          <strong className="text-[var(--cream)]">
            None of this is a survival threshold, and it should not be read as one.
          </strong>{" "}
          {FULL_TIME.note} So these hourly figures are a yardstick for when the business has grown
          enough to be worth drawing from, not a bar anyone has to clear. The last column is simply
          what full time does to the arithmetic: the same revenue spread over{" "}
          {FULL_TIME.hoursPerWeek} hours a week ({fullTimeHoursPerMonth().toFixed(0)} a month) instead
          of {availableHoursPerWeek()}. Working more hours lowers the hourly rate rather than raising
          it, which is the one genuinely counter-intuitive thing here: extra capacity is only worth
          spending on work that compounds.
        </p>
        <p className="table-caption">
          Being a long play with secure funding behind it is an advantage the model does not price,
          and it changes what the constraint even is. At{" "}
          {FULL_TIME.hoursPerWeek} hours a week the {OUTLOOK.backlogHours}-hour backlog clears in about{" "}
          {(OUTLOOK.backlogHours / FULL_TIME.hoursPerWeek).toFixed(1)} weeks, so time stops being the
          binding limit and the limits become the ones hours cannot buy: affiliate approvals that move
          at the merchant&apos;s pace, and the months Google takes to trust a domain. Both of those
          reward being started early far more than being worked hard later. A venture that has to pay
          rent this quarter cannot wait out either of them; this one can, which is exactly why the{" "}
          {availableHoursPerWeek()} hours a week available now are better spent on the feeds and the
          SEO than saved for when the time exists.
        </p>

        <h3 className="mb-1 mt-8 font-display text-lg font-black text-[var(--cream)]">
          What it takes to pay the team
        </h3>
        <p className="table-caption mb-3 mt-0">
          Read this as a milestone ladder, not a liability. Nothing here is owed to anyone: no money
          is being pulled and the {hoursFor()} hours across {people().length} people are sweat equity.
          These are the thresholds at which the business could <em>begin</em> paying for the time it
          is already getting. At Legal Leaf&apos;s basket and commission that is {money(PAYOUT_NOW)}{" "}
          per order at today&apos;s {legal.attributionNowPct}% attribution, rising to{" "}
          {money(PAYOUT_EXIT)} at the {legal.attributionExitPct}% exit assumption. Attribution is the
          quiet term: at 60% capture, four orders in ten are never credited.
        </p>
        <div className="table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="text-left">Target</th>
                <th className="text-right">Revenue / month</th>
                <th className="text-right">Orders / month</th>
                <th className="text-right">Visitors at today&apos;s 2.1%</th>
                <th className="text-right">Visitors at a fixed 20%</th>
              </tr>
            </thead>
            <tbody>
              {HOURLY_TARGETS.map((t) => {
                const b = breakeven(t, PAYOUT_NOW)
                return (
                  <tr key={t}>
                    <td className="font-semibold text-[var(--cream)]">${t}/hour</td>
                    <td className="text-right">{money(b.monthlyRevenueNeeded)}</td>
                    <td className="text-right">{count(Math.round(b.ordersNeeded))}</td>
                    <td className="text-right text-[var(--red)]">
                      {count(Math.round(b.visitorsNeededAtCurrentFunnel))}
                    </td>
                    <td className="text-right text-[var(--sage)]">
                      {count(Math.round(b.visitorsNeededAtFixedFunnel))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="table-caption">
          Measured traffic last month was {count(WEB_MEASURED.visitors)} visitors, so read the last two
          columns as multiples of that. The gap between them is the entire argument of this panel:{" "}
          <strong className="text-[var(--cream)]">
            taking the outbound-click rate from 2.1% to 20% is worth about 10x, and it costs no extra
            traffic
          </strong>
          , because 92% of visitors currently never leave the homepage. Chasing traffic before fixing
          that multiplies a funnel that leaks 98 of every 100 visitors. Both columns assume{" "}
          {ASSUMED_MERCHANT_CONVERSION_PCT}% of merchant visits convert, which is the middle of the
          usual 1 to 5% band and is not measured here.
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
