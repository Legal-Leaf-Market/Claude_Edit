"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Info, TriangleAlert } from "lucide-react"
import { Stomp } from "@/components/ui/stomp"
import { PedalEnclosure } from "@/components/stompbox/pedal-enclosure"
import { PedalThumb } from "@/components/stompbox/pedal-photo"
import {
  decodeBoard,
  encodeBoard,
  engagedOf,
  itemFromCatalog,
  itemFromGuide,
  MAX_ITEMS,
  orderBoard,
  resolveBoard,
  slotForCatalogType,
  type BoardItem,
} from "@/lib/stompbox/board"
import type { CatalogPedal } from "@/lib/stompbox/catalog"
import { chainNotes } from "@/lib/stompbox/chain"
import { pedalsByFamily } from "@/lib/stompbox/pedals"

/**
 * The board: put pedals on it, see the order, stomp them on and off.
 *
 * ALL THE THINKING IS IN lib/board.ts AND lib/chain.ts, deliberately, exactly
 * as the chain builder does it. This component holds a list and renders what
 * those functions return, which is what keeps the ordering, the notes and the
 * link format testable without a browser.
 *
 * THE URL IS READ FROM window.location RATHER THAN useSearchParams. Reading
 * search params through the Next hook opts the whole route into dynamic
 * rendering unless it is wrapped in Suspense, and this page is otherwise
 * static and should stay that way. The cost is that a shared board is not in
 * the server-rendered HTML, which is the right trade: the page's indexable
 * content is the explanation and the parts bin, not one visitor's board.
 */
