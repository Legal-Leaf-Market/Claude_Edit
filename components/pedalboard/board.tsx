"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ArrowRight, ChevronRight, GripVertical, X } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import { fallbackImageryFor } from "@/lib/board/pedal-render"
import { EFFECTS, EFFECT_TYPES, type EffectType } from "@/lib/pedalboard/chain"
import { formatPrice, sourceLabel } from "@/lib/utils"
import type { PedalSourceAvailability } from "@/lib/pedalboard/queries"

/**
 * One slot on the board.
 *
 * `slug` is null for an off-catalogue pedal: a real pedal from a documented
 * rig that nobody we track currently stocks. It still occupies a slot, still
 * counts towards the chain analysis and the power estimate, and says so.
 */
export type BoardSlot = {
  key: string
  brand: string
  model: string
  type: EffectType
  slug: string | null
  imageUrl: string | null
  marketPriceCents: number | null
  sampleSize: number
  bySource: PedalSourceAvailability[]
  loading?: boolean
  /** Why this pedal is on the board, when it came from a documented rig. */
  role?: string
}

export function Board({
  slots,
  highlightKeys,
  onRemove,
  onMove,
  onReorder,
  onRetype,
}: {
  slots: BoardSlot[]
  /** Slots the chain analysis has something to say about. */
  highlightKeys: Set<string>
  onRemove: (key: string) => void
  onMove: (index: number, direction: -1 | 1) => void
  onReorder: (from: number, to: number) => void
  onRetype: (key: string, type: EffectType) => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (slots.length === 0) {
    return (
      <div className="pedalboard-surface flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-display text-lg font-bold text-[var(--text)]">Empty board.</p>
        <p className="max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">
          Search for a pedal above, or load one of the documented rigs. Once there are two on here
          it will start checking the order, and once there are three it will size a power supply.
        </p>
      </div>
    )
  }

  function endDrag() {
    setDraggingIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="pedalboard-surface overflow-x-auto p-4 sm:p-6">
      <ol className="flex items-stretch gap-2 sm:gap-2.5">
        {slots.map((slot, index) => (
          <li key={slot.key} className="flex items-stretch gap-2 sm:gap-2.5">
            <PedalSlot
              slot={slot}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === slots.length - 1}
              flagged={highlightKeys.has(slot.key)}
              dragging={draggingIndex === index}
              dropTarget={overIndex === index && draggingIndex !== null && draggingIndex !== index}
              onRemove={() => onRemove(slot.key)}
              onMoveLeft={() => onMove(index, -1)}
              onMoveRight={() => onMove(index, 1)}
              onRetype={(type) => onRetype(slot.key, type)}
              onDragStart={() => setDraggingIndex(index)}
              onDragEnter={() => setOverIndex(index)}
              onDrop={() => {
                if (draggingIndex !== null && draggingIndex !== index) {
                  onReorder(draggingIndex, index)
                }
                endDrag()
              }}
              onDragEnd={endDrag}
            />
            {index < slots.length - 1 && (
              <div className="chain-arrow" aria-hidden="true">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function PedalSlot({
  slot,
  position,
  isFirst,
  isLast,
  flagged,
  dragging,
  dropTarget,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onRetype,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: {
  slot: BoardSlot
  position: number
  isFirst: boolean
  isLast: boolean
  flagged: boolean
  dragging: boolean
  dropTarget: boolean
  onRemove: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onRetype: (type: EffectType) => void
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const meta = EFFECTS[slot.type]
  const cheapest = slot.bySource[0]
  const cheapestCents =
    cheapest != null
      ? Math.min(cheapest.cheapestNewCents ?? Infinity, cheapest.cheapestUsedCents ?? Infinity)
      : null

  return (
    <div
      draggable
      onDragStart={(event) => {
        // Firefox refuses to start a drag without data on the transfer object.
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", slot.key)
        onDragStart()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
      data-dragging={dragging}
      data-droptarget={dropTarget}
      className="pedal-slot flex w-[188px] shrink-0 flex-col sm:w-[208px]"
      style={{ "--slot-hue": meta.hue } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-2 py-1.5">
        <GripVertical
          className="h-3.5 w-3.5 shrink-0 cursor-grab text-[var(--dim)]"
          aria-hidden="true"
        />
        <span className="font-display text-[11px] font-bold text-[var(--dim)]">{position}</span>

        {/* The type is a guess from the pedal's name, so it has to be
            correctable. A wrong guess would otherwise produce a confidently
            wrong chain warning, which is worse than no warning at all. */}
        <label className="sr-only" htmlFor={`type-${slot.key}`}>
          Effect type for {slot.brand} {slot.model}
        </label>
        <select
          id={`type-${slot.key}`}
          value={slot.type}
          onChange={(event) => onRetype(event.target.value as EffectType)}
          className="min-w-0 flex-1 cursor-pointer truncate rounded border-0 bg-transparent text-[11px] font-semibold uppercase tracking-wide focus:outline-none"
          style={{ color: meta.hue }}
        >
          {EFFECT_TYPES.map((type) => (
            <option key={type} value={type} className="bg-[var(--popover)] text-[var(--text)]">
              {EFFECTS[type].label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${slot.brand} ${slot.model} from the board`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--dim)] transition-colors hover:text-[var(--text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ListingImage
        src={slot.imageUrl}
        alt={`${slot.brand} ${slot.model}`}
        className="h-24 w-full"
        {...fallbackImageryFor(slot.brand, slot.model)}
        fallbackLabel={meta.label}
        fallbackHue={meta.hue}
      />

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div>
          <p className="card-title line-clamp-2 text-[var(--text)]">
            {slot.brand} {slot.model}
          </p>
          {slot.role && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-[var(--muted-foreground)]">
              {slot.role}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-1.5 border-t border-[var(--line)] pt-2">
          {slot.loading ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">Checking stores...</p>
          ) : cheapestCents != null && Number.isFinite(cheapestCents) ? (
            <>
              <p className="card-price text-[17px]">{formatPrice(cheapestCents)}</p>
              {slot.bySource.slice(0, 2).map((source) => (
                <div key={source.source} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">
                    {sourceLabel(source.source)}
                  </span>
                  <span className="shrink-0 text-[var(--dim)]">
                    {source.cheapestNewCents != null && `new ${formatPrice(source.cheapestNewCents)}`}
                    {source.cheapestNewCents != null && source.cheapestUsedCents != null && " · "}
                    {source.cheapestUsedCents != null && `used ${formatPrice(source.cheapestUsedCents)}`}
                  </span>
                </div>
              ))}
              {slot.bySource.length > 2 && (
                <p className="text-[11px] text-[var(--dim)]">
                  +{slot.bySource.length - 2} more{" "}
                  {slot.bySource.length - 2 === 1 ? "store" : "stores"}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
              {slot.marketPriceCents != null
                ? `Around ${formatPrice(slot.marketPriceCents)} used, none listed right now.`
                : "Nobody we track has one listed."}
            </p>
          )}
        </div>

        {slot.slug ? (
          <Link
            href={`/gear/${slot.slug}`}
            className="text-[11px] font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            Compare listings
          </Link>
        ) : (
          <Link
            href={`/search?q=${encodeURIComponent(`${slot.brand} ${slot.model}`)}`}
            className="text-[11px] font-semibold text-[var(--dim)] underline-offset-2 hover:underline"
          >
            Search the whole site
          </Link>
        )}

        <div className="flex gap-1 border-t border-[var(--line)] pt-2">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={isFirst}
            aria-label={`Move ${slot.brand} ${slot.model} earlier in the chain`}
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-[var(--line)] text-[var(--dim)] transition-colors disabled:opacity-25 enabled:hover:bg-[var(--secondary)] enabled:hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={isLast}
            aria-label={`Move ${slot.brand} ${slot.model} later in the chain`}
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-[var(--line)] text-[var(--dim)] transition-colors disabled:opacity-25 enabled:hover:bg-[var(--secondary)] enabled:hover:text-[var(--text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {flagged && (
        <div
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent-text)]"
          aria-hidden="true"
          title="This slot has a note below"
        />
      )}
    </div>
  )
}
