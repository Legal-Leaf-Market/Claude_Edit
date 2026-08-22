import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/lib/db"
import { ingestRuns } from "@/lib/db/schema"
import { resumePageFor } from "@/lib/ingestion/impact-catalogue"
import { ANDERTONS } from "@/lib/ingestion/impact-merchants"

/**
 * THE CURSOR THAT MAKES A CRON ENTRY SUFFICIENT.
 *
 * The Impact API job reads five pages of a thousand per call and records where
 * it stopped, and until now nothing read that back: `startPage` defaulted to 1
 * on every run. Small catalogues hid it, because five pages covers them.
 * Anderton's would not have: 27,052 products means an unparameterised cron
 * ingests the same first 5,000 forever and the other 22,000 never exist on the
 * site. Nothing throws and nothing is logged, so the only symptom is a store
 * page quietly holding a fifth of its catalogue.
 *
 * These tests are the reason a plain `vercel.json` entry is now enough for a
 * merchant of any size.
 */

const JOB = `${ANDERTONS.key}-catalogue-api`

async function recordRun(detail: unknown, status = "ok") {
  await db.insert(ingestRuns).values({
    source: ANDERTONS.source,
    jobKind: JOB,
    status,
    detail: detail as never,
  })
}

beforeEach(async () => {
  await db.delete(ingestRuns)
})

describe("resumePageFor", () => {
  it("starts at the top when the merchant has never run", async () => {
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(1)
  })

  it("CARRIES ON from where the last run stopped", async () => {
    // The whole point. Without this a cron re-reads page one forever.
    await recordRun({ nextPage: 6, done: false })
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(6)
  })

  it("wraps back to the top once the catalogue is finished", async () => {
    // A finished walk should refresh from the start rather than stall at the
    // end, because prices and stock move under us between passes.
    await recordRun({ nextPage: null, done: true })
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(1)
  })

  it("reads the most recent successful run, not the first one", async () => {
    await recordRun({ nextPage: 2, done: false })
    await recordRun({ nextPage: 11, done: false })
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(11)
  })

  it("ignores a failed run, which never established a cursor", async () => {
    await recordRun({ nextPage: 6, done: false })
    await recordRun({ nextPage: 99, done: false }, "failed")
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(6)
  })

  it("does not borrow another merchant's position", async () => {
    // Every merchant walks its own catalogue. Sharing a cursor would start one
    // of them in the middle of a catalogue it has never read.
    await recordRun({ nextPage: 6, done: false })
    expect(await resumePageFor(ANDERTONS, "fender-catalogue-api")).toBe(1)
  })

  it("survives junk in the detail column rather than failing the ingest", async () => {
    // Bookkeeping must never be the thing that stops a pull.
    await recordRun({ unexpected: "shape" })
    expect(await resumePageFor(ANDERTONS, JOB)).toBe(1)
  })
})
