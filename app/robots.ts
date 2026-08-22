import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { env } from "@/lib/env"
import { isStompboxHost } from "@/lib/stompbox/host"
import { SITE_URL as STOMPBOX_URL } from "@/lib/stompbox/site"

/**
 * ONE FILE, TWO DOMAINS.
 *
 * `robots.txt` only exists at the root of a host and a crawler asks for it by
 * that fixed name, so `middleware.ts` deliberately does NOT rewrite it onto
 * `/stompbox/robots.txt`. Which host asked is decided here instead.
 *
 * The guide has nothing to hide: no outbound redirects that would register a
 * click, no admin tree, no per-subscriber tokens, and no filtered search
 * permutations. Handing it Gear Avail's disallow list would be listing paths
 * that do not exist on that domain, which is noise in a file whose whole job
 * is to be unambiguous.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (isStompboxHost((await headers()).get("host"))) {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: `${STOMPBOX_URL}/sitemap.xml`,
      host: STOMPBOX_URL,
    }
  }

  const base = env.site.url.replace(/\/+$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Outbound affiliate redirects. Nothing to index, and letting crawlers
          // follow them would register clicks that no human ever made.
          "/go/",
          "/api/",
          // Filtered and paged search permutations are near-duplicates of each
          // other; the clean /search page is the one worth crawling.
          "/search?",
          // Private, passcode-gated. Never meant to be discoverable.
          "/admin",
          // Carries a per-subscriber token and has nothing to index.
          "/unsubscribe",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
