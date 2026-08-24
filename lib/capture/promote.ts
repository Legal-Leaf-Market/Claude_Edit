import { and, eq, like, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { marketplaceListings, type NewMarketplaceListing, type Source } from "@/lib/db/schema"
import { productCaptures } from "@/lib/db/schema"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { expirePastEndDate, resolveAndReprice, upsertListings } from "@/lib/ingestion/upsert"
import type { CaptureResult, CapturedProduct } from "./extract"

/**
 * PROMOTION: turning a capture into listings a shopper can see.
 *
 * This is the step the capture pipeline deliberately did NOT take. Reading a
 * page you are on is research; putting that catalogue on a public site is
 * redistribution, and the two live in different tables so the second cannot
 * happen by accident. This file is where the second happens ON PURPOSE, and
 * every guard in it exists because the same act done carelessly is the one
 * that gets this project a letter rather than a bug.
 *
 * ---------------------------------------------------------------------------
 *
 * FOUR GATES, AND NONE OF THEM IS OPTIONAL.
 *
 * 1. A WRITTEN-DOWN BASIS. A merchant is promotable only with a row in
 *    PROMOTION_RULES saying why, who decided, and when. There is no default and
 *    no inference: capturing a page says nothing whatever about the right to
 *    republish it, and the whole risk here is somebody assuming otherwise
 *    because the data is sitting right there.
 *
 *    `affiliate-agreement` is the strong basis and the one the merchants below
 *    hold. An approved affiliate is a partner the merchant WANTS sending
 *    traffic to their products; displaying their catalogue behind our link is
 *    the purpose of the arrangement, and the feed is the convenient delivery
 *    mechanism rather than the permission itself. That is a materially
 *    different position from a merchant we have no relationship with, and the
 *    difference is exactly why Guitar Center is not in this table and cannot be
 *    put in it by capturing their pages.
 *
 * 2. A SOURCE THE SCHEMA ALREADY KNOWS. Listings land under a `Source`, and
 *    that union is edited by hand. So a capture of some shop nobody has decided
 *    about has nowhere to go, structurally, and adding a source stays a
 *    deliberate act rather than a side effect of pressing a button.
 *
 * 3. A PRICE THAT PARSED. A row with no price is skipped rather than guessed
 *    at. Section 8's rule, and the reason the extractor returns null rather
 *    than a best effort.
 *
 * 4. A SHELF LIFE. See below, because it is the one nobody expects.
 *
 * ---------------------------------------------------------------------------
 *
 * CAPTURED LISTINGS EXPIRE, AND THAT IS NOT A LIMITATION, IT IS THE HONEST
 * SHAPE OF THE DATA.
 *
 * Every feed here re-runs and learns what sold. A capture cannot: it is a
 * photograph of a page taken once, with no mechanism to discover that an item
 * went out of stock an hour later. Left alone it would sit on the site forever
 * quietly getting wronger, and section 17 says prices shown must be prices the
 * shopper can actually get.
 *
 * So every promoted row gets `endsAt = capturedAt + staleAfterDays`, and
 * `expirePastEndDate` retires it on its own. Re-capturing the page pushes the
 * date out again, which makes keeping a merchant live an explicit, repeated
 * act rather than something that decays invisibly.
 *
 * ---------------------------------------------------------------------------
 *
 * MOST OF THESE LISTINGS EARN NOTHING, AND THE UI SAYS SO.
 *
 * Impact and CJ deep links need ids a capture cannot possibly carry: Impact
 * wants `/c/<publisherId>/<campaignId>/<adId>`, and CJ ships a pre-built
 * BUY_URL per row. There is deliberately no `buildImpactUrl()` anywhere in this
 * repo and this file does not add one. So a promoted Anderton's listing stores
 * a NULL `affiliate_url` and `/go` sends the shopper to Anderton's own page.
 *
 * That is the right outcome rather than a shortcoming. Section 5: routing a
 * shopper through a tracker that credits nobody is worse than a clean direct
 * link. And section 17: payout is not why a merchant is listed, so earning
 * nothing is not a reason to withhold real products at real prices from a
 * shopper.
 *
 * It IS, however, the strongest possible argument for connecting the feed,
 * which carries the tracked links. Promotion is a stopgap and reports itself
 * as one: `promoteCaptures` warns when the source it is writing to already has
 * a working feed, because in that case this is strictly the worse path.
 *
 * Awin and GoAffPro are the exceptions where a link IS buildable, and the rule
 * records which case a merchant is in rather than leaving it to be worked out.
 *
 * ---------------------------------------------------------------------------
 *
 * THE `cap-` PREFIX IS LOAD-BEARING. Feed rows key on the merchant's own
 * product id; captured rows key on the product URL, because that is the only
 * stable identifier a page reliably gives up. Those two keys never collide, so
 * the same product arriving by both routes would become TWO listings at one
 * store and be counted twice in that model's median.
 *
 * The prefix makes captured rows identifiable, `clearPromotedListings()` sweeps
 * them, and the intended sequence is explicit: when a feed starts working for a
 * source, clear its captured rows.
 */

export type PromotionBasis = "affiliate-agreement" | "agents-md"

/** Whether a tracked link can be built for this merchant at all. */
export type LinkBuildability = "awin" | "goaffpro" | "not-buildable"

export type PromotionRule = {
  /** The key an operator types into the collector's panel. */
  merchantKey: string
  /** Where the listings land. Must already exist in SOURCES. */
  source: Source
  basis: PromotionBasis
  /** Who decided, on what, and when. Written down or it did not happen. */
  note: string
  decidedOn: string
  currency: string
  locationCountry: string
  /**
   * These are new-inventory retailers, so an unstated condition is "New", the
   * same default Gear4music and the CJ trio take. Section 8's asymmetry: filing
   * one as new nudges the new median down slightly, while filing it as used
   * lifts the USED median, and a lifted used median manufactures deals that do
   * not exist.
   */
  condition: string
  affiliate: LinkBuildability
  /** How long a captured row stays live before it retires itself. */
  staleAfterDays: number
}

/**
 * THE MERCHANTS A CAPTURE MAY BE PUBLISHED FOR.
 *
 * Three, and all three hold an approved affiliate agreement. Every one of them
 * also has a real feed that would be better, which is why each note says so:
 * this table exists to get product on the site while those feeds are connected,
 * not to replace them.
 */
export const PROMOTION_RULES: PromotionRule[] = [
  {
    merchantKey: "andertons",
    source: "andertons",
    basis: "affiliate-agreement",
    note:
      "Approved Impact.com partner since 11 Aug 2026, commission 1-4%. An approved affiliate is a " +
      "partner the merchant wants sending traffic to their products, so displaying their catalogue " +
      "behind our link is the purpose of the arrangement. BETTER PATH EXISTS: the FTP drop carries " +
      "all ~27,000 products AND the tracked links, which a capture cannot. Use this only until that " +
      "runs, then clear these rows.",
    decidedOn: "2026-08-24",
    currency: "GBP",
    locationCountry: "GB",
    condition: "New",
    /* Impact deep links need a campaign and an ad id. There is no
       buildImpactUrl() in this repo and this is not the place to add one. */
    affiliate: "not-buildable",
    staleAfterDays: 30,
  },
  {
    merchantKey: "zzounds",
    source: "zzounds",
    basis: "affiliate-agreement",
    note:
      "Approved CJ Affiliate partner. BETTER PATH EXISTS: the CJ product feed carries the pre-built " +
      "BUY_URL tracking links, and it is one CJ_ZZOUNDS_FEED_URL away. Captured rows earn nothing.",
    decidedOn: "2026-08-24",
    currency: "USD",
    locationCountry: "US",
    condition: "New",
    /* CJ ships a pre-built BUY_URL per feed row; there is nothing to construct
       from a captured page, and isCjTrackingUrl has nothing to verify. */
    affiliate: "not-buildable",
    staleAfterDays: 30,
  },
  {
    merchantKey: "musiciansfriend",
    source: "musiciansfriend",
    basis: "affiliate-agreement",
    note:
      "Approved Impact.com partner, August 2026. US only, which section 15's regional filter already " +
      "handles from its StoreProfile. BETTER PATH EXISTS: the Impact catalogue API, once somebody " +
      "reads the catalogue id off the account. Note that an approval is not a catalogue, so that id " +
      "may still be refused the way Anderton's is, which is exactly when this table earns its keep.",
    decidedOn: "2026-08-24",
    currency: "USD",
    locationCountry: "US",
    condition: "New",
    affiliate: "not-buildable",
    staleAfterDays: 30,
  },
]

export function promotionRule(merchantKey: string): PromotionRule | null {
  return PROMOTION_RULES.find((rule) => rule.merchantKey === merchantKey.toLowerCase()) ?? null
}

/**
 * A stable external id for a captured product.
 *
 * THE URL PATH, not the whole URL, because tracking and session parameters
 * change between visits and would make every re-capture look like new
 * inventory. Prefixed so captured rows are identifiable and sweepable.
 */
export function capturedExternalId(url: string): string | null {
  try {
    const parsed = new URL(url)
    /* Query dropped entirely: on these retailers it carries session ids and
       campaign tags, never product identity. */
    return `cap-${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "").slice(0, 255)
  } catch {
    return null
  }
}

/**
 * Build the tracked link where that is possible, and null where it is not.
 *
 * FAILS LOUDLY ON A RULE IT CANNOT HONOUR. Every rule in the table today is
 * `not-buildable`, so the other two branches have no caller. A builder with no
 * caller rots, and the specific way this one would rot is the worst available:
 * somebody adds an Awin merchant, the branch quietly returns null, every one of
 * that merchant's listings earns nothing, and nothing anywhere fails. Section 5
 * calls that out for the networks and it is the same trap here.
 *
 * So an unimplemented branch throws at promotion time, when somebody is
 * watching, rather than producing a null that looks like a decision.
 */
function affiliateUrlFor(rawUrl: string, rule: PromotionRule): string | null {
  if (rule.affiliate === "not-buildable") return null
  throw new Error(
    `Rule "${rule.merchantKey}" declares affiliate="${rule.affiliate}" but no builder is wired up ` +
      `in promote.ts. Wire it beside the rule rather than letting it fall through: a silent null ` +
      `here means every promoted listing for this merchant earns nothing and nothing fails.`,
  )
}

export type PromotionOutcome = {
  merchantKey: string
  source: Source
  /** Nothing was written when true. */
  dryRun: boolean
  capturesRead: number
  productsSeen: number
  /** Deduplicated by external id, since captures of adjacent pages overlap. */
  candidates: number
  skippedNoPrice: number
  skippedNoUrl: number
  /** Links that were not on this site's outbound allowlist. */
  skippedOffSite: number
  written: number
  expired: number
  resolved: number
  /** Every promoted row on this source, after this run. */
  liveNow: number
  warnings: string[]
  /** A handful, so a person can eyeball what a dry run would write. */
  sample: { title: string; priceCents: number; url: string; externalId: string }[]
}

/**
 * Turn every stored capture for one merchant into listings.
 *
 * DRY RUN BY DEFAULT at the route, because this is the one operation here that
 * puts rows in front of shoppers, and reading what it WOULD write costs
 * nothing.
 */
export async function promoteCaptures(
  merchantKey: string,
  options: { dryRun?: boolean; feedIsLive?: boolean } = {},
): Promise<PromotionOutcome> {
  const dryRun = options.dryRun ?? true
  const rule = promotionRule(merchantKey)

  if (!rule) {
    throw new Error(
      `No promotion rule for "${merchantKey}". A capture says nothing about the right to republish ` +
        `it, so a merchant is promotable only with a row in PROMOTION_RULES recording why, who ` +
        `decided, and when. Known: ${PROMOTION_RULES.map((r) => r.merchantKey).join(", ")}.`,
    )
  }

  const captures = await db
    .select({
      pageUrl: productCaptures.pageUrl,
      payload: productCaptures.payload,
      capturedAt: productCaptures.capturedAt,
    })
    .from(productCaptures)
    .where(eq(productCaptures.merchantKey, rule.merchantKey))

  const warnings: string[] = []
  if (options.feedIsLive) {
    warnings.push(
      `${rule.source} already has a working feed, which carries tracked links these rows cannot. ` +
        `Promoting captures here is strictly the worse path: clear them instead.`,
    )
  }

  const byExternalId = new Map<string, NewMarketplaceListing>()
  let productsSeen = 0
  let skippedNoPrice = 0
  let skippedNoUrl = 0
  let skippedOffSite = 0
  const offSiteHosts = new Set<string>()

  for (const row of captures) {
    const capture = row.payload as CaptureResult
    const products: CapturedProduct[] = capture.products ?? []
    productsSeen += products.length

    /*
     * The shelf life is measured from when the page was SEEN, not from now, so
     * re-promoting an old capture does not silently make stale data look fresh.
     */
    const endsAt = new Date(
      new Date(row.capturedAt).getTime() + rule.staleAfterDays * 24 * 60 * 60 * 1000,
    )

    for (const product of products) {
      if (!product.url) {
        skippedNoUrl += 1
        continue
      }
      const externalId = capturedExternalId(product.url)
      if (!externalId) {
        skippedNoUrl += 1
        continue
      }
      /*
       * OFF-SITE LINKS ARE DROPPED, and this is not paranoia about our own
       * extractor. A retailer's category page carries links to all sorts of
       * places: sponsored placements, brand microsites, marketplace
       * partners. Any of them can sit in markup that looks exactly like a
       * product card, and promoting one would put a stranger's URL in our
       * catalogue under this merchant's name, where `/go` would then refuse
       * it and the listing would simply never work.
       *
       * The same allowlist `/go` and the cart use, applied one step earlier so
       * the row is never written rather than written and permanently broken.
       */
      if (!isAllowedDestination(product.url)) {
        skippedOffSite += 1
        try {
          offSiteHosts.add(new URL(product.url).hostname)
        } catch {
          offSiteHosts.add("(unparseable)")
        }
        continue
      }

      if (product.priceCents == null || product.priceCents <= 0) {
        /* No guessing. Section 8: a wrong price is worse than a missing one. */
        skippedNoPrice += 1
        continue
      }
      const title = product.title?.trim()
      if (!title) {
        skippedNoUrl += 1
        continue
      }

      /*
       * LAST CAPTURE WINS on a duplicate external id. Captures of adjacent
       * pages overlap by a few cards, and the later read is the fresher price.
       */
      byExternalId.set(externalId, {
        source: rule.source,
        externalId,
        title: title.slice(0, 255),
        description: null,
        priceCents: product.priceCents,
        currency: (product.currency ?? rule.currency).slice(0, 10),
        condition: rule.condition,
        brand: product.brand?.slice(0, 100) ?? null,
        /*
         * Identifiers are carried through when the page volunteered them and
         * never invented. A wrong GTIN claims another instrument's canonical
         * row permanently, which section 4 calls out as the merge that cannot
         * be undone.
         */
        gtin: product.gtin?.slice(0, 100) ?? null,
        epid: null,
        mpn: product.mpn?.slice(0, 100) ?? null,
        locationCountry: rule.locationCountry.slice(0, 4),
        locationZip: null,
        isLocalPickup: false,
        isShippable: true,
        rawUrl: product.url,
        affiliateUrl: affiliateUrlFor(product.url, rule),
        primaryImageUrl: product.imageUrl,
        platformVariantId: null,
        listingStatus: "active",
        listedAt: null,
        /* The shelf life. Nothing else retires a captured row. */
        endsAt,
      })
    }
  }

  const rows = [...byExternalId.values()]

  if (skippedOffSite > 0) {
    /*
     * Named rather than counted, because a handful is ordinary page furniture
     * and a large number means the extractor matched a navigation pattern
     * rather than a product grid, which is worth knowing before writing rows.
     */
    warnings.push(
      `${skippedOffSite} link(s) were dropped for not being on the outbound allowlist: ` +
        `${[...offSiteHosts].slice(0, 8).join(", ")}. A few is normal page furniture; a lot means ` +
        `the capture matched navigation rather than products.`,
    )
  }

  if (dryRun) {
    return {
      merchantKey: rule.merchantKey,
      source: rule.source,
      dryRun: true,
      capturesRead: captures.length,
      productsSeen,
      candidates: rows.length,
      skippedNoPrice,
      skippedNoUrl,
      skippedOffSite,
      written: 0,
      expired: 0,
      resolved: 0,
      liveNow: await countPromoted(rule.source),
      warnings,
      sample: rows.slice(0, 10).map((r) => ({
        title: r.title,
        priceCents: r.priceCents ?? 0,
        url: r.rawUrl,
        externalId: r.externalId,
      })),
    }
  }

  const stats = await upsertListings(rows)
  const { resolved } = await resolveAndReprice(stats)
  /* Sweeps anything whose shelf life ran out, captured or otherwise. */
  const expired = await expirePastEndDate(rule.source)

  return {
    merchantKey: rule.merchantKey,
    source: rule.source,
    dryRun: false,
    capturesRead: captures.length,
    productsSeen,
    candidates: rows.length,
    skippedNoPrice,
    skippedNoUrl,
    skippedOffSite,
    written: stats.inserted + stats.updated,
    expired,
    resolved,
    liveNow: await countPromoted(rule.source),
    warnings,
    sample: rows.slice(0, 10).map((r) => ({
      title: r.title,
      priceCents: r.priceCents ?? 0,
      url: r.rawUrl,
      externalId: r.externalId,
    })),
  }
}

/** How many capture-derived listings this source currently has live. */
export async function countPromoted(source: Source): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(marketplaceListings)
    .where(
      and(
        eq(marketplaceListings.source, source),
        eq(marketplaceListings.listingStatus, "active"),
        like(marketplaceListings.externalId, "cap-%"),
      ),
    )
  return row?.n ?? 0
}

/**
 * Retire every capture-derived listing on a source.
 *
 * THE INTENDED SEQUENCE when a feed starts working. Feed rows key on the
 * merchant's own product id and captured rows key on the URL, so the two never
 * collide and the same product would sit in the catalogue twice, counted twice
 * in that model's median. The `cap-` prefix is what makes this sweep possible
 * at all.
 *
 * Expired rather than deleted, so the price history a captured row contributed
 * survives. A deleted listing would take a real observation of a real price out
 * of the record.
 */
export async function clearPromotedListings(source: Source): Promise<number> {
  const rows = await db
    .update(marketplaceListings)
    .set({ listingStatus: "expired", isDeal: false, updatedAt: new Date() })
    .where(
      and(
        eq(marketplaceListings.source, source),
        eq(marketplaceListings.listingStatus, "active"),
        like(marketplaceListings.externalId, "cap-%"),
      ),
    )
    .returning({ id: marketplaceListings.id })
  return rows.length
}
