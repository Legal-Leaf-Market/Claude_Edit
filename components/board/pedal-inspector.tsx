"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { Pedal3D } from "@/components/board/pedal-3d"
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
          <Pedal3D item={item} photoUrl={item.imageUrl} />

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
