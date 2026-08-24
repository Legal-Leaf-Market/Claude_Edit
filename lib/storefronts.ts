import { env } from "@/lib/env"
import type { Source } from "@/lib/db/schema"

/**
 * THE STOREFRONT REGISTRY. One row per independent seller we read a public
 * catalogue from, and one reader behind all of them.
 *
 * WHY THE DATA LIVES OUT HERE AND NOT UNDER lib/ingestion. `sourceLabel()` in
 * lib/utils.ts reads it, and lib/utils.ts is in every client bundle on the
 * site. A registry that imported the feed readers would pull `./upsert`, and
 * therefore `lib/db` and `pg`, into the browser. It would also put the
 * ingestion tree one hop from the guide's tree, which is precisely the
 * indirect reach tests/stompbox/boundary.test.ts warns it cannot see. So the
 * ROWS are data with no ingestion dependency, and the thing that RUNS them is
 * lib/ingestion/storefront-merchants.ts, which imports this.
 *
 * WHY THIS FILE EXISTS. There were eleven modules named `*-shopify.ts`, plus
 * `squaver-woocommerce.ts`, and diffing any two of them with the names
 * normalised left exactly two differences: the docstring and the base URL.
 * Everything else was the same fourteen lines. That is section 7's "never fork
 * the logic" broken eleven ways, and it had the cost you would expect: adding
 * one store meant editing SIXTEEN files (the module, a cron route, vercel.json,
 * the source union, the label switch, the cart platform switch, the host
 * allowlist, the env block, the queue job union, the scheduler, the worker
 * switch, the CLI script, package.json, and the tests for three of those).
 * Sixteen edit sites is not a chore, it is a rate limit: it is why the
 * catalogue is eleven small sellers rather than fifty.
 *
 * A merchant is now a row here. The Impact registry made the same move for the
 * same reason and it is the shape to copy.
 *
 * ---------------------------------------------------------------------------
 *
 * TWO QUESTIONS THAT USED TO BE ONE, AND SEPARATING THEM IS THE POINT.
 *
 * The old per-store docstrings ran the two together: "confirmed enrolled in an
 * affiliate program AND publishes an agents.md sanctioning /products.json",
 * stated as a single condition for ingesting. They are not one condition, they
 * are two facts about different things, and merging them gets BOTH wrong:
 *
 *   PERMISSION is whether we are allowed to read the catalogue at all. It is
 *   the legal question, it is the one section 2 is about, and it is a hard
 *   gate. No permission, no row. This is `permission` below.
 *
 *   ENROLLMENT is whether the traffic we send earns anything. It is a business
 *   fact, it decides only whether `affiliate_url` is a real link or null, and
 *   section 17 is explicit that it must not decide anything else: "Whether a
 *   merchant pays us is not a reason to delist them... payout is not an input
 *   to that decision." This is `affiliate` below.
 *
 * Gating ingestion on enrollment was the same act as ranking by commission,
 * performed one step earlier: it meant the catalogue a shopper searches is the
 * subset of the world that pays us, which is exactly what the footer promises
 * does not happen. lib/stores.ts already fixed this for the /shop pages after
 * the first version allocated pages by payout status; this is the same fix at
 * the ingestion layer.
 *
 * So a store with sanctioned access and no affiliate program is a legitimate
 * row here, and it ingests. Its listings simply carry a null `affiliate_url`
 * and `/go` sends the shopper to the merchant's own page, which is the same
 * "no half-built link, earning nothing beats a tracker that credits nobody"
 * rule every network here follows.
 *
 * ---------------------------------------------------------------------------
 *
 * WHAT PERMISSION IS NOT. It is not "the endpoint answered". Everything
 * rejected in section 2 would also have answered: Guitar Center's Algolia
 * index answers, Sweetwater's search answers, the Reverb API answers with real
 * credentials. A 200 is evidence about a server, not about a right, and the
 * `basis` field below records the right rather than the response.
 *
 * `agents-md` is the strong basis and the only one that scales. Shopify ships
 * an `/agents.md` platform-wide whose "Read-Only Browsing (No Authentication
 * Required)" section names `/products.json` as the sanctioned no-auth path for
 * agents reading catalogue data without transacting. That is a publisher
 * saying what agents may do, in a file published for agents to read, which is
 * a materially stronger thing than inferring permission from `robots.txt` not
 * forbidding it.
 *
 * `explicit-decision` is the weak one and exists for exactly one row. Squaver
 * runs WooCommerce, has no agents.md at all, and its Store API is
 * unauthenticated because it backs WooCommerce's own checkout blocks rather
 * than because anybody published it for aggregation. That is the same shape
 * rejected for Guitar Center. The owner was told so and chose to build it
 * anyway for one confirmed store. It is marked, so nobody later reads it as
 * precedent for the next WooCommerce store; a second one needs its own call.
 *
 * VERIFY BEFORE YOU ADD A ROW, and do not verify it by hand. `/api/admin/
 * storefront-probe` fetches a candidate's agents.md, robots.txt and one page of
 * products.json and reports what it actually found. Paste the verdict into
 * `note` and put the date in `checkedOn`. The point of recording it is that a
 * year from now the only question anybody can answer about a row is the one
 * somebody wrote down.
 */

