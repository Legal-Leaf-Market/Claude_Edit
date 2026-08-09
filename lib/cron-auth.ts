import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"

/**
 * Shared guard for every /api/cron/* route.
 *
 * FAILS CLOSED, exactly as the sister sites do:
 *   - CRON_SECRET unset  -> 503, the job refuses to run at all
 *   - wrong bearer       -> 401
 *
 * The unset case matters more than it looks. These routes trigger feed
 * ingestion and send email. If an unconfigured deploy let them run
 * unauthenticated, anyone who guessed the path could burn the day's eBay call
 * budget or mail every alert subscriber on demand.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  if (!env.cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Cron routes are disabled." },
      { status: 503 },
    )
  }

  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${env.cronSecret}`

  if (!timingSafeEqual(header, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

/**
 * Constant-time string comparison.
 *
 * A plain === returns as soon as it finds a differing byte, which leaks the
 * length of the matching prefix to anyone who can measure response times. This
 * always walks the full length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
