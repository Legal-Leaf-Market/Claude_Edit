import type { Scenario, SiteProfile } from "./engine"

/**
 * Reference data for Gear Avail's operating model, adapted from the same
 * model built for the sister sites. Single site here, and the specifics
 * (assumptions, merchant list, facts) reflect Gear Avail's actual situation
 * rather than being copied from theirs:
 *
 *   - Musical instruments are not a restricted advertising category the way
 *     THC/hemp/nicotine are, so paid acquisition is a real lever here that
 *     the sister sites structurally do not have.
 *   - The catalogue pages are generated FROM the ingested listings
 *     (app/gear/[slug], app/deals/[slug], app/used/[category]), not
 *     hand-authored, so indexable page count already scales with real
 *     inventory rather than being a hand-written handful.
 *   - Of the 11 live small-seller sources, 7 (by product count, roughly two
 *     thirds of live catalogue) have a confirmed real GoAffPro referral link;
 *     the rest are unconfirmed, pending approval, or paused — see MERCHANTS.
 *
 * All figures below are starting assumptions, not measurements: this is a
 * brand-new catalogue with no real traffic history yet. Every number is
 * editable on the page itself; nothing downstream is hard-coded.
 */

export const PREPARED_ON = "9 August 2026"

export const GEARAVAIL_COLOR = "#f0a830"

export const SITE_PROFILE: SiteProfile = {
  key: "gearavail",
  name: "Gear Avail",
  shortName: "Gear Avail",
  domain: "gearavail.com",
  tagline: "11 independent maker/retailer storefronts, one search",
  color: GEARAVAIL_COLOR,
  // Jan..Dec. Instruments spike hardest at the holidays (gifting) and Black
  // Friday, dip in the new year, and see a smaller back-to-school bump.
  seasonality: [0.82, 0.83, 0.9, 0.95, 0.95, 0.9, 0.85, 0.95, 1.0, 1.05, 1.35, 1.45],
  curveSteepness: 0.26,
  // The 15 hand-authored category landing pages (app/used/[category]).
  // Excludes the ~10,000+ per-instrument /gear and /deals pages, which scale
  // automatically with the catalogue rather than being a fixed count worth
  // tracking the same way.
  indexablePages: 15,
  assumptions: {
    sessionsMonth1: 150,
    sessionsMonth12: 2500,
    sessionsMonth24: 12000,
    basket: 120,
    commissionPct: 8,
    conversionPct: 1.3,
    attributionNowPct: 60,
    attributionExitPct: 90,
  },
}

export const SCENARIOS: Record<"bear" | "base" | "bull", Scenario> = {
  bear: {
    key: "bear",
    label: "Bear",
    headline: "The referral links never get confirmed",
    detail:
      "Folkcraft, Acoustic Guitar and Jamstik stay unconfirmed, Play With Authority's approval never lands, and eBay/Reverb/Sweetwater/Gear4music/CJ stay paused indefinitely. Category pages and the pedal-board builder ship but nothing promotes them. Traffic lands around 40% of plan by month 24 and conversion at 85% of the stated rate.",
    sessions12: 0.55,
    sessions24: 0.4,
    conversion: 0.85,
    freezeAttribution: true,
  },
  base: {
    key: "base",
    label: "Base",
    headline: "Steady confirmation and shipping",
    detail:
      "The unconfirmed GoAffPro codes get confirmed, Play With Authority approves, and at least one of the gated feeds (eBay production, or an Awin/LinkConnector/CJ datafeed) actually materialises. Category pages, the flip-card redesign and the pedal-board builder ship on the roadmap already in motion. Attribution ramps to its month-24 target because the applications actually got filed.",
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
      "Not every gated feed lands — one does, and it's a big one (eBay production access, unlocking the largest addressable used-gear catalogue there is), or the pedal-board builder gets shared organically and becomes the site's front door. Traffic runs a little over 2× plan by month 24 and conversion 15% above the stated rate on the back of a stronger brand and returning visitors.",
    sessions12: 1.6,
    sessions24: 2.2,
    conversion: 1.15,
    freezeAttribution: false,
  },
}
export const SCENARIO_ORDER: Array<keyof typeof SCENARIOS> = ["bear", "base", "bull"]

export type MerchantRow = {
  merchant: string
  platform: string
  ratePct: number | null
  status: "tracking" | "pending" | "unconfirmed" | "paused" | "none"
  /** Modelled from real ingested catalogue size, not a revenue measurement. */
  catalogueCount: number
  note: string
}

