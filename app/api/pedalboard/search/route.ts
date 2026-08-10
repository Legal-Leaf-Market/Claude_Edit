import { NextResponse, type NextRequest } from "next/server"
import { searchPedals } from "@/lib/pedalboard/queries"

export const dynamic = "force-dynamic"

/** Autocomplete for the pedalboard builder. GET /api/pedalboard/search?q=... */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  const pedals = await searchPedals(q, 8)
  return NextResponse.json({ pedals })
}
