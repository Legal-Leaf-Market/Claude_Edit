-- Operator captures: what a person saw on a merchant's page, kept raw.
--
-- Deliberately NOT marketplace_listings, and the separation is the point. A
-- capture is research: it says what a merchant stocks so a decision about
-- chasing them can rest on evidence rather than on a homepage. Turning one into
-- a public listing is redistribution, which CLAUDE.md section 2 gates on a
-- legitimate feed or a published permission, and nothing about how a capture
-- was taken changes that answer. Two tables means the second cannot happen by
-- accident while doing the first.
--
-- payload holds the extractor's ENTIRE output, raw source objects and per-card
-- HTML included. Storing only the normalised fields would be exactly the
-- partial pull this tool exists to prevent: a question nobody thought to ask on
-- the first pass could not then be asked without browsing forty pages again.
--
-- One row per page, not per capture session. Re-capturing a page replaces its
-- row, so pressing the button again after scrolling further down a lazy-loaded
-- grid is the intended way to improve a capture rather than a way to
-- double-count it.

CREATE TABLE IF NOT EXISTS "product_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_key" varchar(60) NOT NULL,
	"origin" varchar(255) NOT NULL,
	"page_url" text NOT NULL,
	"page_title" text,
	"platform" varchar(40),
	-- Which collector build read it. A self-contained bookmarklet is a snapshot
	-- and never updates itself; a stale one does not fail, it returns a smaller
	-- catalogue that looks entirely plausible. Recording the build is how that
	-- gets caught after the fact rather than being argued about.
	"build" varchar(16),
	"product_count" integer DEFAULT 0 NOT NULL,
	-- What the page claimed it held, when it said anything. NULL means it did
	-- not say, which is different from zero.
	"claimed_total" integer,
	"payload" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_captures_page" ON "product_captures" USING btree ("page_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_captures_merchant" ON "product_captures" USING btree ("merchant_key","captured_at");