/**
 * Real store names and real catalogue counts (from the ingestion runs that
 * populated production). Commission rates are left unknown (—) rather than
 * guessed: GoAffPro rates are set per merchant and none have been confirmed
 * from their dashboards yet. Status reflects what actually happened this
 * session: a store is 'tracking' only where the user was handed a real,
 * working `?ref=` link by the merchant.
 */
export const MERCHANTS: MerchantRow[] = [
  { merchant: "Haze Guitar", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 1240, note: "Confirmed real referral link" },
  { merchant: "Eason Music Store", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 1037, note: "Confirmed real referral link" },
  { merchant: "Acoustic Guitar", platform: "Shopify", ratePct: null, status: "unconfirmed", catalogueCount: 1000, note: "GoAffPro enrollment not confirmed from their dashboard yet" },
  { merchant: "Folkcraft Instruments", platform: "Shopify", ratePct: null, status: "unconfirmed", catalogueCount: 859, note: "First store built, before the confirmed-link pattern" },
  { merchant: "EART Guitar", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 806, note: "Confirmed real referral link (auto-generated code, not a vanity one)" },
  { merchant: "Go Kalimba", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 176, note: "Confirmed real referral link" },
  { merchant: "Jackson Audio", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 93, note: "The first confirmed real link this session" },
  { merchant: "Jamstik", platform: "Shopify", ratePct: null, status: "unconfirmed", catalogueCount: 93, note: "GoAffPro signup done, no confirmed link handed over yet" },
  { merchant: "Play With Authority", platform: "Shopify", ratePct: null, status: "pending", catalogueCount: 39, note: "Real link in hand, GoAffPro approval still pending" },
  { merchant: "Eminence Digital", platform: "Shopify", ratePct: null, status: "tracking", catalogueCount: 60, note: "Confirmed link; digital impulse-response packs, not physical gear" },
  { merchant: "Squaver", platform: "WooCommerce", ratePct: null, status: "tracking", catalogueCount: 18, note: "Confirmed link; weaker compliance basis (Store API, no agents.md) — see CLAUDE.md" },
  { merchant: "Pures Music", platform: "Shopify", ratePct: null, status: "paused", catalogueCount: 4368, note: "Built but paused: GoAffPro enrollment not confirmed" },
  { merchant: "eBay", platform: "Buy Feed API", ratePct: null, status: "none", catalogueCount: 0, note: "Sandboxed; no production EPN keyset approved yet" },
  { merchant: "Reverb", platform: "Awin (if published)", ratePct: null, status: "none", catalogueCount: 0, note: "No confirmed publisher datafeed; never scraped, per CLAUDE.md" },
  { merchant: "Sweetwater", platform: "LinkConnector", ratePct: null, status: "none", catalogueCount: 0, note: "No confirmed feed URL" },
  { merchant: "Gear4music", platform: "Awin", ratePct: null, status: "none", catalogueCount: 0, note: "No confirmed feed URL" },
  { merchant: "zZounds / Full Compass / Pineville Music", platform: "CJ Affiliate", ratePct: null, status: "none", catalogueCount: 0, note: "CJ applications not yet through" },
]

export function attributableCatalogueCount(): number {
  return MERCHANTS.filter((m) => m.status === "tracking").reduce((sum, m) => sum + m.catalogueCount, 0)
}
export function totalLiveCatalogueCount(): number {
  return MERCHANTS.filter((m) => m.status !== "none" && m.status !== "paused").reduce(
    (sum, m) => sum + m.catalogueCount,
    0,
  )
}

export const FACTS = [
  {
    tag: "Structural · a real advantage",
    title: "This one can actually buy traffic",
    body: "Google, Meta and TikTok all restrict or outright ban ads for THC, hemp, vapes and nicotine — the category the sister sites live in. Musical instruments carry none of that restriction. Paid acquisition, creator partnerships and ordinary retargeting are all real, legal levers here in a way they structurally are not for Legal Leaf, Herbal Leaf or Nicotia Market.",
  },
  {
    tag: "Fixable · already in motion",
    title: "The catalogue already writes its own pages",
    body: "Legal Leaf's sitemap problem was 15 hand-authored URLs against a 3,576-product catalogue. Gear Avail doesn't have that problem: every ingested listing resolves to a canonical instrument page and, where a market price exists, a deals page — thousands of pages already, growing with every ingestion run, no hand-authoring required. The category redesign and pedal-board builder add depth on top of that, they don't create the base layer from nothing.",
  },
  {
    tag: "Fixable · fastest money",
    title: "About a third of live inventory has no confirmed payout",
    body: "Folkcraft, Acoustic Guitar and Jamstik together are roughly 1,952 of the 5,421 live listings and none has a confirmed GoAffPro referral link yet — every click there earns nothing until that's fixed. Separately, eBay, Reverb, Sweetwater, Gear4music and the CJ trio are fully built and paused, real compliant sources sitting dormant pending an approval or a confirmed feed URL, not a technical blocker.",
  },
]

