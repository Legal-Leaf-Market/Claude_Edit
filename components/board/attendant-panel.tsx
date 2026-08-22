"use client"

import { useMemo, useState } from "react"
import { CircleAlert, CircleHelp, Info } from "lucide-react"
import { adviceForBoard, boardSummary, remarksForItem } from "@/lib/board/attendant"
import { slotLabel, type BoardItem } from "@/lib/board/model"

/**
 * The person behind the counter.
 *
 * The brief was a shop that specialises in pedals, where somebody who knows the
 * gear tells you what each one does and exactly what you will need. This panel
 * is that, and every word in it comes out of `lib/board/attendant.ts`, which
 * derives rather than authors: the circuit sentences are the guide's own, the
 * position and its reason are the chain's, the supply and cable counts are the
 * engines'.
 *
 * WHAT IT SAYS IS IDENTICAL ON BOTH DOMAINS, and that is deliberate rather than
 * incidental. Nothing here reads a price, a merchant or a commission, so the
 * advice a shopper gets on the aggregator is the same advice a reader gets on
 * the guide, and it cannot start bending toward whoever pays (section 17).
 *
 * THE HONEST BITS ARE NOT HIDDEN. "Nobody has taken this circuit apart" gets
 * its own tone and its own place at the bottom rather than being dropped. A
 * shop where the assistant says "I do not know that one" is a shop you can
 * trust about the ones they do know.
 */
export function AttendantPanel({ items }: { items: BoardItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const advice = useMemo(() => adviceForBoard(items), [items])
  const summary = useMemo(() => boardSummary(items), [items])

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="What you will need">
      <div className="surface p-5">
        <p className="stencil">The counter</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">{summary}</p>

        {items.length === 0 && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
            Put something on the board and I will tell you what it does, where it goes, and what
            you need to run it.
          </p>
        )}

        {/* ------------------------------------------------------------ */}
        {/*  What you'll need: the literal brief, so it leads             */}
        {/* ------------------------------------------------------------ */}
        {advice.needs.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-wide text-[var(--dim)]">
              What you&rsquo;ll need
            </h3>
            <ul className="mt-2 space-y-2">
              {advice.needs.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-[var(--text)]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/*  Opinions, from the engines rather than from the panel        */}
        {/* ------------------------------------------------------------ */}
        {advice.headsUp.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-wide text-[var(--dim)]">
              Worth knowing
            </h3>
            <ul className="mt-2 space-y-2">
              {advice.headsUp.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-relaxed text-[var(--dim)]">
                  <CircleAlert
                    className="mt-0.5 h-4 w-4 flex-none text-[var(--signal)]"
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/*  Per pedal: tap one to hear about it                          */}
        {/* ------------------------------------------------------------ */}
        {items.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-wide text-[var(--dim)]">
              About each one
            </h3>
            <ul className="mt-2 space-y-1">
              {items.map((item) => {
                const open = openKey === item.key
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-2 rounded py-1 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenKey(open ? null : item.key)}
                    >
                      <span className="text-sm font-semibold text-[var(--text)]">{item.name}</span>
                      <span className="text-xs text-[var(--dim)]">{slotLabel(item.slot)}</span>
                      {!item.circuitKnown && (
                        <CircleHelp
                          className="h-3.5 w-3.5 flex-none text-[var(--dim)]"
                          aria-label="circuit not documented"
                        />
                      )}
                    </button>
                    {open && (
                      <ul className="mb-2 space-y-1.5 pl-1">
                        {remarksForItem(item).map((remark) => (
                          <li
                            key={remark.line}
                            className={`flex gap-2 text-sm leading-relaxed ${
                              remark.tone === "unchecked"
                                ? "text-[var(--dim)] italic"
                                : "text-[var(--dim)]"
                            }`}
                          >
                            {remark.tone === "heads-up" && (
                              <CircleAlert
                                className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--signal)]"
                                aria-hidden="true"
                              />
                            )}
                            {remark.tone === "info" && (
                              <Info
                                className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent-text)]"
                                aria-hidden="true"
                              />
                            )}
                            <span>{remark.line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/*  What was not checked. Never dropped.                         */}
        {/* ------------------------------------------------------------ */}
        {advice.unchecked.length > 0 && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            {advice.unchecked.map((line) => (
              <p key={line} className="text-xs leading-relaxed text-[var(--dim)]">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
