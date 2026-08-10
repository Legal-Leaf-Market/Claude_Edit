"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import { formatPrice, sourceLabel } from "@/lib/utils"
import type { PedalBoardEntry } from "@/lib/pedalboard/queries"

export type BoardEntry = PedalBoardEntry & { loading?: boolean }

export function Board({
  entries,
  onRemove,
  onMove,
}: {
  entries: BoardEntry[]
  onRemove: (slug: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}) {
  if (entries.length === 0) {
    return (
      <div className="pedalboard-surface flex min-h-48 flex-col items-center justify-center gap-1.5 p-8 text-center">
        <p className="text-sm font-medium text-[var(--cream)]">Nothing on the board yet.</p>
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
          Search for a pedal above to start your chain. Order matters for tone, not for the price
          check, so arrange them however you would actually run them.
        </p>
      </div>
    )
  }

  return (
    <div className="pedalboard-surface flex flex-wrap items-stretch gap-2 p-4 sm:gap-3 sm:p-6">
      {entries.map((entry, index) => (
        <div key={entry.slug} className="flex items-stretch gap-2 sm:gap-3">
          <PedalSlot
            entry={entry}
            position={index + 1}
            isFirst={index === 0}
            isLast={index === entries.length - 1}
            onRemove={() => onRemove(entry.slug)}
            onMoveLeft={() => onMove(index, -1)}
            onMoveRight={() => onMove(index, 1)}
          />
          {index < entries.length - 1 && (
            <div
              className="hidden w-6 shrink-0 items-center justify-center text-[var(--muted-foreground)] sm:flex"
              aria-hidden="true"
            >
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PedalSlot({
  entry,
  position,
  isFirst,
  isLast,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  entry: BoardEntry
  position: number
  isFirst: boolean
  isLast: boolean
  onRemove: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
}) {
  const cheapest = entry.bySource[0]
  const cheapestCents =
    cheapest != null
      ? Math.min(cheapest.cheapestNewCents ?? Infinity, cheapest.cheapestUsedCents ?? Infinity)
      : null

  return (
    <div className="panel relative flex w-48 shrink-0 flex-col overflow-hidden sm:w-56">
      <div className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card)] text-[10px] font-semibold text-[var(--muted-foreground)]">
        {position}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entry.brand} ${entry.model} from the board`}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--cream)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <ListingImage src={entry.imageUrl} alt={`${entry.brand} ${entry.model}`} className="h-28 w-full" />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--cream)]">
            {entry.brand} {entry.model}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {entry.marketPriceCents != null
              ? `~${formatPrice(entry.marketPriceCents)} market`
              : "Not enough data yet"}
          </p>
        </div>

        <div className="mt-1 flex-1 space-y-1.5 border-t border-[var(--border)] pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {entry.loading
              ? "Checking availability..."
              : cheapestCents != null
                ? `In stock, from ${formatPrice(cheapestCents)}`
                : "Not currently in stock"}
          </p>
          {!entry.loading &&
            entry.bySource.slice(0, 3).map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-[var(--cream)]">{sourceLabel(s.source)}</span>
                <span className="shrink-0 text-[var(--muted-foreground)]">
                  {s.cheapestNewCents != null && `New ${formatPrice(s.cheapestNewCents)}`}
                  {s.cheapestNewCents != null && s.cheapestUsedCents != null && " · "}
                  {s.cheapestUsedCents != null && `Used ${formatPrice(s.cheapestUsedCents)}`}
                </span>
              </div>
            ))}
          {!entry.loading && entry.bySource.length > 3 && (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              +{entry.bySource.length - 3} more {entry.bySource.length - 3 === 1 ? "store" : "stores"}
            </p>
          )}
        </div>

        <Link
          href={`/gear/${entry.slug}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--amber)] underline-offset-2 hover:underline"
        >
          Compare listings
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>

        <div className="mt-1 flex gap-1.5 border-t border-[var(--border)] pt-2">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={isFirst}
            aria-label="Move earlier in the chain"
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:bg-[var(--secondary)] enabled:hover:text-[var(--cream)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={isLast}
            aria-label="Move later in the chain"
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:bg-[var(--secondary)] enabled:hover:text-[var(--cream)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
