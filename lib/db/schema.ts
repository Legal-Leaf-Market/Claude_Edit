import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

/* -------------------------------------------------------------------------- */
/*  Better Auth tables (camelCase columns match Better Auth defaults)          */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

/* -------------------------------------------------------------------------- */
/*  Canonical catalogue                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One row per real-world piece of gear ("Fender Player Stratocaster"), built
 * mostly from eBay's structured aspects rather than free-text titles. Listings
 * from every source hang off these rows, which is what makes cross-source price
 * comparison possible.
 *
 * gtin and epid are UNIQUE but nullable. Postgres allows many NULLs in a unique
 * index, so gear without a barcode or an eBay product id still gets a row and
 * simply matches on the fuzzy tier instead.
 */
export const canonicalGear = pgTable(
  "canonical_gear",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: varchar("brand", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    /** URL segment for /gear/[slug] and the programmatic SEO routes. */
    slug: varchar("slug", { length: 220 }).notNull(),

    gtin: varchar("gtin", { length: 20 }),
    epid: varchar("epid", { length: 30 }),
    mpn: varchar("mpn", { length: 100 }),

    msrpCents: integer("msrp_cents"),
    /**
     * Rolling median of observed USED prices. Null until the used sample alone
     * is big enough; a pile of new listings never fills this in.
     */
    avgUsedPriceCents: integer("avg_used_price_cents"),
    /**
     * How many USED listings fed the median above, not how many listings the
     * gear has. Guards against a 1-listing "market". Keeps its original name
     * rather than becoming used_price_sample_size, so the existing read sites
     * are untouched, but it counts one condition class now.
     */
    priceSampleSize: integer("price_sample_size").notNull().default(0),
    /**
     * The same pair for NEW listings, measured and compared separately.
     *
     * A single blended median is what a large new-retail feed breaks: new
     * prices sit above used ones, so the blend rises, and every ordinary used
     * listing then measures far below "market" and earns a below-market badge
     * it has not earned. A listing is only ever judged against the median of
     * its own condition class. See lib/deals/pricing.ts.
     */
    avgNewPriceCents: integer("avg_new_price_cents"),
    newPriceSampleSize: integer("new_price_sample_size").notNull().default(0),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),

    imageUrl: text("image_url"),
    /** True when the row was created by the fuzzy or fallback tier and a human should confirm it. */
    needsReview: boolean("needs_review").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("canonical_gear_gtin_key").on(t.gtin),
    uniqueIndex("canonical_gear_epid_key").on(t.epid),
    uniqueIndex("canonical_gear_slug_key").on(t.slug),
    index("idx_canonical_brand_model").on(t.brand, t.model),
    index("idx_canonical_category").on(t.category),
    index("idx_canonical_needs_review").on(t.needsReview),
    // Trigram index backing the Tier 2 fuzzy match. Without it, resolution
    // degrades to a sequential scan once the catalogue passes a few thousand rows.
    index("idx_canonical_model_trgm").using("gin", sql`${t.model} gin_trgm_ops`),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Listings                                                                  */
/* -------------------------------------------------------------------------- */

export const marketplaceListings = pgTable(
  "marketplace_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalGearId: uuid("canonical_gear_id").references(() => canonicalGear.id, {
      onDelete: "set null",
    }),

    /** 'ebay' | 'reverb' | 'sweetwater' | 'gear4music' | 'zzounds' | 'fullcompass' | 'pinevillemusic' | 'folkcraft' | 'acousticguitar' | 'jamstik' | 'jacksonaudio'. Facebook Marketplace is deliberately out of scope. */
    source: varchar("source", { length: 20 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    priceCents: integer("price_cents").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    condition: varchar("condition", { length: 50 }),

    brand: varchar("brand", { length: 100 }),
    gtin: varchar("gtin", { length: 20 }),
    epid: varchar("epid", { length: 30 }),
    mpn: varchar("mpn", { length: 100 }),

    locationCountry: varchar("location_country", { length: 4 }),
    locationZip: varchar("location_zip", { length: 20 }),
    isLocalPickup: boolean("is_local_pickup").notNull().default(false),
    isShippable: boolean("is_shippable").notNull().default(true),

    rawUrl: text("raw_url").notNull(),
    /**
     * Nullable by design. eBay populates itemAffiliateWebUrl only when the feed
     * is pulled with affiliate context; Reverb links are built lazily through
     * Awin. The /go gateway falls back to rawUrl when this is null.
     */
    affiliateUrl: text("affiliate_url"),
    primaryImageUrl: text("primary_image_url"),
    /**
     * The store's own id for building a prefilled cart URL: a Shopify variant
     * id for Shopify sources, a WooCommerce product id for Squaver, null for
     * every source that has no such concept (eBay/Reverb/CJ/Awin feeds; see
     * lib/cart/stores.ts). Never the same thing as externalId, which also
     * encodes our own composite key.
     */
    platformVariantId: varchar("platform_variant_id", { length: 50 }),

    /** 'active' | 'sold' | 'expired'. */
    listingStatus: varchar("listing_status", { length: 20 }).notNull().default("active"),

    /** Deal detection, recomputed whenever the gear's rolling median moves. */
    isDeal: boolean("is_deal").notNull().default(false),
    /** How far below market, as a fraction (0.25 = 25% under). Null when unknown. */
    dealMargin: real("deal_margin"),

    /** Which resolution tier claimed this listing: 'gtin' | 'epid' | 'fuzzy' | 'provisional'. */
    matchTier: varchar("match_tier", { length: 20 }),
    matchScore: real("match_score"),

    listedAt: timestamp("listed_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("unique_source_external_id").on(t.source, t.externalId),
    index("idx_listings_source_status").on(t.source, t.listingStatus),
    index("idx_listings_price").on(t.priceCents),
    index("idx_listings_epid").on(t.epid),
    index("idx_listings_gtin").on(t.gtin),
    index("idx_listings_canonical").on(t.canonicalGearId),
    index("idx_listings_deal").on(t.isDeal),
    index("idx_listings_updated").on(t.updatedAt),
    // Market price and deal flagging both group by condition class per gear
    // row now. Without this, a 27k-row feed turns each recompute into a scan.
    index("idx_listings_gear_condition").on(t.canonicalGearId, t.condition),
    // Drives the Postgres search fallback when Typesense is not configured.
    index("idx_listings_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
)

/**
 * Append-only price observations. Two jobs:
 *   1. the observed-price-over-time chart on the gear detail page, and
 *   2. the rolling median that deal detection compares against.
 * A row is written only when a listing's price actually changes, so an unchanged
 * hourly snapshot costs nothing.
 */
export const listingPriceHistory = pgTable(
  "listing_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    canonicalGearId: uuid("canonical_gear_id").references(() => canonicalGear.id, {
      onDelete: "set null",
    }),
    source: varchar("source", { length: 20 }).notNull(),
    priceCents: integer("price_cents").notNull(),
    listingStatus: varchar("listing_status", { length: 20 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_price_history_listing").on(t.listingId, t.observedAt),
    index("idx_price_history_gear").on(t.canonicalGearId, t.observedAt),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Alerts                                                                    */
/* -------------------------------------------------------------------------- */

export const savedAlerts = pgTable(
  "saved_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    query: text("query").notNull(),
    maxPriceCents: integer("max_price_cents"),
    /** Null means every source. */
    sourceFilter: varchar("source_filter", { length: 20 }),
    /** Null means every condition. */
    conditionFilter: varchar("condition_filter", { length: 50 }),
    /** 'email' | 'discord' | 'both'. */
    channel: varchar("channel", { length: 20 }).notNull().default("email"),
    isActive: boolean("is_active").notNull().default(true),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_alerts_user").on(t.userId), index("idx_alerts_active").on(t.isActive)],
)

/**
 * One row per (alert, listing) already notified. This is what stops a shopper
 * getting the same guitar emailed to them on every hourly snapshot run.
 */
export const alertMatches = pgTable(
  "alert_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => savedAlerts.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    priceCentsAtMatch: integer("price_cents_at_match").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("unique_alert_listing").on(t.alertId, t.listingId)],
)

/**
 * "Get your shop listed" submissions from /list-your-shop. Filled in either by
 * a shop owner directly or by a customer referring their local shop; either
 * way this is the start of a human conversation, not an automated signup, so
 * every row needs a real person to read it and follow up.
 */
export const merchantLeads = pgTable(
  "merchant_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopName: varchar("shop_name", { length: 200 }).notNull(),
    contactName: varchar("contact_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    location: varchar("location", { length: 200 }),
    /** What the shop already has online, in their own words if 'unsure'. */
    hasOnlineCatalog: varchar("has_online_catalog", { length: 20 }).notNull().default("unsure"),
    existingLink: text("existing_link"),
    message: text("message"),
    /** 'owner' submitted for their own shop, or 'customer' referring one. */
    referredBy: varchar("referred_by", { length: 20 }).notNull().default("owner"),
    /** 'new' | 'contacted' | 'onboarded' | 'declined'. Reviewed by hand for now. */
    status: varchar("status", { length: 20 }).notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_merchant_leads_status").on(t.status), index("idx_merchant_leads_created").on(t.createdAt)],
)

/* -------------------------------------------------------------------------- */
/*  Monetisation and observability                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every outbound click through /go/[listingId]. The UI never links to a
 * marketplace directly, so this table is the complete record of traffic we send
 * and the basis for reconciling affiliate reports.
 */
export const outboundClicks = pgTable(
  "outbound_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").references(() => marketplaceListings.id, {
      onDelete: "set null",
    }),
    canonicalGearId: uuid("canonical_gear_id"),
    source: varchar("source", { length: 20 }).notNull(),
    /** True when we had an affiliate link, false when the click fell back to the raw URL. */
    wasAffiliate: boolean("was_affiliate").notNull().default(false),
    priceCents: integer("price_cents"),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_clicks_listing").on(t.listingId),
    index("idx_clicks_time").on(t.clickedAt),
    index("idx_clicks_source").on(t.source),
  ],
)

/**
 * One row per ingestion attempt. The sister sites learned the hard way that a
 * silently broken feed looks exactly like a quiet market, so every run records
 * what it saw and /api/health reads from here.
 */
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 20 }).notNull(),
    /** 'ebay-daily' | 'ebay-snapshot' | 'ebay-bootstrap' | 'reverb-feed'. */
    jobKind: varchar("job_kind", { length: 40 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    rowsSeen: integer("rows_seen").notNull().default(0),
    rowsUpserted: integer("rows_upserted").notNull().default(0),
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    bytesDownloaded: integer("bytes_downloaded").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    detail: jsonb("detail"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_ingest_runs_source_time").on(t.source, t.startedAt),
    index("idx_ingest_runs_kind").on(t.jobKind, t.startedAt),
  ],
)

/* -------------------------------------------------------------------------- */
/*  Flip Match: a public bulletin board, not a marketplace                   */
/* -------------------------------------------------------------------------- */

/**
 * Every board this one table can carry. 'flip' is the only one with a page
 * built; the rest are reserved so adding their UI later never needs another
 * migration.
 */
export const BOARD_KINDS = ["flip", "wanted", "bandmates", "lessons", "shows", "free", "studio"] as const
export type BoardKind = (typeof BOARD_KINDS)[number]

/**
 * A player posting gear they want to flip. Deliberately old-school: no DMs,
 * no offer/checkout flow, no fee, no cut. Whoever's interested replies in the
 * open thread below, and the actual sale happens off-platform (PayPal,
 * cash, whatever the two of them agree) once they've connected. That is a
 * product decision, not a missing feature: Gear Avail never touches this
 * money and never will.
 *
 * `kind` exists so the same public-thread-plus-replies shape can carry other
 * community boards later (wanted ads, bandmate search, lessons, local shows,
 * free gear) without another migration or another pair of tables. Each is
 * just a different `kind` value and a thin filtered view over this table;
 * add one to the enum below and a page for it when it's actually built.
 */
export const flipThreads = pgTable(
  "flip_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 'flip' | 'wanted' | 'bandmates' | 'lessons' | 'shows' | 'free' | 'studio'. */
    kind: varchar("kind", { length: 20 }).notNull().default("flip"),
    title: varchar("title", { length: 200 }).notNull(),
    /** Free text, not scoped to the canonical_gear categories: this board is not tied to ingested listings. */
    category: varchar("category", { length: 50 }).notNull().default("other"),
    description: text("description").notNull(),
    /** Optional; plenty of posters just want "make an offer" in the replies. */
    askingPriceCents: integer("asking_price_cents"),
    location: varchar("location", { length: 200 }),
    imageUrl: text("image_url"),
    /**
     * Optional Patreon page for the poster. Convenience only: a teacher on the
     * lessons board or a builder posting a run almost certainly already runs
     * one, and linking it saves the reader hunting for it. Gear Avail earns
     * nothing from this and no referral relationship is assumed.
     */
    patreonUrl: text("patreon_url"),
    /** 'open' | 'closed'. The poster closes it once it's flipped, filled, or off the table. */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_flip_threads_kind_status_created").on(t.kind, t.status, t.createdAt),
    index("idx_flip_threads_author").on(t.authorId),
  ],
)

/** Public replies on a Flip Match thread. Contact info gets exchanged here, in the open, same as the old forums. */
export const flipReplies = pgTable(
  "flip_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => flipThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_flip_replies_thread").on(t.threadId, t.createdAt)],
)

