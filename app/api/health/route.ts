import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { describeConfig, env } from "@/lib/env"

export const dynamic = "force-dynamic"

/**
 * Health and freshness.
 *
 * This exists because of a lesson the sister sites learned the hard way: a
 * silently broken feed looks exactly like a quiet market. Counts alone cannot
 * tell you the difference, so this reports the AGE of the most recent
 * successful run per job as well, which is the number that actually goes wrong.
 *
 * Public and unauthenticated, so it carries no secrets: booleans about whether
 * a credential is set, never the credential.
 */
export async function GET() {
  try {
    const [counts, runs] = await Promise.all([
      db.execute<{
        listings: number
        active: number
        gear: number
        deals: number
        review: number
      }>(sql`
        SELECT
          (SELECT COUNT(*) FROM marketplace_listings)::int AS listings,
          (SELECT COUNT(*) FROM marketplace_listings WHERE listing_status = 'active')::int AS active,
          (SELECT COUNT(*) FROM canonical_gear)::int AS gear,
          (SELECT COUNT(*) FROM marketplace_listings WHERE is_deal AND listing_status = 'active')::int AS deals,
          (SELECT COUNT(*) FROM canonical_gear WHERE needs_review)::int AS review
      `),
      db.execute<{
        job_kind: string
        status: string
        finished_at: string | null
        rows_upserted: number
        age_minutes: number | null
      }>(sql`
        SELECT DISTINCT ON (job_kind)
          job_kind, status, finished_at, rows_upserted,
          EXTRACT(EPOCH FROM (NOW() - finished_at)) / 60 AS age_minutes
        FROM ingest_runs
        ORDER BY job_kind, started_at DESC
      `),
    ])

    const row = counts.rows[0]
    const jobs = runs.rows.map((r) => ({
      job: r.job_kind,
      status: r.status,
      finishedAt: r.finished_at,
      rowsUpserted: Number(r.rows_upserted),
      ageMinutes: r.age_minutes == null ? null : Math.round(Number(r.age_minutes)),
    }))

    // Anything ingesting but not producing rows is the failure mode worth
    // shouting about, so it is called out rather than left to be inferred.
    const stale = jobs.filter((j) => j.status === "failed" || (j.ageMinutes ?? 0) > 60 * 26)

    return NextResponse.json({
      ok: true,
      config: describeConfig(),
      sources: {
        ebay: env.ebay.isConfigured ? (env.ebay.isSandbox ? "sandbox" : "production") : "unconfigured",
        reverb: env.awin.hasFeed ? "awin-feed" : "no-feed",
      },
      search: env.typesense.isConfigured ? "typesense" : "postgres",
      counts: {
        listings: Number(row?.listings ?? 0),
        active: Number(row?.active ?? 0),
        gear: Number(row?.gear ?? 0),
        deals: Number(row?.deals ?? 0),
        needsReview: Number(row?.review ?? 0),
      },
      jobs,
      warnings: stale.map((j) => `${j.job} last finished ${j.ageMinutes ?? "?"} minutes ago (${j.status})`),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
