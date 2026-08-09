import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies, headers } from "next/headers"
import { auth } from "@/lib/auth"

export const ADMIN_COOKIE = "llm_admin"

/** Passcode sessions last a month; re-entering the passcode renews them. */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30

/**
 * Two independent ways in, either of which is sufficient:
 *
 *   ADMIN_PASSCODE  a shared secret typed at /admin/sign-in. Doubles as the HMAC
 *                   key for the resulting cookie, so no separate signing secret
 *                   is needed and rotating the passcode invalidates every
 *                   outstanding session.
 *   ADMIN_EMAILS    comma-separated allowlist checked against the signed-in
 *                   Better Auth account, for when the site's own login is wired
 *                   up and you'd rather not keep a second secret.
 *
 * With neither set the gate denies everyone. Failing closed matters more here
 * than convenience: an unset env var on a fresh deploy must not publish the
 * business's financials.
 */
function passcode(): string | null {
  const value = process.env.ADMIN_PASSCODE?.trim()
  return value ? value : null
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function adminConfigured(): boolean {
  return passcode() !== null || adminEmails().length > 0
}

export function passcodeEnabled(): boolean {
  return passcode() !== null
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

/** Constant-time comparison that tolerates differing lengths. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex")
  const bufB = Buffer.from(b, "hex")
  if (bufA.length === 0 || bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function issueToken(now = Date.now()): string | null {
  const secret = passcode()
  if (!secret) return null
  const issuedAt = Math.floor(now / 1000)
  return `${issuedAt}.${sign(`v1:${issuedAt}`, secret)}`
}

function verifyToken(token: string, now = Date.now()): boolean {
  const secret = passcode()
  if (!secret) return false
  const separator = token.indexOf(".")
  if (separator <= 0) return false
  const issuedAt = Number(token.slice(0, separator))
  const signature = token.slice(separator + 1)
  if (!Number.isFinite(issuedAt)) return false

  const age = Math.floor(now / 1000) - issuedAt
  // A future-dated token is a forged one; an expired token is simply stale.
  if (age < -60 || age > ADMIN_SESSION_SECONDS) return false

  return safeEqualHex(sign(`v1:${issuedAt}`, secret), signature)
}

/** Constant-time check of a submitted passcode against the configured one. */
export function passcodeMatches(submitted: string): boolean {
  const secret = passcode()
  if (!secret) return false
  // Hash both sides first so the comparison is length-independent.
  const a = createHmac("sha256", secret).update(submitted).digest("hex")
  const b = createHmac("sha256", secret).update(secret).digest("hex")
  return safeEqualHex(a, b)
}

export async function isAdmin(): Promise<boolean> {
  if (passcode()) {
    const jar = await cookies()
    const token = jar.get(ADMIN_COOKIE)?.value
    if (token && verifyToken(token)) return true
  }

  const allowlist = adminEmails()
  if (allowlist.length > 0) {
    try {
      const session = await auth.api.getSession({ headers: await headers() })
      const email = session?.user?.email?.toLowerCase()
      if (email && allowlist.includes(email)) return true
    } catch {
      // Better Auth needs DATABASE_URL. If it isn't reachable, the passcode
      // path is still valid — this must not throw a 500 on the sign-in page.
    }
  }

  return false
}
