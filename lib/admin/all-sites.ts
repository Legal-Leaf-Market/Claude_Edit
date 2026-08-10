import { runModel, type ModelResult, type MonthRow, type Scenario, type SiteProfile } from "./engine"
import { SITE_PROFILE } from "./reference-data"
import { SISTER_SITE_PROFILES } from "./sister-sites"

/** Gear Avail plus the four sister sites, in the order they render everywhere on this page. */
export const ALL_SITE_PROFILES: SiteProfile[] = [SITE_PROFILE, ...SISTER_SITE_PROFILES]

/**
 * Run the combined model for a given scenario and horizon. No overrides or
 * actuals here on purpose: this page is a read-only rollup of each site's
 * own shipped assumptions, not a shared editor. A site's own admin page
 * (on its own domain) is where its assumptions get tuned and its real
 * months get entered — see the module doc on sister-sites.ts for why this
 * stays one-way.
 */
export function runAllSites(scenario: Scenario, horizonMonths?: number): ModelResult {
  return runModel(ALL_SITE_PROFILES, undefined, scenario, undefined, horizonMonths)
}

/** Sum every site's revenue and sessions into one month-by-month series, for the combined chart. */
export function combinedMonths(model: ModelResult): MonthRow[] {
  const siteList = model.order.map((k) => model.sites[k])
  const length = siteList[0]?.months.length ?? 0

  return Array.from({ length }, (_, i) => {
    const revenue = siteList.reduce((sum, s) => sum + s.months[i].revenue, 0)
    const sessions = siteList.reduce((sum, s) => sum + s.months[i].sessions, 0)
    const gmv = siteList.reduce((sum, s) => sum + s.months[i].gmv, 0)
    const orders = siteList.reduce((sum, s) => sum + s.months[i].orders, 0)
    return {
      index: i + 1,
      label: model.monthLabels[i],
      sessions,
      revPerSession: sessions > 0 ? revenue / sessions : 0,
      orders,
      gmv,
      revenue,
      actualSessions: null,
      actualRevenue: null,
      plannedRevenue: revenue,
      plannedSessions: sessions,
      revenueVariancePct: null,
      sessionsVariancePct: null,
      isActual: false,
      isReanchored: false,
    }
  })
}
