import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The catalogue refresh hook.
 *
 * Two things are being pinned. First that it fails CLOSED: an unconfigured
 * deploy must not leave a route open that lets anybody make this site rebuild
 * a page on demand. Second that it only fires on the event it is for, because
 * a team webhook sees every deployment on the account, including this site's
 * own and every preview build.
 *
 * lib/env.ts snapshots process.env at import time, so each case sets the
 * variables and re-imports with a reset registry, the same shape as the sister
 * site's cron guard tests.
 */

/*
 * The seam is lib/revalidate.ts rather than next/cache, which is an external
 * package vitest cannot mock and which throws an invariant when it is called
 * outside a request. importOriginal keeps REFRESH_TARGETS real so the tag
 * assertion below is checking the wiring rather than checking itself.
 */
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  refreshCatalog: vi.fn(),
}))

const SECRET = "s3cret-webhook-value"

type Config = { webhook?: string; manual?: string; project?: string }

async function loadRoute({ webhook, manual, project }: Config) {
  vi.resetModules()
  const set = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  set("VERCEL_WEBHOOK_SECRET", webhook)
  set("REVALIDATE_SECRET", manual)
  set("GEAR_AVAIL_PROJECT", project)
  /* Sequential, and the mocked module first. Importing both at once races the
     mock factory against the route's own import of it, and the route wins
     often enough to bind the real function. */
  const revalidate = await import("@/lib/revalidate")
  const route = await import("@/app/api/revalidate/route")
  return { POST: route.POST, refreshCatalog: vi.mocked(revalidate.refreshCatalog) }
}

function sign(body: string, secret = SECRET): string {
  return createHmac("sha1", secret).update(body).digest("hex")
}

function webhookRequest(body: unknown, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(body)
  return new Request("https://stompbox.world/api/revalidate", {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json", "x-vercel-signature": sign(raw), ...headers },
  })
}

const deploymentSucceeded = {
  type: "deployment.succeeded",
  payload: { target: "production", name: "musictime", deployment: { id: "dpl_1" } },
}

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.resetModules()
})

describe("configuration", () => {
  it("fails CLOSED with 503 when no secret is set", async () => {
    // The case that matters most: unconfigured must refuse, not accept.
    const { POST, refreshCatalog } = await loadRoute({})
    const response = await POST(webhookRequest(deploymentSucceeded) as never)
    expect(response.status).toBe(503)
    expect(refreshCatalog).not.toHaveBeenCalled()
  })

  it("rejects a wrong signature with 401", async () => {
    const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
    const raw = JSON.stringify(deploymentSucceeded)
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        body: raw,
        headers: { "x-vercel-signature": sign(raw, "the-wrong-secret") },
      }) as never,
    )
    expect(response.status).toBe(401)
    expect(refreshCatalog).not.toHaveBeenCalled()
  })

  it("rejects a missing signature with 401", async () => {
    const { POST } = await loadRoute({ webhook: SECRET })
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        body: JSON.stringify(deploymentSucceeded),
      }) as never,
    )
    expect(response.status).toBe(401)
  })

  it("rejects a body that was edited after signing", async () => {
    // The whole point of signing the raw body rather than trusting the JSON.
    const { POST } = await loadRoute({ webhook: SECRET })
    const signature = sign(JSON.stringify(deploymentSucceeded))
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        body: JSON.stringify({ ...deploymentSucceeded, payload: { target: "production" } }),
        headers: { "x-vercel-signature": signature },
      }) as never,
    )
    expect(response.status).toBe(401)
  })
})

