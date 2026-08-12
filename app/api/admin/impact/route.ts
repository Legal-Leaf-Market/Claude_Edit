import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { env } from "@/lib/env"
import {
  ingestImpactCatalogue,
  listImpactCatalogs,
  peekImpactCatalogue,
} from "@/lib/ingestion/impact-catalogue"
import { impactMerchant, impactSkipReason, IMPACT_MERCHANTS } from "@/lib/ingestion/impact-merchants"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * The Impact.com console: list the catalogues, peek at one, or pull it.
 *
 * Was /api/admin/andertons-api, which did the last two for one merchant. There
 * are eight now and the work is identical, so it takes a merchant key instead
 * of naming one, and gained the mode that matters most when there are eight.
 *
 * THREE MODES, IN THE ORDER YOU WANT THEM.
 *
 * `list` asks the account which catalogues it can actually read, and is the
 * only way to fill in the IMPACT_*_CATALOG_ID variables. A catalogue id cannot
 * be derived, defaulted or guessed: a wrong one either 404s or returns a
 * DIFFERENT advertiser's products, which would file one merchant's stock under
 * another's name and corrupt both the store page and the medians built from it.
 * Anderton's 30480 was read off the platform by hand; this is that, for the
 * other seven, without the round trip.
 *
 * `peek` reads one page of a catalogue, writes nothing, and reports every field
 * name it found alongside the ones the alias table bound. That is CLAUDE.md's
 * rule about never writing a normaliser against a guessed schema, made
 * self-service. The output that matters is a field PRESENT BUT UNBOUND, which
 * is exactly how a column silently arrives null on every row: "Manufacturer
 * Name" nearly did it once, and `OriginalUrl` actually did, handing out
 * affiliate links where the merchant's own page belonged. Seven of these eight
 * catalogues have never been read by anything. Peek before you pull.
 *
 * `pull` (the default) ingests a slice. Same job the cron route and the worker
 * run, so nothing about a manual pull is a special case.
 *
 * SECURITY. Behind the admin passcode, POST only. It reaches a third party with
 * our credentials, which is why it is gated rather than open. It spends no
 * metered call budget (Impact does not charge per pull the way eBay's keyset
 * does) and sends no mail.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  if (!env.impact.hasApi) {
    return NextResponse.json(
      {
        error:
          "IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN are not both set in this environment. Both are on the Impact platform's API settings page, and both are shared by every merchant on the account. Set them in Vercel and redeploy.",
        used: {
          accountSidSet: Boolean(env.impact.accountSid),
          authTokenSet: Boolean(env.impact.authToken),
        },
      },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "list" | "peek" | "pull"
    merchant?: string
    startPage?: number
    pages?: number
    pageSize?: number
  }

  const startedAt = Date.now()
  const seconds = () => Math.round((Date.now() - startedAt) / 100) / 10

  try {
    if (body.mode === "list") {
      const catalogs = await listImpactCatalogs(env.impact.accountSid, env.impact.authToken)
      /*
       * Say which ids are already wired up. With eight merchants the useful
       * question is not "what catalogues exist" but "which of these is not yet
       * in an env var", and answering it here beats cross-referencing two lists
       * by eye.
       */
      const configured = new Map(
        IMPACT_MERCHANTS.filter((m) => m.catalogId).map((m) => [m.catalogId, m.key]),
      )
      return NextResponse.json({
        mode: "list",
        seconds: seconds(),
        count: catalogs.length,
        catalogs: catalogs.map((c) => ({ ...c, wiredTo: configured.get(c.id) ?? null })),
        merchants: IMPACT_MERCHANTS.map((m) => ({
          key: m.key,
          label: m.label,
          catalogId: m.catalogId || null,
          envVar: m.envVar,
        })),
      })
    }

    const merchant = impactMerchant(body.merchant ?? "andertons")
    if (!merchant) {
      return NextResponse.json(
        { error: `Unknown Impact merchant "${body.merchant}".`, known: IMPACT_MERCHANTS.map((m) => m.key) },
        { status: 404 },
      )
    }

    const skip = impactSkipReason(merchant)
    if (skip) {
      return NextResponse.json(
        { error: skip, merchant: merchant.key, envVar: merchant.envVar },
        { status: 503 },
      )
    }

    const config = {
      accountSid: env.impact.accountSid,
      authToken: env.impact.authToken,
      catalogId: merchant.catalogId,
    }

    if (body.mode === "peek") {
      return NextResponse.json({
        mode: "peek",
        merchant: merchant.key,
        label: merchant.label,
        seconds: seconds(),
        ...(await peekImpactCatalogue(config, `The ${merchant.label} Impact catalogue`)),
      })
    }

    const outcome = await ingestImpactCatalogue(merchant, {
      startPage: body.startPage,
      pages: body.pages,
      pageSize: body.pageSize,
    })
    return NextResponse.json({
      mode: "pull",
      merchant: merchant.key,
      label: merchant.label,
      job: `${merchant.key}-catalogue-api`,
      seconds: seconds(),
      ...outcome,
    })
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
        used: {
          merchant: body.merchant ?? "andertons",
          catalogId: impactMerchant(body.merchant ?? "andertons")?.catalogId ?? null,
          accountSidSet: true,
          authTokenSet: true,
        },
      },
      { status: 500 },
    )
  }
}
