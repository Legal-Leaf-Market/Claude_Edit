import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/structured-data"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep auth, API and the private admin area out of the index.
      disallow: ["/api/", "/sign-in", "/sign-up", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
