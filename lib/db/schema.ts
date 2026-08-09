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
    /** Rolling median of observed used prices. Null until the sample is big enough. */
    avgUsedPriceCents: integer("avg_used_price_cents"),
    /** How many listings fed the median above. Guards against a 1-listing "market". */
    priceSampleSize: integer("price_sample_size").notNull().default(0),
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

    /** 'ebay' | 'reverb'. Facebook Marketplace is deliberately out of scope. */
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

export type CanonicalGear = typeof canonicalGear.$inferSelect
export type NewCanonicalGear = typeof canonicalGear.$inferInsert
export type MarketplaceListing = typeof marketplaceListings.$inferSelect
export type NewMarketplaceListing = typeof marketplaceListings.$inferInsert
export type SavedAlert = typeof savedAlerts.$inferSelect
export type IngestRun = typeof ingestRuns.$inferSelect

/** Sources v1 actually ingests. Facebook Marketplace is intentionally absent. */
export const SOURCES = ["ebay", "reverb"] as const
export type Source = (typeof SOURCES)[number]

export const LISTING_STATUSES = ["active", "sold", "expired"] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]
