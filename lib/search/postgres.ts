import { sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  DEFAULT_PER_PAGE,
  emptyFacets,
  normalizeParams,
  type Facets,
  type FacetValue,
  type SearchHit,
  type SearchParams,
  type SearchResult,
} from "./types"

/**
 * Postgres search backend.
 *
 * This is the fallback when Typesense is not configured, and it is a real
 * backend rather than a stub: the site is fully usable on Postgres alone, which
 * is what lets Gear Avail deploy before any search infrastructure exists.
 *
 * Text matching is trigram similarity on the title (GIN indexed), unioned with
 * a plain ILIKE so that short exact substrings like "SM58" still match when
 * their trigram similarity against a long title is low.
 *
 * FACET COUNTING follows the sister sites' rule: each facet's counts are
 * computed with every OTHER filter applied but not its own. That way no visible
 * option can lead to an empty grid, and picking a second brand widens rather
 * than silently zeroes the results.
 */

/** Below this, trigram similarity is noise rather than a match. */
const SIMILARITY_FLOOR = 0.15

type Conditions = {
  text: SQL | null
  source: SQL | null
  brand: SQL | null
  category: SQL | null
  condition: SQL | null
  price: SQL | null
  deals: SQL | null
  shipping: SQL | null
  gear: SQL | null
  /** Always applied: never show ended listings in search. */
  status: SQL
}

function buildConditions(params: SearchParams): Conditions {
  const { shipping } = normalizeParams(params)
  const q = params.q?.trim()

  return {
    status: sql`l.listing_status = 'active'`,

    text: q
      ? sql`(l.title ILIKE ${"%" + q + "%"}
             OR similarity(l.title, ${q}) > ${SIMILARITY_FLOOR}
             OR g.brand ILIKE ${"%" + q + "%"}
             OR g.model ILIKE ${"%" + q + "%"})`
      : null,

    source: params.sources?.length
      ? sql`l.source IN ${params.sources}`
      : null,

    brand: params.brands?.length
      ? sql`COALESCE(g.brand, l.brand) IN ${params.brands}`
      : null,

    category: params.categories?.length ? sql`g.category IN ${params.categories}` : null,

    condition: params.conditions?.length ? sql`l.condition IN ${params.conditions}` : null,

    price:
      params.minPriceCents != null || params.maxPriceCents != null
        ? sql`l.price_cents BETWEEN ${params.minPriceCents ?? 0} AND ${params.maxPriceCents ?? 2_147_483_647}`
        : null,

    deals: params.dealsOnly ? sql`l.is_deal = true` : null,

    shipping:
      shipping === "local"
        ? sql`l.is_local_pickup = true`
        : shipping === "shippable"
          ? sql`l.is_shippable = true`
          : null,

    gear: params.canonicalGearId ? sql`l.canonical_gear_id = ${params.canonicalGearId}` : null,
  }
}

/** Join a set of conditions into one WHERE clause, skipping the nulls. */
function whereFrom(parts: (SQL | null)[]): SQL {
  const active = parts.filter((p): p is SQL => p !== null)
  if (active.length === 0) return sql`TRUE`
  return active.reduce((acc, part) => sql`${acc} AND ${part}`)
}

function allExcept(conditions: Conditions, exclude: keyof Conditions | null): SQL {
  const keys = Object.keys(conditions) as (keyof Conditions)[]
  return whereFrom(keys.filter((k) => k !== exclude).map((k) => conditions[k]))
}

function orderBy(params: SearchParams): SQL {
  const { sort } = normalizeParams(params)
  const q = params.q?.trim()
  switch (sort) {
    case "shuffle": {
      // Round-robin across shops rather than a flat random draw. A plain
      // random ordering is still proportional to catalogue size, so the
      // biggest store would take roughly a quarter of every page; ranking
      // within each source and then ordering by that rank puts one listing
      // from each shop first, then a second from each, and so on. Small
      // stores become visible without commission touching the ordering
      // (house rule: rank never follows payout).
      //
      // The hash is seeded and deterministic so paging through a shuffled
      // set stays stable; a new seed is a new shuffle.
      const seed = String(params.seed ?? 0)
      const roll = sql`md5(l.id::text || ${seed})`
      return sql`ROW_NUMBER() OVER (PARTITION BY l.source ORDER BY ${roll}), ${roll}`
    }
    case "price_asc":
      return sql`l.price_cents ASC, l.updated_at DESC`
    case "price_desc":
      return sql`l.price_cents DESC, l.updated_at DESC`
    case "newest":
      return sql`COALESCE(l.listed_at, l.created_at) DESC`
    case "deal":
      // Nulls last: an unflagged listing must not outrank a real discount.
      return sql`l.deal_margin DESC NULLS LAST, l.price_cents ASC`
    case "relevance":
    default:
      return q
        ? sql`similarity(l.title, ${q}) DESC, l.is_deal DESC, l.price_cents ASC`
        : sql`l.is_deal DESC, l.price_cents ASC`
  }
}

