/**
 * Inputs to the operating model: the four site profiles, the scenario
 * definitions, the per-merchant revenue mix, and the narrative that frames them.
 *
 * Seasonality arrays are indexed by calendar month (0 = January). The curve
 * steepness and seasonality figures are model constants — they describe the
 * *shape* of a launch, not a target — so they stay fixed while the admin edits
 * the anchors, basket, commission, conversion and attribution.
 */

import type { ScenarioKey, ScenarioProfile, SiteKey, SiteProfile } from "@/lib/operating-model"

export const PREPARED_ON = "8 August 2026"

/**
 * Chart + legend colours, stepped for this site's dark surface and validated as
 * a set: all four sit inside the dark lightness band (OKLCH L 0.48–0.67), clear
 * the chroma floor, and hold ≥ 3:1 contrast against the chart surface. The
 * green↔pink pair lands in the 6–8 CVD band, which is why the stacked bands
 * carry a 2px surface gap, a legend and direct end-labels rather than relying
 * on hue alone.
 */
const COLORS: Record<SiteKey, string> = {
  legal: "#25a942",
  kawaii: "#d55181",
  herbal: "#c98500",
  nicotia: "#4a90e2",
}

export const SITE_PROFILES: SiteProfile[] = [
  {
    key: "legal",
    name: "Legal Leaf Market",
    shortName: "Legal Leaf",
    domain: "legal-leafmarket.com",
    tagline: "Hemp / THCa price comparison · 18 stores · 3,576 products",
    color: COLORS.legal,
    // April is the category's peak; December through February is the trough.
    seasonality: [
      0.8281, 0.815, 0.9292, 1.1072, 1.0106, 1.0088,
      1.038, 1.0116, 0.9597, 0.9336, 0.8508, 0.8305,
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
    // Black Friday through December carries the year.
    seasonality: [
      0.7542, 0.8734, 0.8157, 0.8273, 0.8707, 0.9165,
      0.9541, 1.0241, 0.9606, 0.9799, 1.1063, 1.0918,
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
    // Q4 gifting and cold-weather tea demand.
    seasonality: [
      0.9572, 0.8765, 0.8681, 0.8645, 0.8684, 0.8368,
      0.8472, 0.901, 0.9898, 1.0482, 1.1018, 1.1371,
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
    // Flattest of the four; January quit-and-switch demand is the one lift.
    seasonality: [
      0.962, 0.8837, 0.9062, 0.9165, 0.9437, 0.9545,
      0.9663, 0.9802, 0.9873, 0.9461, 0.9091, 0.9008,
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

export const SITE_MAP = Object.fromEntries(SITE_PROFILES.map((s) => [s.key, s])) as Record<
  SiteKey,
  SiteProfile
>

export const SCENARIOS: Record<ScenarioKey, ScenarioProfile> = {
  bear: {
    key: "bear",
    label: "Bear",
    headline: "The applications never get filed",
    detail:
      "Attribution stays where it is today, so every merchant that cannot credit you never starts. Page count stays flat, so organic never compounds. Traffic lands at roughly 40% of plan by month 24 and conversion at 85% of the stated rate. This is the hobby column.",
    sessions12: 0.55,
    sessions24: 0.4,
    conversion: 0.85,
    freezeAttribution: true,
  },
  base: {
    key: "base",
    label: "Base",
    headline: "Consistent solo effort",
    detail:
      "Programmatic pages built from data you already hold, steady community presence, a newsletter, and the affiliate applications actually filed. Attribution ramps to its month-24 target because you did the paperwork; traffic hits the anchors below.",
    sessions12: 1,
    sessions24: 1,
    conversion: 1,
    freezeAttribution: false,
  },
  bull: {
    key: "bull",
    label: "Bull",
    headline: "One channel breaks out",
    detail:
      "Not four channels grinding — one working. A state-legality page cluster that ranks, or a creator partnership that sticks. Traffic runs 2.2× plan by month 24 and conversion 15% above the stated rate on the back of a stronger brand and returning visitors.",
    sessions12: 1.6,
    sessions24: 2.2,
    conversion: 1.15,
    freezeAttribution: false,
  },
}

export const SCENARIO_ORDER: ScenarioKey[] = ["bear", "base", "bull"]

// ── per-merchant revenue mix ────────────────────────────────────────────────

export type MerchantStatus = "tracking" | "partial" | "none"

export type MerchantRow = {
  merchant: string
  platform: string
  /** Null where there is no programme to quote a rate for. */
  ratePct: number | null
  status: MerchantStatus
  /** Share of that site's revenue, in percent. Rows that earn $0 carry 0. */
  sharePct: number
  note: string
}

export const MERCHANTS: Record<SiteKey, MerchantRow[]> = {
  legal: [
    { merchant: "Puffy (HiPuffy)", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 18, note: "Coupon verified at checkout" },
    { merchant: "THCA King", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 15, note: "Coupon verified · 184 lab records" },
    { merchant: "Black Tie CBD", platform: "Shopify", ratePct: 12, status: "tracking", sharePct: 13, note: "161 own certificates · richest data" },
    { merchant: "THCA Small Buds", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 11, note: "Coupon verified" },
    { merchant: "Binoid", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 9, note: "Cart pre-fill working" },
    { merchant: "Bloomz", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 7, note: "Cart pre-fill working" },
    { merchant: "Exhale", platform: "WooCommerce", ratePct: 15, status: "tracking", sharePct: 6, note: "—" },
    { merchant: "THCA4Cheap", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 5, note: "URL coupon verified −10%" },
    { merchant: "THCa Hempire", platform: "BigCommerce", ratePct: 10, status: "partial", sharePct: 4, note: "Bookmarklet hand-off only" },
    { merchant: "Nothing But Canna", platform: "Shopify", ratePct: 12, status: "partial", sharePct: 4, note: "Needs sca_ref · plain ref earned $0" },
    { merchant: "Greek Glass", platform: "Big Cartel", ratePct: 10, status: "partial", sharePct: 3, note: "Bookmarklet hand-off only" },
    { merchant: "Cielo (was DSquared)", platform: "Shopify", ratePct: null, status: "none", sharePct: 1, note: "Rebranded · old link 404s · re-enrol" },
    { merchant: "Accessories (6 stores)", platform: "mixed", ratePct: 8, status: "partial", sharePct: 4, note: "Grasscity, Chill, Hitoki, Zam, YLLVAPE, Mein-Grinder" },
  ],
  kawaii: [
    { merchant: "BRKOX", platform: "Awin 129093", ratePct: 9, status: "tracking", sharePct: 64, note: "Verified end to end · showcase page" },
    { merchant: "Kore Kawaii", platform: "Shopify", ratePct: null, status: "none", sharePct: 12, note: "No affiliate programme wired" },
    { merchant: "Seven other vendors", platform: "Shopify", ratePct: null, status: "none", sharePct: 24, note: "No affiliate IDs · all clicks earn $0" },
  ],
  herbal: [
    { merchant: "Rishi Tea", platform: "Awin 53225", ratePct: 10, status: "tracking", sharePct: 34, note: "Approved 8 Aug · 187 products, healthiest feed" },
    { merchant: "Natural Smoke Shop", platform: "tr=138", ratePct: 10, status: "partial", sharePct: 34, note: "Attribution unconfirmed · /shop 301s to cart" },
    { merchant: "Bear Blend", platform: "ref=JAC6375", ratePct: 12, status: "tracking", sharePct: 18, note: "30-day cookie verified · seed prices, no live feed" },
    { merchant: "Puff Herbals", platform: "Awin 74076", ratePct: 10, status: "tracking", sharePct: 14, note: "—" },
    { merchant: "Secret Nature", platform: "Awin (no ID)", ratePct: 15, status: "none", sharePct: 0, note: "Largest catalogue (207) and earns nothing" },
    { merchant: "Soul CBD", platform: "Awin (no ID)", ratePct: 20, status: "none", sharePct: 0, note: "Merchant ID missing" },
    { merchant: "Charlotte's Web", platform: "Awin (no ID)", ratePct: 10, status: "none", sharePct: 0, note: "Merchant ID missing" },
  ],
  nicotia: [
    { merchant: "Europesnus", platform: "Shopify", ratePct: 10, status: "tracking", sharePct: 17, note: "FLASH25 verified −25%" },
    { merchant: "RELX Global", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 15, note: "Permalink checkout verified" },
    { merchant: "BnB Tobacco", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 13, note: "—" },
    { merchant: "EightVape", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 12, note: "—" },
    { merchant: "Wave Vape", platform: "WooCommerce", ratePct: 10, status: "tracking", sharePct: 11, note: "OFF10 advertised by store but invalid" },
    { merchant: "Vaporesso / Geekvape", platform: "Shopify", ratePct: 12, status: "tracking", sharePct: 10, note: "—" },
    { merchant: "Fruitia", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 9, note: "—" },
    { merchant: "Kind Juice", platform: "Awin feed", ratePct: 10, status: "tracking", sharePct: 8, note: "—" },
    { merchant: "Others (4 stores)", platform: "mixed", ratePct: 9, status: "partial", sharePct: 5, note: "—" },
    { merchant: "Nicokick", platform: "Magento", ratePct: null, status: "none", sharePct: 0, note: "CJ publisher + advertiser IDs empty" },
    { merchant: "Black Buffalo", platform: "Refersion", ratePct: 10, status: "none", sharePct: 0, note: "Not yet approved · page states it earns nothing" },
  ],
}

/** Share of a site's revenue that can actually be credited today. */
export function attributableShare(key: SiteKey): number {
  return MERCHANTS[key]
    .filter((m) => m.status !== "none")
    .reduce((sum, m) => sum + m.sharePct, 0)
}

// ── narrative ───────────────────────────────────────────────────────────────

export const FACTS = [
  {
    tag: "Structural · cannot be fixed",
    title: "You cannot buy traffic",
    body:
      "Google, Meta and TikTok all prohibit ads for THC, hemp flower, vapes and nicotine outright. Meta permits only LegitScript-certified CBD topicals; Google permits topical CBD in three jurisdictions. Organic posts on cannabis and nicotine get removed or shadowbanned without notice. Legal Leaf, Nicotia and most of Herbal Leaf are organic-only businesses by law and by platform policy. KawaiiKatz is the one site that can advertise, but see the economics section, because at 9% commission on a $45 basket it cannot afford to.",
  },
  {
    tag: "Fixable · highest leverage",
    title: "39 pages is not a catalogue",
    body:
      "Measured live: Legal Leaf's sitemap lists 15 URLs, Nicotia 17, Herbal Leaf 5, KawaiiKatz 2. Your direct competitor hempprice.store tracks 13,800 products across 169 vendors with per-state legal pages and a vendor directory. Long-tail search is how comparison sites live, and you are currently offering search engines almost no surface to land on. You already hold the data (3,576 products, 1,071 certificates, 18 stores). It simply isn't published as pages.",
  },
  {
    tag: "Fixable · fastest money",
    title: "Much of your traffic earns nothing",
    body:
      "Herbal Leaf's largest vendor by catalogue (Secret Nature, 207 products) has no merchant ID, so it earns $0. So do Soul CBD and Charlotte's Web. Eight of KawaiiKatz's nine vendors have no affiliate wiring at all. Nicokick's network IDs are empty. Black Buffalo isn't approved. This is revenue you are already generating and giving away, and closing it costs applications, not traffic.",
  },
]

export const NEXT_90_DAYS = [
  {
    title: "Close the attribution gaps before writing a single new page",
    body:
      "Apply for Awin merchant IDs for Secret Nature, Soul CBD and Charlotte's Web. Get the eight unwired KawaiiKatz vendors onto affiliate programmes or drop them. Fill Nicokick's CJ publisher and advertiser IDs. Apply to Black Buffalo's Refersion programme. Confirm how Natural Smoke Shop records ?tr=138, and re-enrol with Cielo after their rebrand.",
    why: "Multiplies revenue on traffic you already have. Costs applications, not months.",
  },
  {
    title: "Turn your data into pages",
    body:
      "You hold 3,576 products, 1,071 certificates, 18 vendors and per-state legality rules. That is a strain hub, a vendor-review page per store, a state-by-state legality page, a “cheapest ounce right now” page per strain, and a lab-report explainer per certificate. Going from 15 URLs to several hundred genuinely useful ones is the difference between the bear and base columns.",
    why: "Long-tail organic is the only scalable channel legally open to you.",
  },
  {
    title: "Decide whether the no-product-URLs rule still serves you",
    body:
      "The sitemap deliberately omits product URLs so as never to compete with a vendor for their own listing. That is a principled call and it is also the single largest cap on your organic surface. A middle path exists: index comparison and strain pages that rank for “best price” and “vs” queries rather than the vendor's own product name.",
    why: "This is a business decision, not a technical one. It belongs to you.",
  },
  {
    title: "Build the email list now, while traffic is small",
    body:
      "Nicotine and hemp are consumables with the highest repeat rates of anything you sell, and email is the one channel no platform can shadowban. The subscribe endpoint is a no-op sink unless the Resend keys are set. Set them.",
    why: "Owned audience is worth more than rented reach in a category that gets deplatformed.",
  },
  {
    title: "Negotiate rates once you can show a statement",
    body:
      "Coupon-code arrangements at 10% are the worst-paying instrument you have. Once any merchant sees consistent volume from you, a direct 20–25% deal is a normal ask. Doubling blended commission doubles revenue with zero extra traffic. It is strictly cheaper than doubling the audience.",
    why: "Revenue per session is a lever you control; traffic is one you only influence.",
  },
  {
    title: "Put KawaiiKatz on a different footing or accept it as a side project",
    body:
      "It is the only site that may legally advertise and the only one whose economics forbid it. Either raise its take rate (print-on-demand or a dropship line at 30–40% margin instead of 9% affiliate) or run it purely on Pinterest and TikTok organic, where kawaii merchandise performs unusually well and costs nothing but time.",
    why: "Same traffic, four times the yield, if the take rate changes.",
  },
]

export const METHOD_NOTES = [
  "Traffic follows an S-curve, not a straight line: slow for four months while a new domain earns trust, steepest between months 8 and 18, decelerating after. It is fitted to pass through the month-1, month-12 and month-24 anchors in the assumptions panel. Monthly seasonality is applied per category: April for hemp, January for nicotine, Q4 for tea and gifting, Black Friday through December for kawaii merchandise — which is why a month's sessions can sit slightly above or below its anchor.",
  "Conversion rate is the most fragile assumption on this page. The model matures it from 80% to 125% of the stated rate over two years as trust, reviews and returning visitors accumulate. If real conversion comes in at half the stated rate, halve every revenue figure. Hemp checkouts in particular carry friction the benchmarks don't: age gates, login walls and payment processors that decline more often than mainstream retail.",
  "Attribution capture starts low and deliberately so. It reflects the merchants that genuinely cannot credit you today, not pessimism. It ramps toward 88–90%, which assumes you actually do the applications in the ninety-day list. If you don't, switch to the bear scenario, which holds capture flat at today's rate and reads the result.",
  "What is not modelled: a merchant terminating a programme, a state banning THCa outright, a Google core update, an Instagram ban on your account, or the wholesale side of Legal Leaf. The first three are real risks in this category; the fourth is real upside that isn't counted here.",
  "Costs are excluded because they are immaterial next to the revenue: domains, hosting, the concierge API and email land between $10 and $200 a month across the whole family. Affiliate has no cost of goods. What this business actually costs is your hours.",
]

export const METHOD_FOOTNOTE =
  "Reference points used to sanity-check the growth curve: a THCa retailer went from 325 to 12,755 monthly sessions in 11 months with a paid agency running technical SEO, category pages, comparison content and 4–5 links a month. The base case here is deliberately slower than that, because you are one person. Industry survey data also says roughly 95% of affiliate sites never reach sustainable income and the single biggest cause is quitting inside year one, while 81% of those who stay past twelve months clear $20,000 a year. The distribution is brutal at the bottom and fine above it."

/** Income levels for the reverse-lookup table. */
export const INCOME_TARGETS = [500, 1000, 2500, 5000, 8333, 20000]

export const ASSUMPTION_FIELDS: {
  key: keyof SiteProfile["assumptions"]
  label: string
  step: number
  suffix?: string
  decimals: number
}[] = [
  { key: "sessionsMonth1", label: "Sessions, month 1", step: 50, decimals: 0 },
  { key: "sessionsMonth12", label: "Sessions, month 12", step: 250, decimals: 0 },
  { key: "sessionsMonth24", label: "Sessions, month 24", step: 1000, decimals: 0 },
  { key: "basket", label: "Basket $", step: 1, decimals: 0 },
  { key: "commissionPct", label: "Commission %", step: 0.5, decimals: 1 },
  { key: "conversionPct", label: "Conversion %", step: 0.05, decimals: 2 },
  { key: "attributionNowPct", label: "Attribution now %", step: 5, decimals: 0 },
  { key: "attributionExitPct", label: "Attribution mo 24 %", step: 5, decimals: 0 },
]
