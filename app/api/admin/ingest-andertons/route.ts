import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { env } from "@/lib/env"
import { ingestAndertonsFeed } from "@/lib/ingestion/andertons-impact"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Pull the Anderton's catalogue on demand, from a browser.
 *
 * WHY THIS EXISTS, AND WHY IT MIGHT NOT WORK.
 *
 * The received wisdom in this repo (mine, written into CLAUDE.md) was that FTP
 * cannot run on a serverless platform, so this job belongs on the BullMQ
 * worker and nowhere else. That is worth re-examining rather than repeating,
 * because it left the largest source on the site permanently un-ingested for
 * anyone without a spare machine.
 *
 * Re-examined: a Vercel Node function runs on Lambda, and Lambda permits
 * arbitrary OUTBOUND TCP. Passive FTP is entirely outbound, control connection
 * and data connection alike, so the network shape is fine. The genuine limits
 * are different ones:
 *
 *   TIME. 300 seconds, the ceiling for a Node function. 27,052 rows over FTP
 *   plus the upsert may not finish inside it.
 *   MEMORY. The catalogue is buffered before parsing, so a very large file can
 *   exhaust the function.
 *
 * Both of those are honest maybes rather than the flat no I asserted before,
 * and the cheapest way to settle it is to try. If it times out, the timeout IS
 * the answer and the worker is genuinely required; the route reports enough to
 * tell that apart from a credential problem.
 *
 * SECURITY. Behind the admin passcode, POST only, same as the maintenance
 * route. Unlike that one this DOES reach a third party, which is exactly why
 * it is gated rather than open: it authenticates to Anderton's FTP with our
 * credential. It spends no metered call budget (Impact does not charge per
 * pull the way eBay's keyset does) and sends no mail.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  if (!env.impact.hasAndertonsFeed) {
    return NextResponse.json(
      {
        error:
          "IMPACT_ANDERTONS_FTP_USER and IMPACT_ANDERTONS_FTP_PASSWORD are not both set in this environment. Set them in Vercel and redeploy.",
      },
      { status: 503 },
    )
  }

  /*
   * A slice per call, so the 300 second ceiling stops being a coin flip.
   * The upsert is idempotent and keyed on (source, external_id) and the feed
   * is a full snapshot, so slice N always means the same rows and a repeated
   * or overlapping call costs nothing but time.
   */
  const body = (await request.json().catch(() => ({}))) as { offset?: number; limit?: number }
  const offset = Number.isFinite(body.offset) ? Math.max(0, Number(body.offset)) : 0
  const limit = Number.isFinite(body.limit) ? Math.max(1, Number(body.limit)) : 4000

  const startedAt = Date.now()

  try {
    const stats = await ingestAndertonsFeed(undefined, { offset, limit })
    return NextResponse.json({
      job: "andertons-catalogue",
      ranFrom: "admin",
      seconds: Math.round((Date.now() - startedAt) / 100) / 10,
      ...stats,
    })
  } catch (error) {
    /*
     * Report the real error rather than a generic failure. The three things
     * that go wrong here are completely different problems with completely
     * different fixes, and the message is what tells them apart: bad
     * credentials, a column the parser could not bind (ImpactSchemaError names
     * the headers it saw), or the function running out of time.
     */
    const message = error instanceof Error ? error.message : String(error)

    /*
     * Echo back the connection settings, minus the password.
     *
     * A DNS failure and a wrong hostname produce the same ENOTFOUND, and the
     * env var is the likelier of the two: pasting the whole ftp:// URL into
     * IMPACT_ANDERTONS_FTP_HOST fails exactly this way, and nothing in the
     * error names what was actually used. Showing it turns a guess into a
     * glance. The password is never included, and `userSet` reports only
     * whether one exists.
     */
    const usedHost = env.impact.andertonsFtpHost
    const looksMalformed = /[:/@]/.test(usedHost) || usedHost.trim() !== usedHost

    return NextResponse.json(
      {
        error: message,
        seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        used: {
          host: usedHost,
          path: env.impact.andertonsFtpPath,
          userSet: Boolean(env.impact.andertonsFtpUser),
          passwordSet: Boolean(env.impact.andertonsFtpPassword),
        },
        hint: looksMalformed
          ? `IMPACT_ANDERTONS_FTP_HOST is "${usedHost}", which is not a bare hostname. It must be exactly "products.impact.com": no ftp:// prefix, no slashes, no path, no trailing space. Delete the variable entirely to use that default.`
          : /ENOTFOUND|EAI_AGAIN/.test(message)
            ? "The hostname did not resolve from Vercel, though it does resolve publicly. Check the variable for stray whitespace, then consider Impact's HTTPS catalogue API instead of FTP."
            : "If this ran for close to 300 seconds it timed out. If it failed fast it is the credentials or the feed's shape, and the message above says which.",
      },
      { status: 500 },
    )
  }
}
