import { describe, expect, it } from "vitest"
import {
  agentsMdSanctionsCatalogue,
  probeStorefront,
  robotsDisallows,
} from "@/lib/ingestion/storefront-probe"

/**
 * THE PROBE MUST NOT TURN A 200 INTO A PERMISSION.
 *
 * That is the whole risk of automating this check. Everything section 2
 * rejects would answer a request: Guitar Center's Algolia index answers,
 * Sweetwater's search answers, the Reverb API answers with real credentials.
 * A tool that reports "reachable" and lets a person read it as "allowed" is
 * worse than no tool, because it launders a guess through something that
 * looks like a verification step.
 *
 * So the tests below are mostly about the probe REFUSING to say yes.
 */

/*
 * Representative of the Shopify agents.md shape CLAUDE.md describes, not a
 * verbatim copy of any one store's file: the sandbox this was written in
 * cannot reach a storefront to take one. What is being tested is the matcher's
 * reasoning, and the real files are read by the deployed route.
 */
const SHOPIFY_AGENTS_MD = `# AI Agent Guidelines

## Read-Only Browsing (No Authentication Required)

Agents may read catalogue data without authenticating:

- \`/products.json\` - all products
- \`/collections/{handle}/products.json\` - products in a collection
- \`/sitemap.xml\`

## Checkout

Agents must not complete a purchase on a customer's behalf.
`

describe("reading an agents.md", () => {
  it("accepts a file that both names the endpoint and sanctions reading it", () => {
    const verdict = agentsMdSanctionsCatalogue(SHOPIFY_AGENTS_MD)
    expect(verdict.sanctioned).toBe(true)
    expect(verdict.namedPaths).toContain("/products.json")
  })

  it("refuses a file that names the endpoint but sanctions nothing", () => {
    /*
     * The dangerous near miss. A page can mention /products.json while saying
     * nothing about whether an agent may read it, or while forbidding it. Only
     * the co-occurrence of the naming and the permission means anything.
     */
    const verdict = agentsMdSanctionsCatalogue(
      "# Agents\n\nDo not fetch /products.json. Contact us for a data licence.\n",
    )
    expect(verdict.sanctioned).toBe(false)
    expect(verdict.reason).toMatch(/no read-only/)
  })

  it("refuses a read-only section that is about something else", () => {
    const verdict = agentsMdSanctionsCatalogue(
      "# Agents\n\n## Read-Only Browsing (No Authentication Required)\n\nYou may read /blogs and /pages.\n",
    )
    expect(verdict.sanctioned).toBe(false)
    expect(verdict.reason).toMatch(/does not name a catalogue endpoint/i)
  })

  it("refuses a themed 404 page pretending to be an agents.md", () => {
    /*
     * A store with no agents.md usually answers 200 with its own 404 template,
     * so "the request succeeded" says nothing at all. This is the single most
     * likely way a false positive would arrive.
     */
    const verdict = agentsMdSanctionsCatalogue(
      "<html><body><h1>Page not found</h1><a href='/products.json'>shop</a>" +
        "<p>no authentication required</p></body></html>",
    )
    expect(verdict.sanctioned).toBe(false)
    expect(verdict.reason).toMatch(/HTML page/)
  })

  it("recognises the WooCommerce Store API when a store does publish one", () => {
    const verdict = agentsMdSanctionsCatalogue(
      "# Agents\n\n## Read-only browsing\n\nNo authentication required for /wp-json/wc/store/v1/products.\n",
    )
    expect(verdict.sanctioned).toBe(true)
  })
})

describe("reading a robots.txt for a refusal", () => {
  it("finds a Disallow that covers the catalogue path", () => {
    const robots = "User-agent: *\nDisallow: /products.json\nDisallow: /admin\n"
    expect(robotsDisallows(robots, "/products.json")).toBe("/products.json")
  })

  it("finds a blanket Disallow", () => {
    expect(robotsDisallows("User-agent: *\nDisallow: /\n", "/products.json")).toBe("/")
  })

  it("ignores a rule written for a different crawler", () => {
    /*
     * A store blocking GPTBot has said something about GPTBot, not about us.
     * Reading somebody else's rule as ours would hide inventory we are welcome
     * to, which is the mirror of the mistake this file mostly guards against
     * and still a mistake.
     */
    const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart\n"
    expect(robotsDisallows(robots, "/products.json")).toBeNull()
  })

  it("applies a rule written for us by name", () => {
    const robots = "User-agent: GearAvail\nDisallow: /products.json\n"
    expect(robotsDisallows(robots, "/products.json")).toBe("/products.json")
  })

  it("treats an empty Disallow as allowing everything", () => {
    expect(robotsDisallows("User-agent: *\nDisallow:\n", "/products.json")).toBeNull()
  })

  it("ignores a commented-out rule", () => {
    expect(robotsDisallows("User-agent: *\n# Disallow: /products.json\n", "/products.json")).toBeNull()
  })
})

