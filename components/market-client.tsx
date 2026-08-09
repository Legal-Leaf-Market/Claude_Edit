"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { MobileDrawer } from "@/components/mobile-drawer"
import { CartDrawer } from "@/components/cart-drawer"
import { WatchlistDrawer } from "@/components/watchlist-drawer"
import { ProductCard } from "@/components/product-card"
import { BadgeFilter } from "@/components/badge-filter"
import { AgeGate } from "@/components/age-gate"
import { HowItWorks } from "@/components/how-it-works"
import { useCart } from "@/lib/use-cart"
import { classifyChange, useWatchlist } from "@/lib/use-watchlist"
import { CANNABINOIDS, DEFAULT_FILTERS, type Filters } from "@/lib/filters"
import { BADGE_ORDER, BADGES, computeAvgPpgByBucket, computeProductBadges } from "@/lib/badges"
import {
  DISCOUNT_CODE,
  getBudgetTotal,
  isTrimOrShake,
  productValuePer100mg,
  qualifyingVariants,
  variantBudgetTotal,
  type Product,
} from "@/lib/products"
import { buildStoreCheckoutUrl, openCheckoutUrl } from "@/lib/checkout"
import { authClient } from "@/lib/auth-client"

type StoreStatus = { name: string; count: number; ok: boolean }

// The handful of sorts deal-hunters reach for most, surfaced as quick chips.
const SORT_CHIPS: { value: Filters["sort"]; label: string }[] = [
  { value: "ppg-asc", label: "Best $/g" },
  { value: "value-asc", label: "Best $/100mg" },
  { value: "price-asc", label: "Cheapest" },
  { value: "newest", label: "Newest" },
  { value: "budget-best", label: "Best Fit" },
  { value: "price-desc", label: "Premium" },
]

