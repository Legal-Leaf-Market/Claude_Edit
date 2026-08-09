import { Client } from "typesense"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import {
  emptyFacets,
  normalizeParams,
  type Facets,
  type SearchHit,
  type SearchParams,
  type SearchResult,
} from "./types"

/**
 * Typesense backend.
 *
 * Optional. When TYPESENSE_HOST and TYPESENSE_API_KEY are unset the facade in
 * ./index.ts routes everything to Postgres instead, and the site behaves
 * identically apart from latency at scale.
 *
 * The collection denormalises the canonical_gear join, because sub-50ms search
 * means no joins at query time. That makes the sync job the thing that has to
 * be right: whenever a listing OR its gear changes, the document is rewritten.
 */

const COLLECTION_FIELDS = [
  { name: "id", type: "string" },
  { name: "title", type: "string" },
  { name: "source", type: "string", facet: true },
  { name: "external_id", type: "string", index: false, optional: true },
  { name: "brand", type: "string", facet: true, optional: true },
  { name: "category", type: "string", facet: true, optional: true },
  { name: "condition", type: "string", facet: true, optional: true },
  { name: "price_cents", type: "int32", facet: true },
  { name: "currency", type: "string", index: false, optional: true },
  { name: "is_deal", type: "bool", facet: true },
  { name: "deal_margin", type: "float", optional: true },
  { name: "is_local_pickup", type: "bool", facet: true },
  { name: "is_shippable", type: "bool", facet: true },
  { name: "listing_status", type: "string", facet: true },
  { name: "primary_image_url", type: "string", index: false, optional: true },
  { name: "canonical_gear_id", type: "string", facet: true, optional: true },
  { name: "gear_slug", type: "string", index: false, optional: true },
  { name: "gear_model", type: "string", optional: true },
  { name: "market_price_cents", type: "int32", optional: true },
  { name: "listed_at", type: "int64", optional: true },
] as const

let cachedClient: Client | null = null

export function getTypesenseClient(): Client | null {
  if (!env.typesense.isConfigured) return null
  if (cachedClient) return cachedClient
  cachedClient = new Client({
    nodes: [
      {
        host: env.typesense.host,
        port: env.typesense.port,
        protocol: env.typesense.protocol,
      },
    ],
    apiKey: env.typesense.apiKey,
    connectionTimeoutSeconds: 5,
    numRetries: 2,
  })
  return cachedClient
}

/** Create the collection if it does not exist. Safe to call on every deploy. */
export async function ensureCollection(): Promise<boolean> {
  const client = getTypesenseClient()
  if (!client) return false

  try {
    await client.collections(env.typesense.collection).retrieve()
    return true
  } catch {
    await client.collections().create({
      name: env.typesense.collection,
      fields: COLLECTION_FIELDS as unknown as never,
      default_sorting_field: "price_cents",
    })
    return true
  }
}

/* -------------------------------------------------------------------------- */
/*  Indexing                                                                  */
/* -------------------------------------------------------------------------- */

type IndexDocument = {
  id: string
  title: string
  source: string
  external_id: string
  brand: string
  category: string
  condition: string
  price_cents: number
  currency: string
  is_deal: boolean
  deal_margin: number
  is_local_pickup: boolean
  is_shippable: boolean
  listing_status: string
  primary_image_url: string
  canonical_gear_id: string
  gear_slug: string
  gear_model: string
  market_price_cents: number
  listed_at: number
}

