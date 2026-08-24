/**
 * ASK A CANDIDATE STORE WHETHER IT WANTS TO BE READ, AND RECORD THE ANSWER.
 *
 * WHY THIS IS A TOOL RATHER THAN A HABIT. The rule in section 2 has always
 * been "verify the endpoint is actually public and check the merchant's own
 * terms before wiring one in", and the honest position is that verifying it by
 * hand is why there are eleven stores rather than fifty. A check nobody can
 * run in under a minute is a check that eventually gets skipped, and the first
 * time it gets skipped is the day this project gets a letter rather than a bug.
 *
 * So the check is code. Point it at an origin and it fetches the three things
 * that decide the question, reports what it actually found, and refuses to
 * turn a 200 into a permission.
 *
 * WHAT IT READS, IN THE ORDER THAT MATTERS:
 *
 *   1. /agents.md. The strong evidence and the only kind that scales. Shopify
 *      ships one platform-wide with a "Read-Only Browsing (No Authentication
 *      Required)" section naming /products.json as the sanctioned no-auth path
 *      for agents reading catalogue data without transacting. A publisher
 *      saying what agents may do, in a file published for agents to read, is a
 *      materially stronger thing than a server not saying no.
 *
 *   2. /robots.txt. Used ONLY to find a refusal, never to manufacture a
 *      permission. robots.txt is silent about almost everything, and reading
 *      silence as consent is the exact reasoning that would have let Guitar
 *      Center through. A Disallow covering the catalogue path is decisive
 *      against; nothing there decides nothing.
 *
 *   3. One page of the catalogue endpoint itself, so "the endpoint exists and
 *      is public" is a fact rather than an assumption. This is the weakest of
 *      the three and is deliberately reported last: it says the door opens,
 *      not that you may walk through it.
 *
 * WHAT IT WILL NOT DO. It never returns "approved". The verdict is
 * `sanctioned`, `refused` or `unclear`, and even `sanctioned` is a report of
 * what a file said rather than a decision to ingest. A person reads it, and
 * pastes it into the merchant row's `permission.note` so the basis for that
 * row survives the person.
 *
 * WHERE IT RUNS. In the deployed app, behind ADMIN_PASSCODE. Not from a
 * development sandbox, whose egress policy blocks storefront domains outright,
 * which is its own argument for making this a production tool rather than
 * something an agent does once by hand and writes a comment about.
 */

export type ProbeVerdict = "sanctioned" | "refused" | "unclear"

export type ProbeDocument = {
  url: string
  status: number | null
  /** Null when the request never completed. */
  error?: string
  /** Trimmed; a robots.txt or agents.md is small, but a 404 page is not. */
  excerpt?: string
}

export type StorefrontProbeResult = {
  baseUrl: string
  platform: "shopify" | "woocommerce" | "unknown"
  verdict: ProbeVerdict
  /** One line a person can act on, and the whole point of the tool. */
  summary: string
  /** Every fact the verdict was built from, so it can be disagreed with. */
  findings: string[]
  agentsMd: ProbeDocument
  robotsTxt: ProbeDocument
  catalogue: ProbeDocument & { productCount?: number; sampleTitles?: string[] }
}

const UA = "GearAvail/1.0 (+aggregator; storefront permission probe)"
const TIMEOUT_MS = 15_000

function normalizeOrigin(input: string): string {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`
  const url = new URL(withScheme)
  /* Only the origin matters; a pasted product URL should still work. */
  return `${url.protocol}//${url.host}`
}