export const NEXT_90_DAYS = [
  {
    title: "Confirm the three unconfirmed GoAffPro links",
    body: "Folkcraft, Acoustic Guitar and Jamstik are live and ingesting, but nobody has handed over a confirmed referral link the way Jackson Audio, Haze Guitar and the rest did. That's a dashboard check per store, not an engineering task.",
    why: "Multiplies revenue on traffic the site already has. Costs a login, not a build.",
  },
  {
    title: "Close out Play With Authority's pending approval",
    body: "The referral link is already wired up; it just needs the GoAffPro application to clear.",
    why: "Zero-effort revenue the moment it clears.",
  },
  {
    title: "File for eBay production access",
    body: "EBAY_FEED_BASE_URL is still sandboxed. Production access is a real application process, not a config flip, and it's the single largest addressable used-gear catalogue available to this site.",
    why: "Historically the slowest item in this project by a wide margin — start it now, not later.",
  },
  {
    title: "Confirm or drop the gated Awin/LinkConnector/CJ feeds",
    body: "Reverb, Sweetwater and Gear4music each need a confirmed publisher datafeed; zZounds, Full Compass and Pineville Music each need a CJ Affiliate application to clear. Each is a real, compliant source the moment it's confirmed — and a dead end worth dropping if it stalls indefinitely.",
    why: "A smaller aggregator that's fully compliant beats a bigger one that isn't, but a confirmed feed beats either.",
  },
  {
    title: "Ship the category redesign and the pedal-board builder",
    body: "Distinct per-category pages, real product photography treatment, and an interactive pedal-chain builder that shows going rates across every store carrying that pedal — all already in motion.",
    why: "This is the site's actual differentiator: no other aggregator in this space lets a shopper build a rig and see the market price for every piece of it.",
  },
]

export const METHOD_NOTES = [
  "Traffic follows an S-curve, not a straight line: slow for the first few months while the domain earns trust, steepest in the middle of the horizon, decelerating after. It's fitted to pass through the month-1, month-12 and month-24 anchors below exactly. Monthly seasonality is applied on top — instruments spike hardest around the holidays and Black Friday, which is why a given month's sessions can sit slightly above or below its anchor.",
  "Conversion rate is the most fragile assumption on this page. The model matures it from 80% to 125% of the stated rate over two years as trust, reviews and returning visitors accumulate. If real conversion comes in at half the stated rate, halve every revenue figure.",
  "Attribution capture starts at roughly two thirds, reflecting the real state of the 11 live stores today: about that share of live catalogue by product count has a confirmed working referral link (see the by-store table). It ramps toward 90%, which assumes the unconfirmed links actually get confirmed and at least one gated feed comes online — the ninety-day list below is exactly that work.",
  "What is not modelled: a merchant terminating its programme, a Google core update, GoAffPro changing its terms, or eBay's production application being denied outright. The last is a real, non-trivial risk for this specific business.",
  "Costs are excluded because they're immaterial next to the revenue: Vercel, Neon and Resend land well under $100/month at this scale. Affiliate commission has no cost of goods. What this business actually costs is engineering and merchant-relationship hours.",
]

export const METHOD_FOOTNOTE =
  "Every figure here is a starting assumption for a catalogue that went from 80 seed listings to real inventory across 11 stores in a single day. There is no real traffic history yet to calibrate against. Enter real Vercel Analytics sessions and real earned commission in the monthly tables as soon as a month closes, and the model stops guessing about that month and re-anchors everything after it. Projections are estimates under stated assumptions, not forecasts or guarantees — this is a planning tool for this business, not investment advice."

export const INCOME_TARGETS = [500, 1000, 2500, 5000, 8333, 20000]

export const ASSUMPTION_FIELDS: { key: keyof SiteProfile["assumptions"]; label: string; step: number }[] = [
  { key: "sessionsMonth1", label: "Sessions, month 1", step: 50 },
  { key: "sessionsMonth12", label: "Sessions, month 12", step: 250 },
  { key: "sessionsMonth24", label: "Sessions, month 24", step: 1000 },
  { key: "basket", label: "Basket $", step: 5 },
  { key: "commissionPct", label: "Commission %", step: 0.5 },
  { key: "conversionPct", label: "Conversion %", step: 0.05 },
  { key: "attributionNowPct", label: "Attribution now %", step: 5 },
  { key: "attributionExitPct", label: "Attribution mo 24 %", step: 5 },
]
