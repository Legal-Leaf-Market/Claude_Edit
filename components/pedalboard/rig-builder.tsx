"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Check,
  Copy,
  Info,
  Plug,
  ShoppingCart,
  Trash2,
  Wand2,
} from "lucide-react"
import { Board, type BoardSlot } from "./board"
import { PedalSearch } from "./pedal-search"
import { RigPicker } from "./rig-picker"
import { BoardPlanner } from "./board-planner"
import { useCart } from "@/lib/cart/context"
import {
  analyzeChain,
  EFFECTS,
  estimatePower,
  type ChainItem,
  type EffectType,
} from "@/lib/pedalboard/chain"
import { encodeBoard, MAX_SLOTS, type BoardSlotInput } from "@/lib/pedalboard/board-url"
import type { PedalBoardEntry, PedalSummary } from "@/lib/pedalboard/queries"
import type { Source } from "@/lib/db/schema"
import { formatPrice } from "@/lib/utils"

/**
 * The rig builder.
 *
 * The state model is one array of slots. Everything else (the chain notes, the
 * power estimate, the running cost, the URL) is derived from it on every
 * render rather than stored alongside it, so there is exactly one thing that
 * can be wrong and it is visible on screen. The previous version kept a slug
 * array and a separate detail map, which meant a slug could exist with no
 * entry and the board would silently drop a pedal.
 *
 * Slot keys, not indexes, identify a slot everywhere outside the reorder
 * handlers. Indexes shift the moment anything moves, and a note attached to
 * index 3 pointing at the wrong pedal is exactly the kind of bug that makes a
 * tool feel untrustworthy.
 */

