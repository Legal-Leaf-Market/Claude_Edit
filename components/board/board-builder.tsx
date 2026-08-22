"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Plus, Share2, ShoppingCart, X } from "lucide-react"
import { Stomp } from "@/components/ui/stomp"
import { PedalEnclosure } from "@/components/board/pedal-enclosure"
import { AttendantPanel } from "@/components/board/attendant-panel"
import {
  effectTypeOf,
  itemFromCatalog,
  itemFromGuide,
  MAX_ITEMS,
  orderBoard,
  slotLabel,
  type BoardCommerce,
  type BoardItem,
  type CatalogInput,
} from "@/lib/board/model"
import { decodeBoard, encodeBoard, resolveBoard } from "@/lib/board/share"
import { PEDALS } from "@/lib/stompbox/pedals"
import type { SlotId } from "@/lib/stompbox/chain"

/**
 * THE BOARD, and it is the same component on both domains.
 *
 * There were two of these. The aggregator's knew about live stock, artist rigs
 * and power; the guide's knew what each circuit does and drew the pedals. This
 * is one builder with both, mounted at /pedalboard and at /stompbox/board.
 *
 * THE INTERACTION MODEL IS LEGO, and that is a design instruction rather than a
 * metaphor. Players do not assemble a board once; they swap things in and out
 * constantly, and the thing they do most often is try a DIFFERENT pedal in a
 * slot they have already decided on. So SWAP is a first-class control sitting
 * on every pedal, not remove-then-search-again. Everything else follows from
 * that: nothing confirms, nothing is destructive, the URL keeps up so a board
 * survives a paste, and bypass leaves the pedal on the board rather than
 * taking it away.
 *
 * COMMERCE ARRIVES AS A PROP AND IS NEVER FETCHED HERE. On gearavail.com the
 * page passes prices, stores and /go links; on stompbox.world it passes
 * nothing and the same component renders a planner. That is what section 20's
 * redistribution rule requires, and doing it with a prop rather than a second
 * component is what stops the two drifting apart again.
 */
