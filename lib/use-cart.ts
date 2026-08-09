"use client"

import { useCallback, useEffect, useState } from "react"

export type CartItem = {
  key: string
  storeName: string
  storeType: "shopify" | "woocommerce"
  cartBaseUrl: string
  variantId: string
  productId: string
  title: string
  label: string
  price: number
  qty: number
}

const STORAGE_KEY = "legalLeafCart"

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      setItems([])
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const add = useCallback((item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key)
      if (existing) {
        return prev.map((i) => (i.key === item.key ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }, [])

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const changeQty = useCallback((key: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)),
    )
  }, [])

  const count = items.reduce((s, i) => s + i.qty, 0)
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  return { items, add, remove, changeQty, count, total, ready }
}
