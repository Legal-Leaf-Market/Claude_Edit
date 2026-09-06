import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { listingDrafts, listingPublications, type ListingDraft } from "@/lib/db/schema"
import { fetchShopListings, type ShopListing } from "@/lib/reverb/shop"
import { detectCategory } from "@/lib/canonical/model-parse"

/**
 * Pull the live Reverb shop into the master records, once.
 *
 * WHY THIS EXISTS. The listing tool is the master going forward, but the stock
 * already on Reverb was typed there by hand and retyping it here would be the
 * exact duplication the tool was built to stop. This reads what is live and
 * writes one draft per unit, so the master starts out knowing about everything
 * we actually own.
 *
 * THE PART THAT MATTERS MOST IS THE PUBLICATION ROW. An imported unit is
 * ALREADY LIVE on Reverb. Written as a plain draft it would show a working
 * "Push to Reverb" button, and pressing it would create a second listing of a
 * pedal that is already for sale. So the import writes a `listing_publications`
 * row marked published, carrying Reverb's own id and URL, which is what makes
 * the existing guard refuse the push and show the live link instead.
 *
 * IT IS CREATE-ONLY, AND THAT IS DELIBERATE. Re-running it adds what is new and
 * leaves everything else exactly as it is. The alternative, refreshing fields
 * from Reverb on every run, would silently overwrite a description somebody
 * rewrote here for eBay, and the whole point of a master record is that it is
 * the one that wins. Reverb is downstream of this now, not upstream of it.
 *
 * NOTHING HERE TOUCHES THE CATALOGUE. Our own stock stays out of
 * marketplace_listings, out of every median and off every deal badge, which is
 * section 24's first guarantee.
 */

export type ImportOutcome =
  | { ok: false; reason: string }
  | {
      ok: true
      created: number
      skipped: number
      /** Live listings we could not turn into a draft, and why. */
      problems: { title: string; reason: string }[]
    }

/**
 * Our stock number for an imported unit.
 *
 * Reverb's own SKU wins when the listing has one, because that is what an
 * operator has been writing on the box. Otherwise it is derived from Reverb's
 * listing id, which is stable, so a second import recognises the same unit
 * rather than creating another row for it.
 */
export function skuFor(listing: ShopListing): string {
  return (listing.sku?.trim() || `RVB-${listing.id}`).slice(0, 60)
}

/**
 * Split "Boss DS-1 Distortion" into a brand and a model when Reverb did not
 * carry `make` and `model` separately.
 *
 * Deliberately crude, because it does not have to be right: it is a starting
 * point in an editable field on a form somebody is about to look at, not a
 * resolution decision that merges two instruments forever. Getting this wrong
 * costs one correction; the resolver getting it wrong corrupts a price history.
 */
function splitTitle(title: string): { brand: string | null; model: string | null } {
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return { brand: null, model: null }
  return { brand: words[0], model: words.slice(1).join(" ").slice(0, 100) }
}

function toDraft(listing: ShopListing): typeof listingDrafts.$inferInsert {
  const guessed = splitTitle(listing.title)
  return {
    sku: skuFor(listing),
    status: "listed",
    title: listing.title.slice(0, 255),
    brand: (listing.make ?? guessed.brand)?.slice(0, 100) ?? null,
    model: (listing.model ?? guessed.model)?.slice(0, 100) ?? null,
    category: detectCategory(listing.title),
    description: listing.description,
    condition: listing.condition,
    year: listing.year?.slice(0, 20) ?? null,
    finish: listing.finish?.slice(0, 60) ?? null,
    photos: listing.photos,
    priceCents: listing.priceCents,
    /* Cost comes across because it is already ours: it lives in Reverb's
       seller_cost field and /admin/inventory has been reading it all along. It
       is never sent to any channel from here. */
    costCents: listing.costCents,
    currency: listing.currency ?? "USD",
    acceptsOffers: listing.offersEnabled,
    shippingCents: listing.shippingCents,
    channelMeta: {},
  }
}

export async function importReverbShop(): Promise<ImportOutcome> {
  const result = await fetchShopListings("live")
  if (!result.ok) return { ok: false, reason: result.reason }

  const listings = result.listings
  if (listings.length === 0) {
    return { ok: true, created: 0, skipped: 0, problems: [] }
  }

  /* Two ways a unit can already be here: imported before (so a publication row
     carries Reverb's id), or created by hand under the same SKU. Both are
     checked, because either one means "do not make a second row". */
  const skus = listings.map(skuFor)
  const existingBySku = new Set(
    (await db.select({ sku: listingDrafts.sku }).from(listingDrafts).where(inArray(listingDrafts.sku, skus))).map(
      (r) => r.sku,
    ),
  )
  const existingByReverbId = new Set(
    (
      await db
        .select({ externalId: listingPublications.externalId })
        .from(listingPublications)
        .where(eq(listingPublications.channel, "reverb"))
    )
      .map((r) => r.externalId)
      .filter((id): id is string => Boolean(id)),
  )

  let created = 0
  let skipped = 0
  const problems: { title: string; reason: string }[] = []

  for (const listing of listings) {
    if (existingBySku.has(skuFor(listing)) || existingByReverbId.has(listing.id)) {
      skipped += 1
      continue
    }

    try {
      const rows = await db.insert(listingDrafts).values(toDraft(listing)).returning()
      const draft = rows[0] as ListingDraft

      /* The row that stops a second listing of a pedal already for sale. */
      await db.insert(listingPublications).values({
        draftId: draft.id,
        channel: "reverb",
        state: "published",
        externalId: listing.id,
        externalUrl: listing.url,
        publishedAt: new Date(),
      })

      created += 1
    } catch (error) {
      /* One bad row must not abandon the other eight. */
      problems.push({ title: listing.title, reason: (error as Error).message.slice(0, 200) })
    }
  }

  return { ok: true, created, skipped, problems }
}