export function RigBuilder({
  initialSlots,
  suggestions,
}: {
  initialSlots: BoardSlot[]
  suggestions: PedalSummary[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { addItem } = useCart()

  const [slots, setSlots] = useState<BoardSlot[]>(initialSlots)
  const [copied, setCopied] = useState(false)
  const [added, setAdded] = useState(false)

  /**
   * Push the board into the URL, replacing rather than pushing.
   *
   * Replace, because every add, remove and drag would otherwise be a history
   * entry, and a shopper who built an eight pedal board would need eight
   * presses of back to leave the page.
   */
  const syncUrl = useCallback(
    (next: BoardSlot[]) => {
      const encoded = encodeBoard(next.map(toSlotInput))
      router.replace(encoded ? `${pathname}?board=${encoded}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const update = useCallback(
    (next: BoardSlot[]) => {
      setSlots(next)
      syncUrl(next)
    },
    [syncUrl],
  )

  /** Look up live availability for slots that do not have it yet. */
  const hydrate = useCallback((keys: string[], slugs: string[]) => {
    if (slugs.length === 0) return
    fetch(`/api/pedalboard/board?slugs=${encodeURIComponent(slugs.join(","))}`)
      .then((res) => res.json())
      .then((data: { pedals: PedalBoardEntry[] }) => {
        const bySlug = new Map(data.pedals.map((p) => [p.slug, p]))
        setSlots((prev) =>
          prev.map((slot) => {
            if (!keys.includes(slot.key)) return slot
            const detail = slot.slug ? bySlug.get(slot.slug) : undefined
            if (!detail) return { ...slot, loading: false }
            return {
              ...slot,
              imageUrl: detail.imageUrl ?? slot.imageUrl,
              marketPriceCents: detail.marketPriceCents,
              sampleSize: detail.sampleSize,
              bySource: detail.bySource,
              loading: false,
            }
          }),
        )
      })
      .catch(() => {
        setSlots((prev) =>
          prev.map((slot) => (keys.includes(slot.key) ? { ...slot, loading: false } : slot)),
        )
      })
  }, [])

  const addPedal = useCallback(
    (pedal: PedalSummary) => {
      setSlots((prev) => {
        if (prev.some((s) => s.key === pedal.slug) || prev.length >= MAX_SLOTS) return prev
        const next = [
          ...prev,
          {
            key: pedal.slug,
            brand: pedal.brand,
            model: pedal.model,
            type: pedal.type,
            slug: pedal.slug,
            imageUrl: pedal.imageUrl,
            marketPriceCents: pedal.marketPriceCents,
            sampleSize: pedal.sampleSize,
            bySource: [],
            loading: true,
          } satisfies BoardSlot,
        ]
        syncUrl(next)
        return next
      })
      hydrate([pedal.slug], [pedal.slug])
    },
    [hydrate, syncUrl],
  )

  /**
   * Replace the whole board with a documented rig.
   *
   * Replace rather than append: "load Gilmour's board" means that board, and
   * merging it into whatever was already there produces a chain nobody asked
   * for. Clearing is one click away if that was the wrong call.
   */
  const loadRig = useCallback(
    (rigSlots: BoardSlot[]) => {
      update(rigSlots)
      const withSlugs = rigSlots.filter((s) => s.slug)
      hydrate(
        withSlugs.map((s) => s.key),
        withSlugs.map((s) => s.slug as string),
      )
    },
    [hydrate, update],
  )

  const removeSlot = useCallback(
    (key: string) => update(slots.filter((s) => s.key !== key)),
    [slots, update],
  )

  const moveSlot = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (target < 0 || target >= slots.length) return
      const next = [...slots]
      ;[next[index], next[target]] = [next[target], next[index]]
      update(next)
    },
    [slots, update],
  )

  const reorder = useCallback(
    (from: number, to: number) => {
      const next = [...slots]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      update(next)
    },
    [slots, update],
  )

  const retype = useCallback(
    (key: string, type: EffectType) =>
      update(slots.map((slot) => (slot.key === key ? { ...slot, type } : slot))),
    [slots, update],
  )

  const sortToConvention = useCallback(() => {
    update([...slots].sort((a, b) => EFFECTS[a.type].rank - EFFECTS[b.type].rank))
  }, [slots, update])

  const clear = useCallback(() => update([]), [update])

  /* ---------------------------------------------------------------- */
  /*  Everything derived                                              */
  /* ---------------------------------------------------------------- */

  const chainItems: ChainItem[] = useMemo(
    () => slots.map((s) => ({ key: s.key, brand: s.brand, model: s.model, type: s.type })),
    [slots],
  )

  const analysis = useMemo(() => analyzeChain(chainItems), [chainItems])
  const power = useMemo(() => estimatePower(chainItems), [chainItems])
  const flaggedKeys = useMemo(
    () => new Set(analysis.notes.map((n) => n.key)),
    [analysis.notes],
  )

  /**
   * What the board costs, and how much of it that number actually covers.
   *
   * Two separate honesty problems, both surfaced rather than smoothed over.
   * A slot with a live listing is priced at the cheapest one; a slot with only
   * a measured median is priced at the median and counted as an estimate; a
   * slot with neither is not priced at all and is counted as unknown. Adding
   * an unpriced pedal in as zero would understate the board, which on a price
   * comparison site is the one direction the error must never go.
   */
  const cost = useMemo(() => {
    let live = 0
    let estimated = 0
    let liveCount = 0
    let estimatedCount = 0
    let unknownCount = 0

    for (const slot of slots) {
      const cheapest = slot.bySource[0]
      const cheapestCents = cheapest
        ? Math.min(cheapest.cheapestNewCents ?? Infinity, cheapest.cheapestUsedCents ?? Infinity)
        : Infinity

      if (Number.isFinite(cheapestCents)) {
        live += cheapestCents
        liveCount++
      } else if (slot.marketPriceCents != null) {
        estimated += slot.marketPriceCents
        estimatedCount++
      } else {
        unknownCount++
      }
    }

    return { live, estimated, total: live + estimated, liveCount, estimatedCount, unknownCount }
  }, [slots])

  /** Slots with a real listing behind them, which is what the cart can take. */
  const buyable = useMemo(
    () =>
      slots.flatMap((slot) => {
        const source = slot.bySource[0]
        if (!source?.cheapestListingId) return []
        const priceCents = Math.min(
          source.cheapestNewCents ?? Infinity,
          source.cheapestUsedCents ?? Infinity,
        )
        if (!Number.isFinite(priceCents)) return []
        return [
          {
            listingId: source.cheapestListingId,
            source: source.source as Source,
            title: `${slot.brand} ${slot.model}`,
            priceCents,
            currency: "USD",
            image: slot.imageUrl,
          },
        ]
      }),
    [slots],
  )

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), 2500)
    return () => clearTimeout(timer)
  }, [added])

  function share() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => setCopied(true))
      .catch(() => {})
  }

  function addBoardToCart() {
    for (const item of buyable) addItem(item)
    setAdded(true)
  }

  const usedKeys = useMemo(() => new Set(slots.map((s) => s.key)), [slots])

  return (
    <div className="space-y-6">
      <RigPicker onLoad={loadRig} />

      <PedalSearch suggestions={suggestions} onAdd={addPedal} disabledSlugs={usedKeys} />

      <Board
        slots={slots}
        highlightKeys={flaggedKeys}
        onRemove={removeSlot}
        onMove={moveSlot}
        onReorder={reorder}
        onRetype={retype}
      />

      {slots.length >= MAX_SLOTS && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {MAX_SLOTS} is the limit here. Past that it is a rack, not a pedalboard.
        </p>
      )}

      {slots.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ---- Chain ---- */}
          <section id="chain" className="panel lg:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-black text-[var(--text)]">Signal chain</h2>
              {!analysis.inConventionalOrder && slots.length > 1 && (
                <button
                  type="button"
                  onClick={sortToConvention}
                  className="pill"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Sort to the usual order
                </button>
              )}
            </div>

            {analysis.notes.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {slots.length < 2
                  ? "Add another pedal and this will start checking the order."
                  : "Nothing out of the ordinary. This runs in the order most players would expect, which mostly means it will behave predictably rather than that it is the only right answer."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {analysis.notes.map((note, index) => (
                  <li key={`${note.key}-${index}`} className="chain-note">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
                    <span>{note.message}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
              The conventional order is a convention, not a rule. Fuzz after a wah, delay into
              distortion and reverb first are all deliberate, recorded choices. Nothing here moves
              your board on its own.
            </p>
          </section>

          {/* ---- Power ---- */}
          <section id="power" className="panel">
            <h2 className="flex items-center gap-2 font-display text-lg font-black text-[var(--text)]">
              <Plug className="h-4 w-4 text-[var(--copper)]" aria-hidden="true" />
              Power
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[var(--muted-foreground)]">Estimated draw</dt>
                <dd className="font-display text-lg font-black text-[var(--text)]">
                  ~{power.totalMa}mA
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[var(--muted-foreground)]">Isolated outputs</dt>
                <dd className="font-semibold text-[var(--text)]">{power.outputsNeeded}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[var(--muted-foreground)]">Supply to look for</dt>
                <dd className="font-semibold text-[var(--money)]">{power.recommendedSupplyMa}mA+</dd>
              </div>
            </dl>
            {power.highDrawCount > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {power.highDrawCount} of these draw enough to want an output of their own rather
                than a daisy chain.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
              These are typical draws for each kind of effect, not the spec of these exact pedals.
              Check the maker&apos;s own figure before you buy a supply.
            </p>
          </section>

          {/* ---- Cost ---- */}
          <section id="cost" className="panel lg:col-span-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-black text-[var(--text)]">
                  What this board costs
                </h2>
                <p className="mt-1 font-display text-3xl font-black text-[var(--money)]">
                  {cost.total > 0 ? formatPrice(cost.total) : "Not enough data to price it"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {[
                    cost.liveCount > 0 &&
                      `${cost.liveCount} priced from listings that are live right now`,
                    cost.estimatedCount > 0 &&
                      `${cost.estimatedCount} estimated from the measured used median`,
                    cost.unknownCount > 0 &&
                      `${cost.unknownCount} not priced at all, and not included in the total`,
                  ]
                    .filter(Boolean)
                    .join(". ") || "Nothing on this board has a price we can stand behind yet."}
                  .
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {buyable.length > 0 && (
                  <button type="button" onClick={addBoardToCart} className="pill">
                    {added ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {added
                      ? "Added"
                      : `Add ${buyable.length} in stock to cart`}
                  </button>
                )}
                <button type="button" onClick={share} className="pill">
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Link copied" : "Copy link to this board"}
                </button>
                <button type="button" onClick={clear} className="pill">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              </div>
            </div>

            {cost.unknownCount > 0 && (
              <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                A pedal with no price here is not out of production. It just is not currently for
                sale from any of the stores this site tracks, and the feeds that are live carry
                small independent makers rather than the legacy brands most documented rigs are
                built from.{" "}
                <Link href="/list-your-shop" className="text-[var(--accent-text)] underline-offset-2 hover:underline">
                  Know a shop that should be here?
                </Link>
              </p>
            )}
          </section>
        </div>
      )}

      {/*
        The physical half: what fits, what powers it, what to patch it with.
        Below the chain rather than replacing it, because the two answer
        different questions. The chain is "will this sound right in this
        order"; the planner is "will this actually go on a board and switch
        on". Every tool worth comparing against does the second and none of
        them does both.
      */}
      <BoardPlanner
        slots={slots.map((slot) => ({
          key: slot.key,
          brand: slot.brand,
          model: slot.model,
          type: slot.type,
        }))}
      />
    </div>
  )
}

function toSlotInput(slot: BoardSlot): BoardSlotInput {
  return slot.slug
    ? { kind: "gear", slug: slot.slug }
    : { kind: "off", brand: slot.brand, model: slot.model }
}
