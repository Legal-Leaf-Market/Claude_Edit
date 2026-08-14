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

export type MatchTier = "gtin" | "epid" | "mpn" | "model" | "fuzzy" | "provisional"

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

/**
 * Placeholder values sellers and feed exporters put in an MPN column when they
 * have nothing to put there. Treating any of these as an identity key would
 * merge every unbranded listing in the catalogue into one row.
 */
const MPN_PLACEHOLDERS = new Set([
  "NA", "N/A", "NONE", "NIL", "NULL", "UNKNOWN", "DOESNOTAPPLY", "NOTAPPLICABLE",
  "DOESNTAPPLY", "NOMPN", "GENERIC", "STANDARD", "REGULAR", "DEFAULT", "OEM",
  "0", "00", "000", "1", "11", "111", "123", "XXX", "TBD", "SEEDESCRIPTION",
  "SEETITLE", "VARIOUS", "ASSORTED", "CUSTOM", "HANDMADE", "VINTAGE", "USED",
])

/**
 * Canonicalise an MPN for comparison: uppercase, strip everything that is not
 * alphanumeric. That collapses "JCM-800/2203", "jcm800 2203" and "JCM8002203"
 * onto one key, which is exactly the variation real feeds carry.
 *
 * Returns null for anything too short, purely placeholder, or with no digits
 * AND no mixed case structure worth trusting. Conservative on purpose: a bad
 * MPN merges two unrelated instruments and corrupts both their price histories.
 */
export function normalizeMpn(raw: string | null | undefined): string | null {
  if (!raw) return null
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (stripped.length < 3 || stripped.length > 64) return null
  if (MPN_PLACEHOLDERS.has(stripped)) return null
  // A run of one repeated character ("XXXXX", "00000") is filler, not a part number.
  if (/^(.)\1*$/.test(stripped)) return null
  return stripped
}

/**
 * Match on brand plus manufacturer part number.
 *
 * This sits between the identifier tiers and the fuzzy tier because it is
 * deterministic, not probabilistic: an MPN names one product by definition. It
 * must be scoped to the brand, because part numbers are only unique within a
 * manufacturer and short ones like "2203" certainly collide across brands.
 *
 * Added after seeding showed six instruments splitting into duplicate canonical
 * rows purely on title wording ("SM58 Dynamic Vocal" against "SM58-LC Cardioid
 * Dynamic") while both listings carried the identical MPN the whole time.
 */