/**
 * Newsletter subscribers.
 *
 * The one asset here that a search-ranking change cannot take away: rankings
 * are rented, a list is owned. That is the main reason this exists, ahead of
 * any revenue it drives.
 *
 * Deliberately thin. An email and where they signed up is enough to send a
 * weekly digest; anything more would be collecting data we have no use for.
 * `source` records which page earned the signup so it is possible to tell
 * which surfaces actually work.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    /** Which page the signup came from: 'feed' | 'board' | 'store' | 'home' | 'gear'. */
    source: varchar("source", { length: 40 }).notNull().default("unknown"),
    /** Optional free text: the gear they are hunting for, if they told us. */
    hunting: varchar("hunting", { length: 200 }),
    /**
     * Unsubscribes are kept as rows rather than deleted, so a later signup
     * cannot silently resurrect someone who opted out.
     */
    isActive: boolean("is_active").notNull().default(true),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** Random, unguessable, and stable: it goes in the unsubscribe link of every send. */
    unsubscribeToken: uuid("unsubscribe_token").notNull().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscribers_email_key").on(t.email),
    index("idx_subscribers_active").on(t.isActive),
  ],
)

export type Subscriber = typeof subscribers.$inferSelect
export type NewSubscriber = typeof subscribers.$inferInsert

