import { NextResponse } from "next/server"
import { desc, sql } from "drizzle-orm"
import { isAdmin } from "@/lib/admin/gate"
import { db } from "@/lib/db"
import { ingestRuns } from "@/lib/db/schema"
import { sourceStatuses } from "@/lib/ingestion/source-status"

export const dynamic = "force-dynamic"

/**
 * Every source, what state it is in, and the last thing that went wrong.
 *
 * THE HALF THAT WAS NEVER READ. `ingest_runs.error` has held the reason the
 * Anderton's FTP pull died since 11 August, and nothing in the app has ever
 * displayed it. /api/health reports that a job failed, which is the half
 * anybody could already guess. Two weeks of hourly Impact failures were spent
 * on exactly this shape of problem: the answer existed and no surface showed
 * it.
 *
 * WHY IT IS BEHIND THE PASSCODE and /api/health is not. The stored error is a
 * feed's own words, and a feed's own words cannot be vetted before they are
 * written. An FTP failure can name a host, a path or a username; an HTTP one
 * can echo back a URL that had a token in its query string. None of that
 * belongs on a public endpoint. The statuses themselves carry no credential,
 * only whether one is set, but they travel with the errors so they sit behind
 * the same door.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  /*
   * The latest run per job, and separately the latest FAILED one. Both,
   * because they answer different questions: a job that is failing now needs
   * the current error, and a job that has not run at all since it broke (the
   * Anderton's FTP case exactly) needs the last one it ever recorded.
   */
  const latest = await db
    .select({
      jobKind: ingestRuns.jobKind,
      source: ingestRuns.source,
      status: ingestRuns.status,
      error: ingestRuns.error,
      rowsUpserted: ingestRuns.rowsUpserted,
      finishedAt: ingestRuns.finishedAt,
      ageMinutes: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${ingestRuns.finishedAt})) / 60`,
    })
    .from(ingestRuns)
    .orderBy(ingestRuns.jobKind, desc(ingestRuns.startedAt))

  /* One row per job, newest first, plus the newest failure whenever the
     newest run itself is not the failure. */
  const newest = new Map<string, (typeof latest)[number]>()
  const lastFailure = new Map<string, (typeof latest)[number]>()
  for (const run of latest) {
    if (!newest.has(run.jobKind)) newest.set(run.jobKind, run)
    if (run.status === "failed" && run.error && !lastFailure.has(run.jobKind)) {
      lastFailure.set(run.jobKind, run)
    }
  }

  const statuses = sourceStatuses().map((status) => {
    /*
     * Job kinds are named per source but not identically (`folkcraft-shopify`,
     * `andertons-catalogue`, `andertons-catalogue-api`), so the match is on
     * prefix. Anderton's two transports are two entries whose job kinds differ
     * only by suffix, so the API one is matched exactly to stop it swallowing
     * the FTP one's runs.
     */
    const key = status.source === "andertons-api" ? "andertons-catalogue-api" : null
    const runs = [...newest.values()].filter((r) =>
      key ? r.jobKind === key : r.jobKind.startsWith(status.source) && r.jobKind !== "andertons-catalogue-api",
    )
    const run = runs[0]
    const failure = key
      ? lastFailure.get(key)
      : [...lastFailure.values()].find(
          (r) => r.jobKind.startsWith(status.source) && r.jobKind !== "andertons-catalogue-api",
        )

    return {
      ...status,
      lastRun: run
        ? {
            job: run.jobKind,
            status: run.status,
            rowsUpserted: run.rowsUpserted,
            finishedAt: run.finishedAt,
            ageMinutes: run.ageMinutes == null ? null : Math.round(Number(run.ageMinutes)),
          }
        : null,
      /* The whole point of this endpoint. */
      lastError: failure
        ? { at: failure.finishedAt, text: (failure.error ?? "").slice(0, 2000) }
        : null,
    }
  })


  return NextResponse.json({
    statuses,
    summary: {
      live: statuses.filter((s) => s.state === "live").length,
      blocked: statuses.filter((s) => s.state === "blocked").length,
      merchantSide: statuses.filter((s) => s.state === "merchant-side").length,
      paused: statuses.filter((s) => s.state === "paused").length,
    },
  })
}
