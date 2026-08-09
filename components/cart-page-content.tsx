"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ListingImage } from "@/components/listing-image"
import { groupBySource, useCart, type CartItem } from "@/lib/cart/context"
import { formatPrice, sourceLabel } from "@/lib/utils"
import type { Source } from "@/lib/db/schema"

function StoreGroup({ source, items }: { source: Source; items: CartItem[] }) {
  const { removeItem, setQty } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.qty, 0)
  const currency = items[0]?.currency ?? "USD"

  async function checkout() {
    setPending(true)
    setError(null)
    setNote(null)
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          items: items.map((i) => ({ listingId: i.listingId, qty: i.qty })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Could not build a checkout link. Try again in a moment.")
        setPending(false)
        return
      }
      if (data.leftoverCount > 0) {
        setNote(
          `Only ${data.filledCount} of ${data.filledCount + data.leftoverCount} item${
            data.filledCount + data.leftoverCount === 1 ? "" : "s"
          } could be added automatically at ${sourceLabel(source)}. Add the rest once you're there.`,
        )
      }
      window.location.assign(data.url)
    } catch {
      setError("Could not build a checkout link. Try again in a moment.")
      setPending(false)
    }
  }

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-[var(--cream)]">{sourceLabel(source)}</h2>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.listingId} className="flex items-center gap-3">
            <ListingImage
              src={item.image}
              alt={item.title}
              className="h-16 w-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm text-[var(--cream)]">{item.title}</p>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                {formatPrice(item.priceCents, item.currency)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty(item.listingId, item.qty - 1)}
                disabled={item.qty <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] disabled:opacity-40"
              >
                <Minus className="h-3 w-3" aria-hidden="true" />
              </button>
              <span className="w-5 text-center text-sm text-[var(--cream)]">{item.qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty(item.listingId, item.qty + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              aria-label="Remove from cart"
              onClick={() => removeItem(item.listingId)}
              className="shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--destructive)]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-sm text-[var(--muted-foreground)]">Subtotal</span>
        <span className="text-base font-semibold text-[var(--cream)]">
          {formatPrice(subtotalCents, currency)}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      {note && <p className="mt-2 text-xs text-[var(--muted-foreground)]">{note}</p>}

      <Button type="button" onClick={checkout} disabled={pending} className="mt-3 w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Checkout at {sourceLabel(source)}
      </Button>
    </section>
  )
}

export function CartPageContent() {
  const { items, clear } = useCart()
  const groups = groupBySource(items)

  if (items.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-base text-[var(--cream)]">Your cart is empty.</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Add gear from search results and it will show up here, grouped by store.
        </p>
        <Link
          href="/search"
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--amber-soft)]"
        >
          Browse gear
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted-foreground)]">
        Each store checks out separately: that is who actually holds the inventory and takes the
        payment, so Gear Avail sends you to each one with the cart already filled in where the
        store allows it.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {[...groups.entries()].map(([source, groupItems]) => (
          <StoreGroup key={source} source={source} items={groupItems} />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--destructive)] hover:underline"
        >
          Clear entire cart
        </button>
      </div>
    </div>
  )
}