export type FlipThread = typeof flipThreads.$inferSelect
export type NewFlipThread = typeof flipThreads.$inferInsert
export type FlipReply = typeof flipReplies.$inferSelect
export type NewFlipReply = typeof flipReplies.$inferInsert

export type CanonicalGear = typeof canonicalGear.$inferSelect
export type NewCanonicalGear = typeof canonicalGear.$inferInsert
export type MarketplaceListing = typeof marketplaceListings.$inferSelect
export type NewMarketplaceListing = typeof marketplaceListings.$inferInsert
export type SavedAlert = typeof savedAlerts.$inferSelect
export type IngestRun = typeof ingestRuns.$inferSelect
export type MerchantLead = typeof merchantLeads.$inferSelect
export type NewMerchantLead = typeof merchantLeads.$inferInsert

/** Sources v1 actually ingests. Facebook Marketplace is intentionally absent. */
export const SOURCES = [
  "ebay",
  "reverb",
  "sweetwater",
  "gear4music",
  "zzounds",
  "fullcompass",
  "pinevillemusic",
  "folkcraft",
  "acousticguitar",
  "jamstik",
  "jacksonaudio",
  "eminencedigital",
  "hazeguitar",
  "eartguitar",
  "playwithauthority",
  "puresmusic",
  "squaver",
  "easonmusicstore",
  "gokalimba",
] as const
export type Source = (typeof SOURCES)[number]

export const LISTING_STATUSES = ["active", "sold", "expired"] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]
