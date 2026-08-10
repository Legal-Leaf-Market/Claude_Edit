import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "drizzle-orm"
import { CategoryIcon, CATEGORY_HUE } from "@/components/category-icon"
import { FilterSidebar } from "@/components/filter-sidebar"
import { ListingCard } from "@/components/listing-card"
import { Pagination } from "@/components/pagination"
import { SortSelect } from "@/components/sort-select"
import { db } from "@/lib/db"
import { CATEGORY_INTRO, categoryFromSlug, indexableCategories } from "@/lib/categories"
import { paramsFromQuery, queryFromParams, search } from "@/lib/search"
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

type PageProps = {
  params: Promise<{ category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params
  const category = categoryFromSlug(slug)
  if (!category) notFound()

  // Filters come off the URL exactly as they do on /search, then the category
  // is forced back on. The page owns that one dimension; the shopper owns the
  // rest.
  const query = await searchParams
  const searchParamsForQuery = { ...paramsFromQuery(query), categories: [category] }

  const [results, models] = await Promise.all([
    search(searchParamsForQuery),
    popularModels(category),
  ])

  const buildHref = (page: number) => {
    // categories is dropped from the query string: it lives in the path here,
    // and repeating it would let the two disagree.
    const { categories: _fixed, ...rest } = { ...searchParamsForQuery, page }
    const qs = queryFromParams(rest)
    return qs ? `/used/${slug}?${qs}` : `/used/${slug}`
  }

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
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `${CATEGORY_HUE[slug] ?? "#f0a830"}22`,
              color: CATEGORY_HUE[slug] ?? "#f0a830",
            }}
          >
            <CategoryIcon slug={slug} className="h-7 w-7" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--cream)]">
            Used {category}
          </h1>
        </div>
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

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Category is fixed by the route, so that facet would only ever
            navigate the shopper out of the page they chose. */}
        <FilterSidebar facets={results.facets} found={results.found} hide={["category"]} />

        <section className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--cream)]">
              {results.found.toLocaleString()} {results.found === 1 ? "listing" : "listings"}
            </h2>
            <SortSelect />
          </div>

          {results.hits.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-[var(--muted-foreground)]">
              Nothing matches those filters right now. Used stock turns over quickly, so it is
              worth widening the price range or checking back.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.hits.map((hit) => (
                  <ListingCard key={hit.id} hit={hit} />
                ))}
              </div>
              <Pagination
                page={results.page}
                perPage={results.perPage}
                found={results.found}
                buildHref={buildHref}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
