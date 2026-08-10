"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CategoryIcon, CATEGORY_HUE } from "@/components/category-icon"
import { StoreMark } from "@/components/store-mark"
import { sortByCategoryPriority } from "@/lib/categories"
import { sourceLabel, slugifyCategory } from "@/lib/utils"
import type { Facets, FacetValue } from "@/lib/search/types"

/**
 * Filter rail.
 *
 * On mobile it collapses to a sheet behind a "Filters" button, because a
 * permanently visible rail on a phone pushes the actual results below the fold.
 *
 * Every control writes to the URL rather than to local state. That keeps a
 * filtered view shareable and back-button friendly, and means the server
 * component is the single source of truth for what is on screen.
 */

type Props = {
  facets: Facets
  found: number
  /**
   * Facets to leave out because the page itself already fixes them. A store
   * page is scoped to one store, so offering a store filter there would just
   * navigate the shopper off the store they are looking at; same for category
   * on a category page. The underlying query still applies the scope, this
   * only hides a control that could contradict it.
   */
  hide?: (keyof Facets)[]
}

export function FilterSidebar({ facets, found, hide }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Portals need a DOM to attach to, which does not exist during SSR.
  useEffect(() => setMounted(true), [])

  // Close the sheet on Escape, and lock body scroll while it is open so the
  // page behind does not scroll under the shopper's finger.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // Move focus into the dialog so a keyboard or screen reader user is not
    // left behind on the trigger button.
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      <div className="mb-4 lg:hidden">
        <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
        </Button>
      </div>

      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filters">
        <FilterControls facets={facets} found={found} hide={hide} />
      </aside>

      {/*
        Mobile sheet, rendered through a PORTAL onto document.body.
        This is load bearing, not stylistic. globals.css gives every direct
        child of body a stacking context (z-index 1, so the decorative
        background layer stays behind content), and the site header carries
        z-40. A sheet rendered in place would be trapped inside <main>'s
        context, and the header would paint straight over its close button.
        Portalling to body escapes every ancestor context.
      */}
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] lg:hidden">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-[var(--popover)] shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-sm font-black text-[var(--cream)]">Filters</h2>
                <Button
                  ref={closeButtonRef}
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <FilterControls facets={facets} found={found} hide={hide} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/* -------------------------------------------------------------------------- */

