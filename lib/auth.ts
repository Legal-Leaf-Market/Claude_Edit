import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import * as schema from "@/lib/db/schema"

/**
 * Better Auth, email and password only.
 *
 * Accounts exist for exactly one reason: saved price alerts need somewhere to
 * hang off and an address to send to. There is no cart and no checkout, so
 * there is nothing else to protect.
 *
 * BETTER_AUTH_SECRET being unset is a real deployment state (the storefront and
 * search work perfectly well without accounts), so the auth handler degrades to
 * a clear 503 rather than crashing the whole app at import time.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.auth.secret || "insecure-development-secret-do-not-use-in-production",
  baseURL: env.auth.url,
  emailAndPassword: {
    enabled: true,
    // No email verification loop in v1: the alert email itself is the proof the
    // address works, and an unverified account can only ever email itself.
    requireEmailVerification: false,
    minPasswordLength: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: "gearavail",
  },
})

export type Session = typeof auth.$Infer.Session
