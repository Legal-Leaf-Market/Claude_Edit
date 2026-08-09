import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminCookieOptions,
  clientKey,
  delay,
  issueToken,
  passcodeMatches,
  throttled,
} from "@/lib/admin/gate"

export const dynamic = "force-dynamic"

/**
 * POST checks the admin passcode and issues the session cookie; DELETE
 * clears it. Fails closed when nothing is configured, same as every other
 * gated route in this app.
 */
export async function POST(request: NextRequest) {
  if (!issueToken()) {
    return NextResponse.json(
      { error: "Passcode sign-in is not configured on this deployment." },
      { status: 501 },
    )
  }

  if (throttled(clientKey(request.headers))) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  const submitted = typeof body?.passcode === "string" ? body.passcode : ""

  if (!submitted || !passcodeMatches(submitted)) {
    await delay(400)
    return NextResponse.json({ error: "That passcode isn't right." }, { status: 401 })
  }

  const token = issueToken()!
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, token, adminCookieOptions(ADMIN_SESSION_SECONDS))
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, "", adminCookieOptions(0))
  return NextResponse.json({ ok: true })
}
