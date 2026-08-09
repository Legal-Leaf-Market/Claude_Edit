"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { authClient } from "@/lib/auth-client"
import {
  addToWatchlist,
  clearWatchlist,
  getWatchlist,
  mergeWatchlist,
  removeFromWatchlist,
  resnapshotWatchItem,
} from "@/app/actions/watchlist"

// A saved product snapshot. We freeze the price/availability AT SAVE TIME so
// that on later visits we can tell the shopper what changed — a price drop or a
// restock — the way CamelCamelCamel-style trackers do.
//
// Storage strategy: signed-out shoppers keep their list on-device in
// localStorage; signing in merges that list into their account (Neon) and from
// then on the account is the source of truth, synced to their email so it
// follows them across devices.
export type WatchItem = {
  id: string
  title: string
  strainName: string
  storeName: string
  link: string
  imageUrl: string
  price: number // "starts at" price when saved
  ppg?: number | null // best $/g when saved (not persisted server-side)
  inStock: boolean // availability when saved
  savedAt: number
}

const STORAGE_KEY = "legalLeafWatch"

function readLocal(): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WatchItem[]) : []
  } catch {
    return []
  }
}

function writeLocal(items: WatchItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / unavailable storage
  }
}

export function useWatchlist() {
  const { data: session, isPending } = authClient.useSession()
  const isAuthed = !!session?.user

  const [items, setItems] = useState<WatchItem[]>([])
  const [ready, setReady] = useState(false)
  // Guards the one-time local→DB merge so it only runs once per login.
  const mergedRef = useRef(false)

  // Load the list from the right source whenever auth state settles.
  useEffect(() => {
    if (isPending) return
    let cancelled = false

    async function load() {
      if (isAuthed) {
        // On first authenticated load, push any device-local items into the
        // account, then treat the DB as the source of truth.
        try {
          const local = readLocal()
          const server =
            !mergedRef.current && local.length
              ? await mergeWatchlist(local.map(({ savedAt, ppg, ...rest }) => rest))
              : await getWatchlist()
          mergedRef.current = true
          if (!cancelled) {
            setItems(server)
            // Clear the local cache now that it's safely in the account.
            if (local.length) writeLocal([])
          }
        } catch {
          if (!cancelled) setItems([])
        }
      } else {
        mergedRef.current = false
        if (!cancelled) setItems(readLocal())
      }
      if (!cancelled) setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthed, isPending])

  // Persist guest changes to localStorage. Authenticated changes are persisted
  // through server actions instead (see add/remove/etc. below).
  useEffect(() => {
    if (!ready || isAuthed) return
    writeLocal(items)
  }, [items, ready, isAuthed])

  const add = useCallback(
    (item: Omit<WatchItem, "savedAt">) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev
        return [{ ...item, savedAt: Date.now() }, ...prev]
      })
      if (isAuthed) {
        const { ppg, ...rest } = item
        void addToWatchlist(rest)
      }
    },
    [isAuthed],
  )

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (isAuthed) void removeFromWatchlist(id)
    },
    [isAuthed],
  )

  const toggle = useCallback(
    (item: Omit<WatchItem, "savedAt">) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev.filter((i) => i.id !== item.id)
        return [{ ...item, savedAt: Date.now() }, ...prev]
      })
      if (isAuthed) {
        const exists = items.some((i) => i.id === item.id)
        if (exists) {
          void removeFromWatchlist(item.id)
        } else {
          const { ppg, ...rest } = item
          void addToWatchlist(rest)
        }
      }
    },
    [isAuthed, items],
  )

  // Re-snapshot a saved item to the latest observed price/availability, so the
  // "since you saved" delta resets to the current baseline.
  const resnapshot = useCallback(
    (id: string, next: { price: number; ppg: number | null; inStock: boolean }) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...next, savedAt: Date.now() } : i)),
      )
      if (isAuthed) void resnapshotWatchItem(id, { price: next.price, inStock: next.inStock })
    },
    [isAuthed],
  )

  const clear = useCallback(() => {
    setItems([])
    if (isAuthed) void clearWatchlist()
  }, [isAuthed])

  const savedIds = new Set(items.map((i) => i.id))

  return { items, add, remove, toggle, resnapshot, clear, savedIds, ready, count: items.length }
}

export type WatchChange = "drop" | "rise" | "restock" | "soldout" | "none"

// Compare a saved snapshot against the current live product to classify what
// changed since the shopper saved it. Restock and price-drop are the wins.
export function classifyChange(
  saved: WatchItem,
  current: { price: number; inStock: boolean } | null,
): { change: WatchChange; delta: number } {
  if (!current) return { change: "none", delta: 0 }
  if (!saved.inStock && current.inStock) return { change: "restock", delta: 0 }
  if (saved.inStock && !current.inStock) return { change: "soldout", delta: 0 }
  const delta = current.price - saved.price
  if (delta <= -0.01) return { change: "drop", delta }
  if (delta >= 0.01) return { change: "rise", delta }
  return { change: "none", delta: 0 }
}
