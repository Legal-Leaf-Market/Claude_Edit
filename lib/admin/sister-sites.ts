import type { SiteProfile } from "./engine"

/**
 * The four sister sites' own operating-model reference data, ported
 * verbatim from `api/admin/_client-engine.js` on their own codebase
 * (Legal-Leaf-Market/Code_Backup), as of the "8 August 2026" model that
 * repo's own ADMIN-OPERATING-MODEL.md documents and pins acceptance numbers
 * against. This file is READ-ONLY reference data, not a live sync: each
 * site's own admin page (on its own domain) is the actual source of truth
 * for its assumptions, and edits or real actuals entered there do not flow
 * back here automatically. If this drifts noticeably from what those pages
 * show, re-port rather than patch around the difference.
 *
 * These feed lib/admin/all-sites.ts, which combines them with Gear Avail's
 * own SITE_PROFILE (lib/admin/reference-data.ts) through the SAME
 * lib/admin/engine.ts `runModel`, unmodified — the whole point of porting
 * the math instead of re-deriving it is that the four sites' own page and
 * this one agree by construction, not by coincidence.
 *
 * Scenario multipliers (bear/base/bull) are identical between this model
 * and Gear Avail's own (compared field by field against
 * lib/admin/reference-data.ts's SCENARIOS), so this file does not repeat
 * them — the combined dashboard reuses Gear Avail's SCENARIOS directly.
 *
 * One deliberate divergence: `_client-engine.js`'s own MODEL_START is
 * September 2026 (month index 8), one month later than this codebase's
 * engine.ts (August 2026, index 7). Seasonality is a per-CALENDAR-month
 * multiplier, so that one-month offset shifts which multiplier lands on
 * which projection month, and running these four profiles through
 * engine.ts reproduces the sister sites' own pinned acceptance numbers to
 * within a few percent rather than exactly (verified: the maturity
 * revenue-per-session figures, which do not depend on calendar alignment
 * at all, DO match the pinned 0.240/0.055/0.141/0.072 exactly). Using
 * engine.ts's own MODEL_START uniformly for all five sites here is
 * intentional, not an oversight: the combined chart lines every site's
 * "month 1" up on one shared timeline, which a per-site calendar offset
 * would defeat outright.
 */

export const SISTER_SITES_PREPARED_ON = "8 August 2026"

const COLORS = { legal: "#25a942", kawaii: "#d55181", herbal: "#c98500", nicotia: "#4a90e2" }

export const SISTER_SITE_PROFILES: SiteProfile[] = [
  {
    key: "legal",
    name: "Legal Leaf Market",
    shortName: "Legal Leaf",
    domain: "legal-leafmarket.com",
    tagline: "Hemp / THCa price comparison · 18 stores · 3,576 products",
    color: COLORS.legal,
    seasonality: [
      0.8281, 0.815, 0.9292, 1.1072, 1.0106, 1.0088, 1.038, 1.0116, 0.9597, 0.9336, 0.8508, 0.8305,
    ],
    curveSteepness: 0.2558,
    indexablePages: 15,
    assumptions: {
      sessionsMonth1: 600,
      sessionsMonth12: 4500,
      sessionsMonth24: 20000,
      basket: 95,
      commissionPct: 15,
      conversionPct: 1.5,
      attributionNowPct: 60,
      attributionExitPct: 90,
    },
  },
  {
    key: "kawaii",
    name: "KawaiiKatz",
    shortName: "KawaiiKatz",
    domain: "kawaiikatz.com",
    tagline: "Kawaii / anime merchandise · 9 vendors",
    color: COLORS.kawaii,
    seasonality: [
      0.7542, 0.8734, 0.8157, 0.8273, 0.8707, 0.9165, 0.9541, 1.0241, 0.9606, 0.9799, 1.1063, 1.0918,
    ],
    curveSteepness: 0.2588,
    indexablePages: 2,
    assumptions: {
      sessionsMonth1: 500,
      sessionsMonth12: 5000,
      sessionsMonth24: 26000,
      basket: 45,
      commissionPct: 9,
      conversionPct: 1.2,
      attributionNowPct: 25,
      attributionExitPct: 90,
    },
  },
  {
    key: "herbal",
    name: "Herbal Leaf Market",
    shortName: "Herbal Leaf",
    domain: "herballeafmarket.com",
    tagline: "CBD / botanicals / tea · 6 makers · 540 products",
    color: COLORS.herbal,
    seasonality: [
      0.9572, 0.8765, 0.8681, 0.8645, 0.8684, 0.8368, 0.8472, 0.901, 0.9898, 1.0482, 1.1018, 1.1371,
    ],
    curveSteepness: 0.2782,
    indexablePages: 5,
    assumptions: {
      sessionsMonth1: 350,
      sessionsMonth12: 2000,
      sessionsMonth24: 8500,
      basket: 58,
      commissionPct: 17,
      conversionPct: 1.3,
      attributionNowPct: 40,
      attributionExitPct: 88,
    },
  },
  {
    key: "nicotia",
    name: "Nicotia Market",
    shortName: "Nicotia",
    domain: "nicotiamarket.com",
    tagline: "Nicotine per-unit comparison · 15 stores · 2,451 listings",
    color: COLORS.nicotia,
    seasonality: [
      0.962, 0.8837, 0.9062, 0.9165, 0.9437, 0.9545, 0.9663, 0.9802, 0.9873, 0.9461, 0.9091, 0.9008,
    ],
    curveSteepness: 0.2794,
    indexablePages: 17,
    assumptions: {
      sessionsMonth1: 450,
      sessionsMonth12: 3000,
      sessionsMonth24: 14000,
      basket: 52,
      commissionPct: 9,
      conversionPct: 1.4,
      attributionNowPct: 55,
      attributionExitPct: 88,
    },
  },
]
