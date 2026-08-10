import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FilterSidebar } from "@/components/filter-sidebar"
import { StoreMark } from "@/components/store-mark"
import { ListingCard } from "@/components/listing-card"
import { Pagination } from "@/components/pagination"
import { SortSelect } from "@/components/sort-select"
import { SubscribeForm } from "@/components/subscribe-form"
import { STORES, storeFromSlug } from "@/lib/stores"
import { paramsFromQuery, queryFromParams, search } from "@/lib/search"

/**
 * Per-merchant showcase pages, one per ingested independent storefront.
 *
 * Server rendered against real current listings for the same reason
 * /used/[category] is: a page that names a real store and then shows nothing
 * is worse than no page at all. Revalidated rather than fully static so
 * prices stay close to what a shopper actually sees at the merchant.
 */
export const revalidate = 900

type PageProps = {
  params: Promise<{ source: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export function generateStaticParams() {
  return STORES.map((s) => ({ source: s.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { source: slug } = await params
  const store = storeFromSlug(slug)
  if (!store) return { title: "Store not found" }

  const title = `${store.name}: ${store.tagline} | Gear Avail`
  const description = `Shop ${store.name} on Gear Avail: ${store.blurb}`

  return {
    title,
    description,
    alternates: { canonical: `/shop/${store.slug}` },
    openGraph: { title, description, type: "website" },
  }
}

export default async function StorePage({ params, searchParams }: PageProps) {
  const { source: slug } = await params
  const store = storeFromSlug(slug)
  if (!store) notFound()

  // Same pattern as the category pages: the shopper drives every filter
  // except the one the route already fixes.
  const query = await searchParams
  const params_ = { ...paramsFromQuery(query), sources: [store.source] }
  const results = await search(params_)

  const buildHref = (page: number) => {
    const { sources: _fixed, ...rest } = { ...params_, page }
    const qs = queryFromParams(rest)
    return qs ? `/shop/${store.slug}?${qs}` : `/shop/${store.slug}`
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://gearavail.com/" },
      { "@type": "ListItem", position: 2, name: store.name, item: `https://gearavail.com/shop/${store.slug}` },
    ],
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-[var(--cream)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--cream)]">{store.name}</li>
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">Store</p>
        <div className="mt-1 flex items-center gap-3">
          <StoreMark source={store.source} name={store.name} size="lg" />
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--cream)]">{store.name}</h1>
        </div>
        <p className="mt-2 text-base font-medium text-[var(--muted-foreground)]">{store.tagline}</p>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">{store.blurb}</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* The store is fixed by the route, so a marketplace facet here would
            only ever send the shopper to a different store. */}
        <FilterSidebar facets={results.facets} found={results.found} hide={["source"]} />

        <section className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--cream)]">
              {results.found.toLocaleString()} {results.found === 1 ? "listing" : "listings"}
            </h2>
            <SortSelect />
          </div>

          {results.hits.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-[var(--muted-foreground)]">
              Nothing from {store.name} matches those filters. Stock turns over quickly, so it is
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

      <div className="mt-10 max-w-2xl">
        <SubscribeForm source="store" />
      </div>
    </div>
  )
}