export type StorefrontPlatform = "shopify" | "woocommerce"

/** Why we are allowed to read this store's catalogue. Recorded, not assumed. */
export type StorefrontPermission = {
  /**
   * `agents-md`: the store publishes an agents.md sanctioning the endpoint.
   * `explicit-decision`: no such file, and the owner chose to proceed anyway
   * with the weakness understood. Never the default, never precedent.
   */
  basis: "agents-md" | "explicit-decision"
  /** ISO date somebody actually looked. */
  checkedOn: string
  /** What they saw, in their own words. */
  note: string
}

/**
 * Whether traffic to this store earns anything. Deliberately has no bearing on
 * whether the store is ingested, ranked, or given a /shop page.
 */
export type AffiliateEnrollment = "goaffpro" | "unconfirmed" | "none"

export type StorefrontMerchant = {
  source: Source
  label: string
  /** Store origin, no trailing slash. */
  baseUrl: string
  platform: StorefrontPlatform
  currency?: string
  locationCountry?: string
  /** WooCommerce only; defaults to the platform's own '/cart/'. */
  cartPath?: string
  permission: StorefrontPermission
  affiliate: AffiliateEnrollment
  /**
   * Read lazily, never captured. `env` resolves at call time and the test
   * suite mutates process.env between cases, so a value read while this module
   * is being imported would freeze whatever happened to be set first.
   */
  referral: () => { refParam?: string; refCode?: string }
  /**
   * Cron pattern, or null for a store that is built but deliberately not
   * scheduled. Same "code stays, schedule doesn't" treatment Full Compass and
   * Pineville Music get: pausing a store must not delete the work.
   */
  schedule: string | null
  /** Why it is paused, when it is. Required by the type so it cannot be silent. */
  pausedReason?: string
}

/**
 * The `agents.md` note every Shopify row shares. Written once because it is
 * one fact about one platform-wide file, and eleven paraphrases of one fact is
 * how the paraphrases start disagreeing.
 */
const SHOPIFY_AGENTS_MD =
  "Shopify's platform-wide /agents.md, whose \"Read-Only Browsing (No Authentication Required)\" " +
  "section names /products.json as the sanctioned no-auth path for agents reading catalogue data " +
  "without transacting. Verified present on this store, not assumed from the platform."