export function MarketClient({
  products,
  updatedAt,
  usingLive,
  storeStatus,
}: {
  products: Product[]
  updatedAt?: string
  usingLive?: boolean
  storeStatus?: StoreStatus[]
}) {
  const PAGE_SIZE = 24
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  // Time is formatted in the visitor's local timezone, which differs from the
  // server's — render it only after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)

  const cart = useCart()
  const watch = useWatchlist()
  const { data: session } = authClient.useSession()

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // Save/unsave a product, freezing its current price + availability so future
  // visits can surface price drops and restocks.
  const toggleWatch = (product: Product) => {
    const wasSaved = watch.savedIds.has(product.id)
    const avail = product.variants.filter((v) => v.available)
    const price = avail.length ? Math.min(...avail.map((v) => v.price)) : product.price
    watch.toggle({
      id: product.id,
      title: product.title,
      strainName: product.strainName,
      storeName: product.storeName,
      link: product.link,
      imageUrl: product.imageUrl,
      price,
      ppg: product.ppgFloat,
      inStock: !product.isSoldOut && avail.length > 0,
    })
    showToast(wasSaved ? "Removed from watchlist" : "Saved — we'll watch the price for you")
  }

  // Deep link from watchlist alert emails: `/?add=<product title>` finds the
  // matching product, drops its cheapest in-stock variant into the cart, and
  // opens the cart drawer — then strips the param so a refresh won't re-add.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get("add")
    if (!wanted) return
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()
    const target =
      products.find((p) => norm(p.title) === norm(wanted)) ??
      products.find((p) => norm(p.title).includes(norm(wanted)))
    if (target) {
      const avail = target.variants.filter((v) => v.available)
      const variant = avail.length
        ? avail.reduce((a, b) => (b.price < a.price ? b : a))
        : target.variants[0]
      if (variant) {
        cart.add({
          key: `${target.id}:${variant.variantId}`,
          storeName: target.storeName,
          storeType: target.storeType,
          cartBaseUrl: target.cartBaseUrl,
          variantId: variant.variantId,
          productId: target.nativeId || target.id,
          title: target.title,
          label: variant.optionLabel || target.strainName || target.title,
          price: variant.price,
        })
        setCartOpen(true)
        showToast(`Added ${target.title} to your cart`)
      }
    }
    // Clean the URL regardless so the action isn't repeated on refresh.
    params.delete("add")
    const qs = params.toString()
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    // Run once on mount; products are stable for the page lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // How many saved items currently show a win (price drop or restock) vs their
  // saved baseline, used for the header alert dot.
  const watchAlertCount = useMemo(() => {
    if (!watch.items.length) return 0
    const byId = new Map(products.map((p) => [p.id, p]))
    let n = 0
    for (const saved of watch.items) {
      const p = byId.get(saved.id)
      const current = p
        ? {
            price: p.variants.filter((v) => v.available).length
              ? Math.min(...p.variants.filter((v) => v.available).map((v) => v.price))
              : p.price,
            inStock: !p.isSoldOut && p.variants.some((v) => v.available),
          }
        : null
      const { change } = classifyChange(saved, current)
      if (change === "drop" || change === "restock") n++
    }
    return n
  }, [watch.items, products])

  // Jump into a single-strain, all-stores view sorted by best value so the
  // shopper can eyeball every store's price for that exact strain side by side.
  const compareStrain = (strain: string) => {
    setFilters((prev) => ({ ...prev, strain, store: "all", sort: "value-asc" }))
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  )

  // Store names present in the live catalog (used by the store filters).
  const stores = useMemo(
    () => Array.from(new Set(products.map((p) => p.storeName))).sort(),
    [products],
  )

  // Store names that currently have items in the Legal-Leaf cart.
  const cartStores = useMemo(
    () => Array.from(new Set(cart.items.map((i) => i.storeName))).sort(),
    [cart.items],
  )

  // Send the cart items for a single store to that store's own cart + discount.
  const checkoutAtStore = async (storeName: string) => {
    // Checkout is account-gated: an account links the watchlist to their email
    // and keeps deal-hunters in the loop. Bounce guests to sign-in and return.
    if (!session?.user) {
      showToast("Create a free account to check out")
      window.location.href = `/sign-up?redirect=${encodeURIComponent("/?checkout=1")}`
      return
    }
    const storeItems = cart.items.filter((i) => i.storeName === storeName)
    if (!storeItems.length) {
      showToast(`Add ${storeName} items to your cart first`)
      return
    }
    const url = buildStoreCheckoutUrl(storeItems)
    if (!url) {
      showToast("Unable to build checkout link")
      return
    }
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE)
    } catch {
      // clipboard is best-effort
    }
    showToast(`Opening ${storeName} · code ${DISCOUNT_CODE} copied`)
    openCheckoutUrl(url)
  }

  // Average price-per-gram keyed by cannabinoid + category so we compare
  // like-with-like (flower vs flower, not flower vs pricey concentrates). Feeds
  // the card's "% under average" recommendation copy.
  const avgPpgByBucket = useMemo(() => computeAvgPpgByBucket(products), [products])

  // Every product's badge set, computed once and shared by the cards and the
  // "Search by Badge" filter so display and filtering never drift apart.
  const badgeMap = useMemo(() => computeProductBadges(products), [products])

  // How many products currently carry each badge (shown in the filter menu).
  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const id of BADGE_ORDER) counts[id] = 0
    for (const ids of badgeMap.values()) for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
    return counts
  }, [badgeMap])

  // Real strain names harvested from the live catalog, deduped + alphabetized.
  // Only strains with at least one IN-STOCK product are listed — we never want
  // to raise a shopper's hopes with a strain that's entirely sold out.
  const strains = useMemo(() => {
    const inStock = new Set<string>()
    for (const p of products) if (!p.isSoldOut && p.strainName) inStock.add(p.strainName)
    return Array.from(inStock).sort((a, b) => a.localeCompare(b))
  }, [products])

  // Same-strain cross-store comparison. For every strain, gather the cheapest
  // out-the-door (item + est. ship) price at each store that carries it in
  // stock, so each card can answer "am I getting the best price on THIS exact
  // strain?" — the core reason to use an aggregator over a single store.
  const crossStore = useMemo(() => {
    // strain key -> best out-the-door total per product entry.
    const groups = new Map<
      string,
      { id: string; storeName: string; total: number; strainName: string }[]
    >()
    for (const p of products) {
      if (p.isSoldOut || !p.strainName) continue
      const avail = p.variants.filter((v) => v.available)
      if (!avail.length) continue
      const total = Math.min(...avail.map((v) => variantBudgetTotal(p, v)))
      const key = p.strainName.toLowerCase()
      const arr = groups.get(key) ?? []
      arr.push({ id: p.id, storeName: p.storeName, total, strainName: p.strainName })
      groups.set(key, arr)
    }

    const info = new Map<
      string,
      {
        strainName: string
        storeCount: number
        cheapestStore: string
        cheapestTotal: number
        thisTotal: number
        isCheapest: boolean
        savings: number
      }
    >()
    for (const entries of groups.values()) {
      const stores = new Set(entries.map((e) => e.storeName))
      if (stores.size < 2) continue // only meaningful when 2+ stores carry it
      const cheapest = entries.reduce((a, b) => (b.total < a.total ? b : a))
      for (const e of entries) {
        const isCheapest = e.total <= cheapest.total + 0.01
        info.set(e.id, {
          strainName: e.strainName,
          storeCount: stores.size,
          cheapestStore: cheapest.storeName,
          cheapestTotal: cheapest.total,
          thisTotal: e.total,
          isCheapest,
          savings: Math.max(0, e.total - cheapest.total),
        })
      }
    }
    return info
  }, [products])

  const filtered = useMemo(() => {
    const tokens = filters.search.toLowerCase().trim().split(/\s+/).filter(Boolean)
    let list = products.slice()

    if (filters.store !== "all") list = list.filter((p) => p.storeName === filters.store)
    // Hide CBD products by default unless the CBD tab is explicitly selected.
    if (filters.hideCbd && filters.cannabinoid !== "cbd")
      list = list.filter((p) => p.cannabinoid !== "cbd")
    // Hide trim/shake/kief so cheap byproduct doesn't distort the $/g model.
    if (filters.hideTrim) list = list.filter((p) => !isTrimOrShake(p))
    if (filters.cannabinoid !== "all")
      list = list.filter((p) => p.cannabinoid === filters.cannabinoid)
    if (tokens.length)
      list = list.filter((p) => tokens.every((k) => p.searchData.includes(k)))
    if (filters.strain !== "all") list = list.filter((p) => p.strainName === filters.strain)
    if (filters.category !== "all") list = list.filter((p) => p.category === filters.category)
    // Badge filter: a product must carry every selected badge.
    if (filters.badges.length)
      list = list.filter((p) => {
        const ids = badgeMap.get(p.id) ?? []
        return filters.badges.every((b) => ids.includes(b as (typeof ids)[number]))
      })
    // Quantity + budget work together: keep products that have at least one
    // available variant meeting BOTH the minimum size and the budget.
    if (filters.minGrams > 0 || filters.budget > 0)
      list = list.filter(
        (p) => qualifyingVariants(p, filters.minGrams, filters.budget).length > 0,
      )

    const s = filters.sort
    if (s === "price-asc") list.sort((a, b) => a.price - b.price)
    else if (s === "price-desc") list.sort((a, b) => b.price - a.price)
    else if (s === "ppg-asc")
      list.sort((a, b) => (a.ppgFloat ?? Infinity) - (b.ppgFloat ?? Infinity) || a.price - b.price)
    else if (s === "value-asc")
      list.sort((a, b) => {
        // Potency-adjusted value ($/100mg active). Products with no lab figure
        // fall to the back, then break ties by raw $/g.
        const va = productValuePer100mg(a) ?? Infinity
        const vb = productValuePer100mg(b) ?? Infinity
        return va - vb || (a.ppgFloat ?? Infinity) - (b.ppgFloat ?? Infinity)
      })
    else if (s === "name-asc") list.sort((a, b) => a.title.localeCompare(b.title))
    else if (s === "budget-best")
      list.sort((a, b) => {
        const ba = filters.budget > 0 ? filters.budget - getBudgetTotal(a) : -1e9
        const bb = filters.budget > 0 ? filters.budget - getBudgetTotal(b) : -1e9
        return bb !== ba ? bb - ba : (a.ppgFloat ?? Infinity) - (b.ppgFloat ?? Infinity)
      })
    else {
      // "Newest" (default): sort each store newest-first, then round-robin across
      // stores so every store is represented from the very first page. A flat
      // date sort lets one store's recent bulk-publish dominate the first screen,
      // which made it look like only 1-2 stores existed on mobile.
      const byStore = new Map<string, Product[]>()
      for (const p of list) {
        const arr = byStore.get(p.storeName)
        if (arr) arr.push(p)
        else byStore.set(p.storeName, [p])
      }
      const queues = Array.from(byStore.values())
      queues.forEach((q) => q.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)))
      const interleaved: Product[] = []
      for (let i = 0, done = false; !done; i++) {
        done = true
        for (const q of queues) {
          if (i < q.length) {
            interleaved.push(q[i])
            done = false
          }
        }
      }
      list = interleaved
    }

    // sold-out items last
    list.sort((a, b) => (a.isSoldOut === b.isSoldOut ? 0 : a.isSoldOut ? 1 : -1))
    return list
  }, [products, filters, badgeMap])

  // Reset pagination whenever the filtered result set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters])

  useEffect(() => {
    setMounted(true)
  }, [])

  const visible = filtered.slice(0, visibleCount)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  return (
    <div className="min-h-screen">
      <AgeGate />
      <SiteHeader
        filters={filters}
        setFilter={setFilter}
        categories={categories}
        strains={strains}
        stores={stores}
        cartCount={cart.count}
        onOpenCart={() => setCartOpen(true)}
        watchCount={watch.items.length}
        watchAlerts={watchAlertCount}
        onOpenWatch={() => setWatchOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {/* Mobile search — the desktop search lives in the filter panel that is
          hidden on phones, so give mobile shoppers a first-class search bar. */}
      <div className="border-b border-gold/15 bg-navy/70 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          <input
            type="search"
            inputMode="search"
            aria-label="Search strains, stores and categories"
            className="w-full rounded-xl border border-gold/25 bg-navy/60 py-2.5 pl-10 pr-9 text-sm font-semibold text-mint outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20"
            placeholder="Search strain, store, category..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => setFilter("search", "")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-mint/70 transition hover:bg-white/10 hover:text-mint"
            >
              <X className="h-4 w-4" strokeWidth={2.6} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile cannabinoid pills — the header above is already pinned, so these
          scroll normally to avoid overlapping the frozen banner. */}
      <div className="z-40 flex gap-2 overflow-x-auto border-b border-gold/15 bg-navy/70 px-4 py-2.5 backdrop-blur md:hidden">
        {CANNABINOIDS.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter("cannabinoid", c.value)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-black transition ${
              filters.cannabinoid === c.value
                ? "border-transparent bg-gradient-to-r from-lime to-gold text-navy"
                : "border-gold/30 bg-white/5 text-mint"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Prominent sort chips + badge filter — how deal-hunters actually shop.
            The badge filter sits OUTSIDE the horizontally-scrolling chip row so
            its dropdown isn't clipped by that container's overflow. */}
        <div className="mb-3 flex items-center gap-2">
          <BadgeFilter
            selected={filters.badges}
            counts={badgeCounts}
            onChange={(next) => setFilter("badges", next)}
          />
          <span className="h-5 w-px shrink-0 bg-gold/20" aria-hidden />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SORT_CHIPS.map((c) => {
              const active = filters.sort === c.value
              return (
                <button
                  key={c.value}
                  onClick={() => setFilter("sort", c.value)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-black transition ${
                    active
                      ? "border-transparent bg-gradient-to-r from-lime to-gold text-navy"
                      : "border-gold/30 bg-white/5 text-mint hover:bg-white/10"
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active badge selections as removable chips. */}
        {filters.badges.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {filters.badges.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setFilter("badges", filters.badges.filter((x) => x !== b))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                  BADGES[b as keyof typeof BADGES]?.chipClass ?? ""
                }`}
              >
                {BADGES[b as keyof typeof BADGES]?.label ?? b}
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilter("badges", [])}
              className="text-xs font-bold text-muted-foreground underline-offset-2 transition hover:text-mint hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            <span className="text-mint">{filtered.length}</span> deal
            {filtered.length === 1 ? "" : "s"} found
            {filters.budget > 0 && ` under $${filters.budget.toFixed(2)}`}
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <HowItWorks />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                usingLive
                  ? "border-lime/40 bg-lime/10 text-mint"
                  : "border-gold/40 bg-gold/10 text-gold"
              }`}
              title={
                storeStatus?.map((s) => `${s.name}: ${s.ok ? `${s.count} live` : "unavailable"}`).join(" · ") ??
                undefined
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${usingLive ? "bg-lime animate-pulse" : "bg-gold"}`}
                aria-hidden
              />
              {usingLive ? "Live inventory" : "Sample data (feeds unavailable)"}
            </span>
            {updatedAt && mounted && (
              <span className="text-muted-foreground">
                Updated{" "}
                {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gold/20 bg-white/[0.05] p-10 text-center">
            <h3 className="text-lg font-black">No products found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try clearing your budget, search, or filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  budget={filters.budget}
                  minGrams={filters.minGrams}
                  avgPpg={avgPpgByBucket[`${p.cannabinoid}|${p.category}`]}
                  badges={badgeMap.get(p.id) ?? []}
                  crossStore={crossStore.get(p.id)}
                  onCompareStrain={compareStrain}
                  saved={watch.savedIds.has(p.id)}
                  onToggleSave={toggleWatch}
                  priority={i === 0}
                  onAdd={(item) => {
                    cart.add(item)
                    setCartOpen(true)
                  }}
                  onCheckoutStore={checkoutAtStore}
                />
              ))}
            </div>

            {visibleCount < filtered.length && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="rounded-full border border-gold/40 bg-white/5 px-6 py-3 text-sm font-black text-mint transition hover:bg-white/10"
                >
                  Load more deals ({filtered.length - visibleCount} left)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        filters={filters}
        setFilter={setFilter}
        resultCount={filtered.length}
        stores={stores}
        strains={strains}
        categories={categories}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        total={cart.total}
        onRemove={cart.remove}
        onChangeQty={cart.changeQty}
        cartStores={cartStores}
        onCheckout={checkoutAtStore}
        isAuthed={!!session?.user}
      />

      <WatchlistDrawer
        open={watchOpen}
        onClose={() => setWatchOpen(false)}
        items={watch.items}
        products={products}
        onRemove={watch.remove}
        onResnapshot={watch.resnapshot}
        onClear={watch.clear}
        isAuthed={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-gold/40 bg-navy px-5 py-2.5 text-sm font-black text-mint shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