/** Rows to index, joined to their canonical gear. */
async function documentsToIndex(sinceIso: string | null, limit: number, offset: number) {
  const filter = sinceIso ? sql`AND l.updated_at >= ${sinceIso}::timestamptz` : sql``
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      l.id, l.title, l.source, l.external_id, l.condition, l.price_cents,
      l.currency, l.is_deal, l.deal_margin, l.is_local_pickup, l.is_shippable,
      l.listing_status, l.primary_image_url, l.canonical_gear_id, l.listed_at,
      l.brand AS listing_brand,
      g.slug AS gear_slug, g.brand AS gear_brand, g.model AS gear_model,
      g.category AS gear_category, g.avg_used_price_cents AS market_price_cents
    FROM marketplace_listings l
    LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
    WHERE l.listing_status = 'active' ${filter}
    ORDER BY l.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  return result.rows.map((r): IndexDocument => {
    const listedAt = r.listed_at ? new Date(r.listed_at as string).getTime() : 0
    return {
      id: String(r.id),
      title: String(r.title ?? ""),
      source: String(r.source ?? ""),
      external_id: String(r.external_id ?? ""),
      // Typesense treats a missing optional field and an empty string
      // differently in facet counts; empty string keeps the facet honest.
      brand: String(r.gear_brand ?? r.listing_brand ?? ""),
      category: String(r.gear_category ?? ""),
      condition: String(r.condition ?? ""),
      price_cents: Number(r.price_cents ?? 0),
      currency: String(r.currency ?? "USD"),
      is_deal: Boolean(r.is_deal),
      deal_margin: Number(r.deal_margin ?? 0),
      is_local_pickup: Boolean(r.is_local_pickup),
      is_shippable: Boolean(r.is_shippable),
      listing_status: String(r.listing_status ?? "active"),
      primary_image_url: String(r.primary_image_url ?? ""),
      canonical_gear_id: String(r.canonical_gear_id ?? ""),
      gear_slug: String(r.gear_slug ?? ""),
      gear_model: String(r.gear_model ?? ""),
      market_price_cents: Number(r.market_price_cents ?? 0),
      listed_at: Number.isFinite(listedAt) ? listedAt : 0,
    }
  })
}

export type SyncResult = { indexed: number; batches: number; skipped: boolean; reason?: string }

/**
 * Push listings into Typesense.
 *
 * `since` makes this an incremental sync driven by updated_at, which is what
 * the post-ingest hook uses. Omit it for a full rebuild.
 */
export async function syncToTypesense(options: { since?: Date | null; batchSize?: number } = {}): Promise<SyncResult> {
  const client = getTypesenseClient()
  if (!client) return { indexed: 0, batches: 0, skipped: true, reason: "Typesense is not configured" }

  await ensureCollection()

  const batchSize = options.batchSize ?? 500
  const sinceIso = options.since ? options.since.toISOString() : null
  let offset = 0
  let indexed = 0
  let batches = 0

  for (;;) {
    const documents = await documentsToIndex(sinceIso, batchSize, offset)
    if (documents.length === 0) break

    // `upsert` rather than `create`: a re-run must overwrite, not duplicate.
    const results = await client
      .collections(env.typesense.collection)
      .documents()
      .import(documents, { action: "upsert" })

    // import() reports per-document outcomes; a single bad row must not be read
    // as a whole-batch success.
    const failures = (Array.isArray(results) ? results : []).filter(
      (r) => (r as { success?: boolean }).success === false,
    )
    if (failures.length > 0) {
      console.warn(`[typesense] ${failures.length}/${documents.length} documents failed in batch ${batches}`)
    }

    indexed += documents.length - failures.length
    batches += 1
    offset += batchSize
  }

  return { indexed, batches, skipped: false }
}

/** Drop documents for listings that are no longer active. */
export async function pruneInactive(): Promise<number> {
  const client = getTypesenseClient()
  if (!client) return 0
  const result = await client
    .collections(env.typesense.collection)
    .documents()
    .delete({ filter_by: "listing_status:!=active" })
  return (result as { num_deleted?: number }).num_deleted ?? 0
}

/* -------------------------------------------------------------------------- */
/*  Querying                                                                  */
/* -------------------------------------------------------------------------- */

