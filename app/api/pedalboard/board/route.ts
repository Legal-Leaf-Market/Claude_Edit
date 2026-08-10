import { NextResponse, type NextRequest } from "next/server"
import { pedalBoardDetails } from "@/lib/pedalboard/queries"

export const dynamic = "force-dynamic"

/** Maximum pedals on one board. A signal chain this long is already unusual. */
const MAX_PEDALS = 20

/** Batch detail for the current board. GET /api/pedalboard/board?slugs=a,b,c */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("slugs") ?? ""
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(
    0,
    MAX_PEDALS,
  )
  const pedals = await pedalBoardDetails(slugs)
  return NextResponse.json({ pedals })
}
