"use client"

import { X } from "lucide-react"
import { CANNABINOIDS, QUANTITY_OPTIONS, SORTS, sortLabel, type Filters } from "@/lib/filters"

const selectClass =
  "w-full rounded-xl border border-gold/25 bg-navy/60 px-3 py-2.5 text-sm font-semibold text-mint outline-none focus:border-lime"

export function MobileDrawer({
  open,
  onClose,
  filters,
  setFilter,
  resultCount,
  stores,
  strains,
  categories,
}: {
  open: boolean
  onClose: () => void
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  resultCount: number
  stores: string[]
  strains: string[]
  categories: string[]
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Filters"
        className={`fixed left-0 top-0 z-[61] flex h-full w-[min(86vw,360px)] flex-col overflow-y-auto border-r border-gold/25 p-4 shadow-[18px_0_45px_rgba(0,0,0,0.45)] transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(160deg,#071423,#0b2138 45%,#0f5132)" }}
      >
        <header className="mb-4 flex items-center justify-between border-b border-gold/25 pb-4">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide">Legal-Leaf Market</h2>
            <p className="mt-0.5 text-[0.64rem] uppercase tracking-widest text-gold">
              Deals + budget
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Store */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Store
          </label>
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
        </section>

        {/* Sort */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-gradient-to-b from-lime/10 to-gold/10 p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Best Deals
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setFilter("sort", s.value)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-black transition ${
                  filters.sort === s.value
                    ? "border-transparent bg-gradient-to-r from-lime to-gold text-navy"
                    : "border-gold/30 bg-mint/[0.06] text-mint"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">Current sort: {sortLabel(filters.sort)}</p>
        </section>

        {/* Min Quantity */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Min Quantity
          </label>
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
          <p className="mt-2 text-xs leading-relaxed text-mint/80">
            Only shows products offering at least this weight, and narrows each product&apos;s size
            options to match.
          </p>
        </section>

        {/* Budget */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Budget amount
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-mint/15 bg-black/25 px-3 py-2">
            <span className="font-black text-lime">$</span>
            <input
              type="number"
              min={0}
              placeholder="Example: 75"
              value={filters.budget || ""}
              onChange={(e) => setFilter("budget", Number(e.target.value) || 0)}
              className="w-full bg-transparent text-lg text-white outline-none"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mint/80">
            {filters.budget > 0
              ? `Showing ${resultCount} products at or under $${filters.budget.toFixed(2)} including estimated shipping.`
              : "Enter a budget to show products that fit after estimated shipping."}
          </p>
          <button
            onClick={() => setFilter("budget", 0)}
            className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-lime to-gold py-2 text-sm font-black text-navy"
          >
            Clear budget
          </button>
        </section>

        {/* Cannabinoid */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Cannabinoid
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CANNABINOIDS.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilter("cannabinoid", c.value)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-black transition ${
                  filters.cannabinoid === c.value
                    ? "border-transparent bg-gradient-to-r from-lime to-gold text-navy"
                    : "border-gold/30 bg-mint/[0.06] text-mint"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Strain */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Strain ({strains.length})
          </label>
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
        </section>

        {/* Category */}
        <section className="mb-4 rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5">
          <label className="mb-2 block text-[0.66rem] font-black uppercase tracking-widest text-gold">
            Category
          </label>
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
        </section>

        {/* Hide CBD */}
        <label className="mb-4 flex cursor-pointer select-none items-center justify-between rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5 text-sm font-black text-mint">
          <span>Hide CBD products</span>
          <input
            type="checkbox"
            checked={filters.hideCbd}
            onChange={(e) => setFilter("hideCbd", e.target.checked)}
            className="h-5 w-5 accent-lime"
          />
        </label>

        {/* Hide Trim/Shake */}
        <label className="mb-4 flex cursor-pointer select-none items-center justify-between rounded-2xl border border-gold/20 bg-white/[0.06] p-3.5 text-sm font-black text-mint">
          <span>
            Hide trim &amp; shake
            <span className="mt-0.5 block text-[0.66rem] font-semibold normal-case text-mint/70">
              Keeps cheap byproduct out of the $/g sort
            </span>
          </span>
          <input
            type="checkbox"
            checked={filters.hideTrim}
            onChange={(e) => setFilter("hideTrim", e.target.checked)}
            className="h-5 w-5 accent-lime"
          />
        </label>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Legal-Leaf Market uses estimated shipping only for budget filtering and comparison.
        </p>
      </aside>
    </>
  )
}
