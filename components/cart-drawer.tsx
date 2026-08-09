"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Minus, Plus, ShieldCheck, Store, Truck, Trash2, User, X } from "lucide-react"
import {
  DISCOUNT_CODE,
  discountPercent,
  discountRate,
  storeShippingEstimate,
} from "@/lib/products"
import type { CartItem } from "@/lib/use-cart"

type StoreGroup = {
  storeName: string
  items: CartItem[]
  units: number
  subtotal: number
  discountPct: number
  savings: number
  netSubtotal: number
  shipping: number
  total: number
}

export function CartDrawer({
  open,
  onClose,
  items,
  total,
  onRemove,
  onChangeQty,
  cartStores,
  onCheckout,
  isAuthed = false,
}: {
  open: boolean
  onClose: () => void
  items: CartItem[]
  total: number
  onRemove: (key: string) => void
  onChangeQty: (key: string, delta: number) => void
  cartStores: string[]
  onCheckout: (storeName: string) => void
  isAuthed?: boolean
}) {
  const [step, setStep] = useState<"cart" | "review">("cart")

  // Snap back to the item list whenever the cart empties or is reopened.
  useEffect(() => {
    if (items.length === 0) setStep("cart")
  }, [items.length])
  useEffect(() => {
    if (open) setStep("cart")
  }, [open])

  // Group items by store and compute per-store subtotal, estimated shipping,
  // and how far each store is from the free-shipping threshold.
  const groups = useMemo<StoreGroup[]>(() => {
    const byStore = new Map<string, CartItem[]>()
    for (const it of items) {
      const arr = byStore.get(it.storeName)
      if (arr) arr.push(it)
      else byStore.set(it.storeName, [it])
    }
    return Array.from(byStore.entries())
      .map(([storeName, storeItems]) => {
        const subtotal = storeItems.reduce((s, i) => s + i.price * i.qty, 0)
        const units = storeItems.reduce((s, i) => s + i.qty, 0)
        // Apply the store's code discount (10% / 20% Black Tie) to the subtotal,
        // then estimate shipping off the discounted amount the shopper pays.
        const rate = discountRate(storeName)
        const savings = subtotal * rate
        const netSubtotal = subtotal - savings
        const shipping = storeShippingEstimate(storeName, netSubtotal)
        return {
          storeName,
          items: storeItems,
          units,
          subtotal,
          discountPct: discountPercent(storeName),
          savings,
          netSubtotal,
          shipping,
          total: netSubtotal + shipping,
        }
      })
      .sort((a, b) => a.storeName.localeCompare(b.storeName))
  }, [items])

  const netItems = groups.reduce((s, g) => s + g.netSubtotal, 0)
  const totalSavings = groups.reduce((s, g) => s + g.savings, 0)
  const estShipping = groups.reduce((s, g) => s + g.shipping, 0)
  const grandTotal = netItems + estShipping

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Legal-Leaf cart"
        className={`fixed right-0 top-0 z-[61] flex h-full w-[min(94vw,440px)] flex-col border-l border-gold/30 p-4 shadow-[-18px_0_45px_rgba(0,0,0,0.48)] transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "linear-gradient(160deg,#071423,#0b2138 46%,#0f5132)" }}
      >
        <header className="mb-4 flex items-center justify-between border-b border-gold/25 pb-4">
          <div className="flex items-center gap-2">
            {step === "review" && (
              <button
                onClick={() => setStep("cart")}
                aria-label="Back to cart"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide">
                {step === "cart" ? "Legal-Leaf Cart" : "Review & Checkout"}
              </h2>
              <p className="mt-0.5 text-[0.68rem] uppercase tracking-widest text-gold">
                {step === "cart"
                  ? "Build first, checkout at store"
                  : `${groups.length} store${groups.length === 1 ? "" : "s"} · checkout each`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ---------------- STEP 1: item list ---------------- */}
        {step === "cart" && (
          <>
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your Legal-Leaf cart is empty. Add products from any card to build a multi-store
                  list.
                </p>
              ) : (
                items.map((it) => (
                  <div key={it.key} className="rounded-2xl border border-gold/20 bg-white/[0.06] p-3">
                    <div className="font-extrabold leading-tight">{it.title}</div>
                    <div className="mt-1 text-xs text-mint/70">
                      {it.label} · {it.storeName}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onChangeQty(it.key, -1)}
                          aria-label="Decrease quantity"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-lime to-gold text-navy"
                        >
                          <Minus className="h-4 w-4" strokeWidth={3} />
                        </button>
                        <strong className="min-w-14 text-center text-sm">Qty {it.qty}</strong>
                        <button
                          onClick={() => onChangeQty(it.key, 1)}
                          aria-label="Increase quantity"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-lime to-gold text-navy"
                        >
                          <Plus className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>
                      <span className="font-black">${(it.price * it.qty).toFixed(2)}</span>
                      <button
                        onClick={() => onRemove(it.key)}
                        aria-label="Remove item"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-mint"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-gold/25 bg-gold/10 p-3 font-black">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>Estimated item total</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-muted-foreground line-through">
                        ${total.toFixed(2)}
                      </span>
                      <span>${netItems.toFixed(2)}</span>
                    </span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="mt-1 text-xs font-black text-lime">
                      You save ${totalSavings.toFixed(2)} with code {DISCOUNT_CODE}
                    </div>
                  )}
                  <div className="mt-1 text-xs font-medium text-muted-foreground">
                    Across {cartStores.length} store{cartStores.length === 1 ? "" : "s"} · 10% off
                    (Black Tie 20%)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime to-gold px-3 py-3 text-sm font-black text-navy transition hover:opacity-90"
                >
                  Review shipping & checkout
                  <ArrowLeft className="h-4 w-4 rotate-180" strokeWidth={2.6} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------------- STEP 2: review by store ---------------- */}
        {step === "review" && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {groups.map((g) => (
                <div key={g.storeName} className="rounded-2xl border border-gold/25 bg-white/[0.06] p-3">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2 font-black">
                      <Store className="h-4 w-4 text-gold" />
                      {g.storeName}
                    </div>
                    <span className="rounded-full border border-gold/30 bg-black/30 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wide text-mint">
                      {g.units} item{g.units === 1 ? "" : "s"}
                    </span>
                  </div>

                  <ul className="space-y-1.5 py-2 text-sm">
                    {g.items.map((it) => (
                      <li key={it.key} className="flex items-start justify-between gap-2">
                        <span className="leading-tight">
                          <span className="font-semibold">{it.title}</span>
                          <span className="block text-xs text-mint/60">
                            {it.label} · Qty {it.qty}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold">${(it.price * it.qty).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-1 border-t border-white/10 pt-2 text-xs font-semibold text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="text-mint">${g.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-lime">
                      <span>Code {DISCOUNT_CODE} ({g.discountPct}% off)</span>
                      <span>-${g.savings.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" /> Est. shipping
                      </span>
                      <span className={g.shipping === 0 ? "text-lime" : "text-mint"}>
                        {g.shipping === 0 ? "FREE" : `$${g.shipping.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black text-foreground">
                      <span>Est. store total</span>
                      <span className="text-gold">${g.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onCheckout(g.storeName)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime to-gold px-3 py-2.5 text-sm font-black text-navy transition hover:opacity-90"
                  >
                    {isAuthed ? (
                      <>
                        <Store className="h-4 w-4" strokeWidth={2.6} />
                        Checkout {g.storeName}
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" strokeWidth={2.6} />
                        Sign in to checkout {g.storeName}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-gold/25 bg-gold/10 p-3">
                <div className="flex items-center justify-between font-black">
                  <span>Est. grand total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>
                    Items ${netItems.toFixed(2)} + est. ship ${estShipping.toFixed(2)}
                  </span>
                  <span>code {DISCOUNT_CODE}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="mt-0.5 text-xs font-black text-lime">
                    Saved ${totalSavings.toFixed(2)} with code {DISCOUNT_CODE}
                  </div>
                )}
              </div>
              <p className="flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime" />
                Shipping is a Legal-Leaf estimate. Each store checks out separately and calculates
                its real shipping at checkout, with code {DISCOUNT_CODE} applied.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
