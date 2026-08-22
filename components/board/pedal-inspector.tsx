"use client"

import { useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { X } from "lucide-react"
import { enclosureSpec } from "@/lib/board/enclosure-3d"
import { genericModel, modelFor } from "@/lib/board/pedal-models"
import { remarksForItem } from "@/lib/board/attendant"
import { slotLabel, type BoardItem, type ItemCommerce } from "@/lib/board/model"

/**
 * PICK THE PEDAL UP.
 *
 * The board is a plan view: pedals in a row, in signal order, at a glance.
 * This is the other thing a player does in a shop, which is take one off the
 * shelf and turn it over. So it pops the pedal out of the row as a solid you
 * can spin, and puts what the attendant knows about it right there beside it.
 *
 * COMMERCE IS A PROP AND IS ABSENT ON THE GUIDE, exactly as it is for the
 * builder that opens this. `/pedalboard` passes a price and a `/go` link;
 * `/stompbox/board` passes nothing, and the panel simply has no price in it.
 * Section 20's redistribution rule does not care that this is a dialog rather
 * than a page: stompbox.world is still a second domain, and a per-listing
 * price is still a feed row.
 */
/**
 * WebGL loads only when a pedal is picked up.
 *
 * `ssr: false` because three.js has no business running on the server, and
 * because keeping the canvas behind a dynamic import means the board page
 * never ships it: the row of pedals is DOM, the outbound link is an anchor,
 * and a shopper who never opens this dialog never downloads a renderer.
 */
const PedalViewer3D = dynamic(
  () => import("@/components/board/pedal-viewer-3d").then((m) => m.PedalViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="p3d-loading">
        <span>Warming up the bench...</span>
      </div>
    ),
  },
)

export function PedalInspector({
  item,
  commerce,
  onClose,
}: {
  item: BoardItem
  commerce?: ItemCommerce
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  /* Escape closes, and focus moves into the dialog so a keyboard user is not
     left behind on the board with a modal open in front of them. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    panel.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const remarks = remarksForItem(item)

  /*
   * A MEASURED MODEL IF WE HAVE ONE, THE DERIVED GENERIC OTHERWISE, and both
   * go through the same renderer. `modelFor` only matches the handful of
   * pedals somebody has actually measured; everything else is sized from its
   * slot and says so in its own note.
   */
  const model = useMemo(() => modelFor(item) ?? genericModel(item, enclosureSpec(item)), [item])
  const measured = useMemo(() => modelFor(item) !== null, [item])

  return (
    <div className="p3d-scrim">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name}, up close`}
        tabIndex={-1}
        className="p3d-panel"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-[var(--text)]">{item.name}</p>
            <p className="truncate text-xs text-[var(--dim)]">
              {slotLabel(item.slot)}
              {item.maker ? ` · ${item.maker}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="knob knob-sm">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="p3d">
            <div className="p3d-stage p3d-stage-gl">
              <PedalViewer3D model={model} engaged={item.engaged} />
            </div>

            <p className="p3d-hint">
              Drag to turn it over. Scroll to move in closer.
            </p>

            {/*
              WHICH KIND OF MODEL THIS IS, in words, every time.

              A measured pedal says what its shape tells you; a derived one
              says plainly that it is not this pedal. The distinction is the
              same one section 8 makes about a market price: showing a
              confident picture of something you have not actually measured is
              the invention, not the drawing.
            */}
            <div className="p3d-truth">
              <p>
                {model.note} Roughly {Math.round(model.width)} by {Math.round(model.depth)}mm on
                the floor.
              </p>
              {item.imageUrl ? (
                <figure className="p3d-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={`${item.name}, as photographed by the shop selling it`}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{measured ? "The real one" : "The actual product"}</figcaption>
                </figure>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-[var(--dim)]">
                What it does
              </h3>
              <ul className="mt-2 space-y-2">
                {remarks.map((remark) => (
                  <li
                    key={remark.line}
                    className={`text-sm leading-relaxed ${
                      remark.tone === "unchecked"
                        ? "italic text-[var(--dim)]"
                        : "text-[var(--dim)]"
                    }`}
                  >
                    {remark.line}
                  </li>
                ))}
              </ul>
            </div>

            {/*
              The price and the way out, and ONLY when the page handed them
              over. Everything outbound goes through /go, which is the route
              that records the click; a merchant URL here would be section 5
              broken in a modal.
            */}
            {commerce ? (
              <div className="border-t border-[var(--line)] pt-4">
                {commerce.cheapestCents != null ? (
                  <p className="text-sm text-[var(--text)]">
                    <span className="text-lg font-black text-[var(--money)]">
                      ${(commerce.cheapestCents / 100).toFixed(0)}
                    </span>{" "}
                    <span className="text-[var(--dim)]">
                      cheapest of {commerce.listingCount}{" "}
                      {commerce.listingCount === 1 ? "listing" : "listings"}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-[var(--dim)]">Nobody has this live right now.</p>
                )}

                {commerce.buyHref ? (
                  <a href={commerce.buyHref} className="stomp stomp-go mt-3 inline-flex">
                    See it at the shop
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
