"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Source } from "@/lib/db/schema"

/**
 * The cart is entirely client-side (localStorage), by design: it holds only
 * display info (title/price/image/qty), never the listing's raw or affiliate
 * URL. Building the actual checkout URL happens server-side, in
 * /api/cart/checkout, which looks up the real destination from the database
 * and logs the click, the same discipline /go uses for a single listing.
 */
export type CartItem = {
  listingId: string
  source: Source
  title: string
  priceCents: number
  currency: string
  image: string | null
  qty: number
}

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void
  removeItem: (listingId: string) => void
  setQty: (listingId: string, qty: number) => void
  clear: () => void
  totalCount: number
  isInCart: (listingId: string) => boolean
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "gearavail_cart"

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Cart starts empty on the server and hydrates from localStorage on mount,
  // rather than reading localStorage during render, so the server-rendered
  // markup and the first client render always match.
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(loadCart())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage can be full or disabled (private browsing); the cart still
      // works for the rest of this session, it just won't persist.
    }
  }, [items, hydrated])

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === item.listingId)
      if (existing) {
        return prev.map((i) =>
          i.listingId === item.listingId ? { ...i, qty: i.qty + qty } : i,
        )
      }
      return [...prev, { ...item, qty }]
    })
  }, [])

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId))
  }, [])

  const setQty = useCallback((listingId: string, qty: number) => {
    if (qty < 1) return
    setItems((prev) => prev.map((i) => (i.listingId === listingId ? { ...i, qty } : i)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const isInCart = useCallback((listingId: string) => items.some((i) => i.listingId === listingId), [items])

  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items])

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQty, clear, totalCount, isInCart }),
    [items, addItem, removeItem, setQty, clear, totalCount, isInCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}

/** Groups cart items by store, since checkout only ever happens one store at a time. */
export function groupBySource(items: CartItem[]): Map<Source, CartItem[]> {
  const groups = new Map<Source, CartItem[]>()
  for (const item of items) {
    const group = groups.get(item.source)
    if (group) group.push(item)
    else groups.set(item.source, [item])
  }
  return groups
}
