export type SortKey =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "ppg-asc"
  | "value-asc"
  | "name-asc"
  | "budget-best"

export type Filters = {
  store: string
  search: string
  cannabinoid: string
  strain: string
  category: string
  sort: SortKey
  budget: number
  minGrams: number
  hideCbd: boolean
  // Hide trim/shake/kief so cheap byproduct doesn't dominate the $/g model.
  hideTrim: boolean
  // Selected badge ids to filter by (a product must carry ALL of them).
  badges: string[]
}

export const DEFAULT_FILTERS: Filters = {
  store: "all",
  search: "",
  cannabinoid: "all",
  strain: "all",
  category: "all",
  sort: "newest",
  budget: 0,
  minGrams: 0,
  hideCbd: true,
  hideTrim: true,
  badges: [],
}

// Minimum-quantity tiers. `value` is a gram threshold; products/variants must
// offer at least this weight to qualify (0 = any quantity).
export const QUANTITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any quantity" },
  { value: 3.5, label: "Eighth+ (3.5g)" },
  { value: 7, label: "Quarter+ (7g)" },
  { value: 14, label: "Half Oz+ (14g)" },
  { value: 28, label: "Ounce+ (28g)" },
  { value: 112, label: "Quarter Pound+ (112g)" },
  { value: 224, label: "Half Pound+ (224g)" },
  { value: 448, label: "Pound (448g)" },
]

export const CANNABINOIDS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "thca", label: "THCa" },
  { value: "cbd", label: "CBD" },
  { value: "d8", label: "Δ8" },
  { value: "d9", label: "Δ9" },
]

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Cheapest" },
  { value: "price-desc", label: "Highest Price" },
  { value: "ppg-asc", label: "Best $/g" },
  { value: "value-asc", label: "Best $/100mg" },
  { value: "name-asc", label: "A-Z" },
  { value: "budget-best", label: "Best Fit" },
]

export function sortLabel(value: SortKey): string {
  return SORTS.find((s) => s.value === value)?.label ?? value
}
