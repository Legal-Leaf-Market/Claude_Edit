import { strainTokens, type CoaFolder } from "./lab-results"
import { cacheCoaToBlob, fileTypeOf, type ResolvedCoa } from "./coa-store"

// Grabs a shopper's exact COA out of a store's public Dropbox folder, then
// SCRAPES the actual file bytes and stores them in our own Blob storage. From
// then on we serve the COA entirely from our origin — no Dropbox redirect, no
// X-Frame-Options, no age gate — which is the bulletproof part.
//
// Dropbox's web app lists a shared folder via an unauthenticated endpoint that
// only needs a CSRF token it hands out as a cookie on the folder page. So we:
//   1. GET the folder page to collect the `__Host-js_csrf` cookie + token.
//   2. POST /list_shared_link_folder_entries to get every file (name + href).
//   3. Match the strain to a file, download its bytes, and cache to Blob.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

type DropboxEntry = {
  filename?: string
  href?: string
  is_dir?: boolean
}

function parseCookies(res: Response): Record<string, string> {
  const jar: Record<string, string> = {}
  // getSetCookie() returns each Set-Cookie header separately (Node 18.14+).
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : ([res.headers.get("set-cookie")].filter(Boolean) as string[])
  for (const c of cookies) {
    const m = c.match(/^([^=]+)=([^;]+)/)
    if (m) jar[m[1]] = m[2]
  }
  return jar
}

/** Convert a Dropbox shared-file link into a raw download URL. */
function toRawUrl(href: string): string {
  try {
    const u = new URL(href)
    u.searchParams.delete("dl")
    u.searchParams.set("raw", "1")
    return u.toString()
  } catch {
    return href
  }
}

/**
 * Score a candidate filename against the requested strain tokens. Returns 0
 * unless the match is strong enough to trust: multi-word strains must share at
 * least two tokens (so "Sour Strawberry" can't match "Lebanese Sour Diesel" on
 * "sour" alone), single-word strains must match that word exactly.
 */
function scoreFile(strainToks: string[], filename: string): number {
  const fileToks = new Set(strainTokens(filename))
  if (fileToks.size === 0) return 0
  let hits = 0
  for (const t of strainToks) if (fileToks.has(t)) hits++
  const minHits = strainToks.length === 1 ? 1 : 2
  if (hits < minHits) return 0
  const coverage = hits / strainToks.length
  // Reward full coverage; penalize extra unrelated tokens a little.
  return hits * 10 + coverage * 6 - Math.min(fileToks.size, 6) * 0.5
}

export async function resolveDropboxCoa(
  folder: CoaFolder,
  strain: string,
): Promise<ResolvedCoa | null> {
  const strainToks = strainTokens(strain)
  if (strainToks.length === 0) return null

  const folderUrl =
    `https://www.dropbox.com/scl/fo/${folder.linkKey}/${folder.secureHash}` +
    `?rlkey=${folder.rlkey}&dl=0`

  // Step 1 — obtain the CSRF cookie/token from the folder page.
  const pageRes = await fetch(folderUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  })
  if (!pageRes.ok) return null
  const jar = parseCookies(pageRes)
  const csrf = jar["__Host-js_csrf"] || jar["js_csrf"] || jar["t"] || ""
  if (!csrf) return null
  const cookieHeader = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")

  // Step 2 — list the folder entries.
  const body = new URLSearchParams({
    is_xhr: "true",
    t: csrf,
    link_type: "s",
    link_key: folder.linkKey,
    secure_hash: folder.secureHash,
    rlkey: folder.rlkey,
    sub_path: "",
  })
  const listRes = await fetch("https://www.dropbox.com/list_shared_link_folder_entries", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      Cookie: cookieHeader,
      Referer: folderUrl,
    },
    body: body.toString(),
    cache: "no-store",
  })
  if (!listRes.ok) return null

  let entries: DropboxEntry[] = []
  try {
    const json = (await listRes.json()) as { entries?: DropboxEntry[] }
    entries = json.entries ?? []
  } catch {
    return null
  }

  const files = entries.filter(
    (e) => !e.is_dir && e.filename && e.href && /\.(pdf|jpe?g|png)$/i.test(e.filename),
  )
  if (files.length === 0) return null

  // Step 3 — pick the best strain match.
  let best: DropboxEntry | null = null
  let bestScore = 0
  for (const f of files) {
    const s = scoreFile(strainToks, f.filename as string)
    if (s > bestScore) {
      bestScore = s
      best = f
    }
  }
  // Require at least one solid strain-token hit.
  if (!best || bestScore < 9.5) return null

  const filename = best.filename as string
  const rawUrl = toRawUrl(best.href as string)
  const ext = (filename.split(".").pop() || "pdf").toLowerCase()

  // Scrape the bytes into our own Blob storage and serve that copy.
  const blobUrl = await cacheCoaToBlob(rawUrl, "thca-king", { ext })
  if (!blobUrl) return null

  return {
    url: blobUrl,
    title: filename.replace(/\.[a-z0-9]+$/i, "").trim(),
    fileType: fileTypeOf(filename),
  }
}
