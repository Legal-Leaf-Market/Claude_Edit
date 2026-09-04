import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { globSync } from "node:fs"
import path from "node:path"
import {
  absolute,
  aggregateOffer,
  articleSchema,
  breadcrumbs,
  itemListSchema,
  productSchema,
} from "@/lib/seo/structured-data"

/**
 * STRUCTURED DATA IS A CLAIM MADE TO A MACHINE, so it is never obviously wrong
 * on the page. It is wrong in Search Console, weeks later, if anybody looks.
 * These pin the claims this site is allowed to make.
 */

describe("no fabricated reputation, anywhere", () => {
  /* The single most common piece of SEO advice for a comparison site is to add
     star markup, because it wins a rich result. This site has no reviews, so
     doing it would be fabricating evidence, and Google treats it as a manual
     action against the whole domain rather than as one bad page. Asserted
     across the module rather than trusted. */
  it("never emits aggregateRating or review", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib", "seo", "structured-data.ts"),
      "utf8",
    )
    expect(source).not.toMatch(/aggregateRating/)
    expect(source).not.toMatch(/"review"|ratingValue|reviewCount/)
  })

  it("emits none of it from a fully populated product either", () => {
    const json = JSON.stringify(
      productSchema({
        name: "Used Boss DS-1",
        brand: "Boss",
        category: "Effects Pedals",
        path: "/gear/boss-ds-1",
        offers: [{ priceCents: 5000, currency: "USD", condition: "Used" }],
      }),
    )
    expect(json).not.toMatch(/[Rr]ating|[Rr]eview/)
  })
})

describe("an offer is only marked up when there is one", () => {
  it("declines a page with no listings", () => {
    expect(aggregateOffer([], "/gear/x")).toBeNull()
    expect(
      productSchema({ name: "X", brand: "B", path: "/gear/x", offers: [] }),
    ).toBeNull()
  })

  it("declines rows with no usable price rather than pricing them at zero", () => {
    expect(
      aggregateOffer([{ priceCents: 0, currency: "USD", condition: null }], "/gear/x"),
    ).toBeNull()
  })
})

describe("the price range describes one currency", () => {
  /* The catalogue is genuinely multi-currency: Anderton's prices in GBP,
     Gear4music runs five regional storefronts. The previous hand-rolled
     version hardcoded "USD" over whatever was in the rows, so one British
     listing under an American one made the low price a number in the wrong
     money. */
  it("takes the majority currency and counts only those offers", () => {
    const offer = aggregateOffer(
      [
        { priceCents: 4000, currency: "GBP", condition: "Used" },
        { priceCents: 9000, currency: "USD", condition: "Used" },
        { priceCents: 11000, currency: "USD", condition: "Used" },
      ],
      "/gear/x",
    )!
    expect(offer.priceCurrency).toBe("USD")
    expect(offer.offerCount).toBe(2)
    expect(offer.lowPrice).toBe("90.00")
    expect(offer.highPrice).toBe("110.00")
  })

  it("does not assume the caller sorted the rows", () => {
    const offer = aggregateOffer(
      [
        { priceCents: 30000, currency: "USD", condition: null },
        { priceCents: 10000, currency: "USD", condition: null },
      ],
      "/gear/x",
    )!
    expect(offer.lowPrice).toBe("100.00")
    expect(offer.highPrice).toBe("300.00")
  })
})

describe("condition is claimed only when it is true of every offer", () => {
  /* New and used are two markets (section 8). A page holding both cannot claim
     either, so it claims neither rather than picking the one that reads
     better. */
  it("states used when every offer is used", () => {
    const offer = aggregateOffer(
      [
        { priceCents: 100, currency: "USD", condition: "Used" },
        { priceCents: 200, currency: "USD", condition: "Good" },
      ],
      "/gear/x",
    )!
    expect(offer.itemCondition).toBe("https://schema.org/UsedCondition")
  })

  it("states new when every offer is new", () => {
    const offer = aggregateOffer(
      [{ priceCents: 100, currency: "USD", condition: "New" }],
      "/gear/x",
    )!
    expect(offer.itemCondition).toBe("https://schema.org/NewCondition")
  })

  it("says nothing at all when the page holds both", () => {
    const offer = aggregateOffer(
      [
        { priceCents: 100, currency: "USD", condition: "New" },
        { priceCents: 200, currency: "USD", condition: "Used" },
      ],
      "/gear/x",
    )!
    expect(offer.itemCondition).toBeUndefined()
  })
})

describe("identifiers are passed through only when held", () => {
  it("omits gtin and mpn rather than sending empty ones", () => {
    /* An empty gtin claims this product has no barcode. Absent claims we do
       not know it, which is the true statement. */
    const schema = productSchema({
      name: "X",
      brand: "B",
      path: "/gear/x",
      gtin: null,
      mpn: "",
      offers: [{ priceCents: 100, currency: "USD", condition: null }],
    })!
    expect(schema.gtin).toBeUndefined()
    expect(schema.mpn).toBeUndefined()
  })
})

describe("breadcrumbs", () => {
  it("numbers from one and leaves the current page unlinked", () => {
    const trail = breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Boss", path: "/search?brand=Boss" },
      { name: "DS-1" },
    ]) as { itemListElement: { position: number; item?: string }[] }

    expect(trail.itemListElement.map((c) => c.position)).toEqual([1, 2, 3])
    expect(trail.itemListElement[2].item).toBeUndefined()
    expect(trail.itemListElement[0].item).toMatch(/^https?:\/\//)
  })
})

describe("URLs come from the deployment, never from a typed hostname", () => {
  /* The bug this replaced: one page built its URLs from SITE_URL and another
     had https://gearavail.com/ typed into it, so a preview deploy emitted
     markup pointing at production. */
  it("resolves paths against the configured origin", () => {
    expect(absolute("/gear/x")).toBe(new URL("/gear/x", process.env.SITE_URL ?? "http://localhost:3000").toString())
  })

  it("has no hardcoded production hostname left in any page's markup", () => {
    const pages = globSync("app/**/page.tsx", { cwd: process.cwd() })
    for (const page of pages) {
      const source = readFileSync(path.join(process.cwd(), page), "utf8")
      const ld = source.includes("application/ld+json") || source.includes("JsonLdScript")
      if (!ld) continue
      expect(source, `${page} hardcodes a hostname in its structured data`).not.toMatch(
        /https:\/\/gearavail\.com/,
      )
    }
  })
})

describe("list and article pages", () => {
  it("declines an empty list rather than marking up nothing", () => {
    expect(itemListSchema({ name: "Used Amps", path: "/used/amps", items: [] })).toBeNull()
  })

  it("makes the artist the subject of a rig article, never its author", () => {
    const schema = articleSchema({
      headline: "Kevin Shields's pedalboard",
      path: "/rigs/kevin-shields",
      about: "Kevin Shields",
    }) as Record<string, unknown>
    expect(schema.author).toBeUndefined()
    expect(schema.about).toEqual({ "@type": "Thing", name: "Kevin Shields" })
    expect(schema["@type"]).toBe("Article")
  })
})
