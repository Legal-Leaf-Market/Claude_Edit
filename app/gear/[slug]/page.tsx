import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { ExternalLink, MapPin, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ListingImage } from "@/components/listing-image"
import { renderForGear } from "@/lib/board/pedal-render"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { GearCredits } from "@/components/rigs/gear-credits"
import { db } from "@/lib/db"
import { canonicalGear } from "@/lib/db/schema"
import { listingsForGear, priceHistoryFor } from "@/lib/deals/history"
import { env } from "@/lib/env"
import { formatMargin, formatPrice, sourceLabel, timeAgo } from "@/lib/utils"

type PageProps = { params: Promise<{ slug: string }> }

async function gearBySlug(slug: string) {
  const rows = await db.select().from(canonicalGear).where(eq(canonicalGear.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const gear = await gearBySlug(slug)
  if (!gear) return { title: "Gear not found" }

  const name = `${gear.brand} ${gear.model}`
  return {
    title: `Used ${name} prices`,
    description: `Every live used ${name} listing from eBay and Reverb, compared side by side with the current market price.`,
    alternates: { canonical: `/gear/${gear.slug}` },
    openGraph: {
      title: `Used ${name} prices | Gear Avail`,
      description: `Compare live used ${name} listings across marketplaces.`,
      images: gear.imageUrl ? [{ url: gear.imageUrl }] : undefined,
    },
  }
}

export default async function GearPage({ params }: PageProps) {
  const { slug } = await params
  const gear = await gearBySlug(slug)
  if (!gear) notFound()

  const [listings, history] = await Promise.all([
    listingsForGear(gear.id),
    priceHistoryFor(gear.id),
  ])

  const name = `${gear.brand} ${gear.model}`
  /* One lookup for the page: the hero and every listing row are all this same
     instrument, so a photograph missing anywhere on it means the same model. */
  const modelled = renderForGear(gear.brand, gear.model)
  const cheapest = listings[0]
  const cheapestCents = cheapest ? Number(cheapest.price_cents) : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-[var(--cream)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/search?brand=${encodeURIComponent(gear.brand)}`}
              className="hover:text-[var(--cream)]"
            >
              {gear.brand}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--cream)]">{gear.model}</li>
        </ol>
      </nav>

      <header className="panel mb-6 flex flex-col gap-5 p-5 sm:flex-row">
        <ListingImage
          src={gear.imageUrl}
          alt={name}
          modelled={modelled}
          className="h-40 w-full rounded-lg sm:h-40 sm:w-40 sm:shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[var(--cream)]">Used {name}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{gear.category}</p>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--dim)]">
                Cheapest live
              </dt>
              <dd className="card-price mt-0.5">
                {cheapestCents != null ? formatPrice(cheapestCents) : "None listed"}
              </dd>
            </div>
            {/*
              Two markets, shown separately, because they are separate markets.
              A single blended "market price" is what a large new-retail feed
              breaks (see lib/deals/pricing.ts): the blend sits above the true
              used median and makes ordinary used prices look like bargains.
              Each is shown only when its own sample cleared the floor, so gear
              stocked new by a retailer and never seen used shows one number
              and says nothing it cannot support about the other.
            */}
            <div>
              <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--dim)]">
                Used market
              </dt>
              <dd className="mt-0.5 font-display text-xl font-bold tracking-[-0.02em] text-[var(--cream)]">
                {gear.avgUsedPriceCents != null
                  ? formatPrice(gear.avgUsedPriceCents)
                  : "Not enough data"}
              </dd>
            </div>
            {gear.avgNewPriceCents != null && (
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--dim)]">
                  New market
                </dt>
                <dd className="mt-0.5 font-display text-xl font-bold tracking-[-0.02em] text-[var(--cream)]">
                  {formatPrice(gear.avgNewPriceCents)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--dim)]">
                Live listings
              </dt>
              <dd className="mt-0.5 font-display text-xl font-bold tracking-[-0.02em] text-[var(--cream)]">{listings.length}</dd>
            </div>
          </dl>

          {gear.avgUsedPriceCents == null && (
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {gear.avgNewPriceCents != null
                ? "We have seen enough new listings to publish a new price, but not enough used ones to say what this is worth second hand. A pile of new stock is not evidence about the used market, so we do not treat it as any."
                : "We publish a market price only once we have seen enough listings for the number to mean something. Until then, compare the live prices below directly."}
            </p>
          )}
        </div>
      </header>

      {/* Records first, listings second. Someone on this page already knows
          what the pedal is; what they usually do not know is which records it
          is on, and that is the thing that decides whether they want one. */}
      <GearCredits brand={gear.brand} model={gear.model} />

      {history.length >= 2 && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-bold tracking-[-0.01em] text-[var(--cream)]">Price over time</h2>
          <div className="rule-accent my-3 w-24" />
          <PriceHistoryChart points={history} />
        </section>
      )}

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold tracking-[-0.01em] text-[var(--cream)]">
            Every live listing, cheapest first
          </h2>
          <Link
            href={`/search?q=${encodeURIComponent(name)}`}
            className="text-sm text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            Search similar gear
          </Link>
        </div>
        <div className="rule-accent my-3 w-24" />

        {listings.length === 0 ? (
          <p className="py-6 text-sm text-[var(--muted-foreground)]">
            Nothing live right now. Used inventory turns over quickly, so set a price alert and we
            will email you when one is listed.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {listings.map((row) => {
              const id = String(row.id)
              const priceCents = Number(row.price_cents)
              const margin = formatMargin(row.deal_margin == null ? null : Number(row.deal_margin))
              const age = timeAgo(row.listed_at ? String(row.listed_at) : null)

              return (
                <li key={id} className="flex flex-wrap items-center gap-3 py-3">
                  <ListingImage
                    src={row.primary_image_url ? String(row.primary_image_url) : null}
                    alt={String(row.title)}
                    modelled={modelled}
                    className="h-14 w-14 shrink-0 rounded-md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-[var(--cream)]">{String(row.title)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                      <Badge variant="source">{sourceLabel(String(row.source))}</Badge>
                      {row.condition ? <Badge>{String(row.condition)}</Badge> : null}
                      {row.is_deal && margin ? <Badge variant="deal">{margin} under</Badge> : null}
                      {row.is_local_pickup ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          Local pickup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" aria-hidden="true" />
                          Ships
                        </span>
                      )}
                      {age && <span>{age}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tracking-[-0.01em] text-[var(--cream)]">
                      {formatPrice(priceCents, String(row.currency ?? "USD"))}
                    </span>
                    {/* A quiet stomp per row, not a green bar per row. Twenty
                        listings meant twenty saturated gradients competing with
                        each other and with the price beside them, which is the
                        opposite of what section 16 reserves the LED for. */}
                    <a
                      href={`/go/${id}`}
                      rel="nofollow sponsored noopener"
                      target="_blank"
                      className="stomp stomp-sm"
                    >
                      View
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Product structured data. Only emitted when there is a real live offer
          behind it, because marking up an empty page is a manual action risk. */}
      {cheapestCents != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: `Used ${name}`,
              brand: { "@type": "Brand", name: gear.brand },
              category: gear.category,
              image: gear.imageUrl ?? undefined,
              gtin: gear.gtin ?? undefined,
              mpn: gear.mpn ?? undefined,
              offers: {
                "@type": "AggregateOffer",
                offerCount: listings.length,
                lowPrice: (cheapestCents / 100).toFixed(2),
                highPrice: (Number(listings[listings.length - 1].price_cents) / 100).toFixed(2),
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: `${env.site.url}/gear/${gear.slug}`,
              },
            }),
          }}
        />
      )}
    </div>
  )
}
