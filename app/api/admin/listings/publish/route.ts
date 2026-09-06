import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { isAdmin } from "@/lib/admin/gate"
import { db } from "@/lib/db"
import { listingDrafts, LISTING_CHANNELS, type ListingChannel } from "@/lib/db/schema"
import { endEverywhereExcept, publishDraft } from "@/lib/listing/publish"
import { readinessFor } from "@/lib/listing/readiness"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Push one unit to one channel, or take it down everywhere because it sold.
 *
 * POST {"id": "...", "channel": "reverb"}          push
 * POST {"id": "...", "action": "check"}            what each channel still needs
 * POST {"id": "...", "action": "sold", "soldOn": "ebay"}   end everywhere else
 *
 * POST ONLY, AND NOT BECAUSE OF CONVENTION. Every action here creates or
 * destroys something on a real marketplace. A GET would be followed by a link
 * prefetcher, a crawler, or a browser restoring tabs, and the result is a live
 * listing nobody meant to create.
 */

function guard() {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return guard()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return NextResponse.json({ error: "Which listing?" }, { status: 400 })

  const rows = await db.select().from(listingDrafts).where(eq(listingDrafts.id, id)).limit(1)
  const draft = rows[0]
  if (!draft) return NextResponse.json({ error: "No such listing." }, { status: 404 })

  const action = typeof body.action === "string" ? body.action : "publish"

  if (action === "check") {
    return NextResponse.json(
      { readiness: LISTING_CHANNELS.map((c) => readinessFor(draft, c)) },
      { headers: { "cache-control": "private, no-store" } },
    )
  }

  if (action === "sold") {
    const soldOn = LISTING_CHANNELS.includes(body.soldOn as ListingChannel)
      ? (body.soldOn as ListingChannel)
      : null
    const result = await endEverywhereExcept(draft.id, soldOn)
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } })
  }

  const channel = body.channel as ListingChannel
  if (!LISTING_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: `Channel must be one of ${LISTING_CHANNELS.join(", ")}.` },
      { status: 400 },
    )
  }

  try {
    const outcome = await publishDraft(draft, channel)
    return NextResponse.json(outcome, { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    console.error("[admin/listings/publish]", error)
    return NextResponse.json({ error: "The push failed. Check the logs." }, { status: 500 })
  }
}
