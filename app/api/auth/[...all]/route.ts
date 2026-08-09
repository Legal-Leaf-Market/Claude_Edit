import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { env } from "@/lib/env"

/**
 * Better Auth handler.
 *
 * Fails closed when BETTER_AUTH_SECRET is unset. Serving auth with the
 * development fallback secret would issue forgeable session cookies, so an
 * unconfigured deploy refuses sign-in rather than pretending to work.
 */
function unconfigured() {
  return NextResponse.json(
    { error: "Authentication is not configured. Set BETTER_AUTH_SECRET." },
    { status: 503 },
  )
}

export async function GET(request: Request) {
  if (!env.auth.isConfigured) return unconfigured()
  return auth.handler(request)
}

export async function POST(request: Request) {
  if (!env.auth.isConfigured) return unconfigured()
  return auth.handler(request)
}
