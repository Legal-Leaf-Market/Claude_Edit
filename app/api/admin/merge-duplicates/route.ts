import { NextResponse, type NextRequest } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { mergeDuplicateGear } from "@/lib/canonical/merge-duplicates"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Fold duplicate canonical rows into one, on demand, from a browser.
 *
 * NOT PART OF THE NIGHTLY JOB, deliberately, and that is the whole reason this
 * is its own route rather than three more lines in /api/admin/maintenance.
 * Everything that job does is recomputable: clear a median and it comes back
 * on the next run. This deletes rows. It is careful and it is idempotent, but
 * a destructive step that fires on a schedule is one nobody is watching when
 * it does something surprising, so it fires when a person asks.
 *
 * DRY RUN FIRST. `{"dryRun":true}` reports exactly what it would fold and what
 * it would leave alone, and writes nothing. Same instinct as
 * /api/admin/probe-ftp: look before touching, especially when the thing being
 * touched is the table every price on the site is keyed on.
 *
 * SECURITY. Same gate as the rest of /admin: an HMAC session cookie issued
 * against ADMIN_PASSCODE, POST only, fails closed.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  /* An empty body is a dry run. Deleting rows should be the thing you opt
     into, not the thing you get for forgetting to send JSON. */
  let dryRun = true
  try {
    const body: unknown = await request.json()
    if (typeof body === "object" && body !== null && "dryRun" in body) {
      dryRun = (body as { dryRun?: unknown }).dryRun !== false
    }
  } catch {
    dryRun = true
  }

  const startedAt = Date.now()
  try {
    const report = await mergeDuplicateGear({ dryRun })
    return NextResponse.json({
      job: "merge-duplicates",
      seconds: Math.round((Date.now() - startedAt) / 100) / 10,
      ...report,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "merge failed" },
      { status: 500 },
    )
  }
}
