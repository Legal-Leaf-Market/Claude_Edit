CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" varchar(40) DEFAULT 'unknown' NOT NULL,
	"hunting" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "idx_subscribers_active" ON "subscribers" USING btree ("is_active");
