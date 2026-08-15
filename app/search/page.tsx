import type { Metadata } from "next"
import { headers } from "next/headers"
import { Suspense } from "react"
import { FilterSidebar } from "@/components/filter-sidebar"
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card"
import { Pagination } from "@/components/pagination"
import { SortSelect } from "@/components/sort-select"
import { RegionNotice } from "@/components/region-notice"
import { excludedSourcesFor, regionFromHeaders } from "@/lib/regions"
import { paramsFromQuery, queryFromParams, search } from "@/lib/search"

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const query = await searchParams
  const q = typeof query.q === "string" ? query.q.trim() : ""
  const title = q ? `Used ${q} for sale` : "Search used and vintage music gear"

  return {
    title,
    description: q
      ? `Live used and vintage ${q} listings from eBay and Reverb, compared side by side and sorted by price.`
      : "Search every used and vintage music gear listing from eBay and Reverb in one place.",
    // Filtered and paged permutations are near-duplicates of each other, so
    // only the clean search page is worth indexing.
    robots: Object.keys(query).length > 0 ? { index: false, follow: true } : undefined,
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await searchParams
  const params = paramsFromQuery(query)

  /*
   * Drop stores that will not ship to this shopper.
   *
   * Resolved here rather than inside search() so the region comes from the
   * request rather than from ambient state, and so the page can tell the
   * shopper what was removed. Section 15's rule is that prices shown must be
   * prices the shopper can actually get, and a Guildford price shown in Ohio
   * fails it exactly as a stale price would.
   *
   * `?ships=all` opts out, which is what the notice links to.
   */
  const region = params.shipsAll ? null : regionFromHeaders(await headers())
  const excludeSources = excludedSourcesFor(region)

  /*
   * The opt-out link, built from the CURRENT params rather than as a bare
   * "?ships=all". A query-only href replaces the whole query string, so the
   * bare version threw away the shopper's search and every active filter,
   * which is a strange reward for clicking "show me more". Page is dropped
   * because unhiding a store changes how many results there are and page
   * seven of the old set means nothing in the new one.
   */
  const showAllQuery = queryFromParams({ ...params, shipsAll: true, page: undefined })
  const showAllHref = showAllQuery ? `/search?${showAllQuery}` : "/search?ships=all"

  return (
    <div className="shell py-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results
          params={{ ...params, excludeSources }}
          region={region}
          showAllHref={showAllHref}
        />
      </Suspense>
    </div>
  )
}

async function Results({
  params,
  region,
  showAllHref,
}: {
  params: ReturnType<typeof paramsFromQuery>
  region: string | null
  showAllHref: string
}) {
  const result = await search(params)

  const buildHref = (page: number) => {
    const qs = queryFromParams({ ...params, page })
    return qs ? `/search?${qs}` : "/search"
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterSidebar facets={result.facets} found={result.found} />

      <section className="min-w-0 flex-1">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--cream)]">
              {params.q ? `Results for "${params.q}"` : "All used gear"}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {result.found.toLocaleString()} live{" "}
              {result.found === 1 ? "listing" : "listings"}
              {result.found > 0 && ` in ${result.tookMs}ms`}
            </p>
          </div>
          <SortSelect />
        </header>

        <RegionNotice region={region} showAllHref={showAllHref} className="mb-4" />

        {result.hits.length === 0 ? (
          <EmptyState query={params.q} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.hits.map((hit) => (
                <ListingCard key={hit.id} hit={hit} />
              ))}
            </div>
            <Pagination
              page={result.page}
              perPage={result.perPage}
              found={result.found}
              buildHref={buildHref}
            />
          </>
        )}
      </section>
    </div>
  )
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="panel p-10 text-center">
      <p className="text-base font-medium text-[var(--cream)]">
        {query ? `Nothing matching "${query}" right now` : "No listings match these filters"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">
        Used inventory turns over fast, so an empty result usually means the gear has sold rather
        than that it does not exist. Try a broader spelling, widen the price range, or set a price
        alert and we will email you when one is listed.
      </p>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="hidden w-64 shrink-0 lg:block">
        <div className="panel h-96 animate-pulse" />
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
