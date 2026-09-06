import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { isAdmin } from "@/lib/admin/gate"
import { db } from "@/lib/db"
import { listingDrafts, listingPublications, DRAFT_STATUSES } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * The master listing records: read them, create one, update one.
 *
 * ADMIN ONLY AND `private, no-store`. These rows carry `cost_cents` and
 * `offer_floor_cents`, which are what we paid and the least we will take. Both
 * are ours alone: no channel is ever told either, and a shared cache holding
 * them is the leak the passcode exists to prevent.
 */

function guard() {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 })
}

const PRIVATE = { "cache-control": "private, no-store" }

export async function GET() {
  if (!(await isAdmin())) return guard()

  const drafts = await db.select().from(listingDrafts).orderBy(desc(listingDrafts.updatedAt))
  const publications = await db.select().from(listingPublications)

  return NextResponse.json(
    {
      drafts: drafts.map((d) => ({
        ...d,
        publications: publications.filter((p) => p.draftId === d.id),
      })),
    },
    { headers: PRIVATE },
  )
}

/** Fields a caller may set. Anything else is ignored rather than trusted. */
const WRITABLE = [
  "sku", "intakeRef", "status", "title", "brand", "model", "category",
  "description", "condition", "year", "finish", "countryOfOrigin", "photos",
  "priceCents", "costCents", "currency", "acceptsOffers", "offerFloorCents",
  "shippingCents", "localPickup", "channelMeta", "notes",
] as const

function clean(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (raw[key] !== undefined) out[key] = raw[key]
  }
  if (typeof out.status === "string" && !DRAFT_STATUSES.includes(out.status as never)) {
    delete out.status
  }
  return out
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return guard()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 })
  }

  const patch = clean(body)
  const id = typeof body.id === "string" ? body.id : null

  if (id) {
    const rows = await db
      .update(listingDrafts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(listingDrafts.id, id))
      .returning()
    if (!rows[0]) return NextResponse.json({ error: "No such draft." }, { status: 404 })
    return NextResponse.json({ draft: rows[0] }, { headers: PRIVATE })
  }

  if (typeof patch.sku !== "string" || !patch.sku.trim()) {
    return NextResponse.json({ error: "A new listing needs a SKU." }, { status: 400 })
  }
  if (typeof patch.title !== "string" || !patch.title.trim()) {
    return NextResponse.json({ error: "A new listing needs a title." }, { status: 400 })
  }

  try {
    const rows = await db
      .insert(listingDrafts)
      .values(patch as typeof listingDrafts.$inferInsert)
      .returning()
    return NextResponse.json({ draft: rows[0] }, { headers: PRIVATE })
  } catch (error) {
    /* The unique index on sku is the likeliest failure and it means something
       specific, so it is worth saying rather than reporting as a 500. */
    const message = (error as Error).message
    if (/uq_listing_drafts_sku|duplicate key/i.test(message)) {
      return NextResponse.json({ error: `SKU ${patch.sku} is already used.` }, { status: 409 })
    }
    console.error("[admin/listings]", error)
    return NextResponse.json({ error: "Could not save. Check the logs." }, { status: 500 })
  }
}
