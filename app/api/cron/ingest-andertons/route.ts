import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { env } from "@/lib/env"
import { ingestAndertonsFeed } from "@/lib/ingestion/andertons-impact"
import { explainFtpFailure } from "@/lib/ingestion/ftp-probe"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Anderton's catalogue refresh, over the FTP drop.
 *
 * WHY THIS ROUTE NOW EXISTS, WHEN THE REPO SPENT MONTHS SAYING IT SHOULD NOT.
 *
 * Anderton's had one automated trigger, `/api/cron/ingest-impact/andertons`,
 * which reads the catalogue over Impact's REST API. On 24 August that path was
 * settled, and settled as impossible: with the response body finally reported,
 * Impact answers every request for catalogue 30480 with
 *
 *     "The requested catalog has not been made available via API by the
 *      Advertiser."
 *
 * Credentials fine, catalogue id right, page size irrelevant. The advertiser
 * has not switched API delivery on, and no amount of retrying changes a setting
 * in somebody else's account.
 *
 * That leaves the FTP drop as the ONLY way in, and until now the only way to
 * run it was a human pressing a button behind the admin passcode. The largest
 * catalogue on the site cannot depend on somebody remembering.
 *
 * WHAT IS STILL UNKNOWN, AND THIS ROUTE IS HOW IT GETS ANSWERED. Whether a
 * serverless function can complete this at all is genuinely open. The network
 * shape is fine (Lambda permits outbound TCP and passive FTP is entirely
 * outbound), but two limits are real: the 300 second ceiling, and the memory to
 * buffer a 27,000 row file before parsing it. Both are honest maybes, and the
 * cheapest way to settle a maybe is to schedule it and read the result.
 *
 * If it times out, the timeout IS the answer and the BullMQ worker is genuinely
 * required. What the schedule buys either way is that the answer arrives on its
 * own rather than waiting on somebody to go and look.
 *
 * WHY IT RUNS RARELY. Every other feed here is hourly or three-hourly. This one
 * re-downloads the whole catalogue on every run rather than resuming a page at
 * a time, which is exactly the asymmetry that made the API path attractive, so
 * a frequent schedule would spend a lot of transfer to learn very little. Daily
 * is enough for a retail catalogue whose prices move in days, not minutes.
 *
 * Fails closed on CRON_SECRET like every other cron route: unset is 503, wrong
 * bearer is 401.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const startedAt = Date.now()

  try {
    const outcome = await ingestAndertonsFeed()
    const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

    return NextResponse.json(
      {
        job: "andertons-catalogue",
        transport: "ftp",
        elapsedMs: Date.now() - startedAt,
        ...outcome,
        indexed,
      },
      { status: outcome.status === "failed" ? 500 : 200 },
    )
  } catch (error) {
    /*
     * ROUTE THE FAILURE TO THE THING WORTH CHANGING, which is what
     * `explainFtpFailure` is for and why it reads the reply CODE rather than
     * the prose: Impact's "431 Service is unavailable" reads like an outage
     * while 431 is RFC 2228's security range, returned to AUTH TLS before any
     * credential is sent.
     *
     * The elapsed time is reported because it is the one number that tells a
     * timeout apart from a refusal, and a timeout is the answer to the open
     * question above rather than a bug to chase.
     */
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        job: "andertons-catalogue",
        transport: "ftp",
        status: "failed",
        elapsedMs: Date.now() - startedAt,
        error: message,
        diagnosis: explainFtpFailure(message, env.impact.andertonsFtpHost),
      },
      { status: 500 },
    )
  }
}