function filterBy(params: SearchParams): string {
  const { shipping } = normalizeParams(params)
  const clauses: string[] = ["listing_status:=active"]

  const list = (field: string, values?: string[]) => {
    if (values?.length) clauses.push(`${field}:=[${values.map((v) => `\`${v}\``).join(",")}]`)
  }

  list("source", params.sources)
  list("brand", params.brands)
  list("category", params.categories)
  list("condition", params.conditions)

  if (params.minPriceCents != null) clauses.push(`price_cents:>=${Math.floor(params.minPriceCents)}`)
  if (params.maxPriceCents != null) clauses.push(`price_cents:<=${Math.ceil(params.maxPriceCents)}`)
  if (params.dealsOnly) clauses.push("is_deal:=true")
  if (params.canonicalGearId) clauses.push(`canonical_gear_id:=\`${params.canonicalGearId}\``)
  if (shipping === "local") clauses.push("is_local_pickup:=true")
  if (shipping === "shippable") clauses.push("is_shippable:=true")

  return clauses.join(" && ")
}

function sortBy(params: SearchParams): string | undefined {
  const { sort } = normalizeParams(params)
  switch (sort) {
    case "price_asc":
      return "price_cents:asc"
    case "price_desc":
      return "price_cents:desc"
    case "newest":
      return "listed_at:desc"
    case "deal":
      return "deal_margin:desc"
    case "relevance":
    default:
      // Undefined lets Typesense rank by its own text relevance score.
      return params.q?.trim() ? undefined : "price_cents:asc"
  }
}

type TypesenseHitDocument = IndexDocument

function toHit(doc: TypesenseHitDocument): SearchHit {
  return {
    id: doc.id,
    source: doc.source,
    externalId: doc.external_id,
    title: doc.title,
    priceCents: doc.price_cents,
    currency: doc.currency || "USD",
    condition: doc.condition || null,
    brand: doc.brand || null,
    primaryImageUrl: doc.primary_image_url || null,
    isLocalPickup: doc.is_local_pickup,
    isShippable: doc.is_shippable,
    isDeal: doc.is_deal,
    dealMargin: doc.deal_margin || null,
    listingStatus: doc.listing_status,
    listedAt: doc.listed_at ? new Date(doc.listed_at).toISOString() : null,
    canonicalGearId: doc.canonical_gear_id || null,
    gearSlug: doc.gear_slug || null,
    gearBrand: doc.brand || null,
    gearModel: doc.gear_model || null,
    gearCategory: doc.category || null,
    marketPriceCents: doc.market_price_cents || null,
  }
}

function toFacets(counts: unknown): Facets {
  const facets = emptyFacets()
  if (!Array.isArray(counts)) return facets
  for (const entry of counts as { field_name: string; counts: { value: string; count: number }[] }[]) {
    const values = (entry.counts ?? [])
      .filter((c) => c.value !== "")
      .map((c) => ({ value: c.value, count: c.count }))
    if (entry.field_name === "source") facets.source = values
    if (entry.field_name === "brand") facets.brand = values
    if (entry.field_name === "category") facets.category = values
    if (entry.field_name === "condition") facets.condition = values
  }
  return facets
}

export async function searchTypesense(params: SearchParams): Promise<SearchResult | null> {
  const client = getTypesenseClient()
  if (!client) return null

  const started = Date.now()
  const { page, perPage } = normalizeParams(params)

  const response = await client
    .collections<TypesenseHitDocument>(env.typesense.collection)
    .documents()
    .search({
      q: params.q?.trim() || "*",
      query_by: "title,gear_model,brand",
      query_by_weights: "3,2,1",
      filter_by: filterBy(params),
      sort_by: sortBy(params),
      facet_by: "source,brand,category,condition",
      max_facet_values: 40,
      page,
      per_page: perPage,
      // Typos are the norm in this market: "stratacaster", "les pual".
      num_typos: 2,
    })

  return {
    hits: (response.hits ?? []).map((h) => toHit(h.document as TypesenseHitDocument)),
    found: response.found ?? 0,
    page,
    perPage,
    facets: toFacets(response.facet_counts),
    backend: "typesense",
    tookMs: Date.now() - started,
  }
}
