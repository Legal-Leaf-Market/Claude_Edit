-- Split the market price into two: one median for new listings, one for used.
--
-- Until now a single median was computed from EVERY listing on a piece of gear
-- regardless of condition, and written to a column named avg_used_price_cents.
-- With a mostly-used catalogue that was survivable. It stops being survivable
-- the moment a large new-retail feed lands (Andertons is ~27k products, and
-- Gear4music, zZounds, Full Compass and Pineville Music all default an empty
-- condition to "New"), because new retail prices sit well above used ones and
-- drag the blend upward. Every ordinary used listing then measures far below
-- that inflated "market" and earns a below-market badge it has not earned.
--
-- False deal badges are the worst failure this site has, so the two classes are
-- now measured and compared separately.

ALTER TABLE "canonical_gear" ADD COLUMN "avg_new_price_cents" integer;
--> statement-breakpoint
ALTER TABLE "canonical_gear" ADD COLUMN "new_price_sample_size" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- price_sample_size now counts USED observations only, pairing with
-- avg_used_price_cents. The column keeps its name rather than being renamed to
-- used_price_sample_size, so the ~15 existing read sites keep working.

-- FAIL CLOSED across the cutover.
--
-- Every existing avg_used_price_cents holds a blended new+used median, and the
-- code reading it after this migration treats it as used-only. Leaving those
-- values in place would mean one refresh cycle of exactly the false-positive
-- badges this change exists to prevent, because a blend sits above the true
-- used median. So the stale medians are cleared and every deal flag withdrawn:
-- the site says "not enough data yet" until the numbers are re-measured, which
-- is the same choice section 8 makes everywhere else. No market price beats a
-- wrong one.
--
-- RUN `npm run db:migrate` AND THEN THE refresh-deals JOB. Market prices and
-- deal badges are absent, not merely stale, until that job completes.
UPDATE "canonical_gear"
SET "avg_used_price_cents" = NULL,
    "price_sample_size" = 0,
    "price_updated_at" = NULL;
--> statement-breakpoint

UPDATE "marketplace_listings"
SET "is_deal" = false,
    "deal_margin" = NULL
WHERE "is_deal" = true OR "deal_margin" IS NOT NULL;
--> statement-breakpoint

-- Deal detection and the gear page both filter by condition class now, and on
-- a 27k-row feed that is a sequential scan per gear row without this.
CREATE INDEX IF NOT EXISTS "idx_listings_gear_condition"
  ON "marketplace_listings" ("canonical_gear_id", "condition");
