"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, MapPin, RotateCcw, Truck } from "lucide-react"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { Badge } from "@/components/ui/badge"
import { ListingImage } from "./listing-image"
import { renderForGear } from "@/lib/board/pedal-render"
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

  /*
   * A MEASURED MODEL WHERE THE SELLER GAVE US NOTHING.
   *
   * Keyed off the resolved canonical gear rather than the listing title, so it
   * inherits the resolver's judgement instead of guessing from marketing prose:
   * a title reading "Boss DS-1 Distortion Pedal Bundle w/ Cables" is not a
   * picture of a DS-1 alone, and `canonical_gear` is where "this listing is
   * that instrument" has already been decided once, properly.
   */
  const modelled = renderForGear(hit.gearBrand, hit.gearModel)

  return (
    <article className="flip-card h-full" data-flipped={flipped}>
      <div className="flip-card-inner h-full">
        {/* Front */}
        <div
          className="flip-face flip-face-front card-face card-face-front flex h-full flex-col overflow-hidden"
          data-best={hit.isDeal ? "true" : undefined}
        >
          <div className="relative">
            <ListingImage
              src={hit.primaryImageUrl}
              alt={hit.title}
              modelled={modelled}
              className="h-64 w-full sm:h-72"
            />
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
            <h3 className="card-title line-clamp-2 text-[var(--cream)]">{hit.title}</h3>

            <div className="mt-auto space-y-2 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="card-price">{formatPrice(hit.priceCents, hit.currency)}</span>
                  {hit.isDeal && hit.marketPriceCents != null && (
                    <span className="text-xs text-[var(--muted-foreground)] line-through">
                      {formatPrice(hit.marketPriceCents, hit.currency)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="shrink-0 text-xs text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent-text)] hover:underline"
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
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-[var(--sage-dk)] to-[var(--sage)] text-[13px] font-bold tracking-[0.02em] text-[#04140a] shadow-[0_4px_14px_rgba(34,197,94,.2)] transition-all hover:brightness-110 hover:shadow-[0_6px_20px_rgba(34,197,94,.35)]"
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
        <div className="flip-face flip-face-back card-face card-face-back flex h-full flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2.5 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="card-title line-clamp-3 text-[var(--cream)]">
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
                className="w-fit text-xs text-[var(--accent-text)] underline-offset-2 hover:underline"
              >
                Compare all {gearName} listings
              </Link>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
              <span className="card-price text-[17px]">
                {formatPrice(hit.priceCents, hit.currency)}
              </span>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:border-[var(--chrome-dk)] hover:text-[var(--accent-text)]"
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
    <div className="card-face overflow-hidden" aria-hidden="true">
      <div className="h-64 w-full animate-pulse bg-[var(--muted)] sm:h-72" />
      <div className="space-y-3 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-10 w-full animate-pulse rounded-[10px] bg-[var(--muted)]" />
      </div>
    </div>
  )
}