describe("a production deploy of the sister site", () => {
  it("drops the catalogue fetch and the page built from it", async () => {
    const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
    const response = await POST(webhookRequest(deploymentSucceeded) as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ revalidated: true })
    expect(refreshCatalog).toHaveBeenCalledTimes(1)
  })

  /*
   * All three names, because Vercel's examples subscribe to deployment.ready
   * and its docs do not enumerate the list in one place. Pinning the route to
   * one string would make the hook depend on a name nobody here has seen
   * delivered, and the symptom would be silence: a 200 that refreshes nothing.
   */
  for (const type of ["deployment.succeeded", "deployment.ready", "deployment.promoted"]) {
    it(`accepts ${type}`, async () => {
      const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
      const response = await POST(
        webhookRequest({ type, payload: { target: "production", name: "musictime" } }) as never,
      )
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ revalidated: true })
      expect(refreshCatalog).toHaveBeenCalledTimes(1)
    })
  }

  it("drops the tag the catalogue fetch is actually written with", async () => {
    // A typo here fails silently: the route answers 200, nothing refreshes,
    // and the only symptom is the stale page this route exists to prevent.
    const [{ CATALOG_TAG }, { REFRESH_TARGETS }] = await Promise.all([
      import("@/lib/catalog"),
      import("@/lib/revalidate"),
    ])
    expect(REFRESH_TARGETS.tag).toBe(CATALOG_TAG)
    expect(REFRESH_TARGETS.path).toBe("/catalog")
  })
})

describe("everything else on the account", () => {
  const ignored = [
    ["a preview build", { ...deploymentSucceeded, payload: { target: "preview", name: "musictime" } }],
    [
      "this site's own deploy",
      { ...deploymentSucceeded, payload: { target: "production", name: "stompbox-world" } },
    ],
    [
      "the build STARTING, which is the moment that causes the problem",
      { type: "deployment.created", payload: { target: "production", name: "musictime" } },
    ],
    [
      "a failed deploy",
      { type: "deployment.error", payload: { target: "production", name: "musictime" } },
    ],
  ] as const

  for (const [label, body] of ignored) {
    it(`ignores ${label}`, async () => {
      const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
      const response = await POST(webhookRequest(body) as never)
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ revalidated: false })
      expect(refreshCatalog).not.toHaveBeenCalled()
    })
  }

  it("reads the project name off the deployment when the event omits the top level one", async () => {
    const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
    await POST(
      webhookRequest({
        type: "deployment.succeeded",
        payload: { target: "production", deployment: { name: "stompbox-world" } },
      }) as never,
    )
    expect(refreshCatalog).not.toHaveBeenCalled()
  })

  it("follows GEAR_AVAIL_PROJECT when the project is renamed", async () => {
    const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET, project: "gear-avail" })
    await POST(webhookRequest(deploymentSucceeded) as never)
    expect(refreshCatalog).not.toHaveBeenCalled()

    const renamed = await loadRoute({ webhook: SECRET, project: "gear-avail" })
    await renamed.POST(
      webhookRequest({
        type: "deployment.succeeded",
        payload: { target: "production", name: "gear-avail" },
      }) as never,
    )
    expect(renamed.refreshCatalog).toHaveBeenCalled()
  })
})

describe("an unrecognised payload", () => {
  it("refreshes anyway, because the two failure modes are not equal", async () => {
    /*
     * Over-refreshing costs one page regeneration nobody can see.
     * Under-refreshing puts a stale catalogue back on the site, looking like a
     * broken deploy. So a shape this code has never seen gets the benefit.
     */
    const { POST, refreshCatalog } = await loadRoute({ webhook: SECRET })
    const response = await POST(webhookRequest({ something: "new" }) as never)
    expect(response.status).toBe(200)
    expect(refreshCatalog).toHaveBeenCalled()
  })
})

describe("the manual path", () => {
  it("accepts a bearer token and refreshes with no body at all", async () => {
    const { POST, refreshCatalog } = await loadRoute({ manual: "manual-token" })
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        headers: { authorization: "Bearer manual-token" },
      }) as never,
    )
    expect(response.status).toBe(200)
    expect(refreshCatalog).toHaveBeenCalled()
  })

  it("rejects the wrong token", async () => {
    const { POST } = await loadRoute({ manual: "manual-token" })
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        headers: { authorization: "Bearer nope" },
      }) as never,
    )
    expect(response.status).toBe(401)
  })

  it("does not accept a webhook secret as a bearer token", async () => {
    // Different jobs, different values. One is signed over a body, and
    // accepting it bare would make the signature pointless.
    const { POST } = await loadRoute({ webhook: SECRET })
    const response = await POST(
      new Request("https://stompbox.world/api/revalidate", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}` },
      }) as never,
    )
    expect(response.status).toBe(401)
  })
})
