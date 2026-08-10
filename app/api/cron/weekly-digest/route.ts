import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { sendWeeklyDigest } from "@/lib/newsletter/digest"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * The weekly digest send.
 *
 * Fails closed on CRON_SECRET like every other cron here, which matters more
 * than usual for this one: an unauthenticated caller could otherwise mail the
 * entire subscriber list on demand.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const result = await sendWeeklyDigest()
  return NextResponse.json({ job: "weekly-digest", ...result })
}
