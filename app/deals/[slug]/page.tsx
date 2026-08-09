import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq, sql } from "drizzle-orm"
import { ListingCard } from "@/components/listing-card"
import { db } from "@/lib/db"
import { canonicalGear } from "@/lib/db/schema"
import { search } from "@/lib/search"
import { formatPrice } from "@/lib/utils"

/**
 * Per-model deal pages: /deals/fender-player-stratocaster.
 *
 * These target the highest-intent query shape there is ("cheap used <model>"),
 * and they only exist for gear we can honestly write about: a model with no
 * market price gets a 404 rather than a page claiming to know what a fair price
 * is. Publishing a "deals" page with no basis for the word "deal" is the fast
 * route to being treated as thin content, and it would also just be untrue.
 */
export const revalidate = 900

type PageProps = { params: Promise<{ slug: string }> }

/** Pre-render the gear with enough listings for the page to be worth having. */
export async function generateStaticParams() {
  try {
    const result = await db.execute<{ slug: string }>(sql`
      SELECT g.slug
      FROM canonical_gear g
      JOIN marketplace_listings l
        ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
      WHERE g.avg_used_price_cents IS NOT NULL
      GROUP BY g.slug
      HAVING COUNT(l.id) >= 3
      ORDER BY COUNT(l.id) DESC
      LIMIT 500
    `)
    return result.rows.map((row) => ({ slug: row.slug }))
  } catch {
    // A build without a reachable database still succeeds; these pages render
    // on demand instead.
    return []
  }
}

async function gearBySlug(slug: string) {
  const rows = await db.select().from(canonicalGear).where(eq(canonicalGear.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const gear = await gearBySlug(slug)
  if (!gear) return { title: "Not found" }

  const name = `${gear.brand} ${gear.model}`
  return {
    title: `Cheap used ${name}: current deals`,
    description: `The cheapest live used ${name} listings across eBay and Reverb, measured against a market price of ${
      gear.avgUsedPriceCents ? formatPrice(gear.avgUsedPriceCents) : "the current spread"
    }.`,
    alternates: { canonical: `/deals/${gear.slug}` },
  }
}

export default async function DealsPage({ params }: PageProps) {
  const { slug } = await params
  const gear = await gearBySlug(slug)
  if (!gear) notFound()

  // No market price means no honest way to call anything a deal.
  if (gear.avgUsedPriceCents == null) notFound()

  const results = await search({
    canonicalGearId: gear.id,
    sort: "price_asc",
    perPage: 24,
  })

  if (results.hits.length === 0) notFound()

  const name = `${gear.brand} ${gear.model}`
  const market = gear.avgUsedPriceCents
  const cheapest = results.hits[0].priceCents
  const saving = market - cheapest

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-[var(--cream)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/gear/${gear.slug}`} className="hover:text-[var(--cream)]">
              {name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--cream)]">Deals</li>
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--cream)]">
          Cheap used {name}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">
          The market price for a used {name} is{" "}
          <strong className="text-[var(--cream)]">{formatPrice(market)}</strong>, taken as a rolling
          median of the {gear.priceSampleSize} listings Gear Avail has on file. The cheapest live
          listing right now is <strong className="text-[var(--cream)]">{formatPrice(cheapest)}</strong>
          {saving > 0 ? (
            <>
              , which is {formatPrice(saving)} under that median.
            </>
          ) : (
            <>, which is at or above that median, so this is not a good week to buy one.</>
          )}
        </p>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          <Link href={`/gear/${gear.slug}`} className="text-[var(--amber)] underline-offset-2 hover:underline">
            See the full price history and every listing
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {results.hits.map((hit) => (
          <ListingCard key={hit.id} hit={hit} />
        ))}
      </div>
    </div>
  )
}