/* -------------------------------------------------------------------------- */
/*  Row mapping                                                               */
/* -------------------------------------------------------------------------- */

type RawRow = {
  id: string
  source: string
  external_id: string
  title: string
  price_cents: number
  currency: string
  condition: string | null
  brand: string | null
  primary_image_url: string | null
  is_local_pickup: boolean
  is_shippable: boolean
  is_deal: boolean
  deal_margin: number | null
  listing_status: string
  listed_at: Date | string | null
  canonical_gear_id: string | null
  gear_slug: string | null
  gear_brand: string | null
  gear_model: string | null
  gear_category: string | null
  market_price_cents: number | null
}

function toHit(row: RawRow): SearchHit {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    title: row.title,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    condition: row.condition,
    brand: row.gear_brand ?? row.brand,
    primaryImageUrl: row.primary_image_url,
    isLocalPickup: row.is_local_pickup,
    isShippable: row.is_shippable,
    isDeal: row.is_deal,
    dealMargin: row.deal_margin == null ? null : Number(row.deal_margin),
    listingStatus: row.listing_status,
    listedAt: row.listed_at ? new Date(row.listed_at).toISOString() : null,
    canonicalGearId: row.canonical_gear_id,
    gearSlug: row.gear_slug,
    gearBrand: row.gear_brand,
    gearModel: row.gear_model,
    gearCategory: row.gear_category,
    marketPriceCents: row.market_price_cents == null ? null : Number(row.market_price_cents),
  }
}

/* -------------------------------------------------------------------------- */
/*  Facets                                                                    */
/* -------------------------------------------------------------------------- */

async function facetCounts(
  expression: SQL,
  where: SQL,
  limit = 40,
): Promise<FacetValue[]> {
  const result = await db.execute<{ value: string; count: number }>(sql`
    SELECT ${expression} AS value, COUNT(*)::int AS count
    FROM marketplace_listings l
    LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
    WHERE ${where} AND ${expression} IS NOT NULL AND ${expression} <> ''
    GROUP BY 1
    ORDER BY count DESC, value ASC
    LIMIT ${limit}
  `)
  return result.rows.map((r) => ({ value: r.value, count: Number(r.count) }))
}

async function buildFacets(conditions: Conditions): Promise<Facets> {
  // Each facet excludes only its own filter, so selecting one value never
  // empties that facet's own list of alternatives.
  const [source, brand, category, condition] = await Promise.all([
    facetCounts(sql`l.source`, allExcept(conditions, "source")),
    facetCounts(sql`COALESCE(g.brand, l.brand)`, allExcept(conditions, "brand")),
    facetCounts(sql`g.category`, allExcept(conditions, "category")),
    facetCounts(sql`l.condition`, allExcept(conditions, "condition")),
  ])
  return { source, brand, category, condition }
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export async function searchPostgres(params: SearchParams): Promise<SearchResult> {
  const started = Date.now()
  const { page, perPage } = normalizeParams(params)
  const conditions = buildConditions(params)
  const where = allExcept(conditions, null)
  const offset = (page - 1) * perPage

  const [rows, countResult, facets] = await Promise.all([
    db.execute<RawRow>(sql`
      SELECT
        l.id, l.source, l.external_id, l.title, l.price_cents, l.currency,
        l.condition, l.brand, l.primary_image_url, l.is_local_pickup,
        l.is_shippable, l.is_deal, l.deal_margin, l.listing_status, l.listed_at,
        l.canonical_gear_id,
        g.slug AS gear_slug, g.brand AS gear_brand, g.model AS gear_model,
        g.category AS gear_category, g.avg_used_price_cents AS market_price_cents
      FROM marketplace_listings l
      LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
      WHERE ${where}
      ORDER BY ${orderBy(params)}
      LIMIT ${perPage} OFFSET ${offset}
    `),
    db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM marketplace_listings l
      LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
      WHERE ${where}
    `),
    buildFacets(conditions),
  ])

  return {
    hits: rows.rows.map(toHit),
    found: Number(countResult.rows[0]?.count ?? 0),
    page,
    perPage,
    facets,
    backend: "postgres",
    tookMs: Date.now() - started,
  }
}

/** Price bounds for the range slider, respecting the other active filters. */
export async function priceBounds(params: SearchParams): Promise<{ minCents: number; maxCents: number }> {
  const conditions = buildConditions(params)
  const result = await db.execute<{ min: number; max: number }>(sql`
    SELECT MIN(l.price_cents)::int AS min, MAX(l.price_cents)::int AS max
    FROM marketplace_listings l
    LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
    WHERE ${allExcept(conditions, "price")}
  `)
  const row = result.rows[0]
  return { minCents: Number(row?.min ?? 0), maxCents: Number(row?.max ?? 0) }
}

export const POSTGRES_DEFAULT_PER_PAGE = DEFAULT_PER_PAGE
export { emptyFacets }
