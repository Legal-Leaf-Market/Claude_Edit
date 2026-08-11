import type { MetadataRoute } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { indexableCategories } from "@/lib/categories"
import { STORES } from "@/lib/stores"
import { BOARDS } from "@/lib/boards"
import { RIGS } from "@/lib/rigs"

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
    /*
     * The Anderton's section. Listed unconditionally, unlike the per-store
     * routes below which are gated on having live inventory: these two render
     * their own editorial copy either way, so an un-ingested catalogue makes
     * them thin rather than the soft 404 an empty inventory page would be.
     * /uk/rigs/[slug] is deliberately absent, since one of those with no
     * stock IS an empty inventory page.
     */
    { url: `${base}/uk`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/uk/rigs`, changeFrequency: "daily", priority: 0.6 },
    ...indexableCategories().map(({ slug }) => ({
      url: `${base}/used/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // The feed and the boards are listed unconditionally, unlike gear and
    // store routes. They render their own copy and a post form whether or not
    // anyone has posted yet, so an empty board is a thin page rather than the
    // soft 404 an inventory page with no inventory would be. Individual posts
    // are deliberately absent: they are noindex, short-lived, and reachable
    // from the board above them.
    { url: `${base}/feed`, changeFrequency: "hourly" as const, priority: 0.8 },
    ...BOARDS.map((board) => ({
      url: `${base}/boards/${board.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    // Rig pages are listed unconditionally for the same reason the boards are.
    // Their content is the curated write-up and the records, which is on the
    // page whether or not a single pedal on it is currently in stock, so an
    // empty catalogue makes them thinner rather than empty. They are also the
    // only genuinely unique editorial content on the site, so they are worth
    // more crawl budget than a category index.
    { url: `${base}/rigs`, changeFrequency: "weekly" as const, priority: 0.8 },
    ...RIGS.map((rig) => ({
      url: `${base}/rigs/${rig.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/pedalboard`, changeFrequency: "weekly" as const, priority: 0.7 },
  ]

  try {
    const result = await db.execute<{ slug: string; has_market: boolean; updated: string }>(sql`
      SELECT g.slug,
             (g.avg_used_price_cents IS NOT NULL OR g.avg_new_price_cents IS NOT NULL) AS has_market,
             MAX(l.updated_at)::text AS updated
      FROM canonical_gear g
      JOIN marketplace_listings l
        ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
      GROUP BY g.slug, g.avg_used_price_cents, g.avg_new_price_cents
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

    const storeResult = await db.execute<{ source: string; updated: string }>(sql`
      SELECT source, MAX(updated_at)::text AS updated
      FROM marketplace_listings
      WHERE listing_status = 'active'
      GROUP BY source
    `)
    const liveSources = new Map(storeResult.rows.map((row) => [row.source, row.updated]))

    // Same soft-404 concern as the deal routes: a store page with zero live
    // listings is worse than no page, so only sources with active inventory
    // right now get indexed.
    const storeRoutes: MetadataRoute.Sitemap = STORES.filter((store) => liveSources.has(store.source)).map(
      (store) => {
        const updated = liveSources.get(store.source)
        return {
          url: `${base}/shop/${store.slug}`,
          lastModified: updated ? new Date(updated) : undefined,
          changeFrequency: "daily" as const,
          priority: 0.6,
        }
      },
    )

    return [...staticRoutes, ...gearRoutes, ...storeRoutes]
  } catch {
    // A sitemap missing its dynamic half beats a 500 that gets the whole file
    // dropped from the index.
    return staticRoutes
  }
}
