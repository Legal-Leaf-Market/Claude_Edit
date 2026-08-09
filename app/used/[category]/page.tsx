import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "drizzle-orm"
import { ListingCard } from "@/components/listing-card"
import { db } from "@/lib/db"
import { CATEGORY_INTRO, categoryFromSlug, indexableCategories } from "@/lib/categories"
import { search } from "@/lib/search"
import { formatPrice } from "@/lib/utils"

/**
 * Programmatic category landing pages.
 *
 * Server rendered against real current listings rather than a static template,
 * because a page that says "used amplifiers" and then shows nothing is worse
 * than no page at all. Revalidated rather than fully static so the prices a
 * crawler sees are close to the prices a shopper sees.
 */
export const revalidate = 900

type PageProps = { params: Promise<{ category: string }> }

export function generateStaticParams() {
  return indexableCategories().map(({ slug }) => ({ category: slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params
  const category = categoryFromSlug(slug)
  if (!category) return { title: "Category not found" }

  return {
    title: `Used ${category} for sale`,
    description: `Compare live used and vintage ${category.toLowerCase()} listings from eBay and Reverb, sorted by price with below-market listings marked.`,
    alternates: { canonical: `/used/${slug}` },
  }
}

/** Most-listed models in this category, which become the internal link mesh. */
async function popularModels(category: string) {
  const result = await db.execute<{
    slug: string
    brand: string
    model: string
    listings: number
    cheapest: number | null
  }>(sql`
    SELECT g.slug, g.brand, g.model,
           COUNT(l.id)::int AS listings,
           MIN(l.price_cents)::int AS cheapest
    FROM canonical_gear g
    JOIN marketplace_listings l
      ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
    WHERE g.category = ${category}
    GROUP BY g.slug, g.brand, g.model
    ORDER BY listings DESC, g.brand ASC
    LIMIT 24
  `)
  return result.rows
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params
  const category = categoryFromSlug(slug)
  if (!category) notFound()

  const [results, models] = await Promise.all([
    search({ categories: [category], sort: "price_asc", perPage: 12 }),
    popularModels(category),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-[var(--cream)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--cream)]">Used {category}</li>
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--cream)]">
          Used {category}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">
          {CATEGORY_INTRO[category] ??
            `Live used and vintage ${category.toLowerCase()} from eBay and Reverb, matched to the same instrument so you can compare every price at once.`}
        </p>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {results.found.toLocaleString()} live{" "}
          {results.found === 1 ? "listing" : "listings"} right now.
        </p>
      </header>

      {models.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold text-[var(--cream)]">
            Most listed {category.toLowerCase()}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <li key={model.slug}>
                <Link
                  href={`/gear/${model.slug}`}
                  className="panel flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:border-[var(--amber)]/40"
                >
                  <span className="min-w-0 truncate text-sm text-[var(--cream)]">
                    {model.brand} {model.model}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {model.cheapest != null ? `from ${formatPrice(Number(model.cheapest))}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--cream)]">Cheapest right now</h2>
          <Link
            href={`/search?category=${encodeURIComponent(category)}`}
            className="text-sm text-[var(--amber)] underline-offset-2 hover:underline"
          >
            Search all {category.toLowerCase()}
          </Link>
        </div>

        {results.hits.length === 0 ? (
          <p className="panel p-8 text-center text-sm text-[var(--muted-foreground)]">
            Nothing live in this category at the moment. Used stock turns over quickly, so it is
            worth checking back.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.hits.map((hit) => (
              <ListingCard key={hit.id} hit={hit} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
