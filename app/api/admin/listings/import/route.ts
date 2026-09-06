import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { importReverbShop } from "@/lib/listing/import-reverb"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Pull the live Reverb shop into the master records.
 *
 * POST ONLY. It creates rows, and a GET would be followed by a prefetcher or a
 * browser restoring a tab. Safe to run more than once by design: it creates
 * what is missing and skips what is already here.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  try {
    const result = await importReverbShop()
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    console.error("[admin/listings/import]", error)
    return NextResponse.json({ error: "The import failed. Check the logs." }, { status: 500 })
  }
}