async function fetchText(
  url: string,
  fetchImpl: typeof fetch,
  accept: string,
): Promise<ProbeDocument> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: accept, "User-Agent": UA },
      signal: controller.signal,
      redirect: "follow",
    })
    const body = await res.text()
    return { url, status: res.status, excerpt: body.slice(0, 20_000) }
  } catch (error) {
    return { url, status: null, error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Does this agents.md actually sanction reading the catalogue without
 * authenticating?
 *
 * Matched on the two things that carry the meaning together: a read-only or
 * no-authentication heading, AND the catalogue path being named. Either alone
 * is not enough. A file that says "no authentication required" about the
 * cart, or one that mentions /products.json only to forbid it, must not pass,
 * which is why the naming and the sanction have to co-occur.
 */
export function agentsMdSanctionsCatalogue(text: string): {
  sanctioned: boolean
  namedPaths: string[]
  reason: string
} {
  const body = text.toLowerCase()

  /* A 404 handled by the storefront theme is HTML, and is not an agents.md. */
  if (/<html[\s>]/i.test(text) && !/agents?\.md/i.test(text)) {
    return { sanctioned: false, namedPaths: [], reason: "Answered with an HTML page, not an agents.md." }
  }

  const paths = [
    "/products.json",
    "/collections",
    "/wp-json/wc/store",
    "/sitemap.xml",
  ].filter((p) => body.includes(p))

  const readOnly =
    /read[-\s]?only browsing/.test(body) ||
    /no authentication required/.test(body) ||
    /without authentication/.test(body)

  if (!paths.some((p) => p === "/products.json" || p.startsWith("/wp-json"))) {
    return {
      sanctioned: false,
      namedPaths: paths,
      reason: "Does not name a catalogue endpoint (/products.json or the WooCommerce Store API).",
    }
  }
  if (!readOnly) {
    return {
      sanctioned: false,
      namedPaths: paths,
      reason:
        "Names a catalogue endpoint but carries no read-only / no-authentication section, so it is " +
        "not saying an agent may read it.",
    }
  }

  return {
    sanctioned: true,
    namedPaths: paths,
    reason: "Publishes a read-only, no-authentication section naming the catalogue endpoint.",
  }
}

/**
 * Find a Disallow that covers a path, for the user-agent groups that apply to
 * us: `*` and any group naming this crawler.
 *
 * Deliberately conservative in the direction that costs us inventory rather
 * than the direction that costs somebody else their terms: an Allow is not
 * given precedence over a Disallow here, because this is a "is anybody saying
 * no" check rather than a crawl planner, and a store with both should be read
 * by a person before it is read by us.
 */
export function robotsDisallows(text: string, path: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim())
  let applies = false
  for (const line of lines) {
    const ua = /^user-agent:\s*(.+)$/i.exec(line)
    if (ua) {
      const agent = ua[1].trim().toLowerCase()
      applies = agent === "*" || agent.includes("gearavail")
      continue
    }
    if (!applies) continue
    const dis = /^disallow:\s*(.*)$/i.exec(line)
    if (!dis) continue
    const rule = dis[1].trim()
    /* "Disallow:" with an empty value means allow everything. */
    if (!rule) continue
    if (path.startsWith(rule) || rule === "/") return rule
  }
  return null
}

/**
 * Probe one candidate storefront.
 *
 * `platform` is a hint; when omitted the catalogue endpoint that answers is
 * what decides, since a store's own homepage markup is not something to build
 * a verdict on.
 */
export async function probeStorefront(
  input: string,
  options: { platform?: "shopify" | "woocommerce"; fetchImpl?: typeof fetch } = {},
): Promise<StorefrontProbeResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = normalizeOrigin(input)

  const cataloguePath =
    options.platform === "woocommerce"
      ? "/wp-json/wc/store/v1/products?per_page=5"
      : "/products.json?limit=5"

  const [agentsMd, robotsTxt, catalogueDoc] = await Promise.all([
    fetchText(`${baseUrl}/agents.md`, fetchImpl, "text/markdown, text/plain, */*"),
    fetchText(`${baseUrl}/robots.txt`, fetchImpl, "text/plain, */*"),
    fetchText(`${baseUrl}${cataloguePath}`, fetchImpl, "application/json, */*"),
  ])

  const findings: string[] = []

  /* ---- 1. agents.md, the strong evidence ---- */
  let sanctioned = false
  if (agentsMd.status === 200 && agentsMd.excerpt) {
    const verdict = agentsMdSanctionsCatalogue(agentsMd.excerpt)
    sanctioned = verdict.sanctioned
    findings.push(`agents.md: 200. ${verdict.reason}`)
    if (verdict.namedPaths.length) {
      findings.push(`agents.md names: ${verdict.namedPaths.join(", ")}`)
    }
  } else if (agentsMd.status === null) {
    findings.push(`agents.md: request failed (${agentsMd.error}).`)
  } else {
    findings.push(
      `agents.md: ${agentsMd.status}. No published agent policy, so there is no publisher statement to rely on.`,
    )
  }

  /* ---- 2. robots.txt, used only to find a refusal ---- */
  const bareCataloguePath = cataloguePath.split("?")[0]
  let refusal: string | null = null
  if (robotsTxt.status === 200 && robotsTxt.excerpt) {
    refusal = robotsDisallows(robotsTxt.excerpt, bareCataloguePath)
    findings.push(
      refusal
        ? `robots.txt: DISALLOWS ${bareCataloguePath} via "Disallow: ${refusal}".`
        : `robots.txt: 200, nothing disallowing ${bareCataloguePath}. Silence is not permission; it only fails to refuse.`,
    )
  } else {
    findings.push(`robots.txt: ${robotsTxt.status ?? "request failed"}. Nothing to read either way.`)
  }

  /* ---- 3. the endpoint itself, the weakest evidence ---- */
  const catalogue: StorefrontProbeResult["catalogue"] = { ...catalogueDoc }
  let platform: StorefrontProbeResult["platform"] = options.platform ?? "unknown"
  if (catalogueDoc.status === 200 && catalogueDoc.excerpt) {
    try {
      const parsed = JSON.parse(catalogueDoc.excerpt) as
        | { products?: { title?: string }[] }
        | { name?: string }[]
      const products = Array.isArray(parsed) ? parsed : (parsed.products ?? [])
      catalogue.productCount = products.length
      catalogue.sampleTitles = products
        .slice(0, 5)
        .map((p) => (Array.isArray(parsed) ? (p as { name?: string }).name : (p as { title?: string }).title))
        .filter((t): t is string => Boolean(t))
      if (platform === "unknown") platform = Array.isArray(parsed) ? "woocommerce" : "shopify"
      findings.push(
        `Catalogue endpoint: 200, ${products.length} product(s) on the first page. The door opens; that is not the same as being invited in.`,
      )
    } catch {
      /*
       * A truncated excerpt is the likely cause and is not a failure of the
       * store, so this says what it saw rather than declaring the endpoint
       * broken.
       */
      catalogue.error = "Answered 200 but the first 20KB did not parse as JSON."
      findings.push(`Catalogue endpoint: 200 but unparseable as JSON in the first 20KB.`)
    }
  } else {
    findings.push(
      `Catalogue endpoint: ${catalogueDoc.status ?? "request failed"}. Nothing here to ingest.`,
    )
  }

  /* ---- the verdict ---- */
  let verdict: ProbeVerdict
  let summary: string

  if (refusal) {
    verdict = "refused"
    summary =
      `${baseUrl} disallows the catalogue path in robots.txt. Do not add it. A published refusal is ` +
      `decisive whatever else the site returns, and this is the shape section 2 rejected Guitar Center on.`
  } else if (sanctioned && catalogueDoc.status === 200) {
    verdict = "sanctioned"
    summary =
      `${baseUrl} publishes an agents.md sanctioning read-only catalogue access, nothing in robots.txt ` +
      `refuses it, and the endpoint answers. This is the agents-md basis; paste these findings into the ` +
      `merchant row's permission.note. Affiliate enrollment is a separate question and does not gate this.`
  } else if (sanctioned) {
    verdict = "unclear"
    summary =
      `${baseUrl} publishes a sanctioning agents.md but the catalogue endpoint did not answer. Permission ` +
      `looks fine and there is nothing to read; check the path or the platform before adding a row.`
  } else {
    verdict = "unclear"
    summary =
      `${baseUrl} publishes no agents.md sanctioning catalogue access. That is NOT a refusal, and it is ` +
      `also not the agents-md basis: adding it would need an explicit decision recorded on the row, the ` +
      `way Squaver's is. An endpoint answering is not a permission.`
  }

  /*
   * The excerpts are dropped from agents.md and robots.txt only when they are
   * large, because a person reading this wants the actual words, and the
   * actual words of a real agents.md are a couple of KB.
   */
  return {
    baseUrl,
    platform,
    verdict,
    summary,
    findings,
    agentsMd: { ...agentsMd, excerpt: agentsMd.excerpt?.slice(0, 4000) },
    robotsTxt: { ...robotsTxt, excerpt: robotsTxt.excerpt?.slice(0, 4000) },
    /* The catalogue body is a whole page of products; the count and a few
       titles are what a person needs, and the raw JSON is noise. */
    catalogue: { ...catalogue, excerpt: undefined },
  }
}
