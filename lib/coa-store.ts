import { createHash } from "node:crypto"
import { put, list } from "@vercel/blob"

// Shared helper: download a COA document's bytes from its source and cache them
// in our own PUBLIC Blob storage. From then on the COA is served entirely from
// our origin — correct content-type, no framing restrictions, no retailer age
// gate — which is what makes the viewer bulletproof. Keyed by a stable hash of
// the source URL so each unique COA is fetched once and reused thereafter.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

export type CoaFileType = "pdf" | "image"

/** A resolved COA served from our own Blob storage. */
export type ResolvedCoa = { url: string; title: string; fileType: CoaFileType }

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export function extOf(urlOrName: string): string {
  const clean = urlOrName.split("?")[0].split("#")[0]
  const ext = (clean.split(".").pop() || "").toLowerCase()
  return CONTENT_TYPES[ext] ? ext : "pdf"
}

export function fileTypeOf(urlOrName: string): CoaFileType {
  return /\.(jpe?g|png|webp)(\?|#|$)/i.test(urlOrName) ? "image" : "pdf"
}

/**
 * Download the COA bytes from `sourceUrl` and store them in our public Blob
 * store under `coa/{storeSlug}/{hash}.{ext}`. Returns the public Blob URL
 * (directly embeddable) or null if the download/upload fails.
 */
export async function cacheCoaToBlob(
  sourceUrl: string,
  storeSlug: string,
  opts?: { referer?: string; ext?: string },
): Promise<string | null> {
  const ext = opts?.ext || extOf(sourceUrl)
  const key = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 20)
  const pathname = `coa/${storeSlug}/${key}.${ext}`

  // Reuse the cached copy if we've already scraped this COA.
  try {
    const existing = await list({ prefix: pathname, limit: 1 })
    if (existing.blobs.length > 0) return existing.blobs[0].url
  } catch {
    // listing failed — fall through and try to (re)upload
  }

  let res: Response
  try {
    res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        ...(opts?.referer ? { Referer: opts.referer } : {}),
      },
      redirect: "follow",
      cache: "no-store",
    })
  } catch {
    return null
  }
  if (!res.ok) return null

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < 1024) return null // too small to be a real document

  const contentType =
    CONTENT_TYPES[ext] || res.headers.get("content-type") || "application/octet-stream"
  try {
    const blob = await put(pathname, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return blob.url
  } catch {
    return null
  }
}
