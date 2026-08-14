import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { recomputeMarketPrice } from "@/lib/deals/pricing"

/**
 * Fold canonical rows that are the same instrument into one.
 *
 * WHY A BACKFILL EXISTS AT ALL. The resolver stopped making these rows (see
 * Tier 1d in resolve.ts), but a fix to the ingestion path does nothing about
 * what the old path already wrote, and nothing re-resolves a listing that
 * already has a canonical id. Jackson Audio's 1484 Twin Twelve Classic was on
 * the published shelf four times and would have stayed there.
 *
 * THE RULE IS THE SAME ONE THE RESOLVER USES, deliberately, because two
 * different answers to "is this the same instrument" is how the two drift
 * apart: same brand, same model, character for character once case and edge
 * whitespace are ignored. Similar is not enough. "DS-1 Distortion" and
 * "DS-1X Distortion" score 0.82 on this database's own similarity() and are
 * different pedals, so nothing here looks at similarity.
 *
 * IT REFUSES A GROUP WHERE HARD IDENTITY DISAGREES. Two rows carrying
 * different GTINs or different EPIDs are two products however alike their
 * names, so that group is left exactly as it is and counted as skipped. Under
 * merge rather than over merge, the same bias the resolver is built on: a
 * duplicate row is untidy, and a bad merge corrupts the price history of two
 * instruments and every deal badge computed from it.
 *
 * IT IS IDEMPOTENT. Running it twice does nothing the second time, which is
 * what makes it safe to put behind a button somebody may double click.
 */

export type MergeReport = {
  /** Groups of two or more rows naming the same instrument. */
  groups: number
  /** Rows folded into another and deleted. */
  merged: number
  /** Groups left untouched because a GTIN or EPID disagreed. */
  skipped: number
  /** What happened, one line per group, for the admin screen to print. */
  detail: string[]
  dryRun: boolean
}

type GroupRow = { brand: string; model: string; ids: string[] }

type GearRow = {
  id: string
  slug: string
  brand: string
  model: string
  gtin: string | null
  epid: string | null
  mpn: string | null
  image_url: string | null
}

/**
 * Groups keyed the way the resolver keys them. Ordered by creation so the
 * oldest row is the one that survives: it is the one whose slug is already in
 * somebody's search results and on the sister site.
 */
async function duplicateGroups(): Promise<GroupRow[]> {
  const result = await db.execute<GroupRow>(sql`
    SELECT lower(btrim(brand)) AS brand,
           lower(btrim(model)) AS model,
           array_agg(id ORDER BY created_at, id) AS ids
      FROM canonical_gear
     GROUP BY 1, 2
    HAVING count(*) > 1
     ORDER BY count(*) DESC, 1, 2
  `)
  return result.rows
}

async function gearById(ids: string[]): Promise<GearRow[]> {
  const result = await db.execute<GearRow>(sql`
    SELECT id, slug, brand, model, gtin, epid, mpn, image_url
      FROM canonical_gear
     WHERE id IN ${ids}
     ORDER BY created_at, id
  `)
  return result.rows
}

/** Same test the resolver applies before attaching to an identical model. */
function conflicts(a: GearRow, b: GearRow): boolean {
  if (a.gtin && b.gtin && a.gtin !== b.gtin) return true
  if (a.epid && b.epid && a.epid !== b.epid) return true
  return false
}

export async function mergeDuplicateGear(options: { dryRun?: boolean } = {}): Promise<MergeReport> {
  const dryRun = options.dryRun ?? false
  const report: MergeReport = { groups: 0, merged: 0, skipped: 0, detail: [], dryRun }

  const groups = await duplicateGroups()
  report.groups = groups.length

  for (const group of groups) {
    const rows = await gearById(group.ids)
    if (rows.length < 2) continue

    const [keeper, ...rest] = rows
    const mergeable = rest.filter((row) => !conflicts(keeper, row))

    if (mergeable.length === 0) {
      report.skipped += 1
      report.detail.push(
        `skipped ${keeper.brand} ${keeper.model}: ${rest.length + 1} rows, identifiers disagree`,
      )
      continue
    }
    if (mergeable.length < rest.length) {
      report.skipped += 1
      report.detail.push(
        `partial ${keeper.brand} ${keeper.model}: ${rest.length - mergeable.length} left alone, identifiers disagree`,
      )
    }

    report.detail.push(
      `${dryRun ? "would merge" : "merged"} ${mergeable.length} into ${keeper.slug} (${keeper.brand} ${keeper.model})`,
    )
    report.merged += mergeable.length
    if (dryRun) continue

    const loserIds = mergeable.map((row) => row.id)

    await db.transaction(async (tx) => {
      /* Every table that points at a canonical row, including the one with no
         foreign key on it. outbound_clicks carries the id for reporting and
         nothing would complain if it were left dangling, which is exactly why
         it is easy to forget. */
      await tx.execute(
        sql`UPDATE marketplace_listings SET canonical_gear_id = ${keeper.id}, updated_at = now()
             WHERE canonical_gear_id IN ${loserIds}`,
      )
      await tx.execute(
        sql`UPDATE listing_price_history SET canonical_gear_id = ${keeper.id}
             WHERE canonical_gear_id IN ${loserIds}`,
      )
      await tx.execute(
        sql`UPDATE outbound_clicks SET canonical_gear_id = ${keeper.id}
             WHERE canonical_gear_id IN ${loserIds}`,
      )

      /* Take anything the keeper is missing before the losers go. Only into
         NULLs: a value already on the keeper was set by evidence at least as
         good, which is the same rule enrichGear follows. */
      const gtin = keeper.gtin ?? mergeable.find((row) => row.gtin)?.gtin ?? null
      const epid = keeper.epid ?? mergeable.find((row) => row.epid)?.epid ?? null
      const mpn = keeper.mpn ?? mergeable.find((row) => row.mpn)?.mpn ?? null
      const image = keeper.image_url ?? mergeable.find((row) => row.image_url)?.image_url ?? null

      /* Delete first, patch second. gtin and epid are uniquely indexed, so
         moving one onto the keeper while the loser still holds it would trip
         the index inside the transaction. */
      await tx.execute(sql`DELETE FROM canonical_gear WHERE id IN ${loserIds}`)
      await tx.execute(sql`
        UPDATE canonical_gear
           SET gtin = ${gtin}, epid = ${epid}, mpn = ${mpn}, image_url = ${image},
               updated_at = now()
         WHERE id = ${keeper.id}
      `)
    })

    /* The keeper now has every listing both rows had, so its median was
       computed from a sample that no longer exists. */
    await recomputeMarketPrice(keeper.id)
  }

  return report
}
