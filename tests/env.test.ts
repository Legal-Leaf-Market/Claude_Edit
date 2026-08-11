import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * How environment variables are READ, which turns out to matter as much as
 * what they hold.
 *
 * This file exists because of one real incident. IMPACT_ANDERTONS_FTP_HOST was
 * pasted into Vercel as " products.impact.com", with a leading space that no
 * dashboard shows and no error message quotes. The FTP client dutifully asked
 * DNS for a hostname containing a space, got ENOTFOUND, and the failure looked
 * for a while like Vercel's resolver or Impact being down: everything that
 * printed the value printed something that read as correct.
 *
 * The fix is in `str()` rather than at the call site, because the exposure is
 * every variable in the file and not just that one.
 */

/**
 * `env` is a module-level const, so it captures process.env once at import.
 * Each case therefore sets the variable first and imports fresh.
 */
async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules()
  const previous: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const mod = await import("@/lib/env")
  return { env: mod.env, previous }
}

const touched: Record<string, string | undefined>[] = []

afterEach(() => {
  for (const previous of touched.splice(0)) {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
  vi.resetModules()
})

async function withEnv(vars: Record<string, string | undefined>) {
  const { env, previous } = await loadEnv(vars)
  touched.push(previous)
  return env
}

describe("string variables are trimmed", () => {
  /** The actual incident, pinned. */
  it("strips a pasted leading space from the Anderton's FTP host", async () => {
    const env = await withEnv({ IMPACT_ANDERTONS_FTP_HOST: " products.impact.com" })
    expect(env.impact.andertonsFtpHost).toBe("products.impact.com")
  })

  it("strips a trailing space and a trailing newline too", async () => {
    const env = await withEnv({ IMPACT_ANDERTONS_FTP_HOST: "products.impact.com \n" })
    expect(env.impact.andertonsFtpHost).toBe("products.impact.com")
  })

  /**
   * Credentials get the same treatment, deliberately. A password whose first
   * character is a space is indistinguishable from a paste accident from
   * inside this process, and the accident is far likelier than the password.
   */
  it("trims credentials as well as hostnames", async () => {
    const env = await withEnv({
      IMPACT_ANDERTONS_FTP_USER: "  andertons  ",
      IMPACT_ANDERTONS_FTP_PASSWORD: "\ts3cret\n",
    })
    expect(env.impact.andertonsFtpUser).toBe("andertons")
    expect(env.impact.andertonsFtpPassword).toBe("s3cret")
  })

  /**
   * A variable someone "cleared" by leaving a space in it is unset, not set to
   * a space. Otherwise `hasAndertonsFeed` reports a configured feed with
   * nothing behind it, which is the one thing every gate in this file exists
   * to avoid.
   */
  it("treats a whitespace-only value as unset", async () => {
    const env = await withEnv({
      IMPACT_ANDERTONS_FTP_HOST: "   ",
      IMPACT_ANDERTONS_FTP_USER: " ",
      IMPACT_ANDERTONS_FTP_PASSWORD: " ",
    })
    expect(env.impact.andertonsFtpHost).toBe("products.impact.com")
    expect(env.impact.hasAndertonsFeed).toBe(false)
  })

  it("leaves interior spaces alone, since only the edges are ever accidental", async () => {
    const env = await withEnv({ INSTAGRAM_HANDLE: " stompbox world " })
    expect(env.social.instagramHandle).toBe("stompbox world")
  })
})

describe("the Anderton's feed gate", () => {
  it("needs both halves of the credential pair", async () => {
    const onlyUser = await withEnv({
      IMPACT_ANDERTONS_FTP_USER: "andertons",
      IMPACT_ANDERTONS_FTP_PASSWORD: undefined,
    })
    expect(onlyUser.impact.hasAndertonsFeed).toBe(false)

    const both = await withEnv({
      IMPACT_ANDERTONS_FTP_USER: "andertons",
      IMPACT_ANDERTONS_FTP_PASSWORD: "s3cret",
    })
    expect(both.impact.hasAndertonsFeed).toBe(true)
  })

  /**
   * Host and path have real defaults, so they must never be part of the gate:
   * a deploy with neither set is still perfectly able to authenticate once the
   * credentials arrive.
   */
  it("defaults the host and path so neither has to be set at all", async () => {
    const env = await withEnv({
      IMPACT_ANDERTONS_FTP_HOST: undefined,
      IMPACT_ANDERTONS_FTP_PATH: undefined,
    })
    expect(env.impact.andertonsFtpHost).toBe("products.impact.com")
    expect(env.impact.andertonsFtpPath).toBe("/Andertons-Music-Company/")
  })
})

describe("the sandbox default that must never move", () => {
  /**
   * Section 11 of CLAUDE.md, made mechanical. A deploy that quietly points at
   * production eBay with a sandbox-shaped token burns the daily call budget
   * for nothing, and the default is the only thing standing in the way.
   */
  it("keeps eBay on sandbox unless an environment says otherwise", async () => {
    const env = await withEnv({ EBAY_FEED_BASE_URL: undefined })
    expect(env.ebay.baseUrl).toBe("https://api.sandbox.ebay.com/buy/feed/v1_beta")
  })
})