export function BoardBuilder({ catalog }: { catalog: CatalogPedal[] }) {
  const [items, setItems] = useState<BoardItem[]>([])
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState(false)

  /* Open whatever was in the link, once, on mount. */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("b")
    const restored = resolveBoard(decodeBoard(raw), catalog)
    if (restored.length > 0) setItems(restored)
  }, [catalog])

  /* Keep the address bar in step, without pushing history entries: adding six
     pedals should not mean pressing back six times to leave the page. */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (items.length > 0) url.searchParams.set("b", encodeBoard(items))
    else url.searchParams.delete("b")
    window.history.replaceState(null, "", url)
    setCopied(false)
  }, [items])

  const ordered = useMemo(() => orderBoard(items), [items])
  const live = useMemo(() => engagedOf(ordered), [ordered])
  const notes = useMemo(() => chainNotes(live), [live])
  const onBoard = useMemo(() => new Set(items.map((item) => item.key)), [items])
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
      current.map((entry) =>
        entry.key === key ? { ...entry, engaged: !entry.engaged } : entry,
      ),
    )
  }, [])

  /* Catalogue rows that have a slot in this guide's chain. The ones that do
     not are counted below and explained rather than silently dropped. */
  const placeable = useMemo(
    () => catalog.filter((pedal) => slotForCatalogType(pedal.type) !== null),
    [catalog],
  )
  const unplaceable = catalog.length - placeable.length

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return placeable
    return placeable.filter((pedal) =>
      `${pedal.brand} ${pedal.model}`.toLowerCase().includes(needle),
    )
  }, [placeable, query])

  const guideGroups = useMemo(() => pedalsByFamily(), [])

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      /* Clipboard permission is refusable and some browsers refuse it outright.
         The URL is already correct in the address bar, so there is nothing to
         recover from and nothing worth interrupting the player about. */
    }
  }

  return (
    <div className="space-y-10">
      <section aria-label="Your board">
        <div className="deck overflow-x-auto p-5 sm:p-7">
          <div className="flex min-w-max items-stretch gap-0">
            <div className="flex items-center">
              <span className="jack">Guitar</span>
              <span className="patch-h" aria-hidden="true" />
            </div>

            {ordered.length === 0 ? (
              <div className="flex min-h-[9.5rem] flex-1 items-center justify-center px-6">
                <p className="max-w-sm text-center text-sm leading-relaxed text-[var(--dim)]">
                  Empty board. Add pedals from below and they will patch themselves up in
                  the conventional order, guitar first and amp last.
                </p>
              </div>
            ) : (
              ordered.map((item, index) => (
                <div key={item.key} className="flex items-stretch">
                  <PedalEnclosure
                    item={item}
                    position={index + 1}
                    onToggle={() => toggle(item.key)}
                    onRemove={() => remove(item.key)}
                  />
                  {index < ordered.length - 1 && (
                    <span className="patch-h" aria-hidden="true" />
                  )}
                </div>
              ))
            )}

            <div className="flex items-center">
              <span className="patch-h" aria-hidden="true" />
              <span className="jack">Amp</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-[var(--dim)]">
            {ordered.length === 0
              ? `Room for ${MAX_ITEMS} pedals.`
              : `${ordered.length} on the board, ${live.length} in the signal. Press one to bypass it.`}
          </p>
          {ordered.length > 0 && (
            <>
              <Stomp size="sm" onClick={share}>
                {copied ? "Link copied" : "Copy link"}
              </Stomp>
              <Stomp variant="ghost" size="sm" onClick={() => setItems([])}>
                Clear the board
              </Stomp>
            </>
          )}
        </div>
      </section>

      {notes.length > 0 && (
        <section aria-label="What this order does" className="panel">
          <h2 className="text-xl font-black text-[var(--text)]">What this order does</h2>
          <ul className="mt-5 space-y-5">
            {notes.map((note) => (
              <li key={note.title} className="flex gap-3">
                {note.level === "warn" ? (
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 flex-none text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 flex-none text-[var(--dim)]" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{note.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">{note.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Pedals you can add">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-black text-[var(--text)]">The parts bin</h2>
          {full && (
            <p className="text-sm text-[var(--accent-text)]">
              Board is full at {MAX_ITEMS}. Take something off to add another.
            </p>
          )}
        </div>

        <div className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="stencil">Real pedals, from the catalogue</h3>
            <label className="text-xs text-[var(--dim)]">
              <span className="sr-only">Filter the catalogue</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by brand or model"
                className="w-56 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--chip)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
              />
            </label>
          </div>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--dim)]">
            Live stock on{" "}
            <a href="https://gearavail.com/used/effects-pedals" rel="noopener" className="underline">
              Gear Avail
            </a>
            . Their slot is worked out from the product name, and this guide has read none
            of these circuits, so the notes above will say so rather than pretend
            otherwise.
            {unplaceable > 0 && (
              <>
                {" "}
                {unplaceable} more {unplaceable === 1 ? "is" : "are"} in the catalogue and not
                offered here: loopers and utility boxes have no single slot in this chain, and
                guessing one would be picking a position at random.
              </>
            )}
          </p>

          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--dim)]">Nothing matches that.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {filtered.map((pedal) => {
                const item = itemFromCatalog(pedal)
                if (!item) return null
                const already = onBoard.has(item.key)
                return (
                  <button
                    key={pedal.slug}
                    type="button"
                    onClick={() => add(item)}
                    disabled={already || full}
                    title={already ? "Already on the board" : `Add ${pedal.brand} ${pedal.model}`}
                    className="surface flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-[var(--chrome)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[var(--line)]"
                  >
                    <PedalThumb src={pedal.imageUrl} alt="" />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">
                        {pedal.brand}
                      </span>
                      <span className="block max-w-[11rem] truncate text-sm font-semibold text-[var(--text)]">
                        {pedal.model}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-9">
          <h3 className="stencil">Circuits, from the guide</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--dim)]">
            The documented ones. These carry everything this site knows about what the
            circuit does, so a fuzz here will warn you about the buffer two slots up.
          </p>
          <div className="mt-4 space-y-5">
            {guideGroups.map((group) => (
              <div key={group.family}>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
                  {group.family}
                </p>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {group.pedals.map((pedal) => {
                    const item = itemFromGuide(pedal)
                    const already = onBoard.has(item.key)
                    return (
                      <Stomp
                        key={pedal.slug}
                        size="sm"
                        disabled={already || full}
                        onClick={() => add(item)}
                      >
                        {pedal.name}
                      </Stomp>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
