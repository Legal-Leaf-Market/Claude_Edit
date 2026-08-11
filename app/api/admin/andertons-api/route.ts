import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { env } from "@/lib/env"
import {
  diagnoseAndertonsApi,
  ingestAndertonsViaApi,
  peekAndertonsApi,
  type ImpactApiConfig,
} from "@/lib/ingestion/andertons-impact"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * The Anderton's catalogue over Impact's REST API: peek at it, or pull it.
 *
 * WHY A SECOND WAY IN. The FTP drop is the channel Impact documents first, and
 * it is the right one for catalogues too large to serve any other way. It is
 * also the awkward one here: it needs a control connection plus passive data
 * ports from a serverless function, a separate credential pair that Impact
 * mails on request, and a host that is only shown inside their platform. Every
 * failure so far has been in that plumbing rather than in anything to do with
 * the catalogue.
 *
 * The REST API needs an AccountSid and an AuthToken, both visible in Impact's
 * own API settings, and is otherwise ordinary HTTPS. Two transports onto one
 * normaliser costs very little and means the next attempt has two ways to
 * succeed instead of one.
 *
 * PEEK FIRST. `{"mode":"peek"}` reads a single page, writes nothing, and
 * reports the field names it found alongside which ones the alias table bound.
 * That is CLAUDE.md's rule about never writing a normaliser against a guessed
 * schema, made self-service: the FTP parser earned its column bindings by
 * someone pasting the real header row, and this earns its own the same way
 * without a round trip. An unbound-but-present field is the interesting
 * result, since that is precisely what silently nulls a column across 27,052
 * rows the way "Manufacturer Name" nearly did.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  if (!env.impact.hasAndertonsApi) {
    return NextResponse.json(
      {
        error:
          "IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN are not both set in this environment. Both are on the Impact platform's API settings page. Set them in Vercel and redeploy.",
        used: {
          accountSidSet: Boolean(env.impact.accountSid),
          authTokenSet: Boolean(env.impact.authToken),
          catalogId: env.impact.andertonsCatalogId,
        },
      },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "peek" | "pull" | "diagnose"
    startPage?: number
    pages?: number
    pageSize?: number
  }

  const config: ImpactApiConfig = {
    accountSid: env.impact.accountSid,
    authToken: env.impact.authToken,
    catalogId: env.impact.andertonsCatalogId,
  }

  const startedAt = Date.now()
  const seconds = () => Math.round((Date.now() - startedAt) / 100) / 10

  try {
    /*
     * Diagnose before peek in the branch order, because it is the one that
     * works when peek does not. A 400 has several candidate causes and the
     * status alone tells them apart from none of the others.
     */
    if (body.mode === "diagnose") {
      return NextResponse.json({
        mode: "diagnose",
        seconds: seconds(),
        catalogId: config.catalogId,
        ...(await diagnoseAndertonsApi(config)),
      })
    }

    if (body.mode === "peek") {
      return NextResponse.json({ mode: "peek", seconds: seconds(), ...(await peekAndertonsApi(config)) })
    }

    const outcome = await ingestAndertonsViaApi({
      startPage: body.startPage,
      pages: body.pages,
      pageSize: body.pageSize,
    })
    return NextResponse.json({ mode: "pull", job: "andertons-catalogue-api", seconds: seconds(), ...outcome })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        seconds: seconds(),
        /*
         * The catalogue id is the one setting here that can be wrong while
         * everything else is right, and unlike the credentials it is safe to
         * echo. A 404 with the id printed beside it is a one-glance fix.
         */
        used: { catalogId: config.catalogId, accountSidSet: true, authTokenSet: true },
      },
      { status: 500 },
    )
  }
}
