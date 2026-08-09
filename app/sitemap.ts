import type { MetadataRoute } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { indexableCategories } from "@/lib/categories"

/**
 * Sitemap.
 *
 * Only gear with live listings is included. Listing a URL that renders "nothing
 * available" wastes crawl budget on exactly the pages we least want indexed,
 * and the deal routes 404 without a market price anyway, so including them
 * unconditionally would advertise soft 404s.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.site.url.replace(/\/+$/, "")

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/search`, changeFrequency: "hourly", priority: 0.8 },
    ...indexableCategories().map(({ slug }) => ({
      url: `${base}/used/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ]

  try {
    const result = await db.execute<{ slug: string; has_market: boolean; updated: string }>(sql`
      SELECT g.slug,
             (g.avg_used_price_cents IS NOT NULL) AS has_market,
             MAX(l.updated_at)::text AS updated
      FROM canonical_gear g
      JOIN marketplace_listings l
        ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
      GROUP BY g.slug, g.avg_used_price_cents
      ORDER BY COUNT(l.id) DESC
      LIMIT 40000
    `)

    const gearRoutes: MetadataRoute.Sitemap = result.rows.flatMap((row) => {
      const lastModified = row.updated ? new Date(row.updated) : undefined
      const entries: MetadataRoute.Sitemap = [
        {
          url: `${base}/gear/${row.slug}`,
          lastModified,
          changeFrequency: "daily",
          priority: 0.6,
        },
      ]
      // The deals route only exists where there is a market price to compare to.
      if (row.has_market) {
        entries.push({
          url: `${base}/deals/${row.slug}`,
          lastModified,
          changeFrequency: "daily",
          priority: 0.5,
        })
      }
      return entries
    })

    return [...staticRoutes, ...gearRoutes]
  } catch {
    // A sitemap missing its dynamic half beats a 500 that gets the whole file
    // dropped from the index.
    return staticRoutes
  }
}
