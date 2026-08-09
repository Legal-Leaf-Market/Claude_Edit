import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import type { CanonicalGear, NewMarketplaceListing } from "@/lib/db/schema"
import { gearSlug, parseGearFromTitle } from "./model-parse"

/**
 * Entity resolution: which real-world instrument is this listing?
 *
 * Three tiers, deliberately ordered by how much we trust the evidence.
 *
 *   Tier 1, deterministic. A GTIN is a global barcode and an EPID is eBay's own
 *     catalogue id. Either is a hard identity, so these match or create outright.
 *   Tier 2, structured. No identifier, but we have a brand and a model guess.
 *     Fuzzy match against existing gear from the SAME brand using pg_trgm.
 *     Scoping to the brand is what keeps this safe: "Standard" means something
 *     completely different under Gibson than under Squier, and an unscoped
 *     similarity search happily merges them.
 *   Tier 3, fallback. Create a provisional row flagged needs_review.
 *
 * Paid embeddings are deliberately NOT wired up. eBay's structured fields carry
 * most rows, and an embedding bill for the remainder is not justified before we
 * can see how large that remainder actually is. resolveByEmbedding below is the
 * marked extension point for when it is.
 */

/** Minimum trigram similarity for a Tier 2 match. Tuned conservatively. */
export const FUZZY_MATCH_THRESHOLD = 0.55

export type MatchTier = "gtin" | "epid" | "fuzzy" | "provisional"

export type ResolutionResult = {
  gearId: string
  tier: MatchTier
  score: number
  created: boolean
}

type ResolvableListing = Pick<
  NewMarketplaceListing,
  "title" | "brand" | "gtin" | "epid" | "mpn" | "primaryImageUrl"
>

/* -------------------------------------------------------------------------- */
/*  Tier 1: deterministic identifiers                                         */
/* -------------------------------------------------------------------------- */

/**
 * GTINs arrive with wildly inconsistent padding (UPC-12 vs EAN-13 vs a
 * spreadsheet that ate the leading zero). Normalising to digits and stripping
 * leading zeros makes those three spellings of one barcode collide correctly.
 */
export function normalizeGtin(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 14) return null
  const trimmed = digits.replace(/^0+/, "")
  return trimmed.length >= 8 ? trimmed : digits
}

