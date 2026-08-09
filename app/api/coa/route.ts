import type { NextRequest } from "next/server"
import { COA_ALLOWED_HOSTS } from "@/lib/lab-results"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
  "Accept-Language": "en-US,en;q=0.9",
}

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return COA_ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`))
}

/**
 * Proxies a store's lab-results / COA page (or PDF) and re-serves it with
 * framing allowed, so it can be shown inside our in-app COA viewer. Retailer
 * pages block direct <iframe> embedding via X-Frame-Options / CSP; this route
 * strips those headers while restricting fetches to an allowlist of the stores
 * we actually aggregate (so it can't be used as an open proxy).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw) return new Response("Missing url", { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new Response("Invalid url", { status: 400 })
  }

  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) {
    return new Response("Host not allowed", { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      cache: "no-store",
    })
  } catch {
    return new Response("Failed to load source", { status: 502 })
  }

  if (!upstream.ok) {
    return new Response(`Source returned ${upstream.status}`, { status: 502 })
  }

  const contentType = upstream.headers.get("content-type") ?? ""

  // Non-HTML (typically the COA PDF itself): stream it straight through with
  // framing allowed.
  if (!contentType.includes("text/html")) {
    const buf = await upstream.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": contentType || "application/octet-stream",
        "content-security-policy": "frame-ancestors 'self'",
        "cache-control": "public, max-age=300",
      },
    })
  }

  // HTML: inject a <base> so the page's relative assets/links resolve against
  // the original origin, and open external links in a new tab.
  let html = await upstream.text()
  const baseHref = `${target.origin}/`
  const injected = `<base href="${baseHref}"><style>html{scroll-behavior:smooth}</style>`

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}${injected}`)
  } else {
    html = `${injected}${html}`
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "frame-ancestors 'self'",
      "cache-control": "public, max-age=300",
    },
  })
}
