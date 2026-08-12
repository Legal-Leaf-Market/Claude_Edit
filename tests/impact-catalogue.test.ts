import { describe, expect, it } from "vitest"
import {
  bindColumns,
  ImpactSchemaError,
  normalizeImpactRecords,
  parseImpactCatalogue,
} from "@/lib/ingestion/impact-catalogue"
import {
  ANDERTONS,
  canPullImpactMerchant,
  impactMerchant,
  impactSkipReason,
  IMPACT_MERCHANTS,
  type ImpactMerchant,
} from "@/lib/ingestion/impact-merchants"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { SOURCES } from "@/lib/db/schema"
import { STORE_BY_SOURCE } from "@/lib/stores"
import { sourceLabel } from "@/lib/utils"

/**
 * The Impact catalogue reader, once it stopped being about one merchant.
 *
 * tests/andertons-impact.test.ts already pins the parser itself against the
 * real header row, and it still runs through this same code. What is new and
 * therefore worth its own tests is everything the eight-merchant registry made
 * possible to get wrong:
 *
 *   1. a merchant declared in one place and missing from another, which is how
 *      a source ends up with listings and no store page, or with listings whose
 *      /go redirect 502s because its domain never reached the allowlist;
 *   2. rows landing under the wrong merchant, which would file one shop's stock
 *      under another's name;
 *   3. a merchant with no catalogue id quietly reporting success.
 */

const CANONICAL_HEADER =
  "Catalog Item Id,Name,Url,Current Price,Currency,Manufacturer,Gtin,Stock Availability"

function feed(...rows: string[]): string {
  return [CANONICAL_HEADER, ...rows].join("\n")
}

describe("the merchant registry", () => {
  it("has a unique key and a unique source per merchant", () => {
    expect(new Set(IMPACT_MERCHANTS.map((m) => m.key)).size).toBe(IMPACT_MERCHANTS.length)
    expect(new Set(IMPACT_MERCHANTS.map((m) => m.source)).size).toBe(IMPACT_MERCHANTS.length)
  })

  /**
   * A source the union does not know about is not a compile error anywhere
   * useful: `marketplace_listings.source` is a varchar, so rows would write
   * fine and then be invisible to every zod-validated route (alerts, cart
   * checkout) that enumerates SOURCES.
   */
  it("declares every merchant's source in the SOURCES union", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      expect(SOURCES).toContain(merchant.source)
    }
  })

  /** varchar(20). A longer key writes fine locally and errors on the real column. */
  it("keeps every source inside the database column", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      expect(merchant.source.length).toBeLessThanOrEqual(20)
    }
  })

  it("gives every merchant a display name and a store page", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      // Not the fallthrough, which returns the raw source string.
      expect(sourceLabel(merchant.source)).not.toBe(merchant.source)
      expect(STORE_BY_SOURCE.get(merchant.source)).toBeTruthy()
    }
  })

  /**
   * THE ONE THAT ACTUALLY BREAKS A SHOPPER. An Impact catalogue carries the
   * merchant's own untracked product page beside the tracked link, and that
   * untracked URL becomes `raw_url`. If its host is not on the allowlist, /go
   * refuses the redirect and every listing from that merchant dead-ends at a
   * 502 while looking perfectly fine in search.
   */
  it("has every merchant's storefront on the /go allowlist", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      for (const host of merchant.hosts) {
        expect(isAllowedDestination(`https://www.${host}/some-product`)).toBe(true)
      }
    }
  })

  it("names the env var each catalogue id is read from", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      expect(merchant.envVar).toMatch(/^IMPACT_[A-Z0-9]+_CATALOG_ID$/)
    }
  })

  it("looks a merchant up by key, case-insensitively, and refuses an unknown one", () => {
    expect(impactMerchant("fender")?.label).toBe("Fender")
    expect(impactMerchant("FENDER")?.label).toBe("Fender")
    expect(impactMerchant("guitarcenter")).toBeNull()
  })
})

describe("what a merchant may not know about itself", () => {
  /**
   * The sharpest rule in CLAUDE.md, at the merchant level this time.
   *
   * The Impact marketplace export puts these merchants between 2% and 15%, and
   * an ingester that knew would be one sort() from preferring the ones that
   * pay. The registry is the natural place for that number to creep in, so its
   * absence is asserted rather than assumed.
   */
  it("records no commission rate anywhere in the registry", () => {
    const serialised = JSON.stringify(IMPACT_MERCHANTS)
    expect(serialised).not.toMatch(/commission|payout|\brate\b/i)
    for (const merchant of IMPACT_MERCHANTS) {
      expect(Object.keys(merchant)).not.toContain("commission")
    }
  })
})

