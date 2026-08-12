import { env } from "@/lib/env"
import type { Source } from "@/lib/db/schema"

/**
 * Every Impact.com advertiser whose PRODUCT CATALOGUE this site ingests.
 *
 * WHY A REGISTRY RATHER THAN A MODULE PER MERCHANT. Awin, CJ and LinkConnector
 * each got their own ingestion file because each is genuinely a different feed:
 * a different URL, a different column set, a different transport. These eight
 * are not. They are one API, one credential pair, one normaliser, and one
 * catalogue id each. Writing eight near-identical modules would be forking the
 * logic eight ways for no gain, which section 7 of CLAUDE.md rules out for
 * triggers and which applies at least as strongly to merchants.
 *
 * So a merchant here is DATA, and lib/ingestion/impact-catalogue.ts is the one
 * implementation that reads it. Adding a ninth is a row in this file, an env
 * var, a source in the SOURCES union and a store profile: no new parser.
 *
 * WHAT IS DELIBERATELY NOT IN THIS TABLE. Commission. The Impact marketplace
 * export ranks these merchants from 2% (Fender) to 15% (Donner), and the
 * catalogue rows themselves may carry per-product commission columns as
 * Anderton's do. None of that reaches this file or the parser, for the reason
 * CLAUDE.md gives at length: a payout-aware ingester is one .filter() from
 * dropping the merchants or the rows that pay least, which is ranking by
 * commission performed before the shopper ever sees a result. Fender at 2% and
 * Donner at 15% are ingested identically and ranked identically.
 */

export type ImpactMerchant = {
  /**
   * URL and CLI key. Also the BullMQ scheduler id and the cron route segment,
   * so it has to be stable: changing one orphans a schedule rather than
   * renaming it.
   */
  key: string
  source: Source
  label: string
  /**
   * Impact catalogue id, read off the account. Empty means unconfigured, which
   * is a supported state: the job logs a reason and writes nothing.
   */
  catalogId: string
  /**
   * The variable `catalogId` is read from, named here rather than derived from
   * the key. Deriving it would work today and silently stop working the first
   * time a key and a variable name disagree, and the admin panel prints this
   * for a human to paste into Vercel, so a wrong guess is a wasted trip.
   */
  envVar: string
  /**
   * The brand's PROGRAMME id on Impact, from the marketplace export.
   *
   * NOT THE CATALOGUE ID, AND NEVER USABLE AS ONE. This is the number that
   * identifies the advertiser's programme: the thing a publisher applies to.
   * A catalogue id identifies one published product feed belonging to that
   * programme, and the two are unrelated numbers. Anderton's is the proof
   * sitting in this repo already: catalogue 30480, campaign 43829.
   *
   * Putting a programme id in `catalogId` would ask the API for
   * /Catalogs/<programme>/Items, which either 404s or returns whichever
   * advertiser genuinely owns a catalogue with that number, filing their stock
   * under this merchant's name. That is the failure the hard "do not" list
   * calls out as worse than a 404 because nothing fails.
   *
   * What it is good for is matching. The admin catalogue list uses it to say
   * which returned catalogue belongs to which merchant here, instead of asking
   * a human to pair up two lists of names by eye. Nothing in the ingestion path
   * reads it.
   */
  programId?: string
  /**
   * Currency stamped on a row when the catalogue carries no currency column.
   *
   * A FALLBACK, NOT A DECLARATION. The feed's own column always wins where one
   * exists, and the ingest run records whether it had to fall back
   * (`fellBackOnCurrency` in the run detail) precisely because this value is a
   * guess about a merchant's home market and a wrong one mislabels every row
   * silently. Check it against the first real pull.
   */
  fallbackCurrency: string
  /** Stamped on `location_country`. Where the merchant ships FROM, not where it ships to. */
  country: string
  /**
   * The merchant's own storefront hosts, for the /go allowlist.
   *
   * Impact catalogues carry a tracked link and often the merchant's untracked
   * product page beside it; the untracked one becomes `raw_url` and has to
   * clear the allowlist or /go refuses to follow it. Kept here so a merchant's
   * domains are declared in the same row as everything else about it, and
   * asserted against lib/affiliate/allowed-hosts.ts by a test.
   */
  hosts: string[]
  /** One line for the store page and the admin catalogue list. */
  note: string
}

/**
 * Anderton's, named separately because it is the one merchant with a second
 * transport: lib/ingestion/andertons-impact.ts pulls the same catalogue over
 * Impact's FTP drop and needs this descriptor by name rather than by lookup.
 */
export const ANDERTONS: ImpactMerchant = {
  key: "andertons",
  source: "andertons",
  label: "Andertons Music Company",
  catalogId: env.impact.andertonsCatalogId,
  envVar: "IMPACT_ANDERTONS_CATALOG_ID",
  programId: "43829",
  // Confirmed: Anderton's trades only in the UK and prices in pounds.
  fallbackCurrency: "GBP",
  country: "GB",
  hosts: ["andertons.co.uk"],
  note: "Catalogue 30480, campaign 43829, ~27,052 products. Also reachable over FTP.",
}

/**
 * The merchants, in the order they were approved.
 *
 * All eight are NEW-RETAIL sellers, so an empty condition column means new
 * stock, the same call gear4music-awin.ts and the CJ modules make and the same
 * one section 8 depends on to keep the new and used medians apart. There is no
 * per-merchant condition override here because none of them is a peer
 * marketplace; if one ever is, it needs a used default and a fresh look at
 * where its rows land in the median.
 */
