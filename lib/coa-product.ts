import { strainTokens } from "./lab-results"
import { cacheCoaToBlob, fileTypeOf, extOf, type ResolvedCoa } from "./coa-store"

// Generalized COA grabber: given a matched product page, find the actual COA
// document the retailer publishes for that product (a PDF link or a COA image),
// then scrape its bytes into our own Blob storage and serve that copy. This is
// what lets EVERY matched strain render from our origin instead of bouncing the
// shopper to the retailer's age-gated site.
//
// Where each platform hides the COA (verified live):
//   • Shopify (Black Tie): a ".pdf" link in the product body_html (Shopify CDN).
//   • Shopify (Small Buds): a product image named "..._compliance_coa_*.png".
//   • WooCommerce (THCA4Cheap): a "wp-content/uploads/{Strain}_THCA_COA*.jpg".

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

// Filenames/paths that look like a certificate of analysis.
const COA_HINT =
  /coa|compliance|lab[-_\s]?result|lab[-_\s]?report|certificate|certi?ficate|potency|third[-_\s]?party|analysis/i

type Candidate = { url: string; name: string; kind: "pdf" | "image"; fromHint: boolean }

/** Strip Woo/Shopify resize suffixes (e.g. "-600x776") to get the original. */
function toOriginalImage(url: string): string {
  return url.replace(/-\d+x\d+(\.(?:jpe?g|png|webp))(\?|#|$)/i, "$1$2")
}

function slugForStore(store: string): string {
  return store
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Pick the best COA candidate for a strain, preferring hinted + strain-matched. */
function pickCandidate(strain: string, candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null
  const toks = strainTokens(strain)

  const scoreOf = (c: Candidate): number => {
    let s = 0
    if (c.fromHint) s += 5 // filename explicitly looks like a COA
    const nameToks = new Set(strainTokens(c.name))
    let hits = 0
    for (const t of toks) if (nameToks.has(t)) hits++
    s += hits * 6 // matches this strain's name
    if (c.kind === "pdf") s += 1 // slight preference for full PDFs
    return s
  }

  let best: Candidate | null = null
  let bestScore = -1
  for (const c of candidates) {
    const s = scoreOf(c)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  // Need at least a COA hint OR a strain-name hit to trust it.
  return bestScore >= 5 || (best && strainTokens(best.name).some((t) => toks.includes(t)))
    ? best
    : null
}

/** Collect COA candidates from a Shopify product's JSON payload. */
async function shopifyCandidates(productUrl: string): Promise<Candidate[]> {
  const jsonUrl = productUrl.split("?")[0].replace(/\/$/, "") + ".json"
  const res = await fetch(jsonUrl, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json()) as {
    product?: { body_html?: string; images?: { src?: string; alt?: string }[] }
  }
  const product = data.product
  if (!product) return []

  const out: Candidate[] = []
  const body = product.body_html || ""

  // PDF links in the description (Black Tie's "3rd Party Lab Analysis").
  for (const m of body.matchAll(/href=["'](https?:\/\/[^"']+\.pdf[^"']*)["']/gi)) {
    const url = m[1]
    out.push({ url, name: decodeURIComponent(url.split("/").pop() || ""), kind: "pdf", fromHint: true })
  }
  // Any other COA-hinted links (Drive/Confident Cannabis viewers etc.).
  for (const m of body.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = m[1]
    if (/\.pdf/i.test(url)) continue
    if (COA_HINT.test(url)) {
      const kind = fileTypeOf(url)
      out.push({ url, name: decodeURIComponent(url.split("/").pop() || ""), kind, fromHint: true })
    }
  }
  // Product images that are actually COA scans (Small Buds' compliance_coa).
  for (const img of product.images || []) {
    const src = img.src || ""
    if (!src) continue
    const name = (img.alt || "") + " " + (src.split("/").pop() || "")
    if (COA_HINT.test(name)) {
      out.push({ url: toOriginalImage(src), name: src.split("/").pop() || "", kind: "image", fromHint: true })
    }
  }
  return out
}

/** Collect COA candidates from a WooCommerce product page's HTML. */
async function wooCandidates(productUrl: string): Promise<Candidate[]> {
  const res = await fetch(productUrl, { headers: { "User-Agent": UA, Accept: "text/html" }, cache: "no-store" })
  if (!res.ok) return []
  const html = await res.text()

  const out: Candidate[] = []
  const seen = new Set<string>()
  const add = (rawUrl: string) => {
    const url = toOriginalImage(rawUrl)
    if (seen.has(url)) return
    seen.add(url)
    const name = decodeURIComponent(url.split("/").pop() || "")
    if (!COA_HINT.test(name)) return
    out.push({ url, name, kind: fileTypeOf(url), fromHint: true })
  }
  // COA images/PDFs uploaded under wp-content (THCA4Cheap's {Strain}_THCA_COA).
  for (const m of html.matchAll(/https?:\/\/[^"'<> )]+\.(?:pdf|jpe?g|png|webp)/gi)) add(m[0])
  return out
}

/**
 * Resolve a product's COA into our Blob storage and return the servable copy,
 * or null if we can't find/scrape one for this product.
 */
export async function resolveProductCoa(
  store: string,
  platform: "shopify" | "woocommerce",
  productUrl: string,
  strain: string,
): Promise<ResolvedCoa | null> {
  let candidates: Candidate[] = []
  try {
    candidates =
      platform === "shopify" ? await shopifyCandidates(productUrl) : await wooCandidates(productUrl)
  } catch {
    return null
  }

  const best = pickCandidate(strain, candidates)
  if (!best) return null

  const blobUrl = await cacheCoaToBlob(best.url, slugForStore(store), {
    referer: productUrl,
    ext: extOf(best.url),
  })
  if (!blobUrl) return null

  return {
    url: blobUrl,
    title: best.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || strain,
    fileType: best.kind,
  }
}
