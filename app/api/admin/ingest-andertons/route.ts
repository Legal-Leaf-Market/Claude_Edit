import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { env } from "@/lib/env"
import { ingestAndertonsFeed, listAndertonsDrop } from "@/lib/ingestion/andertons-impact"
import { explainFtpFailure } from "@/lib/ingestion/ftp-probe"

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
  const body = (await request.json().catch(() => ({}))) as {
    mode?: "list" | "pull"
    offset?: number
    limit?: number
  }
  const offset = Number.isFinite(body.offset) ? Math.max(0, Number(body.offset)) : 0
  const limit = Number.isFinite(body.limit) ? Math.max(1, Number(body.limit)) : 4000

  const startedAt = Date.now()

  try {
    /*
     * List before pulling. A failed login and a catalogue too big for 300
     * seconds both surface as a slow failure otherwise, and they are opposite
     * problems. This costs a second and tells them apart.
     */
    if (body.mode === "list") {
      const listing = await listAndertonsDrop({
        host: env.impact.andertonsFtpHost,
        port: env.impact.andertonsFtpPort,
        user: env.impact.andertonsFtpUser,
        password: env.impact.andertonsFtpPassword,
        path: env.impact.andertonsFtpPath,
      })
      return NextResponse.json({
        mode: "list",
        seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        used: { host: env.impact.andertonsFtpHost, port: env.impact.andertonsFtpPort },
        ...listing,
      })
    }

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
    /*
     * Surrounding whitespace is no longer possible here: lib/env.ts trims
     * every value it reads, precisely because a pasted leading space on this
     * variable produced an ENOTFOUND that read like an outage. What remains
     * catchable is a value that is the wrong SHAPE rather than the wrong
     * spacing: a whole ftp:// URL, a host with the path appended, credentials
     * in user@host form, an interior space, or something with no dot in it.
     */
    const looksMalformed = /[:/@]/.test(usedHost) || /\s/.test(usedHost) || !usedHost.includes(".")

    return NextResponse.json(
      {
        error: message,
        seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        used: {
          host: usedHost,
          // The port matters now that the transport is SSH: a 22 here and an
          // FTP-shaped error is a contradiction worth seeing at a glance.
          port: env.impact.andertonsFtpPort,
          path: env.impact.andertonsFtpPath,
          userSet: Boolean(env.impact.andertonsFtpUser),
          passwordSet: Boolean(env.impact.andertonsFtpPassword),
        },
        hint: looksMalformed
          ? `IMPACT_ANDERTONS_FTP_HOST is "${usedHost}", which is not a bare hostname. It wants a host and nothing else: no ftp:// prefix, no slashes, no path, no credentials. Delete the variable entirely to fall back to "products.impact.com".`
          : explainFtpFailure(message, usedHost),
      },
      { status: 500 },
    )
  }
}