async function findByBrandMpn(brand: string, mpn: string): Promise<CanonicalGear | null> {
  const rows = await db
    .select()
    .from(canonicalGear)
    .where(
      and(
        sql`lower(${canonicalGear.brand}) = lower(${brand})`,
        sql`upper(regexp_replace(${canonicalGear.mpn}, '[^A-Za-z0-9]', '', 'g')) = ${mpn}`,
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/*  Tier 1d: same brand, identical model                                      */
/* -------------------------------------------------------------------------- */

/**
 * Same brand, same model, character for character once case and edge
 * whitespace are ignored.
 *
 * WHY THIS EXISTS, and it is the narrowest useful rule rather than an obvious
 * one. A listing carrying an identifier the catalogue has never seen used to
 * create a row outright, on the reasoning that a new barcode means a new
 * product. That is false for a shop's own numbering: Shopify emits one listing
 * per VARIANT and lib/ingestion/shopify-storefront.ts puts the variant's SKU in
 * `mpn`, so four finishes of one pedal arrive as four unseen "MPN"s. Each one
 * missed Tier 1c and made its own row, which is how Jackson Audio's 1484 Twin
 * Twelve Classic ended up on the published shelf four times.
 *
 * WHY NOT JUST FALL THROUGH TO THE FUZZY TIER, which is the tempting fix and is
 * dangerous. Measured against this database's own similarity(), at the 0.55
 * threshold: "DS-1" and "DS-1X" score 0.571, "Big Muff Pi" and "Little Big Muff
 * Pi" 0.632, "Tube Screamer TS9" and "Tube Screamer TS808" 0.714. Those are
 * different pedals, and today they are kept apart precisely BECAUSE they carry
 * distinct part numbers. Sending identifier-bearing listings to the fuzzy tier
 * would merge all three pairs and corrupt the price history of both sides,
 * which is a far worse failure than a duplicate row.
 *
 * Identical is the discriminator, not similar. Every duplicate observed on the
 * live shelf had a model string equal to its twin (the Twin Twelve, the Asabi,
 * the Modular Fuzz), and every near-miss pair above differs. So this tier
 * demands equality and leaves everything else to the existing ladder.
 */
async function findByBrandModel(brand: string, model: string): Promise<CanonicalGear | null> {
  if (!brand || !model) return null
  const rows = await db
    .select()
    .from(canonicalGear)
    .where(
      and(
        sql`lower(btrim(${canonicalGear.brand})) = lower(btrim(${brand}))`,
        sql`lower(btrim(${canonicalGear.model})) = lower(btrim(${model}))`,
      ),
    )
    .orderBy(canonicalGear.createdAt)
    .limit(1)
  return rows[0] ?? null
}

/**
 * Whether a hard identifier says these are definitively NOT the same product.
 *
 * A GTIN is a global barcode and an EPID is eBay's own catalogue id. Two rows
 * carrying different ones are two products however alike their names, so this
 * blocks the merge above and a separate row gets created, which is the
 * under-merge bias this file is built on.
 *
 * MPN IS DELIBERATELY NOT CHECKED HERE. A differing MPN is the entire case this
 * tier exists to fix: the field holds a shop's per-variant SKU as often as a
 * manufacturer's part number, and treating a disagreement between two SKUs as
 * proof of two products is what produced the duplicates in the first place.
 */
function conflictsOnHardId(
  gear: CanonicalGear,
  incoming: { gtin: string | null; epid: string | null },
): boolean {
  if (gear.gtin && incoming.gtin && gear.gtin !== incoming.gtin) return true
  if (gear.epid && incoming.epid && gear.epid !== incoming.epid) return true
  return false
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

/**
 * An identifier this catalogue has never seen. Attach the listing to the row
 * for the identical brand and model if there is one, and only make a new row
 * when there is not.
 *
 * THE ASSUMPTION THIS REPLACES: that an unseen identifier proves an unseen
 * product. It does not. It proves only that we have not seen that identifier,
 * and a shop numbering its own variants produces a fresh one per colourway.
 * The tier reported is `model` when it attached, because that is the evidence
 * that actually decided it: the identifier contributed nothing but a miss.
 */
async function attachOrCreate(args: CreateArgs, tierWhenCreating: MatchTier): Promise<ResolutionResult> {
  const twin = await findByBrandModel(args.brand, args.model)
  if (twin && !conflictsOnHardId(twin, { gtin: args.gtin, epid: args.epid })) {
    await enrichGear(twin, args)
    return { gearId: twin.id, tier: "model", score: 1, created: false }
  }
  const created = await createGear(args)
  return { gearId: created.id, tier: tierWhenCreating, score: 1, created: true }
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
      return attachOrCreate(
        { brand, model, category: parsed.category, gtin, epid, mpn, imageUrl: image, needsReview: false },
        "gtin",
      )
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
      return attachOrCreate(
        { brand, model, category: parsed.category, gtin, epid, mpn, imageUrl: image, needsReview: false },
        "epid",
      )
    }
  }

  if (!brand) return null

  /* ---- Tier 1c: brand + MPN ---- */
  const normalizedMpn = normalizeMpn(mpn)
  if (normalizedMpn) {
    const existing = await findByBrandMpn(brand, normalizedMpn)
    if (existing) {
      await enrichGear(existing, { gtin, epid, imageUrl: image })
      return { gearId: existing.id, tier: "mpn", score: 1, created: false }
    }
    if (model) {
      return attachOrCreate(
        { brand, model, category: parsed.category, gtin, epid, mpn, imageUrl: image, needsReview: false },
        "mpn",
      )
    }
  }

  if (!model) return null

  /* ---- Tier 1d: same brand, identical model ---- */
  const twin = await findByBrandModel(brand, model)
  if (twin && !conflictsOnHardId(twin, { gtin, epid })) {
    await enrichGear(twin, { gtin, epid, mpn, imageUrl: image })
    return { gearId: twin.id, tier: "model", score: 1, created: false }
  }

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

  const tally: Record<MatchTier, number> = {
    gtin: 0,
    epid: 0,
    mpn: 0,
    model: 0,
    fuzzy: 0,
    provisional: 0,
  }

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
