import type { MetadataRoute } from "next"
import { PEDALS } from "@/lib/pedals"
import { STATIC_ROUTES } from "@/lib/nav"
import { SITE_URL } from "@/lib/site"

/**
 * Built from the nav tree and the dataset rather than hand-listed, so a page
 * added to one and forgotten in the other cannot happen. Only routes this file
 * explicitly builds are ever listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.8,
  }))

  const pedalEntries = PEDALS.map((pedal) => ({
    url: `${SITE_URL}/pedals/${pedal.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }))

  return [...staticEntries, ...pedalEntries]
}
