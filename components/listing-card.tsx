import Link from "next/link"
import { ExternalLink, MapPin, Truck } from "lucide-react"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { Badge } from "@/components/ui/badge"
import { ListingImage } from "./listing-image"
import { formatMargin, formatPrice, sourceLabel, timeAgo } from "@/lib/utils"
import type { Source } from "@/lib/db/schema"
import type { SearchHit } from "@/lib/search/types"

/**
 * A single listing.
 *
 * The outbound link ALWAYS goes to /go/[id], never to the marketplace URL
 * directly. That route is what records the click and attaches affiliate
 * attribution, so a card that linked straight out would silently cost revenue
 * and lose the analytics at the same time.
 */
export function ListingCard({ hit }: { hit: SearchHit }) {
  const margin = formatMargin(hit.dealMargin)
  const age = timeAgo(hit.listedAt)
  const gearName = [hit.gearBrand, hit.gearModel].filter(Boolean).join(" ")

  return (
    <article className="panel group flex flex-col overflow-hidden transition-colors hover:border-[var(--amber)]/40">
      <div className="relative">
        <ListingImage
          src={hit.primaryImageUrl}
          alt={hit.title}
          className="h-44 w-full sm:h-48"
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
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--cream)]">
          {hit.title}
        </h3>

        {hit.gearSlug && gearName && (
          <Link
            href={`/gear/${hit.gearSlug}`}
            className="w-fit text-xs text-[var(--amber)] underline-offset-2 hover:underline"
          >
            Compare all {gearName} listings
          </Link>
        )}

        <div className="mt-auto space-y-2 pt-1">
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
    </article>
  )
}

/** Skeleton used while a search streams in, sized to match the real card. */
export function ListingCardSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden="true">
      <div className="h-44 w-full animate-pulse bg-[var(--muted)] sm:h-48" />
      <div className="space-y-3 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--muted)]" />
      </div>
    </div>
  )
}
