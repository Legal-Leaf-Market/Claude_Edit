import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchImpactApiPage, redactImpactUrl } from "@/lib/ingestion/impact-catalogue"

/**
 * WHAT A FAILED IMPACT CALL IS ALLOWED TO TELL YOU, AND WHAT IT IS NOT.
 *
 * This file exists because of a real outage that ran for weeks. The Anderton's
 * catalogue job failed on every hourly cron with exactly this line:
 *
 *     [impact:andertons] failed: Impact API returned 400 Bad Request.
 *
 * and that was the whole of it. The 400 branch of the error builder was an
 * empty string, so the one message anybody ever saw named a status and stopped.
 * Nobody could act on it, so nobody did, and the largest catalogue on the site
 * stayed at zero rows while the cron burned a run an hour.
 *
 * The rule the tests below hold is: report the body, because on a JSON API the
 * body is the only place that says WHICH parameter was rejected. And never
 * report the account sid, because it is half of the HTTP Basic pair and it
 * sits in the path of every one of these URLs.
 */

const config = {
  accountSid: "IRSecretAccount123",
  authToken: "sh-hh-token",
  catalogId: "30480",
}

/*
 * A FRESH Response PER CALL, which is not fussiness. A body can only be read
 * once, so handing the same Response back twice makes the retry look as though
 * the API answered with nothing: the first read drains it. Real fetches return
 * a new one every time, and a stub that does not will pass code that is broken
 * and fail code that is fine.
 */
function reply(status: number, body: string, statusText = "Bad Request") {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(body, { status, statusText }))
}

afterEach(() => vi.restoreAllMocks())

describe("what a failing Impact call reports", () => {
  it("quotes the body on a 400, because that is where the reason is", async () => {
    reply(400, JSON.stringify({ Message: "PageSize exceeds the maximum of 100" }))

    await expect(fetchImpactApiPage(config, 1)).rejects.toThrow(
      /PageSize exceeds the maximum of 100/,
    )
  })

  it("says a 400 means the credentials were fine", async () => {
    /*
     * The deduction that would have saved the weeks. Impact checks the Basic
     * pair before it looks at anything else, so a 400 rather than a 401 rules
     * out the account entirely and points at the request. Somebody reading the
     * log should not have to know that.
     */
    reply(400, "{}")
    await expect(fetchImpactApiPage(config, 1)).rejects.toThrow(/parameter rather than an access/)
  })

  it("never puts the account sid in the message", async () => {
    reply(400, "{}")

    const error = await fetchImpactApiPage(config, 1).catch((e: Error) => e)
    expect(String(error)).not.toContain(config.accountSid)
    /* The rest of the URL is exactly what a person diagnosing this needs. */
    expect(String(error)).toContain("/Catalogs/30480/Items")
  })

  it("drops an HTML body rather than pasting a page into a log", async () => {
    /*
     * The original comment was right about this case and wrong to generalise
     * from it: some Impact deployments answer an auth failure with a whole
     * error page, and a log line is not the place for markup.
     */
    reply(401, "<!doctype html><html><body>Sign in to Impact</body></html>", "Unauthorized")

    const error = await fetchImpactApiPage(config, 1).catch((e: Error) => e)
    expect(String(error)).not.toContain("doctype")
    expect(String(error)).toContain("AccountSid or AuthToken was rejected")
  })

  it("caps a long body rather than logging all of it", async () => {
    reply(400, JSON.stringify({ Message: "x".repeat(5000) }))

    const error = await fetchImpactApiPage(config, 1).catch((e: Error) => e)
    expect(String(error).length).toBeLessThan(900)
    expect(String(error)).toContain("...")
  })

  it("keeps the useful sentences on 403 and 404", async () => {
    reply(404, "{}", "Not Found")
    await expect(fetchImpactApiPage(config, 1)).rejects.toThrow(/No catalogue 30480/)

    vi.restoreAllMocks()
    reply(403, "{}", "Forbidden")
    await expect(fetchImpactApiPage(config, 1)).rejects.toThrow(/not permitted to read/)
  })
})

describe("finding the page size the API will actually serve", () => {
  it("retries once at a smaller page when a big one is rejected", async () => {
    const calls: string[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("PageSize=1000")) {
        return new Response(JSON.stringify({ Message: "PageSize too large" }), {
          status: 400,
          statusText: "Bad Request",
        })
      }
      return new Response(JSON.stringify({ Items: [{ Id: "1" }], "@page": 1 }), { status: 200 })
    })

    const page = await fetchImpactApiPage(config, 1, 1000)

    expect(page.records).toHaveLength(1)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain("PageSize=1000")
    expect(calls[1]).toContain("PageSize=100")
  })

  it("does not retry a 401, because a smaller page cannot fix an account", async () => {
    const fetchSpy = reply(401, "{}", "Unauthorized")
    await expect(fetchImpactApiPage(config, 1, 1000)).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not retry a 404 either", async () => {
    const fetchSpy = reply(404, "{}", "Not Found")
    await expect(fetchImpactApiPage(config, 1, 1000)).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("gives up after the one retry rather than looping", async () => {
    const fetchSpy = reply(400, JSON.stringify({ Message: "still no" }))
    await expect(fetchImpactApiPage(config, 1, 1000)).rejects.toThrow(/still no/)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("does not retry when the page was already small", async () => {
    const fetchSpy = reply(400, "{}")
    await expect(fetchImpactApiPage(config, 1, 100)).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe("redacting the account out of a URL", () => {
  it("removes the sid and leaves everything else legible", () => {
    const url =
      "https://api.impact.com/Mediapartners/IRSecretAccount123/Catalogs/30480/Items?Page=1&PageSize=1000"
    const safe = redactImpactUrl(url)

    expect(safe).not.toContain("IRSecretAccount123")
    expect(safe).toContain("/Mediapartners/***/Catalogs/30480/Items")
    expect(safe).toContain("PageSize=1000")
  })

  it("leaves a URL with no sid in it alone", () => {
    const url = "https://api.impact.com/Catalogs"
    expect(redactImpactUrl(url)).toBe(url)
  })
})
