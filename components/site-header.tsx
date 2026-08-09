"use client"

import { Bell, Menu, Search, ShoppingCart, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { CANNABINOIDS, QUANTITY_OPTIONS, SORTS, type Filters } from "@/lib/filters"
import { AccountButton } from "@/components/account-button"

const selectClass =
  "w-full rounded-xl border border-gold/25 bg-navy/60 px-3.5 py-2.5 text-sm font-semibold text-mint outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20"
const labelClass = "mb-1.5 block text-[0.64rem] font-black uppercase tracking-widest text-gold"

export function SiteHeader({
  filters,
  setFilter,
  categories,
  strains,
  stores,
  cartCount,
  onOpenCart,
  watchCount,
  watchAlerts,
  onOpenWatch,
  onOpenMenu,
}: {
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  categories: string[]
  strains: string[]
  stores: string[]
  cartCount: number
  onOpenCart: () => void
  watchCount: number
  watchAlerts: number
  onOpenWatch: () => void
  onOpenMenu: () => void
}) {
  // Desktop-only: filters are hidden/shown manually via a toggle button.
  const [filtersHidden, setFiltersHidden] = useState(false)

  return (
    <header
      className="sticky top-0 z-50 overflow-hidden border-b border-gold/25 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg,rgba(7,20,35,0.72),rgba(15,81,50,0.72))",
      }}
    >
      {/* Continuous paisley across the whole header: the violet banner at the
          top melts down through a teal middle into the emerald page art below,
          so the header background and the page background read as one pattern. */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top opacity-35 mix-blend-screen"
        style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(109,75,214,0.42) 0%, rgba(24,160,180,0.26) 52%, rgba(15,81,50,0) 100%)",
        }}
        aria-hidden
      />

      {/* Hero banner — black & white, always visible and frozen at the top. */}
      <div className="relative block overflow-hidden">
        {/* Stronger violet paisley to anchor the top of the blend */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-55 mix-blend-screen"
          style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 130% at 50% -10%, rgba(109,75,214,0.28) 0, transparent 60%), radial-gradient(50% 100% at 82% 0, rgba(58,123,255,0.20) 0, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-3 px-4 pb-5 pt-7 text-center">
          <h1 className="relative text-3xl font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] sm:text-4xl">
            Legal-Leaf Market
            <span className="sr-only">
              {" "}
              — Compare legal hemp prices: THCA, Delta-8, Delta-9 & CBD deals by price per gram
            </span>
          </h1>
          <span
            className="relative h-1 w-40 rounded-full"
            style={{ background: "linear-gradient(90deg,transparent,#6d4bd6,#3a7bff,#fff,transparent)" }}
            aria-hidden
          />
        </div>
      </div>

      {/* Tight top line — logo, name, cart together */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenMenu}
              aria-label="Open filters menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/40 bg-white/10 text-mint md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setFiltersHidden((v) => !v)}
              aria-label={filtersHidden ? "Show filters" : "Hide filters"}
              aria-pressed={!filtersHidden}
              className="relative hidden h-10 items-center gap-2 rounded-xl border border-gold/40 bg-white/10 px-3.5 text-sm font-black text-mint transition hover:bg-white/15 md:flex"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {filtersHidden ? "Show Filters" : "Hide Filters"}
            </button>

            <AccountButton />

            <button
              onClick={onOpenWatch}
              aria-label={
                watchAlerts > 0
                  ? `Open watchlist, ${watchAlerts} price alert${watchAlerts === 1 ? "" : "s"}`
                  : "Open watchlist"
              }
              className="relative flex h-10 items-center gap-2 rounded-xl border border-gold/40 bg-white/10 px-3.5 text-sm font-black text-mint transition hover:bg-white/15"
            >
              <Bell className="h-5 w-5" />
              <span className="hidden sm:inline">Watchlist</span>
              {watchCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-black text-navy">
                  {watchCount}
                </span>
              )}
              {watchAlerts > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-lime" />
                </span>
              )}
            </button>

            <button
              onClick={onOpenCart}
              aria-label="Open cart"
              className="relative flex h-10 items-center gap-2 rounded-xl border border-gold/40 bg-white/10 px-3.5 text-sm font-black text-mint transition hover:bg-white/15"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden sm:inline">Cart</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-xs font-black text-navy">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop filters — roomy, centered panel. Toggled manually via the
            Show/Hide Filters button; no scroll-driven animation to glitch. */}
        <div className={`overflow-hidden pb-4 ${filtersHidden ? "hidden" : "md:block hidden"}`}>
          <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {/* The filter panel is the "middle" of the blend: same paisley, but
                tinted teal/blue between the violet banner and the emerald page. */}
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen"
              style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(24,160,180,0.18) 0%, rgba(58,123,255,0.12) 60%, rgba(15,81,50,0.14) 100%)",
              }}
              aria-hidden
            />
            <div className="relative grid grid-cols-6 gap-x-5 gap-y-4">
              <div className="col-span-2">
                <label className={labelClass}>Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
                  <input
                    className={`${selectClass} pl-10`}
                    placeholder="Search strain, store, category..."
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Store</label>
                <select
                  className={selectClass}
                  value={filters.store}
                  onChange={(e) => setFilter("store", e.target.value)}
                >
                  <option value="all">All Stores</option>
                  {stores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Cannabinoid</label>
                <select
                  className={selectClass}
                  value={filters.cannabinoid}
                  onChange={(e) => setFilter("cannabinoid", e.target.value)}
                >
                  {CANNABINOIDS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Strain ({strains.length})</label>
                <select
                  className={selectClass}
                  value={filters.strain}
                  onChange={(e) => setFilter("strain", e.target.value)}
                >
                  <option value="all">All Strains</option>
                  {strains.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Sort</label>
                <select
                  className={selectClass}
                  value={filters.sort}
                  onChange={(e) => setFilter("sort", e.target.value as Filters["sort"])}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  className={selectClass}
                  value={filters.category}
                  onChange={(e) => setFilter("category", e.target.value)}
                >
                  <option value="all">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Min Quantity</label>
                <select
                  className={selectClass}
                  value={filters.minGrams}
                  onChange={(e) => setFilter("minGrams", Number(e.target.value))}
                >
                  {QUANTITY_OPTIONS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Budget ($)</label>
                <input
                  type="number"
                  min={0}
                  className={selectClass}
                  placeholder="e.g. 75"
                  value={filters.budget || ""}
                  onChange={(e) => setFilter("budget", Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Actions row */}
            <div className="relative mt-5 flex items-center justify-center gap-3 border-t border-gold/15 pt-4">
              <button
                onClick={() => setFilter("sort", "ppg-asc")}
                className="rounded-xl bg-gradient-to-r from-lime to-gold px-6 py-2.5 text-sm font-black text-navy transition hover:brightness-105"
              >
                Best Deals
              </button>
              <button
                onClick={() => setFilter("budget", 0)}
                className="rounded-xl border border-gold/30 bg-white/5 px-5 py-2.5 text-sm font-bold text-mint transition hover:bg-white/10"
              >
                Clear Budget
              </button>
              <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-gold/25 bg-navy/60 px-4 py-2.5 text-sm font-bold text-mint">
                <input
                  type="checkbox"
                  checked={filters.hideCbd}
                  onChange={(e) => setFilter("hideCbd", e.target.checked)}
                  className="h-4 w-4 accent-lime"
                />
                Hide CBD
              </label>
              <label
                className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-gold/25 bg-navy/60 px-4 py-2.5 text-sm font-bold text-mint"
                title="Hide trim, shake & kief so cheap byproduct doesn't distort the price-per-gram sort"
              >
                <input
                  type="checkbox"
                  checked={filters.hideTrim}
                  onChange={(e) => setFilter("hideTrim", e.target.checked)}
                  className="h-4 w-4 accent-lime"
                />
                Hide Trim/Shake
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Paisley connector seam. When the filters (the teal "middle") are
          collapsed, this slim band keeps the banner's pattern flowing into the
          page background — but in a different blue/gold accent so the seam
          reads as its own step. Always shown on mobile (no desktop filter
          panel there); on desktop only when filters are hidden. */}
      <div
        className={`relative h-2.5 w-full overflow-hidden ${filtersHidden ? "" : "md:hidden"}`}
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50 mix-blend-screen"
          style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(58,123,255,0.55), rgba(214,181,109,0.6), rgba(58,123,255,0.55), transparent)",
          }}
        />
      </div>
    </header>
  )
}
