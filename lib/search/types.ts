import type { Source } from "@/lib/db/schema"

/** Shipping intent. Local pickup and shippable are genuinely different shopping modes. */
export type ShippingFilter = "any" | "local" | "shippable"

export type SortOption = "relevance" | "price_asc" | "price_desc" | "newest" | "deal" | "shuffle"

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "deal", label: "Biggest discount" },
  { value: "newest", label: "Newly listed" },
  { value: "shuffle", label: "Shuffle the shops" },
]

export type SearchParams = {
  q?: string
  brands?: string[]
  categories?: string[]
  conditions?: string[]
  sources?: Source[]
  minPriceCents?: number
  maxPriceCents?: number
  dealsOnly?: boolean
  shipping?: ShippingFilter
  /** Restrict to one canonical gear row, used by the gear detail page. */
  canonicalGearId?: string
  sort?: SortOption
  /**
   * Only meaningful for sort=shuffle. Fixes which shuffle you get, so paging
   * through a shuffled result set stays consistent instead of re-drawing (and
   * repeating or skipping listings) on every page. The shuffle button just
   * picks a new one.
   */
  seed?: number
  page?: number
  perPage?: number
}

export type SearchHit = {
  id: string
  source: string
  externalId: string
  title: string
  /** Short excerpt for the card's back face. Not indexed for filtering, display only. */
  description: string | null
  priceCents: number
  currency: string
  condition: string | null
  brand: string | null
  primaryImageUrl: string | null
  isLocalPickup: boolean
  isShippable: boolean
  isDeal: boolean
  dealMargin: number | null
  listingStatus: string
  listedAt: string | null
  canonicalGearId: string | null
  gearSlug: string | null
  gearBrand: string | null
  gearModel: string | null
  gearCategory: string | null
  marketPriceCents: number | null
}

export type FacetValue = { value: string; count: number }

export type Facets = {
  source: FacetValue[]
  brand: FacetValue[]
  category: FacetValue[]
  condition: FacetValue[]
}

export type SearchResult = {
  hits: SearchHit[]
  found: number
  page: number
  perPage: number
  facets: Facets
  /** Which engine answered. Surfaced on /api/health so a silent fallback is visible. */
  backend: "typesense" | "postgres"
  tookMs: number
}

export const DEFAULT_PER_PAGE = 24
export const MAX_PER_PAGE = 96

export function emptyFacets(): Facets {
  return { source: [], brand: [], category: [], condition: [] }
}

/** Clamp and default user-supplied paging so a crafted URL cannot ask for 10,000 rows. */
export function normalizeParams(params: SearchParams): Required<Pick<SearchParams, "page" | "perPage" | "sort" | "shipping">> {
  return {
    page: Math.max(1, Math.floor(params.page ?? 1)),
    perPage: Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(params.perPage ?? DEFAULT_PER_PAGE))),
    // Most listings here are single-source (one manufacturer, one store), so
    // a cheapest-first default surfaces whatever happens to be the least
    // expensive item on the site rather than anything relevant. Newest first
    // is a better browse default; price sorting earns its keep once a
    // shopper has actually narrowed down what they are looking for (a text
    // query, or a specific instrument's own deals page).
    sort: params.sort ?? (params.q ? "relevance" : "newest"),
    shipping: params.shipping ?? "any",
  }
}
