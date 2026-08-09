-- Backs the brand + MPN resolution tier in lib/canonical/resolve.ts.
--
-- The expression must match the lookup exactly or Postgres will not use the
-- index: lower(brand) alongside the alphanumeric-only uppercase MPN, so that
-- "JCM-800/2203" and "jcm800 2203" collapse onto one key.
--
-- Deliberately NOT unique. A feed that exports a junk MPN would otherwise make
-- an insert throw mid-ingest; normalizeMpn() filters the known placeholders and
-- the resolver looks up before creating, which is the safer shape for data we
-- do not control.
CREATE INDEX IF NOT EXISTS "idx_canonical_brand_mpn"
  ON "canonical_gear" (lower("brand"), upper(regexp_replace("mpn", '[^A-Za-z0-9]', '', 'g')))
  WHERE "mpn" IS NOT NULL;
