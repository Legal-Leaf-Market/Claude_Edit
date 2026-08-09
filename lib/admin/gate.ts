import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * The admin gate. One way in: ADMIN_PASSCODE, typed at /admin/sign-in. It
 * doubles as the HMAC key for the session cookie, so rotating it signs
 * everyone out — no separate signing secret to manage, and no database.
 *
 * This site has no user accounts and no Better Auth session that would make
 * sense to gate an internal financial page behind, so the gate is a single
 * shared passcode rather than a per-user login. With ADMIN_PASSCODE unset the
 * gate denies everyone: an unset env var on a fresh deploy must never publish
 * the operating model, the same "fail closed" rule CRON_SECRET follows.
 */

export const ADMIN_COOKIE = "gearavail_admin"
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30 // 30 days

function passcode(): string | null {
  const value = (process.env.ADMIN_PASSCODE || "").trim()
  return value ? value : null
}

export function adminConfigured(): boolean {
  return passcode() !== null
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

/** Constant-time comparison that tolerates differing lengths without throwing. */
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

/** Server Component / Route Handler check against the cookie jar. */
export async function isAdmin(): Promise<boolean> {
  if (!passcode()) return false
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  return !!(token && verifyToken(token))
}

export const adminCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
})

/**
 * Per-instance attempt counter. A serverless deployment spreads requests
 * across instances, so this is a speed bump rather than a hard limit — paired
 * with the fixed delay on failure it makes online guessing impractical
 * without a shared store. The first endpoint here that has needed one.
 */
const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return headers.get("x-real-ip") ?? "unknown"
}

export function throttled(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
