"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, MapPin, RotateCcw, Truck } from "lucide-react"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { Badge } from "@/components/ui/badge"
import { ListingImage } from "./listing-image"
import { formatMargin, formatPrice, sourceLabel, timeAgo } from "@/lib/utils"
import type { Source } from "@/lib/db/schema"
import type { SearchHit } from "@/lib/search/types"

/**
 * A single listing, as a flip card: the front is the scannable summary
 * (photo, price, quick actions), the back holds the detail that does not fit
 * in a grid tile (description, brand, source) without a full page load.
 *
 * A real 3D transform (see .flip-card* in globals.css), not a fade, with an
 * accessible fallback: prefers-reduced-motion swaps the rotation for a plain
 * cross-fade rather than disabling the interaction.
 *
 * The outbound link ALWAYS goes to /go/[id], never to the marketplace URL
 * directly. That route is what records the click and attaches affiliate
 * attribution, so a card that linked straight out would silently cost revenue
 * and lose the analytics at the same time.
 */
export function ListingCard({ hit }: { hit: SearchHit }) {
  const [flipped, setFlipped] = useState(false)
  const margin = formatMargin(hit.dealMargin)
  const age = timeAgo(hit.listedAt)
  const gearName = [hit.gearBrand, hit.gearModel].filter(Boolean).join(" ")

  return (
    <article className="flip-card h-full" data-flipped={flipped}>
      <div className="flip-card-inner h-full">
        {/* Front */}
        <div className="flip-face flip-face-front panel flex h-full flex-col overflow-hidden">
          <div className="relative">
            <ListingImage src={hit.primaryImageUrl} alt={hit.title} className="h-64 w-full sm:h-72" />
            {hit.isDeal && margin && (
              <div className="absolute left-2 top-2">
                <Badge variant="deal">{margin} below market</Badge>
              </div>
            )}
            <div className="absolute right-2 top-2">
              <Badge variant="source">{sourceLabel(hit.source)}</Badge>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 p-3">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--cream)]">
              {hit.title}
            </h3>

            <div className="mt-auto space-y-2 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-[var(--cream)]">
                    {formatPrice(hit.priceCents, hit.currency)}
                  </span>
                  {hit.isDeal && hit.marketPriceCents != null && (
                    <span className="text-xs text-[var(--muted-foreground)] line-through">
                      {formatPrice(hit.marketPriceCents, hit.currency)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="shrink-0 text-xs text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--amber)] hover:underline"
                  aria-label={`Show details for ${hit.title}`}
                >
                  Details
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                {hit.condition && <Badge>{hit.condition}</Badge>}
                {hit.isLocalPickup ? (
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

              <a
                href={`/go/${hit.id}`}
                rel="nofollow sponsored noopener"
                target="_blank"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--amber-soft)]"
              >
                View on {sourceLabel(hit.source)}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>

              <AddToCartButton
                item={{
                  listingId: hit.id,
                  source: hit.source as Source,
                  title: hit.title,
                  priceCents: hit.priceCents,
                  currency: hit.currency,
                  image: hit.primaryImageUrl,
                }}
              />
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="flip-face flip-face-back panel flex h-full flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2.5 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-3 text-sm font-medium leading-snug text-[var(--cream)]">
                {hit.title}
              </h3>
              <Badge variant="source">{sourceLabel(hit.source)}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {hit.brand && (
                <div>
                  <dt className="text-[var(--muted-foreground)]">Brand</dt>
                  <dd className="text-[var(--cream)]">{hit.brand}</dd>
                </div>
              )}
              {hit.condition && (
                <div>
                  <dt className="text-[var(--muted-foreground)]">Condition</dt>
                  <dd className="text-[var(--cream)]">{hit.condition}</dd>
                </div>
              )}
              <div>
                <dt className="text-[var(--muted-foreground)]">Delivery</dt>
                <dd className="text-[var(--cream)]">{hit.isLocalPickup ? "Local pickup" : "Ships"}</dd>
              </div>
              {hit.marketPriceCents != null && (
                <div>
                  <dt className="text-[var(--muted-foreground)]">Market price</dt>
                  <dd className="text-[var(--cream)]">{formatPrice(hit.marketPriceCents, hit.currency)}</dd>
                </div>
              )}
            </dl>

            {hit.description ? (
              <p className="line-clamp-6 flex-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {hit.description}
              </p>
            ) : (
              <p className="flex-1 text-xs italic text-[var(--muted-foreground)]">
                No description published for this listing.
              </p>
            )}

            {hit.gearSlug && gearName && (
              <Link
                href={`/gear/${hit.gearSlug}`}
                className="w-fit text-xs text-[var(--amber)] underline-offset-2 hover:underline"
              >
                Compare all {gearName} listings
              </Link>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
              <span className="text-sm font-semibold text-[var(--cream)]">
                {formatPrice(hit.priceCents, hit.currency)}
              </span>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--cream)] hover:bg-[var(--secondary)]"
                aria-label="Back to photo"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Skeleton used while a search streams in, sized to match the real card. */
export function ListingCardSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden="true">
      <div className="h-64 w-full animate-pulse bg-[var(--muted)] sm:h-72" />
      <div className="space-y-3 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--muted)]" />
      </div>
    </div>
  )
}
