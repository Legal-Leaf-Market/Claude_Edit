import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  // The v0 preview is served through a proxy origin that isn't known from env
  // vars, so trust the incoming request's own origin (plus any known env URLs).
  // This keeps auth working in the preview iframe, on localhost, and on Vercel.
  trustedOrigins: async (request?: Request) => {
    const origins = new Set<string>()
    for (const url of [
      process.env.V0_RUNTIME_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ]) {
      if (url) origins.add(url)
    }
    // `request` is only present on HTTP calls (sign-in/up, OAuth); server-side
    // getSession() calls it without one, so guard against undefined headers.
    const headers = request?.headers
    if (headers) {
      const origin = headers.get("origin")
      if (origin) origins.add(origin)
      const referer = headers.get("referer")
      if (referer) {
        try {
          origins.add(new URL(referer).origin)
        } catch {
          // ignore malformed referer
        }
      }
    }
    return Array.from(origins)
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
