import { MERCHANTS, SITE_PROFILE, type MerchantRow } from "./reference-data"
import { SISTER_SITE_PROFILES } from "./sister-sites"

/**
 * The master vendor table: every merchant on every site in the family, with
 * the commission rate each one actually pays.
 *
 * PROVENANCE, because this is the part that matters. These are not estimates
 * and they are not restated from memory. The four sister sites' rows are
 * transcribed from the authoritative source, which is Legal Leaf Market's own
 * admin engine (`api/admin/_client-engine.js`, the `MERCHANTS` object). That
 * is the same engine Gear Avail's operating model was ported from, and its own
 * page describes itself as "built from real commission rates, real catalogue
 * sizes, and the affiliate links that are actually tracking today". Gear
 * Avail's rows are not duplicated here: they are imported live from
 * reference-data.ts so this file can never drift from the page next door.
 *
 * WHAT `ratePct: null` MEANS. It means no rate is on record anywhere in the
 * family's repos, NOT that the merchant pays nothing. eBay, Reverb, Sweetwater
 * and the CJ programmes all publish rates in the real world; none of them is
 * written down in any of these five codebases, so inventing a number here
 * would put a fabricated figure into a revenue projection. Those rows carry
 * null and are counted as unknown, including under the optimistic assumption
 * below. Fill them in from the affiliate dashboards, not from a guess.
 *
 * KAWAIIKATZ WAS WRONG HERE AND IS NOW CORRECTED. This file previously carried
 * Legal Leaf's admin view, which recorded eight of the nine KawaiiKatz vendors
 * as having no affiliate IDs and earning $0. That was stale. The codes are set:
 * GoAffPro lets an affiliate choose a custom referral code per store, so one
 * `kawaiikatz` code across eight independent GoAffPro shops is exactly what
 * enrollment looks like rather than evidence of a guess.
 *
 * Every rate is now verified against GoAffPro's own merchant directory
 * (22,428 programmes, checked 10 Aug 2026) and all twenty rates across
 * KawaiiKatz and Gear Avail matched their repos exactly. The repos were right.
 *
 * BRKOX remains unresolved and is the one row still carrying a conflict: the
 * KawaiiKatz repo records commissionPct 0 while Legal Leaf's admin records 9%
 * and tracking. It runs on Awin rather than GoAffPro, so the directory cannot
 * settle it. `advertisedPct` keeps both numbers visible.
 */

export type MasterVendorRow = {
  merchant: string
  /** Platform, or the affiliate network and merchant id where there is one. */
  platform: string
  /** What the programme actually pays today. Null means no rate on record. */
  ratePct: number | null
  status: "tracking" | "partial" | "pending" | "unconfirmed" | "paused" | "none"
  /**
   * Modelled share of that site's revenue, from catalogue depth, in-stock
   * rate, basket and rate. An estimate of mix, never a measurement. Null
   * where the source site models share by catalogue count instead.
   */
  sharePct: number | null
  /** Rate the programme advertises, where it differs from what is wired up. */
  advertisedPct?: number
  note: string
}

/**
 * Transcribed from Legal Leaf's `_client-engine.js` MERCHANTS. Keys match the
 * site keys used by sister-sites.ts so the two line up without a lookup table.
 */
