import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { pullComps } from "@/lib/outreach/comps"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Price a seller's lot against what we actually know.
 *
 * POST {"rows": [{"brand": "Boss", "model": "DS-1"}, ...]} and get one comp per
 * row back, in the order sent.
 *
 * BEHIND THE ADMIN PASSCODE, and not only because the tool is. The response
 * carries our own Reverb sold prices, which is what we paid and what we made,
 * and that is the one number on this whole site that is nobody else's business.
 * Section 24 already keeps our cost out of the public shop feed; this is the
 * same figure reached by a different door.
 *
 * `private, no-store` for the same reason /api/reverb/orders is: a shared cache
 * holding our margin is the leak the passcode was meant to prevent.
 */

type Body = { rows?: unknown }

const MAX_ROWS = 60

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 })
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Send { rows: [{ brand, model }] }." }, { status: 400 })
  }

  // A lot is a board, not a catalogue. The cap is here so a malformed paste
  // cannot turn one click into a query with a thousand ILIKE branches in it.
  const rows = body.rows.slice(0, MAX_ROWS).map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>
    return {
      brand: typeof row.brand === "string" ? row.brand.slice(0, 100) : "",
      model: typeof row.model === "string" ? row.model.slice(0, 100) : "",
    }
  })

  try {
    const result = await pullComps(rows)
    return NextResponse.json(result, {
      headers: { "cache-control": "private, no-store" },
    })
  } catch (error) {
    // The reason, never the thrown object: a database error can quote the query
    // back, and the query carries whatever was pasted into the tool.
    console.error("[outreach/comps]", error)
    return NextResponse.json({ error: "The lookup failed. Check the logs." }, { status: 500 })
  }
}
