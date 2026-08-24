import { describe, expect, it } from "vitest"
import { sourceStatuses, blockedSources } from "@/lib/ingestion/source-status"

/**
 * A SOURCE THAT IS NOT PRODUCING ROWS MUST SAY WHICH VALUE IS MISSING.
 *
 * The failure this guards is the one the project keeps paying for: a source is
 * off, something reports that it is off, and nothing says what would turn it
 * on. Anderton's ran a failing cron for two weeks on exactly that, with the
 * answer sitting unread in a response body.
 */

describe("every blocked source names its variable and where to find it", () => {
  it("finds sources at all", () => {
    expect(sourceStatuses().length).toBeGreaterThan(15)
  })

  it("never reports blocked without saying what to paste", () => {
    for (const status of blockedSources()) {
      expect(status.blockedBy, `${status.source} is blocked but names no variable`).toBeTruthy()
      expect(
        status.whereFrom?.length ?? 0,
        `${status.source} names a variable but not where its value comes from`,
      ).toBeGreaterThan(40)
    }
  })

  it("gives every source a transport, so a reader knows what kind of thing broke", () => {
    for (const status of sourceStatuses()) {
      expect(status.transport, status.source).toBeTruthy()
    }
  })

  it("keeps Anderton's two transports as two entries", () => {
    /*
     * Collapsing them is how its real state got lost for a fortnight. The API
     * path is dead from the advertiser's side and no retry helps; the FTP path
     * is a separate question about credentials we do hold. One row saying
     * "andertons: failed" cannot express that.
     */
    const sources = sourceStatuses().map((s) => s.source)
    expect(sources).toContain("andertons")
    expect(sources).toContain("andertons-api")

    const api = sourceStatuses().find((s) => s.source === "andertons-api")
    expect(api?.state).toBe("merchant-side")
    expect(api?.whereFrom).toMatch(/Nothing here can fix it/)
  })

  it("never tells anybody to guess an Impact catalogue id", () => {
    /*
     * A wrong id does not 404, it returns another advertiser's products under
     * this merchant's name, which poisons the store page and every median
     * built from it. The guidance has to say so every time it is shown.
     */
    for (const status of blockedSources()) {
      if (!status.blockedBy?.includes("CATALOG_ID")) continue
      expect(status.whereFrom).toMatch(/NEVER guess/)
      expect(status.whereFrom, "must warn that a programme id is a different scheme").toMatch(
        /programme/i,
      )
    }
  })

  it("does not offer scraping as an alternative anywhere in the guidance", () => {
    /*
     * Every one of these merchants has a real feed we are entitled to read.
     * A hint here that a storefront could be read instead would be the one
     * place a tired person would find it at exactly the wrong moment.
     */
    const prose = sourceStatuses()
      .map((s) => `${s.whereFrom ?? ""} ${s.blockedBy ?? ""}`)
      .join(" ")
      .toLowerCase()
    expect(prose).not.toMatch(/\bscrap(e|ing)\b(?! index| sweetwater)/)
  })
})
