CREATE TABLE "merchant_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_name" varchar(200) NOT NULL,
	"contact_name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30),
	"location" varchar(200),
	"has_online_catalog" varchar(20) DEFAULT 'unsure' NOT NULL,
	"existing_link" text,
	"message" text,
	"referred_by" varchar(20) DEFAULT 'owner' NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD COLUMN "platform_variant_id" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_merchant_leads_status" ON "merchant_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_merchant_leads_created" ON "merchant_leads" USING btree ("created_at");