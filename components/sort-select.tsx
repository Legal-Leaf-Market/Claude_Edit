"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SORT_OPTIONS } from "@/lib/search/types"

export function SortSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("sort") ?? (params.get("q") ? "relevance" : "price_asc")

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString())
          next.set("sort", e.target.value)
          next.delete("page")
          router.push(`${pathname}?${next.toString()}`, { scroll: false })
        }}
        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-[var(--popover)]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
