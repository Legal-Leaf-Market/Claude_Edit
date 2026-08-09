CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"price_cents_at_match" integer NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_gear" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"category" varchar(100) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"gtin" varchar(20),
	"epid" varchar(30),
	"mpn" varchar(100),
	"msrp_cents" integer,
	"avg_used_price_cents" integer,
	"price_sample_size" integer DEFAULT 0 NOT NULL,
	"price_updated_at" timestamp with time zone,
	"image_url" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(20) NOT NULL,
	"job_kind" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"rows_seen" integer DEFAULT 0 NOT NULL,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"bytes_downloaded" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"detail" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"canonical_gear_id" uuid,
	"source" varchar(20) NOT NULL,
	"price_cents" integer NOT NULL,
	"listing_status" varchar(20) NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_gear_id" uuid,
	"source" varchar(20) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"condition" varchar(50),
	"brand" varchar(100),
	"gtin" varchar(20),
	"epid" varchar(30),
	"mpn" varchar(100),
	"location_country" varchar(4),
	"location_zip" varchar(20),
	"is_local_pickup" boolean DEFAULT false NOT NULL,
	"is_shippable" boolean DEFAULT true NOT NULL,
	"raw_url" text NOT NULL,
	"affiliate_url" text,
	"primary_image_url" text,
	"listing_status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_deal" boolean DEFAULT false NOT NULL,
	"deal_margin" real,
	"match_tier" varchar(20),
	"match_score" real,
	"listed_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"canonical_gear_id" uuid,
	"source" varchar(20) NOT NULL,
	"was_affiliate" boolean DEFAULT false NOT NULL,
	"price_cents" integer,
	"referrer" text,
	"user_agent" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"max_price_cents" integer,
	"source_filter" varchar(20),
	"condition_filter" varchar(50),
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_alert_id_saved_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."saved_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_canonical_gear_id_canonical_gear_id_fk" FOREIGN KEY ("canonical_gear_id") REFERENCES "public"."canonical_gear"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_canonical_gear_id_canonical_gear_id_fk" FOREIGN KEY ("canonical_gear_id") REFERENCES "public"."canonical_gear"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_alert_listing" ON "alert_matches" USING btree ("alert_id","listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_gear_gtin_key" ON "canonical_gear" USING btree ("gtin");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_gear_epid_key" ON "canonical_gear" USING btree ("epid");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_gear_slug_key" ON "canonical_gear" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_canonical_brand_model" ON "canonical_gear" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "idx_canonical_category" ON "canonical_gear" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_canonical_needs_review" ON "canonical_gear" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "idx_canonical_model_trgm" ON "canonical_gear" USING gin ("model" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ingest_runs_source_time" ON "ingest_runs" USING btree ("source","started_at");--> statement-breakpoint
CREATE INDEX "idx_ingest_runs_kind" ON "ingest_runs" USING btree ("job_kind","started_at");--> statement-breakpoint
CREATE INDEX "idx_price_history_listing" ON "listing_price_history" USING btree ("listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_price_history_gear" ON "listing_price_history" USING btree ("canonical_gear_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_source_external_id" ON "marketplace_listings" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "idx_listings_source_status" ON "marketplace_listings" USING btree ("source","listing_status");--> statement-breakpoint
CREATE INDEX "idx_listings_price" ON "marketplace_listings" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX "idx_listings_epid" ON "marketplace_listings" USING btree ("epid");--> statement-breakpoint
CREATE INDEX "idx_listings_gtin" ON "marketplace_listings" USING btree ("gtin");--> statement-breakpoint
CREATE INDEX "idx_listings_canonical" ON "marketplace_listings" USING btree ("canonical_gear_id");--> statement-breakpoint
CREATE INDEX "idx_listings_deal" ON "marketplace_listings" USING btree ("is_deal");--> statement-breakpoint
CREATE INDEX "idx_listings_updated" ON "marketplace_listings" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_listings_title_trgm" ON "marketplace_listings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_clicks_listing" ON "outbound_clicks" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_clicks_time" ON "outbound_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "idx_clicks_source" ON "outbound_clicks" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_alerts_user" ON "saved_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_active" ON "saved_alerts" USING btree ("is_active");