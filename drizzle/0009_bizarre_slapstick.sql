CREATE TABLE "listing_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(60) NOT NULL,
	"intake_ref" varchar(60),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"brand" varchar(100),
	"model" varchar(100),
	"category" varchar(100),
	"description" text,
	"condition" varchar(50),
	"year" varchar(20),
	"finish" varchar(60),
	"country_of_origin" varchar(60),
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_cents" integer,
	"cost_cents" integer,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"accepts_offers" boolean DEFAULT true NOT NULL,
	"offer_floor_cents" integer,
	"shipping_cents" integer,
	"local_pickup" boolean DEFAULT false NOT NULL,
	"channel_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"channel" varchar(20) NOT NULL,
	"state" varchar(20) NOT NULL,
	"external_id" varchar(120),
	"external_url" text,
	"error" text,
	"published_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_publications" ADD CONSTRAINT "listing_publications_draft_id_listing_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_listing_drafts_sku" ON "listing_drafts" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_listing_drafts_status" ON "listing_drafts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_listing_publications_draft_channel" ON "listing_publications" USING btree ("draft_id","channel");--> statement-breakpoint
CREATE INDEX "idx_listing_publications_channel" ON "listing_publications" USING btree ("channel","state");