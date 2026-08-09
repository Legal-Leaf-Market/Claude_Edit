import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  issueToken,
  passcodeEnabled,
  passcodeMatches,
} from "@/lib/admin"

export const runtime = "nodejs"
// The passcode check must never be served from a cache.
export const dynamic = "force-dynamic"

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

/**
 * Per-instance attempt counter. A serverless deployment spreads requests across
 * instances so this is a speed bump rather than a hard limit — combined with the
 * fixed delay on failure it makes online guessing impractical without needing a
 * shared store.
 */
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return headerList.get("x-real-ip") ?? "unknown"
}

function throttled(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function POST(request: Request) {
  if (!passcodeEnabled()) {
    return NextResponse.json(
      { error: "Passcode sign-in is not configured on this deployment." },
      { status: 501 },
    )
  }

  const headerList = await headers()
  if (throttled(clientKey(headerList))) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429 },
    )
  }

  let submitted = ""
  try {
    const body = (await request.json()) as { passcode?: unknown }
    if (typeof body?.passcode === "string") submitted = body.passcode
  } catch {
    // Fall through to the generic failure below rather than leaking a parse error.
  }

  if (!submitted || !passcodeMatches(submitted)) {
    await delay(400)
    return NextResponse.json({ error: "That passcode isn't right." }, { status: 401 })
  }

  const token = issueToken()
  if (!token) {
    return NextResponse.json({ error: "Passcode sign-in is not configured." }, { status: 501 })
  }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  return NextResponse.json({ ok: true })
}