export function BoardBuilder({
  catalog,
  commerce = {},
  /** Where a buy link points. Absent on the guide, which sells nothing. */
  gearHrefBase = null,
  rigs = [],
  initial = [],
}: {
  catalog: CatalogInput[]
  commerce?: BoardCommerce
  gearHrefBase?: string | null
  /** Documented artist boards, as starting points. */
  rigs?: { slug: string; name: string; context: string; pedals: string[] }[]
  initial?: BoardItem[]
}) {
  const [items, setItems] = useState<BoardItem[]>(initial)
  const [query, setQuery] = useState("")
  /** Which slot the picker is filling. Null means it is closed. */
  const [picking, setPicking] = useState<{ slot: SlotId | null; replacing: string | null } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  /* Open whatever was in the link, once. Read off window rather than through
     useSearchParams: the hook opts the whole route into dynamic rendering, and
     a visitor's board is not this page's indexable content anyway. */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("b")
    const restored = resolveBoard(decodeBoard(raw), catalog)
    if (restored.length > 0) setItems(restored)
  }, [catalog])

  /* Keep the address bar in step without stacking history: adding six pedals
     should not mean pressing back six times to leave. */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (items.length > 0) url.searchParams.set("b", encodeBoard(items))
    else url.searchParams.delete("b")
    window.history.replaceState(null, "", url)
    setCopied(false)
  }, [items])

  const ordered = useMemo(() => orderBoard(items), [items])
  const onBoard = useMemo(() => new Set(items.map((i) => i.key)), [items])
  const full = items.length >= MAX_ITEMS

  const add = useCallback((item: BoardItem | null) => {
    if (!item) return
    setItems((current) => {
      if (current.length >= MAX_ITEMS) return current
      if (current.some((entry) => entry.key === item.key)) return current
      return [...current, item]
    })
  }, [])

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((entry) => entry.key !== key))
  }, [])

  const toggle = useCallback((key: string) => {
    setItems((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, engaged: !entry.engaged } : entry)),
    )
  }, [])

  /**
   * SWAP: put a different pedal in the place this one holds.
   *
   * The replacement keeps the outgoing pedal's POSITION in the array rather
   * than being appended, so a swap does not quietly reorder a board somebody
   * has already arranged. It also keeps its engaged state, because swapping a
   * bypassed drive for another drive should not switch it on underneath you.
   */
  const swap = useCallback((outgoingKey: string, incoming: BoardItem | null) => {
    if (!incoming) return
    setItems((current) => {
      const at = current.findIndex((entry) => entry.key === outgoingKey)
      if (at < 0) return current
      if (current.some((entry) => entry.key === incoming.key && entry.key !== outgoingKey)) {
        return current
      }
      const next = [...current]
      next[at] = { ...incoming, engaged: current[at].engaged }
      return next
    })
  }, [])

  const loadRig = useCallback(
    (rig: { pedals: string[] }) => {
      /* Match each documented pedal to a real product where one exists, and
         fall back to the guide entry where it does not, so a rig loads whole
         rather than half. */
      const built: BoardItem[] = []
      for (const name of rig.pedals) {
        const needle = name.toLowerCase()
        const product = catalog.find((entry) =>
          `${entry.brand} ${entry.model}`.toLowerCase().includes(needle),
        )
        const item = product
          ? itemFromCatalog(product)
          : (() => {
              const pedal = PEDALS.find((p) => `${p.maker} ${p.name}`.toLowerCase().includes(needle))
              return pedal ? itemFromGuide(pedal) : null
            })()
        if (item && !built.some((b) => b.key === item.key)) built.push(item)
      }
      setItems(built.slice(0, MAX_ITEMS))
    },
    [catalog],
  )

  /** Candidates for the picker, narrowed to the slot when swapping. */
  const candidates = useMemo(() => {
    const slot = picking?.slot ?? null
    const needle = query.trim().toLowerCase()

    const fromCatalog = catalog
      .map((entry) => itemFromCatalog(entry))
      .filter((item): item is BoardItem => item !== null)
    const fromGuide = PEDALS.map((pedal) => itemFromGuide(pedal))

    return [...fromCatalog, ...fromGuide]
      .filter((item) => !onBoard.has(item.key) || item.key === picking?.replacing)
      .filter((item) => (slot ? item.slot === slot : true))
      .filter((item) =>
        needle ? `${item.maker ?? ""} ${item.name}`.toLowerCase().includes(needle) : true,
      )
      .slice(0, 60)
  }, [catalog, onBoard, picking, query])

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      /* Clipboard permission is refusable and some browsers refuse outright.
         The URL is already right in the address bar, so there is nothing to
         recover from and nothing worth interrupting the player about. */
    }
  }

  /** Everything on the board, grouped by store, for the per-store checkout. */
  const cartByStore = useMemo(() => {
    const groups = new Map<string, number>()
    for (const item of items) {
      const c = commerce[item.key]
      if (!c?.stores?.length) continue
      const store = c.stores[0]
      groups.set(store, (groups.get(store) ?? 0) + 1)
    }
    return [...groups.entries()].sort((a, b) => b[1] - a[1])
  }, [items, commerce])

  const commerceOn = Boolean(gearHrefBase)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/*  The deck                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Your board">
          <div className="deck overflow-x-auto p-5 sm:p-7">
            {ordered.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--dim)]">
                Empty board. Add a pedal, or load somebody else&rsquo;s rig and start swapping.
              </p>
            ) : (
              /* The camera lives on the stage, not on .deck: .deck is the
                 scroller, and overflow flattens 3D. See globals.css. */
              <div className="deck-stage">
                <div className="deck-row">
                {ordered.map((item, index) => (
                  <div key={item.key} className="group/pedal relative">
                    <PedalEnclosure
                      item={item}
                      position={index + 1}
                      onToggle={() => toggle(item.key)}
                      onRemove={() => remove(item.key)}
                    />
                    {/*
                      SWAP, on every pedal. This is the control the whole page
                      is arranged around: the common move is not "remove this"
                      but "try a different one here".
                    */}
                    <button
                      type="button"
                      className="knob knob-sm absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover/pedal:opacity-100 focus-visible:opacity-100"
                      onClick={() => {
                        setQuery("")
                        setPicking({ slot: item.slot, replacing: item.key })
                      }}
                      aria-label={`Swap ${item.name} for another ${slotLabel(item.slot).toLowerCase()}`}
                      title={`Swap for another ${slotLabel(item.slot).toLowerCase()}`}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Stomp
              variant="go"
              onClick={() => {
                setQuery("")
                setPicking({ slot: null, replacing: null })
              }}
              disabled={full}
            >
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              {full ? `Board full (${MAX_ITEMS})` : "Add a pedal"}
            </Stomp>

            {items.length > 0 && (
              <Stomp led={false} onClick={share}>
                <Share2 className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                {copied ? "Link copied" : "Share this board"}
              </Stomp>
            )}

            {items.length > 0 && (
              <Stomp variant="ghost" onClick={() => setItems([])}>
                Clear
              </Stomp>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Artist rigs, as starting points                                 */}
        {/* ---------------------------------------------------------------- */}
        {rigs.length > 0 && (
          <section aria-label="Start from a documented rig">
            <h2 className="stencil">Start from a real board</h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Load one, then swap each pedal for whatever is actually in stock. Nobody named here
              is affiliated with this site.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {rigs.map((rig) => (
                <button
                  key={rig.slug}
                  type="button"
                  className="pill"
                  onClick={() => loadRig(rig)}
                  title={rig.context}
                >
                  {rig.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/*  The picker                                                      */}
        {/* ---------------------------------------------------------------- */}
        {picking && (
          <section className="surface p-5" aria-label="Choose a pedal">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-black tracking-tight text-[var(--text)]">
                {picking.replacing
                  ? `Swap in another ${slotLabel(picking.slot!).toLowerCase()}`
                  : "Add a pedal"}
              </h2>
              <button
                type="button"
                className="knob knob-sm ml-auto"
                onClick={() => setPicking(null)}
                aria-label="Close the picker"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Brand or model"
              className="plate mt-3 w-full px-3 py-2 text-sm"
              aria-label="Search pedals"
            />

            {candidates.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--dim)]">
                Nothing matches. The catalogue only carries what a shop has live right now, so a
                pedal can be real and still not be here today.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {candidates.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-left transition-colors hover:border-[var(--chrome-dk)]"
                      onClick={() => {
                        if (picking.replacing) swap(picking.replacing, item)
                        else add(item)
                        setPicking(null)
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">
                          {item.maker ? `${item.maker} ` : ""}
                          {item.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--dim)]">
                          {slotLabel(item.slot)}
                          {item.source === "guide" ? " · documented circuit" : ""}
                          {commerceOn && commerce[item.key]?.listingCount
                            ? ` · ${commerce[item.key].listingCount} listed`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/*  Buying, on the aggregator only                                  */}
        {/* ---------------------------------------------------------------- */}
        {commerceOn && items.length > 0 && (
          <section className="surface p-5" aria-label="Buying this board">
            <h2 className="text-sm font-black tracking-tight text-[var(--text)]">
              <ShoppingCart className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              Buying this board
            </h2>
            {cartByStore.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                None of these has a live listing right now.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[var(--dim)]">
                  {/*
                    Grouped by store because no checkout spans unrelated
                    merchants. Saying so is better than a "buy all" button that
                    silently only fills one basket.
                  */}
                  Checkout is per store, since no basket spans different shops.
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {cartByStore.map(([store, count]) => (
                    <li key={store} className="text-[var(--dim)]">
                      <span className="text-[var(--text)]">{store}</span>: {count}{" "}
                      {count === 1 ? "pedal" : "pedals"}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <ul className="mt-4 space-y-2">
              {ordered.map((item) => {
                const c = commerce[item.key]
                return (
                  <li key={item.key} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-[var(--text)]">
                      {item.maker ? `${item.maker} ` : ""}
                      {item.name}
                    </span>
                    {c?.buyHref ? (
                      <a href={c.buyHref} className="text-[var(--accent-text)] underline">
                        See it
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--dim)]">not listed</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  The attendant                                                     */}
      {/* ------------------------------------------------------------------ */}
      <AttendantPanel items={ordered} />
    </div>
  )
}