function FilterControls({
  facets,
  found,
  hide,
  onNavigate,
}: Props & { onNavigate?: () => void }) {
  const hidden = new Set(hide ?? [])
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  /** Rewrite one query key and navigate. Paging always resets on a filter change. */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value === null || value === "") next.delete(key)
      else next.set(key, value)
      next.delete("page")
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
      onNavigate?.()
    },
    [params, pathname, router, onNavigate],
  )

  /** Toggle one value inside a comma-separated multi-select key. */
  const toggleValue = useCallback(
    (key: string, value: string) => {
      const current = (params.get(key) ?? "").split(",").filter(Boolean)
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      setParam(key, next.join(","))
    },
    [params, setParam],
  )

  const selected = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean)
  const shipping = params.get("shipping") ?? "any"
  const dealsOnly = params.get("deals") === "1"

  const hasFilters =
    dealsOnly ||
    shipping !== "any" ||
    ["brand", "category", "condition", "source", "min", "max"].some((k) => params.get(k))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">
          {found.toLocaleString()} {found === 1 ? "listing" : "listings"}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              // Keep the text query; clearing filters should not clear the search.
              const q = params.get("q")
              router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false })
              onNavigate?.()
            }}
            className="text-xs text-[var(--amber)] underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Price
        </legend>
        <label className="flex items-center gap-2 text-sm text-[var(--cream)]">
          <input
            type="checkbox"
            checked={dealsOnly}
            onChange={(e) => setParam("deals", e.target.checked ? "1" : null)}
            className="h-4 w-4 accent-[var(--amber)]"
          />
          Below market only
        </label>
        <div className="flex items-center gap-2 pt-1">
          <PriceInput label="Min" value={params.get("min") ?? ""} onCommit={(v) => setParam("min", v)} />
          <span className="text-[var(--muted-foreground)]">to</span>
          <PriceInput label="Max" value={params.get("max") ?? ""} onCommit={(v) => setParam("max", v)} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Delivery
        </legend>
        <div className="flex rounded-full border border-[var(--line)] p-0.5">
          {(
            [
              ["any", "All"],
              ["shippable", "Ships"],
              ["local", "Local"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam("shipping", value === "any" ? null : value)}
              aria-pressed={shipping === value}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${
                shipping === value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--cream)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {!hidden.has("source") && (
      <FacetGroup
        title="Store"
        values={facets.source}
        selected={selected("source")}
        onToggle={(v) => toggleValue("source", v)}
        renderLabel={sourceLabel}
        renderMark={(v) => <StoreMark source={v} name={sourceLabel(v)} size="sm" />}
      />
      )}
      {!hidden.has("category") && (
      <FacetGroup
        title="Category"
        values={sortByCategoryPriority(facets.category)}
        selected={selected("category")}
        onToggle={(v) => toggleValue("category", v)}
        renderMark={(v) => (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{
              background: `${CATEGORY_HUE[slugifyCategory(v)] ?? "#f0a830"}22`,
              color: CATEGORY_HUE[slugifyCategory(v)] ?? "#f0a830",
            }}
          >
            <CategoryIcon slug={slugifyCategory(v)} className="h-3.5 w-3.5" />
          </span>
        )}
      />
      )}
      {!hidden.has("brand") && (
      <FacetGroup
        title="Brand"
        values={facets.brand}
        selected={selected("brand")}
        onToggle={(v) => toggleValue("brand", v)}
        collapsibleAfter={8}
      />
      )}
      {!hidden.has("condition") && (
      <FacetGroup
        title="Condition"
        values={facets.condition}
        selected={selected("condition")}
        onToggle={(v) => toggleValue("condition", v)}
      />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Price input that commits on blur or Enter rather than on every keystroke.
 * Navigating per character would fire a search for "1", "12", "125" on the way
 * to "1250".
 */
function PriceInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string | null) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === value) return
    onCommit(trimmed === "" ? null : trimmed)
  }

  return (
    <label className="flex-1">
      <span className="sr-only">{label} price</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
        }}
        className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--chip)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
    </label>
  )
}

function FacetGroup({
  title,
  values,
  selected,
  onToggle,
  renderLabel,
  renderMark,
  collapsibleAfter,
}: {
  title: string
  values: FacetValue[]
  selected: string[]
  onToggle: (value: string) => void
  renderLabel?: (value: string) => string
  /** Optional leading glyph, so store and category rows read visually. */
  renderMark?: (value: string) => React.ReactNode
  collapsibleAfter?: number
}) {
  const [expanded, setExpanded] = useState(false)
  if (values.length === 0) return null

  // Zero-count options are already excluded by the facet query, following the
  // sister sites' rule that no visible choice can land on an empty grid.
  const limit = collapsibleAfter && !expanded ? collapsibleAfter : values.length
  const shown = values.slice(0, limit)

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </legend>
      <div className="space-y-1.5">
        {shown.map((facet) => (
          <label
            key={facet.value}
            className="flex cursor-pointer items-center justify-between gap-2 text-sm text-[var(--cream)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(facet.value)}
                onChange={() => onToggle(facet.value)}
                className="h-4 w-4 shrink-0 accent-[var(--amber)]"
              />
              {renderMark?.(facet.value)}
              <span className="truncate">{renderLabel ? renderLabel(facet.value) : facet.value}</span>
            </span>
            <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{facet.count}</span>
          </label>
        ))}
      </div>
      {collapsibleAfter && values.length > collapsibleAfter && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-[var(--amber)] underline-offset-2 hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${values.length}`}
        </button>
      )}
    </fieldset>
  )
}
