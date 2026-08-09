import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The cron guard reads CRON_SECRET through lib/env, which snapshots
 * process.env at import time. Each case therefore sets the variable and then
 * re-imports both modules with a reset registry.
 */
async function loadGuard(secret: string | undefined) {
  vi.resetModules()
  if (secret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = secret
  const mod = await import("@/lib/cron-auth")
  return mod.requireCronAuth
}

function requestWith(authorization?: string): NextRequest {
  return new NextRequest("https://musictime.test/api/cron/refresh-deals", {
    headers: authorization ? { authorization } : {},
  })
}

const originalSecret = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = originalSecret
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
  vi.resetModules()
})

describe("requireCronAuth", () => {
  it("fails CLOSED with 503 when CRON_SECRET is unset", async () => {
    // This is the case that matters most. These routes burn the eBay call
    // budget and send email, so an unconfigured deploy must refuse to run them
    // rather than run them unauthenticated.
    const requireCronAuth = await loadGuard(undefined)
    const response = requireCronAuth(requestWith("Bearer anything"))
    expect(response?.status).toBe(503)
  })

  it("rejects a missing Authorization header with 401", async () => {
    const requireCronAuth = await loadGuard("s3cret-value")
    expect(requireCronAuth(requestWith())?.status).toBe(401)
  })

  it("rejects a wrong bearer with 401", async () => {
    const requireCronAuth = await loadGuard("s3cret-value")
    expect(requireCronAuth(requestWith("Bearer wrong-value"))?.status).toBe(401)
  })

  it("rejects a correct secret sent without the Bearer scheme", async () => {
    const requireCronAuth = await loadGuard("s3cret-value")
    expect(requireCronAuth(requestWith("s3cret-value"))?.status).toBe(401)
  })

  it("rejects a bearer that is only a prefix of the secret", async () => {
    // Guards against a comparison that stops at the first difference.
    const requireCronAuth = await loadGuard("s3cret-value")
    expect(requireCronAuth(requestWith("Bearer s3cret"))?.status).toBe(401)
  })

  it("returns null for the correct bearer, letting the route run", async () => {
    const requireCronAuth = await loadGuard("s3cret-value")
    expect(requireCronAuth(requestWith("Bearer s3cret-value"))).toBeNull()
  })
})
