import { sql } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"
import { closeDb, db } from "@/lib/db"
import { conditionClass, IS_NEW_CONDITION_REGEX } from "@/lib/deals/pricing"

/**
 * The condition classifier exists twice, in JavaScript and in Postgres, and
 * they must agree.
 *
 * Medians are computed in JS from a fetched sample; deal flags are written by a
 * single UPDATE in the database; the search projections pick which median to
 * show with a third copy of the same predicate. If those drift, a listing gets
 * flagged against a median built from a population it was not part of, and
 * nothing anywhere throws. It just quietly starts inventing bargains.
 *
 * So the fixtures below are real condition strings the feeds actually emit, and
 * every one is run through BOTH implementations.
 */

/** Condition strings seen across eBay, Reverb, the CJ/Awin feeds and Shopify. */
const FIXTURES: { condition: string | null; expected: "new" | "used" }[] = [
  // Plainly new. The CJ and Awin retail feeds default an empty column to this.
  { condition: "New", expected: "new" },
  { condition: "new", expected: "new" },
  { condition: "NEW", expected: "new" },
  { condition: "Brand New", expected: "new" },
  { condition: "brand new", expected: "new" },
  { condition: "  New  ", expected: "new" },

  // Retail-channel goods that sell near new. See the note in pricing.ts on why
  // these are classed new rather than used: it is the direction that cannot
  // invent a deal.
  { condition: "New other (see details)", expected: "new" },
  { condition: "Open box", expected: "new" },
  { condition: "Open-box", expected: "new" },
  { condition: "openbox", expected: "new" },
  { condition: "Seller refurbished", expected: "new" },
  { condition: "Manufacturer refurbished", expected: "new" },
  { condition: "Refurbished", expected: "new" },
  // B-stock is a dealer selling factory stock with a scratch on it. Reverb's
  // own normaliser already called it "Refurbished" and therefore new, so
  // leaving the raw spelling on the used side had the two disagreeing.
  { condition: "B-Stock", expected: "new" },
  { condition: "b stock", expected: "new" },
  { condition: "BSTOCK", expected: "new" },

  // Genuinely second-hand.
  { condition: "Used", expected: "used" },
  { condition: "used", expected: "used" },
  { condition: "Very Good", expected: "used" },
  { condition: "Excellent", expected: "used" },
  { condition: "Mint", expected: "used" },
  { condition: "Good", expected: "used" },
  { condition: "Fair", expected: "used" },
  { condition: "Poor", expected: "used" },
  { condition: "For parts or not working", expected: "used" },
  { condition: "Non Functioning", expected: "used" },
  { condition: "Vintage", expected: "used" },

  // A blank field is a private seller who did not fill it in, not a retailer.
  { condition: null, expected: "used" },
  { condition: "", expected: "used" },

  // The word boundary earning its keep. None of these are new stock.
  { condition: "Newark reissue", expected: "used" },
  { condition: "Newly serviced", expected: "used" },
  { condition: "Renewed casing", expected: "used" },

  // Reverb's own condition vocabulary, in full. Every grade below "Brand New"
  // is a second-hand grade and has to reach the used median, or a peer
  // marketplace's prices would be measured against new retail.
  { condition: "Non Functioning", expected: "used" },
  { condition: "Fair", expected: "used" },
  { condition: "Good", expected: "used" },
  { condition: "Very Good", expected: "used" },
  { condition: "Excellent", expected: "used" },
  { condition: "Mint", expected: "used" },
  { condition: "Acceptable", expected: "used" },
  { condition: "Unspecified", expected: "used" },
]

describe("conditionClass", () => {
  it("classifies every known condition string as expected", () => {
    for (const { condition, expected } of FIXTURES) {
      expect(conditionClass(condition), `"${condition}"`).toBe(expected)
    }
  })

  it("treats undefined like a blank field", () => {
    expect(conditionClass(undefined)).toBe("used")
  })
})

describe("the Postgres predicate agrees with the JavaScript one", () => {
  it("classifies every fixture identically in the database", async () => {
    // One round trip: every fixture evaluated by Postgres' own regex engine,
    // against the exact pattern the pricing UPDATE and the search projections
    // use. Nulls are excluded here and asserted separately, since the SQL side
    // guards on IS NOT NULL before the regex ever runs.
    const cases = FIXTURES.filter((f) => f.condition != null)
    const values = sql.join(
      cases.map((f) => sql`(${f.condition})`),
      sql`, `,
    )

    const result = await db.execute<{ condition: string; is_new: boolean }>(sql`
      SELECT v.condition, (v.condition ~* ${IS_NEW_CONDITION_REGEX}) AS is_new
      FROM (VALUES ${values}) AS v(condition)
    `)

    expect(result.rows).toHaveLength(cases.length)

    for (const row of result.rows) {
      const sqlClass = row.is_new ? "new" : "used"
      expect(sqlClass, `Postgres disagrees on "${row.condition}"`).toBe(
        conditionClass(row.condition),
      )
    }
  })
})

afterAll(async () => {
  await closeDb()
})
