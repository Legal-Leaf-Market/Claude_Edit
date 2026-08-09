import { sql } from "drizzle-orm"
import { closeDb, db } from "../lib/db"
import { refreshAllDeals } from "../lib/deals/pricing"

/**
 * Removes development seed listings that were mistakenly left live in
 * production. scripts/seed.ts previously generated fake "reverb" and "ebay"
 * listings using real reverb.com/ebay.com URLs (fixed in the same commit as
 * this script -- it now uses example.test, which can never resolve to a real
 * site). Until that fix, real site visitors could see a listing that looked
 * like a genuine Reverb or eBay item but pointed nowhere real.
 *
 * This does NOT touch real ingested data. The match is deliberately narrow --
 * seed.ts is the ONLY place these three literal test IDs appear in the whole
 * codebase (confirmed via `git grep`), so filtering on them can't catch a real
 * Awin/eBay-sourced row by accident:
 *   - Awin publisher/merchant ids "3004653" / "67144" (tests/awin.test.ts uses
 *     the same pair as known-fake fixtures)
 *   - eBay campaign id "5338000000"
 * As a second, independent signal, seed rows also always have a rawUrl on the
 * reverb.com/ebay.com domains with a listing id pattern that isn't a real
 * eBay item number or Reverb slug (see scripts/seed.ts buildListings()).
 *
 * Defaults to a dry run -- pass --confirm to actually delete.
 *   npx tsx scripts/purge-seed-data.ts            # preview only
 *   npx tsx scripts/purge-seed-data.ts --confirm   # actually delete
 */

const CONFIRM = process.argv.includes("--confirm")

const SEED_MATCH = sql`
  (affiliate_url LIKE '%awinmid=67144%awinaffid=3004653%' OR affiliate_url LIKE '%awinaffid=3004653%awinmid=67144%')
  OR affiliate_url LIKE '%campid=5338000000%'
  OR (source = 'reverb' AND raw_url LIKE 'https://reverb.com/item/%')
  OR (source = 'ebay' AND raw_url LIKE 'https://www.ebay.com/itm/%' AND external_id LIKE 'ebay-%-_')
`

async function main() {
  const preview = await db.execute(sql`
    SELECT id, source, external_id, title, raw_url, affiliate_url, listed_at
    FROM marketplace_listings
    WHERE ${SEED_MATCH}
    ORDER BY source, external_id
  `)

  console.log(`Found ${preview.rows.length} seed-pattern row(s):`)
  for (const row of preview.rows) {
    console.log(`  [${row.source}] ${row.external_id} — "${row.title}" — ${row.raw_url}`)
  }

  if (preview.rows.length === 0) {
    console.log("Nothing to purge.")
    await closeDb()
    return
  }

  if (!CONFIRM) {
    console.log(`\nDry run only -- no rows deleted. Re-run with --confirm to actually delete these ${preview.rows.length} row(s).`)
    await closeDb()
    return
  }

  // listing_price_history has ON DELETE CASCADE on listing_id, so its rows for
  // these listings go with them automatically. canonical_gear rows are left
  // alone -- they're a resolved product identity real future listings can
  // still resolve onto, not seed-specific -- but their cached price stats can
  // be built from now-deleted fake listings, so recompute after deleting.
  const result = await db.execute(sql`
    DELETE FROM marketplace_listings WHERE ${SEED_MATCH}
  `)
  console.log(`Deleted ${result.rowCount ?? preview.rows.length} row(s).`)

  console.log("Recomputing canonical_gear price stats from remaining listings...")
  await refreshAllDeals()
  console.log("Done.")

  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
