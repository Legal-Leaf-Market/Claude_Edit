import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import {
  PROMOTION_RULES,
  clearPromotedListings,
  countPromoted,
  promoteCaptures,
  promotionRule,
} from "@/lib/capture/promote"
import { sourceStatuses } from "@/lib/ingestion/source-status"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Publish a merchant's captures as listings, or retire them again.
 *
 * DRY RUN UNLESS ASKED OTHERWISE. This is the one operation in the capture
 * pipeline that puts rows in front of shoppers, and reading what it WOULD write
 * costs nothing, so `{"merchantKey":"andertons"}` previews and
 * `{"merchantKey":"andertons","commit":true}` writes. Nobody should discover
 * what a promotion does by doing it.
 *
 * THE FEED CHECK IS PASSED IN RATHER THAN LOOKED UP INSIDE. lib/capture/
 * promote.ts deliberately knows nothing about env or feed configuration: it
 * decides what may be published, not what is configured. Here is where the two
 * meet, so the outcome can warn that a source already has a working feed
 * carrying tracked links these rows cannot.
 *
 * Behind the admin passcode, POST only.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  let body: { merchantKey?: string; commit?: boolean; mode?: "promote" | "clear" | "list" }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const mode = body.mode ?? "promote"

  if (mode === "list") {
    /*
     * What may be published, and how much of it already is. The `note` is
     * returned verbatim because it is the reasoning, and a reason nobody can
     * read is a reason nobody can disagree with.
     */
    return NextResponse.json({
      rules: await Promise.all(
        PROMOTION_RULES.map(async (rule) => ({
          merchantKey: rule.merchantKey,
          source: rule.source,
          basis: rule.basis,
          note: rule.note,
          decidedOn: rule.decidedOn,
          earnsCommission: rule.affiliate !== "not-buildable",
          staleAfterDays: rule.staleAfterDays,
          liveNow: await countPromoted(rule.source),
        })),
      ),
    })
  }

  const merchantKey = body.merchantKey?.trim().toLowerCase()
  if (!merchantKey) {
    return NextResponse.json(
      { error: 'A "merchantKey" is required.', known: PROMOTION_RULES.map((r) => r.merchantKey) },
      { status: 400 },
    )
  }

  const rule = promotionRule(merchantKey)
  if (!rule) {
    return NextResponse.json(
      {
        error:
          `No promotion rule for "${merchantKey}". Capturing a merchant's pages says nothing about ` +
          `the right to republish them, so publishing needs a row in PROMOTION_RULES recording why, ` +
          `who decided, and when.`,
        known: PROMOTION_RULES.map((r) => r.merchantKey),
      },
      { status: 400 },
    )
  }

  if (mode === "clear") {
    const cleared = await clearPromotedListings(rule.source)
    return NextResponse.json({
      merchantKey: rule.merchantKey,
      source: rule.source,
      cleared,
      /* Expired rather than deleted, so the prices they recorded survive. */
      note:
        "Retired rather than deleted, so the price history those rows contributed stays in the " +
        "record. Run this when the merchant's real feed starts working: feed rows and captured rows " +
        "key differently, so the same product would otherwise be listed twice at one store and " +
        "counted twice in that model's median.",
    })
  }

  /* Is this source's real feed already working? If so, this is the worse path. */
  const status = sourceStatuses().find((s) => s.source === rule.source)
  const feedIsLive = status?.state === "live"

  try {
    const outcome = await promoteCaptures(rule.merchantKey, {
      dryRun: !body.commit,
      feedIsLive,
    })

    return NextResponse.json({
      ...outcome,
      earnsCommission: rule.affiliate !== "not-buildable",
      /*
       * Said on every response, not buried in a doc. A promoted Impact or CJ
       * listing carries a null affiliate_url because their deep links need ids
       * a captured page cannot hold, so these rows send real shoppers to real
       * products and earn nothing. That is the right trade rather than a bug
       * (section 5: a tracker that credits nobody is worse than a clean direct
       * link), and it is also the best argument there is for connecting the
       * feed.
       */
      commissionNote:
        rule.affiliate === "not-buildable"
          ? "These listings carry NO affiliate link: Impact and CJ deep links need a campaign and ad " +
            "id that a captured page cannot hold, and this repo never hand-builds one. Shoppers reach " +
            "the merchant's own page and we earn nothing until the feed is connected."
          : undefined,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}