describe("normalising rows for a merchant that is not Anderton's", () => {
  const fender = impactMerchant("fender") as ImpactMerchant

  it("stamps the merchant's own source, currency and country", () => {
    const { rows } = parseImpactCatalogue(
      feed('"F-1","Player Stratocaster","https://www.fender.com/strat","849.99","","Fender","",""'),
      fender,
    )
    expect(rows[0].source).toBe("fender")
    expect(rows[0].currency).toBe("USD")
    expect(rows[0].locationCountry).toBe("US")
  })

  /**
   * The fallback is a fallback. A catalogue that states its own currency wins,
   * because the registry value is a guess about a merchant's home market and
   * these merchants sell across several.
   */
  it("lets the catalogue's own currency column beat the merchant default", () => {
    const { rows } = parseImpactCatalogue(
      feed('"F-2","Player Telecaster","https://www.fender.com/tele","749.00","EUR","Fender","",""'),
      fender,
    )
    expect(rows[0].currency).toBe("EUR")
  })

  /**
   * Section 8: new and used are two markets. Every Impact merchant here is a
   * retailer or a brand store, so a blank condition is new stock. Filing one as
   * used would lift the used median and manufacture deals that do not exist.
   */
  it("treats a blank condition as New, like every other retail feed", () => {
    const { rows } = parseImpactCatalogue(
      feed('"F-3","Jazz Bass","https://www.fender.com/jazz","1099.00","","Fender","",""'),
      fender,
    )
    expect(rows[0].condition).toBe("New")
  })

  it("keeps two merchants' rows apart rather than sharing a source", () => {
    const donner = impactMerchant("donner") as ImpactMerchant
    const one = normalizeImpactRecords(
      [{ CatalogItemId: "x", Name: "A pedal", Url: "https://www.fender.com/p", CurrentPrice: "10" }],
      fender,
    )
    const two = normalizeImpactRecords(
      [{ CatalogItemId: "x", Name: "A pedal", Url: "https://www.donnermusic.com/p", CurrentPrice: "10" }],
      donner,
    )
    expect(one.rows[0].source).toBe("fender")
    expect(two.rows[0].source).toBe("donner")
    // Same external id, different source: the upsert key is the pair, so these
    // are two listings rather than one overwriting the other.
    expect(one.rows[0].externalId).toBe(two.rows[0].externalId)
  })

  /** The error has to name the merchant now that eight of them share a parser. */
  it("names the merchant when a mandatory column cannot be bound", () => {
    let message = ""
    try {
      normalizeImpactRecords([{ ProductRef: "x", Heading: "y" }], fender)
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain("Fender")
    expect(message).toContain("ProductRef")
    expect(message).toContain("FIELD_ALIASES")
  })

  it("still throws ImpactSchemaError on an empty response", () => {
    expect(() => normalizeImpactRecords([], fender)).toThrow(ImpactSchemaError)
  })
})

describe("configuration gating", () => {
  /**
   * Unset is a supported state, not a bug to route around: the same treatment
   * Sweetwater's feed URL has had since the beginning. What matters is that the
   * two reasons a merchant cannot be pulled stay distinguishable, because one
   * is fixed once for every merchant and the other is fixed per merchant.
   */
  it("explains a missing catalogue id as the thing to go and do", () => {
    const unset: ImpactMerchant = { ...ANDERTONS, catalogId: "" }
    expect(canPullImpactMerchant(unset)).toBe(false)

    const reason = impactSkipReason(unset) ?? ""
    // Either message is legitimate depending on whether credentials are set in
    // this environment; both have to name the merchant and neither may be blank.
    expect(reason).toContain(ANDERTONS.label)
    expect(reason.length).toBeGreaterThan(40)
  })

  it("never claims a merchant is pullable without an account credential", () => {
    for (const merchant of IMPACT_MERCHANTS) {
      if (!process.env.IMPACT_ACCOUNT_SID || !process.env.IMPACT_AUTH_TOKEN) {
        expect(canPullImpactMerchant(merchant)).toBe(false)
        expect(impactSkipReason(merchant)).toBeTruthy()
      }
    }
  })
})

describe("bindColumns labelling", () => {
  it("uses the label it is given in the failure, and works without one", () => {
    expect(() => bindColumns(["Sku", "Name", "Url"])).not.toThrow()
    try {
      bindColumns(["Nope"], "The Musician's Friend Impact catalogue")
    } catch (error) {
      expect((error as Error).message).toContain("Musician's Friend")
    }
  })
})
