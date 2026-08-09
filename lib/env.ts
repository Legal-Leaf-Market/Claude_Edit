/**
 * Central environment access.
 *
 * MusicTime is built against gated data sources: the eBay Buy Feed API is a
 * Limited Release that needs EPN approval, and the Reverb catalogue is only
 * available to us if Awin publishes a product datafeed to publishers. Neither
 * is guaranteed at build time, so nothing in this file throws on a missing
 * credential. Instead every integration exposes an `isConfigured` flag and the
 * callers no-op loudly (a logged warning) rather than crashing a cron or a
 * page render.
 *
 * The one hard requirement is DATABASE_URL.
 */

function str(name: string, fallback = ""): string {
  const v = process.env[name]
  return v === undefined || v === "" ? fallback : v
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v === undefined || v === "") return fallback
  return /^(1|true|yes|on)$/i.test(v)
}

function int(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(n) ? n : fallback
}

/** eBay's sandbox host. Production is api.ebay.com and requires an approved keyset. */
const EBAY_SANDBOX_BASE = "https://api.sandbox.ebay.com/buy/feed/v1_beta"

export const env = {
  databaseUrl: str("DATABASE_URL"),
  redisUrl: str("REDIS_URL"),

  site: {
    url: str("SITE_URL", "http://localhost:3000"),
    name: "MusicTime",
  },

  ebay: {
    /**
     * Defaults to SANDBOX on purpose. Production access is a separate approval
     * and we never want a misconfigured deploy hammering the live feed with a
     * sandbox-shaped token.
     */
    baseUrl: str("EBAY_FEED_BASE_URL", EBAY_SANDBOX_BASE),
    oauthToken: str("EBAY_OAUTH_TOKEN"),
    marketplaceId: str("EBAY_MARKETPLACE_ID", "EBAY_US"),
    affiliateCampaignId: str("EBAY_AFFILIATE_CAMPAIGN_ID"),
    /** Musical Instruments & Gear (L1, EBAY_US). Verify via the Taxonomy API. */
    categoryIds: str("EBAY_CATEGORY_IDS", "619")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** Bytes per Range request. eBay allows up to 100 MB; 10 MB is the documented example. */
    chunkBytes: int("EBAY_FEED_CHUNK_BYTES", 10 * 1024 * 1024),
    /** Daily getItemFeed call budget, guarded client side before we ever hit 429. */
    dailyCallBudget: int("EBAY_DAILY_CALL_BUDGET", 10_000),
    get isConfigured(): boolean {
      return Boolean(env.ebay.oauthToken)
    },
    get isSandbox(): boolean {
      return env.ebay.baseUrl.includes("sandbox")
    },
  },

  awin: {
    publisherId: str("AWIN_PUBLISHER_ID"),
    reverbMerchantId: str("AWIN_REVERB_MERCHANT_ID"),
    /**
     * Reverb's product datafeed URL from the Awin publisher dashboard. Unset is
     * the expected state until we confirm Reverb publishes one. When unset the
     * Reverb worker logs and no-ops. It never falls back to the Reverb API or
     * to scraping, both of which their terms forbid for aggregation.
     */
    reverbFeedUrl: str("AWIN_REVERB_FEED_URL"),
    get isConfigured(): boolean {
      return Boolean(env.awin.publisherId && env.awin.reverbMerchantId)
    },
    get hasFeed(): boolean {
      return Boolean(env.awin.reverbFeedUrl)
    },
  },

  linkconnector: {
    /**
     * Sweetwater's affiliate program runs on LinkConnector. Their datafeed
     * URL, if a Sweetwater product feed is confirmed to exist there. Unset is
     * the expected state until confirmed; when unset the Sweetwater worker
     * logs and no-ops. It never falls back to scraping sweetwater.com or its
     * search index.
     */
    sweetwaterFeedUrl: str("LINKCONNECTOR_SWEETWATER_FEED_URL"),
    get hasSweetwaterFeed(): boolean {
      return Boolean(env.linkconnector.sweetwaterFeedUrl)
    },
  },

  typesense: {
    host: str("TYPESENSE_HOST"),
    port: int("TYPESENSE_PORT", 443),
    protocol: str("TYPESENSE_PROTOCOL", "https"),
    apiKey: str("TYPESENSE_API_KEY"),
    searchOnlyKey: str("TYPESENSE_SEARCH_ONLY_KEY"),
    collection: str("TYPESENSE_COLLECTION", "listings"),
    get isConfigured(): boolean {
      return Boolean(env.typesense.host && env.typesense.apiKey)
    },
  },

  alerts: {
    resendApiKey: str("RESEND_API_KEY"),
    fromEmail: str("SITE_FROM_EMAIL", "alerts@musictime.app"),
    discordWebhookUrl: str("DISCORD_WEBHOOK_URL"),
    get canEmail(): boolean {
      return Boolean(env.alerts.resendApiKey)
    },
    get canDiscord(): boolean {
      return Boolean(env.alerts.discordWebhookUrl)
    },
  },

  auth: {
    secret: str("BETTER_AUTH_SECRET"),
    url: str("BETTER_AUTH_URL", str("SITE_URL", "http://localhost:3000")),
    get isConfigured(): boolean {
      return Boolean(env.auth.secret)
    },
  },

  /**
   * Shared secret for the /api/cron/* routes. Fails CLOSED: an unset secret
   * makes every cron return 503 rather than running unauthenticated. This is
   * the same guard the sister sites use.
   */
  cronSecret: str("CRON_SECRET"),

  /** Skips network calls in tests and lets fixtures drive the ingestion path. */
  offline: bool("MUSICTIME_OFFLINE", false),
} as const

/** One-line startup summary so a misconfigured deploy is obvious in the logs. */
export function describeConfig(): string {
  const parts = [
    `db=${env.databaseUrl ? "set" : "MISSING"}`,
    `ebay=${env.ebay.isConfigured ? (env.ebay.isSandbox ? "sandbox" : "production") : "unconfigured"}`,
    `awin=${env.awin.isConfigured ? "set" : "unconfigured"}`,
    `reverb-feed=${env.awin.hasFeed ? "set" : "absent"}`,
    `sweetwater-feed=${env.linkconnector.hasSweetwaterFeed ? "set" : "absent"}`,
    `typesense=${env.typesense.isConfigured ? "set" : "postgres-fallback"}`,
    `redis=${env.redisUrl ? "set" : "absent"}`,
  ]
  return parts.join(" ")
}
