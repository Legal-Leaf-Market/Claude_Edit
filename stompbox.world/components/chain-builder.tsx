"use client"

import { useMemo, useState } from "react"
import { Info, TriangleAlert } from "lucide-react"
import { chainNotes, orderPedals, SLOT_BY_ID } from "@/lib/chain"
import { pedalsByFamily } from "@/lib/pedals"
import { Stomp } from "@/components/ui/stomp"

/**
 * Pick pedals, see the conventional order and the reasons behind it.
 *
 * ALL THE THINKING IS IN lib/chain.ts, deliberately. This component holds a
 * list of slugs and renders what those functions return, which is what lets
 * the ordering and the notes be tested without a browser and reused if the
 * same answer is ever wanted on the server.
 *
 * The state is local rather than in the URL. A shareable link would be a nice
 * addition, and it wants a Suspense boundary around useSearchParams to keep
 * the page statically rendered, so it is a deliberate follow-up rather than
 * something half-done here.
 */
export function ChainBuilder() {
  const [selected, setSelected] = useState<string[]>([])

  const groups = useMemo(() => pedalsByFamily(), [])
  const ordered = useMemo(() => orderPedals(selected), [selected])
  const notes = useMemo(() => chainNotes(ordered), [ordered])

  function toggle(slug: string) {
    setSelected((current) =>
      current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug],
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div>
        <h2 className="text-2xl font-black text-[var(--text)]">Pick what is on your board</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--dim)]">
          Everything in the directory is here. Nothing is saved and nothing is sent
          anywhere: this runs entirely in your browser.
        </p>

        <div className="mt-6 space-y-7">
          {groups.map((group) => (
            <div key={group.family}>
              <h3 className="stencil">{group.family}</h3>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {group.pedals.map((pedal) => (
                  <Stomp
                    key={pedal.slug}
                    size="sm"
                    aria-pressed={selected.includes(pedal.slug)}
                    onClick={() => toggle(pedal.slug)}
                  >
                    {pedal.name}
                  </Stomp>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="mt-8">
            <Stomp variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear the board
            </Stomp>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
        <div className="panel">
          <h2 className="text-xl font-black text-[var(--text)]">Signal order</h2>

          {ordered.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
              Nothing selected yet. Pick a few pedals and they will be laid out guitar
              first, amp last, with a note wherever the order is a judgement call rather
              than a convention.
            </p>
          ) : (
            <>
              <p className="stencil mt-4">Guitar</p>
              <div className="patch mt-2" aria-hidden="true" />

              <ol className="mt-2 space-y-0">
                {ordered.map((pedal, index) => (
                  <li key={pedal.slug}>
                    <div className="surface flex items-baseline justify-between gap-3 px-4 py-3">
                      <span className="font-semibold text-[var(--text)]">{pedal.name}</span>
                      <span className="stencil text-[0.56rem]">
                        {SLOT_BY_ID[pedal.slot].name}
                      </span>
                    </div>
                    {index < ordered.length - 1 && (
                      <div className="patch" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>

              <div className="patch" aria-hidden="true" />
              <p className="stencil mt-2">Amp</p>
            </>
          )}

          {notes.length > 0 && (
            <ul className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
              {notes.map((note) => (
                <li key={note.title} className="flex gap-3">
                  {note.level === "warn" ? (
                    <TriangleAlert
                      className="mt-0.5 h-4 w-4 flex-none text-[var(--accent-text)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Info
                      className="mt-0.5 h-4 w-4 flex-none text-[var(--dim)]"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{note.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">{note.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
