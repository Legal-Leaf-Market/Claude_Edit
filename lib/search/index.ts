import { env } from "@/lib/env"
import { priceBounds, searchPostgres } from "./postgres"
import { searchTypesense } from "./typesense"
import type { SearchParams, SearchResult, ShippingFilter, SortOption } from "./types"

/**
 * Search facade.
 *
 * Typesense when it is configured and healthy, Postgres otherwise. A Typesense
 * failure falls THROUGH to Postgres rather than erroring the page: a search
 * cluster hiccup should degrade latency, not take the storefront down.
 *
 * The fallback is logged and reported through `backend` on the result, so a
 * silent permanent fallback is visible on /api/health rather than being
 * mistaken for everything working.
 */
export async function search(params: SearchParams): Promise<SearchResult> {
  // Shuffle is a seeded round-robin across shops, expressed as a window
  // function. Typesense has no equivalent, so this one sort always answers
  // from Postgres rather than silently degrading to a different order.
  if (params.sort === "shuffle") return searchPostgres(params)

  if (env.typesense.isConfigured) {
    try {
      const result = await searchTypesense(params)
      if (result) return result
    } catch (error) {
      console.error(
        `[search] Typesense query failed, falling back to Postgres: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  return searchPostgres(params)
}

export { priceBounds }
export * from "./types"

/* -------------------------------------------------------------------------- */
/*  URL <-> params                                                            */
/* -------------------------------------------------------------------------- */

const SORTS: SortOption[] = ["relevance", "price_asc", "price_desc", "newest", "deal", "shuffle"]
const SHIPPING: ShippingFilter[] = ["any", "local", "shippable"]

function multi(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const list = (Array.isArray(value) ? value : value.split(","))
    .map((v) => v.trim())
    .filter(Boolean)
  return list.length ? list : undefined
}

function dollarsToCents(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n * 100)
}

/**
 * Read search params off a URL query object.
 *
 * Everything is validated rather than trusted: `sort` and `shipping` are
 * checked against their allowed sets so a crafted URL cannot reach the SQL
 * builder with an unexpected value.
 */
export function paramsFromQuery(
  query: Record<string, string | string[] | undefined>,
): SearchParams {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const sort = first(query.sort) as SortOption | undefined
  const shipping = first(query.shipping) as ShippingFilter | undefined
  const page = Number.parseInt(first(query.page) ?? "1", 10)
  // Clamped to a plain non-negative integer: it is concatenated into a hash
  // input, so it must never carry anything but a number.
  const rawSeed = Number.parseInt(first(query.seed) ?? "", 10)
  const seed = Number.isFinite(rawSeed) && rawSeed >= 0 ? rawSeed % 1_000_000 : undefined

  return {
    q: first(query.q)?.trim() || undefined,
    brands: multi(query.brand),
    categories: multi(query.category),
    conditions: multi(query.condition),
    sources: multi(query.source) as SearchParams["sources"],
    minPriceCents: dollarsToCents(first(query.min)),
    maxPriceCents: dollarsToCents(first(query.max)),
    dealsOnly: first(query.deals) === "1",
    shipsAll: first(query.ships) === "all",
    shipping: shipping && SHIPPING.includes(shipping) ? shipping : "any",
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    seed,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Build a query string from params, omitting defaults so URLs stay short and cacheable. */
export function queryFromParams(params: SearchParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.brands?.length) search.set("brand", params.brands.join(","))
  if (params.categories?.length) search.set("category", params.categories.join(","))
  if (params.conditions?.length) search.set("condition", params.conditions.join(","))
  if (params.sources?.length) search.set("source", params.sources.join(","))
  if (params.minPriceCents != null) search.set("min", String(params.minPriceCents / 100))
  if (params.maxPriceCents != null) search.set("max", String(params.maxPriceCents / 100))
  if (params.dealsOnly) search.set("deals", "1")
  if (params.shipsAll) search.set("ships", "all")
  if (params.shipping && params.shipping !== "any") search.set("shipping", params.shipping)
  if (params.sort) search.set("sort", params.sort)
  // Only carried for shuffle: on any other sort it would just make otherwise
  // identical URLs look distinct and split the cache.
  if (params.sort === "shuffle" && params.seed != null) search.set("seed", String(params.seed))
  if (params.page && params.page > 1) search.set("page", String(params.page))
  return search.toString()
}
