import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"
import { refreshCatalog } from "@/lib/revalidate"

/**
 * Refresh the catalogue when the sister site redeploys.
 *
 * THE BUG THIS EXISTS FOR, because it is not obvious and it already shipped
 * once. Both Vercel projects build from the same commit at the same time, and
 * this one prerenders `/catalog` by fetching Gear Avail over HTTP during its
 * build. So a commit that changes the endpoint AND this site races itself:
 * this build can finish first and bake in a response from the OLD production
 * deployment, which is exactly what happened on the change that made the
 * catalogue read the live shelf. The page came out labelled with the previous
 * version's numbers and looked, reasonably, like the deploy had not worked.
 *
 * It self heals in fifteen minutes, because that is what `revalidate` on the
 * page is for. This route closes the window: Vercel calls it when Gear Avail's
 * production deployment succeeds, the tag is dropped, and the next request
 * rebuilds the page against the endpoint that is actually live now.
 *
 * IT DOES NOT MAKE THIS SITE DEPEND ON THAT ONE. Nothing here reaches out,
 * nothing here holds a credential for anything, and the whole route failing
 * leaves the fifteen minute window exactly as it was. CLAUDE.md's rule against
 * adding a credential here is about not giving this project a way INTO the
 * sister site's data; a shared string that only proves an inbound request is
 * genuine is the opposite of that, and it opens nothing.
 *
 * THE COUPLING RUNS ONE WAY, and it has to stay that way. This site knows
 * about Gear Avail. Gear Avail knows nothing about this site, and no code
 * shipped over there for this: the caller is Vercel's own webhook, configured
 * once in the dashboard. See CLAUDE.md section 2b for that setup.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel event types that mean "the new code is now the one serving traffic".
 *
 * ALL THREE, DELIBERATELY, rather than the one the setup notes name. Vercel's
 * own examples subscribe to `deployment.ready` and its docs do not enumerate
 * the full list in one place, so pinning this to a single string would make
 * the hook depend on a name nobody here has seen delivered. Accepting the
 * union costs nothing: a second refresh drops a tag that is already dropped,
 * and whichever event the webhook is configured for, it lands here.
 *
 * `deployment.created` is deliberately absent: it fires when the build starts,
 * which is the moment that causes the problem rather than the moment that
 * fixes it. Subscribing to it would refresh the page while the OLD deployment
 * is still answering, and cache the stale catalogue a second time.
 */
const LIVE_EVENTS = new Set(["deployment.succeeded", "deployment.ready", "deployment.promoted"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Constant time compare of two secrets, length difference included. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Vercel signs the RAW body with the webhook secret, HMAC SHA1, hex encoded.
 * The body has to be verified before it is parsed, which is why this route
 * reads text() and does its own JSON.parse rather than taking request.json().
 */
function signatureMatches(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  return secretMatches(header, createHmac("sha1", secret).update(rawBody).digest("hex"))
}

type Verdict = { act: boolean; reason: string }

/**
 * Whether this event is Gear Avail going live in production.
 *
 * THE ASYMMETRY DECIDES THE UNKNOWN CASE. Revalidating when we did not need to
 * costs one page regeneration, which nobody can see. Failing to revalidate
 * brings back a stale catalogue that looks like a broken deploy. So a field
 * that is present and says "not ours" skips, and a field that is missing
 * because the payload is a shape this code has never seen acts anyway.
 */
function verdictFor(body: unknown, sisterProject: string): Verdict {
  if (!isRecord(body)) return { act: true, reason: "unrecognised payload, refreshed anyway" }

  const type = typeof body.type === "string" ? body.type : null
  if (type && !LIVE_EVENTS.has(type)) return { act: false, reason: `ignored event ${type}` }

  const payload = isRecord(body.payload) ? body.payload : {}
  const target = typeof payload.target === "string" ? payload.target : null
  if (target && target !== "production") return { act: false, reason: `ignored target ${target}` }

  /* The project name lives at payload.name on some events and on the
     deployment object on others, so both are read before concluding it is
     absent. Getting this wrong in the "absent" direction only over-refreshes. */
  const deployment = isRecord(payload.deployment) ? payload.deployment : {}
  const name =
    typeof payload.name === "string"
      ? payload.name
      : typeof deployment.name === "string"
        ? deployment.name
        : null
  if (name && name !== sisterProject) return { act: false, reason: `ignored project ${name}` }

  return { act: true, reason: `${type ?? "deployment"} for ${name ?? sisterProject}` }
}

export async function POST(request: NextRequest) {
  const { webhookSecret, manualSecret, sisterProject } = env.revalidation

  /* Fails CLOSED, and unset matters more than wrong, the same way the sister
     site treats CRON_SECRET. An unconfigured deploy must not expose a route
     that lets anybody on the internet make this site rebuild a page on
     demand. */
  if (!webhookSecret && !manualSecret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Revalidation is not configured. Set VERCEL_WEBHOOK_SECRET (or REVALIDATE_SECRET) on this project.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const raw = await request.text()

  const authorization = request.headers.get("authorization") ?? ""
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null

  const signed = webhookSecret
    ? signatureMatches(raw, request.headers.get("x-vercel-signature"), webhookSecret)
    : false
  const presented = manualSecret && bearer ? secretMatches(bearer, manualSecret) : false
  const authorized = signed || presented

  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: "Bad signature" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  /* A hand rolled call carries no body at all, and that is a valid way to use
     this route. Only a webhook payload gets filtered. */
  let body: unknown = null
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
  }

  const verdict = raw && body ? verdictFor(body, sisterProject) : { act: true, reason: "manual" }

  if (!verdict.act) {
    return NextResponse.json(
      { ok: true, revalidated: false, reason: verdict.reason },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  refreshCatalog()

  return NextResponse.json(
    { ok: true, revalidated: true, reason: verdict.reason },
    { headers: { "Cache-Control": "no-store" } },
  )
}
