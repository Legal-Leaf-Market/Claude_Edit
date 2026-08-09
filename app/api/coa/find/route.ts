import type { NextRequest } from "next/server"
import { STORE_SEARCH, COA_FOLDERS, strainTokens, cleanStrainQuery } from "@/lib/lab-results"
import { resolveDropboxCoa } from "@/lib/coa-dropbox"
import { resolveProductCoa } from "@/lib/coa-product"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
}

// Candidate products we never want to surface as a "COA match".
const EXCLUDE = /(t-?shirt|apparel|hoodie|sticker|hat|merch|subscription|gift\s*card|sample\s*pack|mystery)/i

type Candidate = { title: string; url: string }
type FindResult = {
  found: boolean
  url?: string
  title?: string
  query: string
  /** True when `url` is the actual COA document (embed directly, no proxy). */
  direct?: boolean
  /** Document kind when `direct` is true. */
  fileType?: "pdf" | "image"
}

function score(strainToks: string[], title: string): number {
  if (EXCLUDE.test(title)) return -1
  const titleToks = new Set(strainTokens(title))
  if (titleToks.size === 0) return 0
  let hits = 0
  for (const t of strainToks) if (titleToks.has(t)) hits++
  if (hits === 0) return 0
  // Reward matching all the strain's tokens; lightly favor tighter titles.
  const coverage = hits / strainToks.length
  return hits * 10 + coverage * 5 - Math.min(titleToks.size, 8) * 0.25
}

function pickBest(strain: string, candidates: Candidate[]): Candidate | null {
  const toks = strainTokens(strain)
  if (toks.length === 0) return null
  let best: Candidate | null = null
  let bestScore = 0
  for (const c of candidates) {
    const s = score(toks, c.title)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  // Require at least one real strain-token hit (score >= ~10).
  return bestScore >= 9.5 ? best : null
}

async function shopifyCandidates(searchBase: string, linkBase: string, q: string): Promise<Candidate[]> {
  const url =
    `${searchBase}/search/suggest.json?q=${encodeURIComponent(q)}` +
    `&resources%5Btype%5D=product&resources%5Blimit%5D=8`
  const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" })
  if (!res.ok) return []
  const json = (await res.json()) as {
    resources?: { results?: { products?: { title: string; url: string }[] } }
  }
  const products = json.resources?.results?.products ?? []
  return products.map((p) => ({
    title: p.title,
    // suggest.json returns a relative URL with tracking params; strip them.
    url: absolutize(linkBase, p.url.split("?")[0]),
  }))
}

async function wooCandidates(searchBase: string, q: string): Promise<Candidate[]> {
  const url = `${searchBase}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=8`
  const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" })
  if (!res.ok) return []
  const json = (await res.json()) as { name?: string; permalink?: string }[]
  return (Array.isArray(json) ? json : [])
    .filter((p) => p.name && p.permalink)
    .map((p) => ({ title: p.name as string, url: p.permalink as string }))
}

function absolutize(base: string, path: string): string {
  try {
    return new URL(path, base).toString()
  } catch {
    return path
  }
}

export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store") ?? ""
  const strain = req.nextUrl.searchParams.get("strain") ?? ""
  const query = cleanStrainQuery(strain)

  if (!query) {
    return Response.json({ found: false, query } satisfies FindResult)
  }

  // Prefer grabbing the exact COA document from the store's public COA folder.
  const folder = COA_FOLDERS[store]
  if (folder) {
    try {
      const doc = await resolveDropboxCoa(folder, strain)
      if (doc) {
        return Response.json({
          found: true,
          url: doc.url,
          title: doc.title,
          query,
          direct: true,
          fileType: doc.fileType,
        } satisfies FindResult)
      }
    } catch {
      // fall through to product search
    }
  }

  const cfg = STORE_SEARCH[store]
  if (!cfg) {
    return Response.json({ found: false, query } satisfies FindResult)
  }

  try {
    const candidates =
      cfg.platform === "shopify"
        ? await shopifyCandidates(cfg.searchBase, cfg.linkBase, query)
        : await wooCandidates(cfg.searchBase, query)

    const best = pickBest(strain, candidates)
    if (best) {
      // We matched the exact product — now grab the COA the retailer publishes
      // for it, store it in our Blob, and serve that copy directly. Falls back
      // to the product page only if no scrapeable COA is found.
      const doc = await resolveProductCoa(store, cfg.platform, best.url, strain)
      if (doc) {
        return Response.json({
          found: true,
          url: doc.url,
          title: doc.title,
          query,
          direct: true,
          fileType: doc.fileType,
        } satisfies FindResult)
      }
      return Response.json({ found: true, url: best.url, title: best.title, query } satisfies FindResult)
    }
  } catch {
    // fall through to not-found
  }

  return Response.json({ found: false, query } satisfies FindResult)
}
