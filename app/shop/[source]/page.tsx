import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ListingCard } from "@/components/listing-card"
import { STORES, storeFromSlug } from "@/lib/stores"
import { search } from "@/lib/search"

/**
 * Per-merchant showcase pages, one per confirmed independent storefront.
 *
 * Server rendered against real current listings for the same reason
 * /used/[category] is: a page that names a real store and then shows nothing
 * is worse than no page at all. Revalidated rather than fully static so
 * prices stay close to what a shopper actually sees at the merchant.
 */
export const revalidate = 900

type PageProps = { params: Promise<{ source: string }> }

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

export default async function StorePage({ params }: PageProps) {
  const { source: slug } = await params
  const store = storeFromSlug(slug)
  if (!store) notFound()

  const results = await search({ sources: [store.source], sort: "price_asc", perPage: 24 })

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
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cream)]">{store.name}</h1>
        <p className="mt-2 text-base font-medium text-[var(--muted-foreground)]">{store.tagline}</p>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">{store.blurb}</p>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {results.found.toLocaleString()} live {results.found === 1 ? "listing" : "listings"} right now.
        </p>
      </header>

      <section>
        {results.hits.length === 0 ? (
          <p className="panel p-8 text-center text-sm text-[var(--muted-foreground)]">
            Nothing live from {store.name} at the moment. Stock turns over quickly, so it is worth
            checking back.
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