async function findByKey(column: "gtin" | "epid", value: string): Promise<CanonicalGear | null> {
  const rows = await db
    .select()
    .from(canonicalGear)
    .where(eq(column === "gtin" ? canonicalGear.gtin : canonicalGear.epid, value))
    .limit(1)
  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/*  Tier 2: brand-scoped fuzzy match                                          */
/* -------------------------------------------------------------------------- */

export type FuzzyCandidate = { id: string; brand: string; model: string; score: number }

/**
 * Best same-brand model match above the threshold.
 *
 * `similarity()` comes from pg_trgm and is backed by the GIN index declared on
 * canonical_gear.model. The brand equality is applied first so the trigram
 * comparison only ever runs against that brand's catalogue.
 */
export async function findFuzzyCandidate(
  brand: string,
  model: string,
  threshold = FUZZY_MATCH_THRESHOLD,
): Promise<FuzzyCandidate | null> {
  if (!brand || !model) return null
  const rows = await db
    .select({
      id: canonicalGear.id,
      brand: canonicalGear.brand,
      model: canonicalGear.model,
      score: sql<number>`similarity(${canonicalGear.model}, ${model})`,
    })
    .from(canonicalGear)
    .where(
      and(
        sql`lower(${canonicalGear.brand}) = lower(${brand})`,
        sql`similarity(${canonicalGear.model}, ${model}) >= ${threshold}`,
      ),
    )
    .orderBy(sql`similarity(${canonicalGear.model}, ${model}) DESC`)
    .limit(1)

  const row = rows[0]
  return row ? { ...row, score: Number(row.score) } : null
}

/* -------------------------------------------------------------------------- */
/*  Creation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Slugs must be unique, and two different instruments can legitimately reduce
 * to the same brand+model string. Probe with a numeric suffix rather than
 * failing the insert.
 */
async function uniqueSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await db
      .select({ id: canonicalGear.id })
      .from(canonicalGear)
      .where(eq(canonicalGear.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
  }
  // Deterministic last resort so we never spin forever on a hot slug.
  return `${base}-${Date.now().toString(36)}`
}

type CreateArgs = {
  brand: string
  model: string
  category: string
  gtin: string | null
  epid: string | null
  mpn: string | null
  imageUrl: string | null
  needsReview: boolean
}

/**
 * Insert a canonical row, tolerating the race where a concurrent worker just
 * created the same gear. ON CONFLICT DO NOTHING plus a re-read is cheaper and
 * safer than a transaction-level lock across the whole ingest.
 */
async function createGear(args: CreateArgs): Promise<CanonicalGear> {
  const slug = await uniqueSlug(gearSlug(args.brand, args.model))
  const inserted = await db
    .insert(canonicalGear)
    .values({
      brand: args.brand.slice(0, 100),
      model: args.model.slice(0, 100),
      category: args.category.slice(0, 100),
      slug,
      gtin: args.gtin,
      epid: args.epid,
      mpn: args.mpn?.slice(0, 100) ?? null,
      imageUrl: args.imageUrl,
      needsReview: args.needsReview,
    })
    .onConflictDoNothing()
    .returning()

  if (inserted[0]) return inserted[0]

  // Lost the race, or hit the slug/gtin/epid unique index. Re-read by whichever
  // key we supplied, newest wins.
  if (args.gtin) {
    const byGtin = await findByKey("gtin", args.gtin)
    if (byGtin) return byGtin
  }
  if (args.epid) {
    const byEpid = await findByKey("epid", args.epid)
    if (byEpid) return byEpid
  }
  const bySlug = await db
    .select()
    .from(canonicalGear)
    .where(eq(canonicalGear.slug, slug))
    .limit(1)
  if (bySlug[0]) return bySlug[0]

  throw new Error(`Could not create or find canonical gear for ${args.brand} ${args.model}`)
}

/**
 * Fill in identifiers and imagery a later listing supplied but an earlier one
 * lacked. Only ever writes into NULL columns: a value already on the row was
 * set by evidence at least as good as ours.
 */
async function enrichGear(gear: CanonicalGear, args: Partial<CreateArgs>): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (!gear.gtin && args.gtin) patch.gtin = args.gtin
  if (!gear.epid && args.epid) patch.epid = args.epid
  if (!gear.mpn && args.mpn) patch.mpn = args.mpn.slice(0, 100)
  if (!gear.imageUrl && args.imageUrl) patch.imageUrl = args.imageUrl
  if (Object.keys(patch).length === 0) return
  patch.updatedAt = new Date()
  // A concurrent writer may have filled the same unique column first, in which
  // case the enrichment is redundant rather than fatal.
  try {
    await db.update(canonicalGear).set(patch).where(eq(canonicalGear.id, gear.id))
  } catch {
    /* another worker won the race; the value it wrote is just as good */
  }
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

export async function resolveCanonicalGear(
  listing: ResolvableListing,
): Promise<ResolutionResult | null> {
  const parsed = parseGearFromTitle(listing.title ?? "", listing.brand)
  const gtin = normalizeGtin(listing.gtin)
  const epid = listing.epid?.trim() || null
  const mpn = listing.mpn?.trim() || null
  const image = listing.primaryImageUrl ?? null

  // Brand is required to name a canonical row at all. Without one, an unbranded
  // listing would create a junk row per title, so we leave it unresolved and
  // let it surface in search on its own text.
  const brand = parsed.brand
  const model = parsed.model || mpn || ""

  /* ---- Tier 1: GTIN ---- */
  if (gtin) {
    const existing = await findByKey("gtin", gtin)
    if (existing) {
      await enrichGear(existing, { epid, mpn, imageUrl: image })
      return { gearId: existing.id, tier: "gtin", score: 1, created: false }
    }
    if (brand && model) {
      const created = await createGear({
        brand,
        model,
        category: parsed.category,
        gtin,
        epid,
        mpn,
        imageUrl: image,
        needsReview: false,
      })
      return { gearId: created.id, tier: "gtin", score: 1, created: true }
    }
  }

  /* ---- Tier 1: EPID ---- */
  if (epid) {
    const existing = await findByKey("epid", epid)
    if (existing) {
      await enrichGear(existing, { gtin, mpn, imageUrl: image })
      return { gearId: existing.id, tier: "epid", score: 1, created: false }
    }
    if (brand && model) {
      const created = await createGear({
        brand,
        model,
        category: parsed.category,
        gtin,
        epid,
        mpn,
        imageUrl: image,
        needsReview: false,
      })
      return { gearId: created.id, tier: "epid", score: 1, created: true }
    }
  }

  if (!brand || !model) return null

  /* ---- Tier 2: brand-scoped fuzzy ---- */
  const candidate = await findFuzzyCandidate(brand, model)
  if (candidate) {
    const existing = await findById(candidate.id)
    if (existing) await enrichGear(existing, { gtin, epid, mpn, imageUrl: image })
    return { gearId: candidate.id, tier: "fuzzy", score: candidate.score, created: false }
  }

  /* ---- Tier 3: provisional ---- */
  const created = await createGear({
    brand,
    model,
    category: parsed.category,
    gtin,
    epid,
    mpn,
    imageUrl: image,
    needsReview: true,
  })
  return { gearId: created.id, tier: "provisional", score: 0, created: true }
}

async function findById(id: string): Promise<CanonicalGear | null> {
  const rows = await db.select().from(canonicalGear).where(eq(canonicalGear.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * Resolve every listing that does not yet have a canonical row.
 * Returns a per-tier tally so an ingest run can report how it did.
 */
export async function resolveUnmatchedListings(limit = 5000): Promise<Record<MatchTier, number>> {
  const pending = await db
    .select({
      id: marketplaceListings.id,
      title: marketplaceListings.title,
      brand: marketplaceListings.brand,
      gtin: marketplaceListings.gtin,
      epid: marketplaceListings.epid,
      mpn: marketplaceListings.mpn,
      primaryImageUrl: marketplaceListings.primaryImageUrl,
    })
    .from(marketplaceListings)
    .where(isNull(marketplaceListings.canonicalGearId))
    .limit(limit)

  const tally: Record<MatchTier, number> = { gtin: 0, epid: 0, fuzzy: 0, provisional: 0 }

  for (const row of pending) {
    const result = await resolveCanonicalGear(row)
    if (!result) continue
    tally[result.tier] += 1
    await db
      .update(marketplaceListings)
      .set({
        canonicalGearId: result.gearId,
        matchTier: result.tier,
        matchScore: result.score,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, row.id))
  }

  return tally
}

/* -------------------------------------------------------------------------- */
/*  Extension point                                                           */
/* -------------------------------------------------------------------------- */

/**
 * EXTENSION POINT, intentionally unimplemented.
 *
 * When the needs_review queue shows that structured fields are genuinely not
 * enough, this is where a vector tier slots in, between Tier 2 and Tier 3:
 * embed "brand model category" and nearest-neighbour it against a pgvector
 * column on canonical_gear. Do not wire it up before there is a measured
 * miss rate to justify the per-row cost.
 */
export async function resolveByEmbedding(
  _brand: string,
  _model: string,
): Promise<FuzzyCandidate | null> {
  return null
}