export const IMPACT_MERCHANTS: ImpactMerchant[] = [
  ANDERTONS,
  {
    key: "americanmusical",
    source: "americanmusical",
    label: "American Musical Supply",
    catalogId: env.impact.americanMusicalCatalogId,
    envVar: "IMPACT_AMERICANMUSICAL_CATALOG_ID",
    programId: "47665",
    fallbackCurrency: "USD",
    country: "US",
    hosts: ["americanmusical.com"],
    note: "US instrument retailer, broad catalogue.",
  },
  {
    key: "musiciansfriend",
    source: "musiciansfriend",
    label: "Musician's Friend",
    catalogId: env.impact.musiciansFriendCatalogId,
    envVar: "IMPACT_MUSICIANSFRIEND_CATALOG_ID",
    programId: "14291",
    fallbackCurrency: "USD",
    country: "US",
    hosts: ["musiciansfriend.com"],
    note: "US instrument retailer, one of the largest catalogues on the network.",
  },
  {
    key: "nativeinstruments",
    source: "nativeinstruments",
    label: "Native Instruments",
    catalogId: env.impact.nativeInstrumentsCatalogId,
    envVar: "IMPACT_NATIVEINSTRUMENTS_CATALOG_ID",
    programId: "29910",
    /*
     * USD is the guess, and it is a guess worth watching. Native Instruments is
     * a Berlin company that prices in EUR at home and USD in the US store, so
     * whichever the catalogue carries, this fallback only applies if it carries
     * no currency column at all. If the first pull reports fellBackOnCurrency,
     * check the real prices before trusting a single one of them.
     */
    fallbackCurrency: "USD",
    country: "DE",
    hosts: ["native-instruments.com"],
    note: "Software instruments and effects, plus Maschine/Komplete hardware.",
  },
  {
    key: "fender",
    source: "fender",
    label: "Fender",
    catalogId: env.impact.fenderCatalogId,
    envVar: "IMPACT_FENDER_CATALOG_ID",
    programId: "33985",
    fallbackCurrency: "USD",
    country: "US",
    hosts: ["fender.com"],
    note: "The brand's own direct storefront, not a dealer.",
  },
  {
    key: "universalaudio",
    source: "universalaudio",
    label: "Universal Audio",
    catalogId: env.impact.universalAudioCatalogId,
    envVar: "IMPACT_UNIVERSALAUDIO_CATALOG_ID",
    programId: "39245",
    fallbackCurrency: "USD",
    country: "US",
    hosts: ["uaudio.com"],
    note: "Interfaces, UAFX pedals and the plugin catalogue, direct from UA.",
  },
  {
    key: "donner",
    source: "donner",
    label: "Donner Music",
    catalogId: env.impact.donnerCatalogId,
    envVar: "IMPACT_DONNER_CATALOG_ID",
    programId: "43895",
    /*
     * Donner runs several regional programmes on Impact, one of them labelled
     * "Online sale-EU". If the catalogue this account can read turns out to be
     * the EU one, the prices are euros and this line is wrong: watch
     * fellBackOnCurrency on the first pull, and prefer the feed's own column.
     */
    fallbackCurrency: "USD",
    country: "US",
    hosts: ["donnermusic.com", "donnerdeal.com"],
    note: "Budget instruments, pedals and controllers, sold direct.",
  },
  {
    key: "pluginalliance",
    source: "pluginalliance",
    label: "Plugin Alliance",
    catalogId: env.impact.pluginAllianceCatalogId,
    envVar: "IMPACT_PLUGINALLIANCE_CATALOG_ID",
    programId: "30401",
    fallbackCurrency: "USD",
    country: "DE",
    hosts: ["plugin-alliance.com"],
    note: "Studio plugins from Brainworx and partner brands. Software, but sold as products.",
  },
]

export const IMPACT_MERCHANT_BY_KEY = new Map(IMPACT_MERCHANTS.map((m) => [m.key, m]))
export const IMPACT_MERCHANT_BY_SOURCE = new Map(IMPACT_MERCHANTS.map((m) => [m.source, m]))

export function impactMerchant(key: string): ImpactMerchant | null {
  return IMPACT_MERCHANT_BY_KEY.get(key.toLowerCase()) ?? null
}

/** True when this merchant can actually be pulled: account credentials AND a catalogue id. */
export function canPullImpactMerchant(merchant: ImpactMerchant): boolean {
  return Boolean(env.impact.hasApi && merchant.catalogId)
}

/**
 * Why a merchant cannot be pulled, phrased as the thing to go and do.
 *
 * Split from the boolean above because the two failures have completely
 * different fixes and the same symptom (a job that writes nothing): missing
 * credentials are one paste into Vercel for every merchant at once, while a
 * missing catalogue id is per merchant and has to be read off the account.
 */
export function impactSkipReason(merchant: ImpactMerchant): string | null {
  if (!env.impact.hasApi) {
    return (
      `IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN are not set, so ${merchant.label} is skipped. ` +
      "Both are on the Impact platform's API settings page and are shared by every merchant."
    )
  }
  if (!merchant.catalogId) {
    return (
      `No catalogue id for ${merchant.label}, so it is skipped. ` +
      "Run the admin \"List the Impact catalogues\" button to read the real ids off this account, " +
      "then set the matching IMPACT_*_CATALOG_ID. Do not guess one: a wrong id either 404s or " +
      "returns another advertiser's products under this merchant's name."
    )
  }
  return null
}
