import { NextResponse } from "next/server"
import { desc, sql } from "drizzle-orm"
import { isAdmin, passcodeMatches, adminConfigured } from "@/lib/admin/gate"
import { db } from "@/lib/db"
import { productCaptures } from "@/lib/db/schema"
import type { CaptureResult } from "@/lib/capture/extract"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Receive a capture from the collector.
 *
 * WHY A TOKEN HEADER AND NOT THE ADMIN COOKIE. This is posted from the
 * merchant's own page, so it is cross-origin, and the admin session cookie is
 * SameSite and will not travel. The operator types the passcode into the panel
 * on the shop page instead; it is used for one request and never stored
 * anywhere. Same reasoning as the sister site's x-ll-admin-token, and the same
 * rule about never putting it in the bookmarklet URL, which lives in a
 * bookmarks bar in plain sight forever.
 *
 * FAILS CLOSED ON AN UNSET PASSCODE, like every other gate here. No passcode
 * configured means nobody can send, rather than everybody.
 *
 * WHAT IT DOES NOT DO. It does not create a listing, touch canonical_gear, or
 * put anything in front of a shopper. A capture is research; publishing one is
 * redistribution, which section 2 gates separately on a feed or a published
 * permission. Keeping the write confined to `product_captures` is what makes
 * that boundary structural rather than a matter of remembering.
 */

/*
 * CORS. The collector runs on the merchant's origin, so the browser preflights
 * this. Wide open on the ORIGIN because there is no useful way to enumerate the
 * merchant sites an operator might be standing on, and no cookie is involved:
 * the only thing that authorises a write is a passcode typed in by hand, so a
 * permissive origin grants nothing that the passcode does not already gate.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-ga-admin-token",
  "access-control-max-age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

type IngestBody = {
  merchantKey?: string
  build?: string
  capture?: CaptureResult
}

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSCODE is not set, so captures cannot be accepted." },
      { status: 503, headers: CORS },
    )
  }

  const token = request.headers.get("x-ga-admin-token") ?? ""
  if (!passcodeMatches(token)) {
    return NextResponse.json({ error: "Bad token." }, { status: 401, headers: CORS })
  }

  let body: IngestBody
  try {
    body = (await request.json()) as IngestBody
  } catch {
    return NextResponse.json({ error: "Body was not JSON." }, { status: 400, headers: CORS })
  }

  const merchantKey = body.merchantKey?.trim().toLowerCase().slice(0, 60)
  const capture = body.capture

  if (!merchantKey) {
    return NextResponse.json({ error: "merchantKey is required." }, { status: 400, headers: CORS })
  }
  if (!capture || !Array.isArray(capture.products) || !capture.pageUrl) {
    return NextResponse.json(
      { error: "capture must carry pageUrl and a products array." },
      { status: 400, headers: CORS },
    )
  }

  /*
   * A CAPTURE WITH NOTHING IN IT IS REFUSED RATHER THAN STORED, because the
   * unique index means storing it would REPLACE a good earlier capture of the
   * same page with an empty one. That is the specific way this tool could
   * destroy work: run the bookmarklet before the grid finished rendering, and
   * silently overwrite a full page with zero.
   */
  if (capture.products.length === 0) {
    return NextResponse.json(
      {
        error:
          "This capture is empty, so it was not stored. Storing it would replace any earlier capture " +
          "of the same page. Let the page finish loading, scroll to the bottom, and run it again.",
      },
      { status: 400, headers: CORS },
    )
  }

  const [row] = await db
    .insert(productCaptures)
    .values({
      merchantKey,
      origin: capture.origin?.slice(0, 255) ?? "",
      pageUrl: capture.pageUrl,
      pageTitle: capture.pageTitle?.slice(0, 2000) ?? null,
      platform: capture.platform?.slice(0, 40) ?? null,
      build: body.build?.slice(0, 16) ?? null,
      productCount: capture.products.length,
      claimedTotal: capture.coverage?.claimedTotal ?? null,
      payload: capture,
    })
    .onConflictDoUpdate({
      target: productCaptures.pageUrl,
      set: {
        merchantKey,
        pageTitle: capture.pageTitle?.slice(0, 2000) ?? null,
        platform: capture.platform?.slice(0, 40) ?? null,
        build: body.build?.slice(0, 16) ?? null,
        productCount: capture.products.length,
        claimedTotal: capture.coverage?.claimedTotal ?? null,
        payload: capture,
        capturedAt: new Date(),
      },
    })
    .returning({ id: productCaptures.id })

  const [tally] = await db
    .select({
      pages: sql<number>`COUNT(*)::int`,
      products: sql<number>`COALESCE(SUM(${productCaptures.productCount}), 0)::int`,
    })
    .from(productCaptures)
    .where(sql`${productCaptures.merchantKey} = ${merchantKey}`)

  return NextResponse.json(
    {
      ok: true,
      id: row?.id,
      merchantKey,
      stored: capture.products.length,
      merchantTotals: { pages: tally?.pages ?? 0, products: tally?.products ?? 0 },
    },
    { headers: CORS },
  )
}

/**
 * What has been captured so far, for the install page's state table.
 *
 * SIGNED IN, AND NOT CORS-OPEN. This shipped as neither, which was a mistake
 * worth naming rather than quietly correcting: the POST needs `*` because the
 * collector posts from the merchant's own origin, and the GET inherited that
 * header and the missing gate along with it.
 *
 * Empty, it leaked nothing. Populated, it would have served any site on the
 * internet the list of merchants we are capturing, how many products from each,
 * and when we last ran one. That is our own operating information, and there is
 * no caller that needs it cross-origin: the install page is same-origin, and
 * the collector on a merchant's page only ever POSTs.
 *
 * A 401 here is a normal state rather than a fault. /collect is not behind the
 * passcode, because the bookmarklet and the target list are not secrets and an
 * operator installing them should not have to sign in first. Only the state
 * table is gated, and the page says so.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Sign in at /admin to see what has been captured.", merchants: [] },
      { status: 401 },
    )
  }
  if (!adminConfigured()) {
    return NextResponse.json({ writable: false, merchants: [] })
  }

  const rows = await db
    .select({
      merchantKey: productCaptures.merchantKey,
      pages: sql<number>`COUNT(*)::int`,
      products: sql<number>`COALESCE(SUM(${productCaptures.productCount}), 0)::int`,
      claimed: sql<number | null>`MAX(${productCaptures.claimedTotal})`,
      lastAt: sql<string>`MAX(${productCaptures.capturedAt})`,
      builds: sql<string>`STRING_AGG(DISTINCT ${productCaptures.build}, ', ')`,
    })
    .from(productCaptures)
    .groupBy(productCaptures.merchantKey)
    .orderBy(desc(sql`COALESCE(SUM(${productCaptures.productCount}), 0)`))

  return NextResponse.json({ writable: true, merchants: rows })
}