/** A fetch stub that answers per path, and 404s anything it was not given. */
function stubStore(pages: Record<string, { status: number; body: string }>): typeof fetch {
  return (async (input: string | URL) => {
    const path = new URL(String(input)).pathname
    const page = pages[path]
    if (!page) return new Response("Not found", { status: 404 })
    return new Response(page.body, { status: page.status })
  }) as unknown as typeof fetch
}

describe("the verdict a whole probe reaches", () => {
  const CATALOGUE = { status: 200, body: JSON.stringify({ products: [{ title: "A pedal" }] }) }

  it("says sanctioned when the file, robots and endpoint all agree", async () => {
    const result = await probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({
        "/agents.md": { status: 200, body: SHOPIFY_AGENTS_MD },
        "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /admin\n" },
        "/products.json": CATALOGUE,
      }),
    })

    expect(result.verdict).toBe("sanctioned")
    expect(result.platform).toBe("shopify")
    expect(result.catalogue.productCount).toBe(1)
    expect(result.summary).toMatch(/Affiliate enrollment is a separate question/)
  })

  it("lets a robots.txt refusal beat a sanctioning agents.md", () => {
    /*
     * DECISIVENESS IN THE SAFE DIRECTION. If a store contradicts itself, the
     * probe reports the refusal, because the cost of being wrong is not
     * symmetrical: missing a store we were welcome to costs some inventory,
     * and reading one that said no is the thing section 1 says gets this
     * project a letter rather than a bug.
     */
    return probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({
        "/agents.md": { status: 200, body: SHOPIFY_AGENTS_MD },
        "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /products.json\n" },
        "/products.json": CATALOGUE,
      }),
    }).then((result) => {
      expect(result.verdict).toBe("refused")
      expect(result.summary).toMatch(/Do not add it/)
    })
  })

  it("will not call a working endpoint with no agents.md sanctioned", async () => {
    /*
     * The Guitar Center shape, and the single most important case here. The
     * catalogue answers perfectly and there is no published permission, so the
     * verdict is unclear and the summary says an endpoint answering is not a
     * permission.
     */
    const result = await probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({
        "/robots.txt": { status: 200, body: "User-agent: *\n" },
        "/products.json": CATALOGUE,
      }),
    })

    expect(result.verdict).toBe("unclear")
    expect(result.summary).toMatch(/not a permission/)
    expect(result.findings.join(" ")).toMatch(/No published agent policy/)
  })

  it("says silence in robots.txt is not consent", async () => {
    const result = await probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({
        "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /cart\n" },
        "/products.json": CATALOGUE,
      }),
    })
    expect(result.findings.join(" ")).toMatch(/Silence is not permission/)
  })

  it("reports a sanctioning file whose endpoint does not answer as unclear, not sanctioned", async () => {
    const result = await probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({ "/agents.md": { status: 200, body: SHOPIFY_AGENTS_MD } }),
    })
    expect(result.verdict).toBe("unclear")
  })

  it("probes the WooCommerce path when told the platform", async () => {
    const result = await probeStorefront("https://example-shop.com", {
      platform: "woocommerce",
      fetchImpl: stubStore({
        "/wp-json/wc/store/v1/products": { status: 200, body: JSON.stringify([{ name: "A pedal" }]) },
      }),
    })
    expect(result.catalogue.productCount).toBe(1)
    expect(result.catalogue.url).toContain("/wp-json/wc/store/v1/products")
  })

  it("takes an origin off a pasted product URL rather than probing that path", async () => {
    const result = await probeStorefront("example-shop.com/products/some-pedal?variant=1", {
      fetchImpl: stubStore({ "/products.json": CATALOGUE }),
    })
    expect(result.baseUrl).toBe("https://example-shop.com")
    expect(result.catalogue.url).toBe("https://example-shop.com/products.json?limit=5")
  })

  it("never reports a verdict of approved, in any wording", async () => {
    /* The vocabulary is deliberate: this tool reports, a person decides. */
    const result = await probeStorefront("https://example-shop.com", {
      fetchImpl: stubStore({
        "/agents.md": { status: 200, body: SHOPIFY_AGENTS_MD },
        "/products.json": CATALOGUE,
      }),
    })
    expect(["sanctioned", "refused", "unclear"]).toContain(result.verdict)
    expect(result.summary.toLowerCase()).not.toContain("approved")
  })
})
