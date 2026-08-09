import type { MetadataRoute } from "next"
import { env } from "@/lib/env"

export default function robots(): MetadataRoute.Robots {
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
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