const SISTER_VENDORS: Record<string, MasterVendorRow[]> = {
  legal: [
    { merchant: "Puffy (HiPuffy)", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 18, note: "Coupon verified at checkout" },
    { merchant: "THCA King", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 15, note: "Coupon verified, 184 lab records" },
    { merchant: "Black Tie CBD", platform: "Shopify", ratePct: 12, status: "tracking", sharePct: 13, note: "161 own certificates, richest data" },
    { merchant: "THCA Small Buds", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 11, note: "Coupon verified" },
    { merchant: "Binoid", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 9, note: "Cart pre-fill working" },
    { merchant: "Bloomz", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 7, note: "Cart pre-fill working" },
    { merchant: "Exhale", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 6, note: "" },
    { merchant: "THCA4Cheap", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 5, note: "URL coupon verified, minus 10%" },
    { merchant: "THCa Hempire", platform: "BigCommerce", ratePct: 10, status: "partial", sharePct: 4, note: "Bookmarklet hand-off only" },
    { merchant: "Nothing But Canna", platform: "Shopify", ratePct: 12, status: "partial", sharePct: 4, note: "Needs sca_ref; plain ref earned $0" },
    { merchant: "Greek Glass", platform: "Big Cartel", ratePct: 10, status: "partial", sharePct: 3, note: "Bookmarklet hand-off only" },
    { merchant: "Cielo (was DSquared)", platform: "Shopify", ratePct: null, status: "none", sharePct: 1, note: "Rebranded, old link 404s, needs re-enrolment" },
    { merchant: "Accessories (6 stores)", platform: "mixed", ratePct: 8, status: "partial", sharePct: 4, note: "Grasscity, Chill, Hitoki, Zam, YLLVAPE, Mein-Grinder" },
  ],
  kawaii: [
    { merchant: "BRKOX", platform: "Awin 129093", ratePct: 9, status: "tracking", sharePct: 64, advertisedPct: 0, note: "Verified end to end, showcase page. Awin rather than GoAffPro, so the rate conflict with the repo's commissionPct 0 is unresolved" },
    { merchant: "Squishy Bottle", platform: "GoAffPro", ratePct: 25, status: "tracking", sharePct: 8, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
    { merchant: "Plushible", platform: "GoAffPro", ratePct: 20, status: "tracking", sharePct: 6, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
    { merchant: "Autoplush", platform: "GoAffPro", ratePct: 20, status: "tracking", sharePct: 4, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
    { merchant: "Kore Kawaii", platform: "GoAffPro", ratePct: 15, status: "tracking", sharePct: 12, note: "Rate verified against GoAffPro's directory (listed as Kawaii Crafts Shop). 7-day cookie" },
    { merchant: "Montessori & Me", platform: "GoAffPro", ratePct: 15, status: "tracking", sharePct: 3, note: "Rate verified. 30-day cookie, the longest of the nine" },
    { merchant: "Hello Kitty Camp", platform: "GoAffPro", ratePct: 10, status: "tracking", sharePct: 2, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
    { merchant: "Mintie Lunchboxes", platform: "GoAffPro", ratePct: 10, status: "tracking", sharePct: 1, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
    { merchant: "jigsawdepot", platform: "GoAffPro", ratePct: 10, status: "tracking", sharePct: 1, note: "Rate verified against GoAffPro's directory. 7-day cookie" },
  ],
  herbal: [
    { merchant: "Rishi Tea", platform: "Awin 53225", ratePct: 10, status: "tracking", sharePct: 34, note: "Approved 8 Aug, 187 products, healthiest feed" },
    { merchant: "Natural Smoke Shop", platform: "tr=138", ratePct: 10, status: "partial", sharePct: 34, note: "Attribution unconfirmed, /shop 301s to cart" },
    { merchant: "Bear Blend", platform: "ref=JAC6375", ratePct: 12, status: "tracking", sharePct: 18, note: "30-day cookie verified, seed prices, no live feed" },
    { merchant: "Puff Herbals", platform: "Awin 74076", ratePct: 10, status: "tracking", sharePct: 14, note: "" },
    { merchant: "Secret Nature", platform: "Awin (no ID)", ratePct: 15, status: "none", sharePct: 0, note: "Largest catalogue (207) and earns nothing" },
    { merchant: "Soul CBD", platform: "Awin (no ID)", ratePct: 20, status: "none", sharePct: 0, note: "Merchant ID missing" },
    { merchant: "Charlotte's Web", platform: "Awin (no ID)", ratePct: 10, status: "none", sharePct: 0, note: "Merchant ID missing" },
  ],
  nicotia: [
    { merchant: "Europesnus", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 17, note: "FLASH25 verified, minus 25%" },
    { merchant: "RELX Global", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 15, note: "Permalink checkout verified" },
    { merchant: "BnB Tobacco", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 13, note: "" },
    { merchant: "EightVape", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 12, note: "" },
    { merchant: "Wave Vape", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 11, note: "OFF10 advertised by store but invalid" },
    { merchant: "Vaporesso / Geekvape", platform: "Shopify", ratePct: 12, status: "tracking", sharePct: 10, note: "" },
    { merchant: "Fruitia", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 9, note: "" },
    { merchant: "Kind Juice", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 8, note: "" },
    { merchant: "Others (4 stores)", platform: "mixed", ratePct: 9, status: "partial", sharePct: 5, note: "" },
    { merchant: "Nicokick", platform: "Magento", ratePct: null, status: "none", sharePct: 0, note: "CJ publisher and advertiser IDs empty" },
    { merchant: "Black Buffalo", platform: "Refersion", ratePct: 10, status: "none", sharePct: 0, note: "Not yet approved, page states it earns nothing" },
  ],
}

/** Gear Avail's own rows, widened to the master shape. */
function gearAvailRows(): MasterVendorRow[] {
  return MERCHANTS.map((m: MerchantRow) => ({
    merchant: m.merchant,
    platform: m.platform,
    ratePct: m.ratePct,
    status: m.status,
    // Gear Avail models depth by real ingested catalogue count rather than a
    // share estimate, so share stays null instead of being back-derived.
    sharePct: null,
    note: m.note,
  }))
}

export type MasterVendorSite = {
  key: string
  name: string
  shortName: string
  domain: string
  color: string
  rows: MasterVendorRow[]
}

/** Every site in the family, Gear Avail first, in the same order as everywhere else. */
export const MASTER_VENDOR_SITES: MasterVendorSite[] = [
  {
    key: SITE_PROFILE.key,
    name: SITE_PROFILE.name,
    shortName: SITE_PROFILE.shortName,
    domain: SITE_PROFILE.domain,
    color: SITE_PROFILE.color,
    rows: gearAvailRows(),
  },
  ...SISTER_SITE_PROFILES.map((p) => ({
    key: p.key,
    name: p.name,
    shortName: p.shortName,
    domain: p.domain,
    color: p.color,
    rows: SISTER_VENDORS[p.key] ?? [],
  })),
]

/**
 * A merchant counts as earning today only when it is actually attributing.
 * "partial" is deliberately excluded: a bookmarklet hand-off or an unconfirmed
 * ref is exactly the case where clicks look tracked and pay nothing.
 */
export function isEarningToday(row: MasterVendorRow): boolean {
  return row.status === "tracking" && row.ratePct !== null && row.ratePct > 0
}

/**
 * The rate to use when you assume every pending, partial or unconfirmed
 * programme comes through. A rate already on record is used as-is, since an
 * approval does not change the published rate, it just starts paying it.
 *
 * Rows with no rate on record stay null even here. That is the point: the
 * optimistic case is "every application is approved", not "every unknown
 * number is whatever we need it to be".
 */
export function optimisticRate(row: MasterVendorRow): number | null {
  if (row.ratePct !== null) return row.ratePct
  if (row.advertisedPct !== undefined) return row.advertisedPct
  return null
}

export type VendorTotals = {
  total: number
  earningToday: number
  approvableWithRate: number
  rateUnknown: number
  /** Simple mean of rates on record, not weighted by revenue or catalogue. */
  meanRatePct: number | null
  /** Mean under the assumption that everything pending is approved. */
  meanRateIfAllApprovedPct: number | null
}

export function vendorTotals(rows: MasterVendorRow[]): VendorTotals {
  const withRate = rows.filter((r) => r.ratePct !== null).map((r) => r.ratePct as number)
  const optimistic = rows
    .map(optimisticRate)
    .filter((r): r is number => r !== null)

  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length

  return {
    total: rows.length,
    earningToday: rows.filter(isEarningToday).length,
    approvableWithRate: rows.filter((r) => !isEarningToday(r) && optimisticRate(r) !== null).length,
    rateUnknown: rows.filter((r) => optimisticRate(r) === null).length,
    meanRatePct: mean(withRate),
    meanRateIfAllApprovedPct: mean(optimistic),
  }
}
