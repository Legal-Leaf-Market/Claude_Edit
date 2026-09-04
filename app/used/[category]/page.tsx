import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CategoryHero } from "@/components/category-hero"
import { FilterSidebar } from "@/components/filter-sidebar"
import { ListingCard } from "@/components/listing-card"
import { Pagination } from "@/components/pagination"
import { SortSelect } from "@/components/sort-select"
import { liveModels } from "@/lib/catalog/live-models"
import {
  CATEGORY_INTRO,
  CATEGORY_KICKER,
  CATEGORY_TITLE,
  categoryFromSlug,
  indexableCategories,
} from "@/lib/categories"
import { paramsFromQuery, queryFromParams, search } from "@/lib/search"
import { formatPrice } from "@/lib/utils"
import { JsonLdScript } from "@/components/json-ld"
import { breadcrumbs, itemListSchema } from "@/lib/seo/structured-data"

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

/**
 * Most-listed models in this category, which become the internal link mesh.
 *
 * The query lives in lib/catalog/live-models.ts because this page is not the
 * only thing that asks what a category actually has in stock: the pedal slice
 * published to stompbox.world asks the same question, and when it asked it
 * with its own SELECT the two answers drifted. One definition, two readers.
 */
async function popularModels(category: string) {
  return liveModels({ category, limit: 24 })
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
    <div className="shell py-8">
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

      <JsonLdScript
        data={[
          /* The internal link mesh, as a list. Links rather than Product
             nodes: a crawler that follows one gets the offers from the gear
             page, and repeating a thinner copy here would be two answers to
             the same question with the worse one sometimes winning. */
          itemListSchema({
            name: `Used ${category}`,
            description: CATEGORY_INTRO[category],
            path: `/used/${slug}`,
            items: models.map((model) => ({
              name: `${model.brand} ${model.model}`,
              path: `/gear/${model.slug}`,
            })),
          }),
          breadcrumbs([{ name: "Home", path: "/" }, { name: `Used ${category}` }]),
        ]}
      />

      <CategoryHero
        slug={slug}
        eyebrow={`Used ${category}`}
        title={CATEGORY_TITLE[category] ?? `Used ${category}`}
        kicker={CATEGORY_KICKER[category]}
      />

      <div className="mb-8 max-w-3xl">
        <p className="text-base leading-relaxed text-[var(--muted-foreground)]">
          {CATEGORY_INTRO[category] ??
            `Live used and vintage ${category.toLowerCase()} from eBay and Reverb, matched to the same instrument so you can compare every price at once.`}
        </p>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {results.found.toLocaleString()} live{" "}
          {results.found === 1 ? "listing" : "listings"} right now.
        </p>
      </div>

      {models.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-[var(--cream)]">
            Most listed {category.toLowerCase()}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <li key={model.slug}>
                <Link
                  href={`/gear/${model.slug}`}
                  className="panel flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:border-[var(--accent-text)]/40"
                >
                  <span className="min-w-0 truncate text-sm text-[var(--cream)]">
                    {model.brand} {model.model}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {model.cheapestCents != null ? `from ${formatPrice(model.cheapestCents)}` : ""}
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
            <h2 className="text-lg font-bold text-[var(--cream)]">
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
