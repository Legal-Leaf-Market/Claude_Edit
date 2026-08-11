/**
 * Central environment access.
 *
 * Gear Avail is built against gated data sources: the eBay Buy Feed API is a
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
    name: "Gear Avail",
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

    gear4musicMerchantId: str("AWIN_GEAR4MUSIC_MERCHANT_ID"),
    /** Gear4music's Awin product datafeed URL. Unset means the worker no-ops. */
    gear4musicFeedUrl: str("AWIN_GEAR4MUSIC_FEED_URL"),
    get gear4musicIsConfigured(): boolean {
      return Boolean(env.awin.publisherId && env.awin.gear4musicMerchantId)
    },
    get hasGear4musicFeed(): boolean {
      return Boolean(env.awin.gear4musicFeedUrl)
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

  cj: {
    /**
     * CJ Affiliate (formerly Commission Junction). Each advertiser is a
     * separate program with its own product feed; zZounds and Full Compass
     * Systems are both CJ advertisers but have independent feed URLs.
     * Unset is the expected state until each is confirmed in the CJ account
     * dashboard. Never falls back to scraping either site.
     */
    zzoundsFeedUrl: str("CJ_ZZOUNDS_FEED_URL"),
    get hasZzoundsFeed(): boolean {
      return Boolean(env.cj.zzoundsFeedUrl)
    },
    fullCompassFeedUrl: str("CJ_FULLCOMPASS_FEED_URL"),
    get hasFullCompassFeed(): boolean {
      return Boolean(env.cj.fullCompassFeedUrl)
    },
    pinevilleMusicFeedUrl: str("CJ_PINEVILLEMUSIC_FEED_URL"),
    get hasPinevilleMusicFeed(): boolean {
      return Boolean(env.cj.pinevilleMusicFeedUrl)
    },
  },

  impact: {
    /**
     * Impact.com (formerly Impact Radius), carrying the Anderton's programme,
     * APPROVED 11 Aug 2026. The site's Universal Tracking Tag is live sitewide
     * (app/layout.tsx) for Impact's own site-verification step, which was
     * always independent of catalogue ingestion.
     *
     * FTP, NOT AN HTTPS FEED URL. This started life as
     * `IMPACT_ANDERTONS_FEED_URL` on the assumption that Impact delivered
     * catalogues the way Awin, CJ and LinkConnector do, over an authenticated
     * HTTPS URL. It does not: Impact drops catalogues on an FTP server
     * (products.impact.com, one directory per advertiser) and the publisher
     * pulls them from there. The shape below matches how the feed is actually
     * delivered rather than how the other four networks deliver theirs.
     *
     * Two consequences worth knowing before the ingestion module gets written:
     *
     *   1. It cannot run from a Vercel cron route. FTP needs a control
     *      connection plus passive data ports, which a serverless function
     *      cannot hold open, so this job belongs on the BullMQ worker (the
     *      second trigger in section 7 of CLAUDE.md) rather than beside the
     *      other `/api/cron/ingest-*` routes.
     *   2. The password is a real credential, unlike every other value in
     *      this block. It is read from the environment and never written to
     *      a file, and .env.example carries the key with no value.
     *
     * Still no row-normaliser: Impact has no fixed product-feed schema (brands
     * configure their own field names per catalogue, confirmed against
     * Impact's own "File Formats for Product Catalogs" docs), so the column
     * headers have to be read off the real file first. Unset is the expected
     * state until then, same as every other unconfirmed source in this file.
     */
    andertonsFtpHost: str("IMPACT_ANDERTONS_FTP_HOST", "products.impact.com"),
    andertonsFtpUser: str("IMPACT_ANDERTONS_FTP_USER"),
    andertonsFtpPassword: str("IMPACT_ANDERTONS_FTP_PASSWORD"),
    andertonsFtpPath: str("IMPACT_ANDERTONS_FTP_PATH", "/Andertons-Music-Company/"),
    /**
     * Gated on the credential pair rather than the host or path, since those
     * two have real defaults and would otherwise report a feed as configured
     * when nothing can actually authenticate to it.
     */
    get hasAndertonsFeed(): boolean {
      return Boolean(env.impact.andertonsFtpUser && env.impact.andertonsFtpPassword)
    },
  },

  /**
   * Small independent Shopify sellers, confirmed enrolled in GoAffPro (or a
   * similar affiliate app) and verified per-store to publish an agents.md
   * "Read-Only Browsing" section sanctioning /products.json. Catalogue
   * ingestion works with no credentials at all; these vars only carry this
   * publisher's actual referral code for that store's program, so listings
   * get a real affiliate_url instead of a null one.
   */
  goaffpro: {
    folkcraft: {
      refParam: str("GOAFFPRO_FOLKCRAFT_REF_PARAM"),
      refCode: str("GOAFFPRO_FOLKCRAFT_REF_CODE"),
    },
    acousticGuitar: {
      refParam: str("GOAFFPRO_ACOUSTICGUITAR_REF_PARAM"),
      refCode: str("GOAFFPRO_ACOUSTICGUITAR_REF_CODE"),
    },
    jamstik: {
      refParam: str("GOAFFPRO_JAMSTIK_REF_PARAM"),
      refCode: str("GOAFFPRO_JAMSTIK_REF_CODE"),
    },
    jacksonAudio: {
      // Defaults to "ref", the parameter in the approved referral link
      // (jackson.audio/?ref=...); the real code is still required from env.
      refParam: str("GOAFFPRO_JACKSONAUDIO_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_JACKSONAUDIO_REF_CODE"),
    },
    eminenceDigital: {
      refParam: str("GOAFFPRO_EMINENCEDIGITAL_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_EMINENCEDIGITAL_REF_CODE"),
    },
    hazeGuitar: {
      refParam: str("GOAFFPRO_HAZEGUITAR_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_HAZEGUITAR_REF_CODE"),
    },
    eartGuitar: {
      refParam: str("GOAFFPRO_EARTGUITAR_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_EARTGUITAR_REF_CODE"),
    },
    playWithAuthority: {
      refParam: str("GOAFFPRO_PLAYWITHAUTHORITY_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_PLAYWITHAUTHORITY_REF_CODE"),
    },
    puresMusic: {
      refParam: str("GOAFFPRO_PURESMUSIC_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_PURESMUSIC_REF_CODE"),
    },
    squaver: {
      refParam: str("GOAFFPRO_SQUAVER_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_SQUAVER_REF_CODE"),
    },
    easonMusicStore: {
      refParam: str("GOAFFPRO_EASONMUSICSTORE_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_EASONMUSICSTORE_REF_CODE"),
    },
    goKalimba: {
      refParam: str("GOAFFPRO_GOKALIMBA_REF_PARAM", "ref"),
      refCode: str("GOAFFPRO_GOKALIMBA_REF_CODE"),
    },
  },

  /**
   * Groq, powering the "Ask" assistant (lib/ai/).
   *
   * Same isConfigured shape as every other integration in this file: unset
   * means /api/ask answers 503 with a plain reason and the Ask button never
   * renders, rather than the page throwing. Nothing else on the site depends
   * on it, so an unset key costs exactly one feature.
   *
   * The model default is openai/gpt-oss-120b because it is the model Groq's
   * own deprecation notices point every retired model at (kimi-k2-instruct in
   * March 2026, qwen3-32b and llama-4-scout in June 2026), and it supports the
   * tool calling this depends on. It is overridable per environment precisely
   * because that list keeps moving: when this one is retired in turn, set
   * GROQ_MODEL rather than shipping a code change.
   */
  groq: {
    apiKey: str("GROQ_API_KEY"),
    model: str("GROQ_MODEL", "openai/gpt-oss-120b"),
    baseUrl: str("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
    /**
     * Per-IP question budget per FIXED CLOCK HOUR, resetting on the hour, not a
     * rolling window. Generous for a person, useless for a scraper.
     */
    hourlyLimitPerIp: int("GROQ_HOURLY_LIMIT_PER_IP", 30),
    get isConfigured(): boolean {
      return Boolean(env.groq.apiKey)
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
    fromEmail: str("SITE_FROM_EMAIL", "alerts@gearavail.app"),
    discordWebhookUrl: str("DISCORD_WEBHOOK_URL"),
    get canEmail(): boolean {
      return Boolean(env.alerts.resendApiKey)
    },
    get canDiscord(): boolean {
      return Boolean(env.alerts.discordWebhookUrl)
    },
  },

  /**
   * Where "get your shop listed" submissions get emailed. Reuses
   * RESEND_API_KEY/DISCORD_WEBHOOK_URL above rather than a separate
   * credential; only the destination address is new. Unset means the lead
   * still gets saved to the database (that is the durable record), it just
   * has no notification sent, the same "log to DB, notify best effort"
   * pattern as everything else here.
   */
  leads: {
    notifyEmail: str("LEADS_NOTIFY_EMAIL"),
    get canEmail(): boolean {
      return Boolean(env.alerts.resendApiKey && env.leads.notifyEmail)
    },
  },

  auth: {
    secret: str("BETTER_AUTH_SECRET"),
    url: str("BETTER_AUTH_URL", str("SITE_URL", "http://localhost:3000")),
    get isConfigured(): boolean {
      return Boolean(env.auth.secret)
    },
    /**
     * Optional. Signing in with a Google account someone already has removes
     * the "make up a password" wall in front of every auth-gated feature
     * (alerts, Flip Match). Unset means the sign-in page just shows email and
     * password, same as before this existed.
     */
    google: {
      clientId: str("GOOGLE_CLIENT_ID"),
      clientSecret: str("GOOGLE_CLIENT_SECRET"),
      get isConfigured(): boolean {
        return Boolean(env.auth.google.clientId && env.auth.google.clientSecret)
      },
    },
  },

  /**
   * Shared secret for the /api/cron/* routes. Fails CLOSED: an unset secret
   * makes every cron return 503 rather than running unauthenticated. This is
   * the same guard the sister sites use.
   */
  cronSecret: str("CRON_SECRET"),

  /**
   * Official Instagram post embeds (embed.js), never a scraped feed widget.
   * INSTAGRAM_POST_URLS is a comma list of public post permalinks; unset
   * means the homepage section renders as a plain follow callout instead of
   * embeds, the same isConfigured-style fallback every other integration in
   * this file uses, so a missing credential never ships a broken widget.
   */
  social: {
    instagramHandle: str("INSTAGRAM_HANDLE", "stompbox.world"),
    instagramPostUrls: str("INSTAGRAM_POST_URLS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    get hasInstagramPosts(): boolean {
      return env.social.instagramPostUrls.length > 0
    },
  },

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
    `gear4music-feed=${env.awin.hasGear4musicFeed ? "set" : "absent"}`,
    `zzounds-feed=${env.cj.hasZzoundsFeed ? "set" : "absent"}`,
    `fullcompass-feed=${env.cj.hasFullCompassFeed ? "set" : "absent"}`,
    `pinevillemusic-feed=${env.cj.hasPinevilleMusicFeed ? "set" : "absent"}`,
    `andertons-feed=${env.impact.hasAndertonsFeed ? "set" : "absent"}`,
    `typesense=${env.typesense.isConfigured ? "set" : "postgres-fallback"}`,
    `groq=${env.groq.isConfigured ? env.groq.model : "unconfigured"}`,
    `redis=${env.redisUrl ? "set" : "absent"}`,
    `leads-notify=${env.leads.canEmail ? "set" : "db-only"}`,
    `instagram=${env.social.hasInstagramPosts ? "embeds" : "follow-only"}`,
    `google-signin=${env.auth.google.isConfigured ? "set" : "unconfigured"}`,
  ]
  return parts.join(" ")
}