export const STOREFRONT_MERCHANTS: StorefrontMerchant[] = [
  {
    source: "folkcraft",
    label: "Folkcraft Instruments",
    baseUrl: "https://folkcraft.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.folkcraft,
    schedule: "30 */6 * * *",
  },
  {
    source: "acousticguitar",
    label: "Acoustic Guitar",
    baseUrl: "https://store.acousticguitar.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.acousticGuitar,
    schedule: "45 */6 * * *",
  },
  {
    source: "jamstik",
    label: "Jamstik",
    baseUrl: "https://www.jamstik.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.jamstik,
    schedule: "15 */6 * * *",
  },
  {
    source: "jacksonaudio",
    label: "Jackson Audio",
    baseUrl: "https://jackson.audio",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.jacksonAudio,
    schedule: "35 */6 * * *",
  },
  {
    source: "eminencedigital",
    label: "Eminence Digital",
    baseUrl: "https://eminence-digital.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.eminenceDigital,
    schedule: "5 */6 * * *",
  },
  {
    source: "hazeguitar",
    label: "Haze Guitar",
    baseUrl: "https://www.hazeguitar.com.au",
    platform: "shopify",
    // Australian storefront. Left at the USD/US default until somebody
    // confirms what the JSON actually prices in: guessing AUD here would
    // print a wrong number, which is worse than an unconverted right one.
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.hazeGuitar,
    schedule: "25 */6 * * *",
  },
  {
    source: "eartguitar",
    label: "EART Guitar",
    baseUrl: "https://eartguitar.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.eartGuitar,
    schedule: "50 */6 * * *",
  },
  {
    source: "playwithauthority",
    label: "Play With Authority",
    baseUrl: "https://www.playwithauthority.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.playWithAuthority,
    schedule: "55 */6 * * *",
  },
  {
    source: "easonmusicstore",
    label: "Eason Music Store",
    baseUrl: "https://www.easonmusicstore.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.easonMusicStore,
    schedule: "12 */6 * * *",
  },
  {
    source: "gokalimba",
    label: "Go Kalimba",
    baseUrl: "https://www.gokalimba.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.goKalimba,
    schedule: "18 */6 * * *",
  },
  {
    source: "puresmusic",
    label: "Pures Music",
    baseUrl: "https://www.puresmusic.com",
    platform: "shopify",
    permission: { basis: "agents-md", checkedOn: "2026-08-19", note: SHOPIFY_AGENTS_MD },
    // Never confirmed, and not why it is paused. Recorded separately so the
    // two reasons cannot be mistaken for each other later.
    affiliate: "unconfirmed",
    referral: () => env.goaffpro.puresMusic,
    schedule: null,
    pausedReason:
      "A product-mix decision, not a permission or payout one. The catalogue is crystal singing " +
      "bowls and chakra tuning forks mixed with real instruments, and the owner does not want that " +
      "mix on the site. Ingested whole with no category filtering when it runs, because filtering a " +
      "feed to the parts we like is a different decision again. Do not re-enable without an explicit " +
      "call to carry the product-mix concern anyway.",
  },
  {
    source: "squaver",
    label: "Squaver",
    baseUrl: "https://squaver.in",
    platform: "woocommerce",
    cartPath: "/cart/",
    permission: {
      basis: "explicit-decision",
      checkedOn: "2026-08-19",
      note:
        "NO agents.md at all: Squaver runs WordPress + WooCommerce, and the only public catalogue " +
        "read is the Store API (/wp-json/wc/store/v1/products), which is unauthenticated because it " +
        "backs WooCommerce's own cart and checkout blocks, NOT because Squaver published it for " +
        "third-party aggregation. That is the same 'built for the site's own frontend rather than " +
        "published for this use' shape rejected for Guitar Center. The owner was told this " +
        "explicitly and chose to build it for this one confirmed GoAffPro store. Specific to " +
        "Squaver; not precedent for another WooCommerce store without an equivalent call.",
    },
    affiliate: "goaffpro",
    referral: () => env.goaffpro.squaver,
    schedule: "8 */6 * * *",
  },
]

const BY_SOURCE = new Map(STOREFRONT_MERCHANTS.map((m) => [m.source as string, m]))

export function storefrontMerchant(source: string): StorefrontMerchant | null {
  return BY_SOURCE.get(source) ?? null
}

export function isStorefrontSource(source: string): boolean {
  return BY_SOURCE.has(source)
}

/** The rows that actually run on a timer. A paused store keeps its row. */
export function scheduledStorefrontMerchants(): StorefrontMerchant[] {
  return STOREFRONT_MERCHANTS.filter((m) => m.schedule !== null)
}
