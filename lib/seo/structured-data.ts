import { env } from "@/lib/env"
import { conditionClass } from "@/lib/deals/pricing"

/**
 * SCHEMA.ORG MARKUP, BUILT IN ONE PLACE.
 *
 * There were two hand-rolled JSON-LD blocks before this, on two pages, and
 * they already disagreed: one built its URLs from `SITE_URL` and the other had
 * the production hostname typed into it, so a preview deploy emitted markup
 * pointing at the live site. That is the shape of every bug this file exists to
 * prevent. Structured data is read by machines and by nobody else, so it is
 * never obviously wrong on the page: it is wrong in Search Console, weeks
 * later, if anybody is looking.
 *
 * THE RULE THAT GOVERNS ALL OF IT: MARKUP IS A CLAIM, AND EVERY CLAIM HERE HAS
 * TO BE ONE THE PAGE ITSELF MAKES.
 *
 * That is section 8's honesty rule wearing a different hat. The site refuses to
 * publish a market price under `MIN_SAMPLE_SIZE` because a number with nothing
 * behind it is worse than no number; marking up an offer that does not exist,
 * or a rating nobody gave, is the same act aimed at a crawler instead of a
 * shopper. Google treats it as the same act too, and the penalty is a manual
 * action against the whole domain.
 *
 * SO NOTHING HERE CLAIMS A REPUTATION: no star ratings, no testimonials, none
 * of the reputation vocabulary at all. A test asserts their absence by scanning
 * this file rather than trusting the intention, which is why the words
 * themselves are not written out here either. This site collects no opinions
 * from anybody. The single most common piece of SEO advice for a comparison
 * site is to add star markup because it wins a rich result, and doing that with
 * nothing behind it is fabricating evidence.
 */

export type JsonLd = Record<string, unknown>

/** Absolute, from the deployment's own origin, never a typed hostname. */
export function absolute(path: string): string {
  return new URL(path, env.site.url).toString()
}

/**
 * A trail, numbered from one.
 *
 * Takes the same items the visible `<nav>` renders, because a breadcrumb that
 * disagrees with the one on the page is the definition of markup that does not
 * describe the page. The last crumb carries no `item`: it is where you already
 * are, and self-linking it is a common way to get the trail ignored.
 */
export function breadcrumbs(trail: { name: string; path?: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: absolute(crumb.path) } : {}),
    })),
  }
}

export type OfferRow = {
  priceCents: number
  currency: string | null
  condition: string | null
}

/**
 * The offers on a gear page, aggregated, or null when there is nothing to say.
 *
 * NULL IS A REAL ANSWER AND THE COMMON ONE. A canonical row with no live
 * listing is a page about an instrument nobody is currently selling, and
 * `Product` markup with no offer on it is a page telling a crawler it sells
 * something it does not.
 *
 * ONE CURRENCY, AND THIS IS NOT PEDANTRY. `AggregateOffer` carries a single
 * `priceCurrency` for a single low and high, and this catalogue is genuinely
 * multi-currency: Anderton's prices in GBP, Gear4music runs five regional
 * storefronts, the rest are USD. The previous version hardcoded "USD" over
 * whatever was in the rows, so one British listing under an American one made
 * the low price a number in the wrong money. The majority currency wins and
 * the count reflects only those offers, so the figures and the count always
 * describe the same set.
 *
 * CONDITION IS STATED ONLY WHEN IT IS TRUE OF EVERY OFFER. Section 8 is
 * emphatic that new and used are two markets; a page holding both cannot claim
 * either, so it claims neither rather than picking the one that reads better.
 */
export function aggregateOffer(rows: OfferRow[], pageUrl: string): JsonLd | null {
  const priced = rows.filter((row) => Number.isFinite(row.priceCents) && row.priceCents > 0)
  if (!priced.length) return null

  const byCurrency = new Map<string, OfferRow[]>()
  for (const row of priced) {
    const code = (row.currency || "USD").toUpperCase()
    const list = byCurrency.get(code)
    if (list) list.push(row)
    else byCurrency.set(code, [row])
  }
  let currency = "USD"
  let group: OfferRow[] = []
  for (const [code, list] of byCurrency) {
    if (list.length > group.length) {
      currency = code
      group = list
    }
  }

  const prices = group.map((row) => row.priceCents).sort((a, b) => a - b)
  const classes = new Set(group.map((row) => conditionClass(row.condition)))

  return {
    "@type": "AggregateOffer",
    offerCount: group.length,
    lowPrice: (prices[0] / 100).toFixed(2),
    highPrice: (prices[prices.length - 1] / 100).toFixed(2),
    priceCurrency: currency,
    availability: "https://schema.org/InStock",
    ...(classes.size === 1
      ? {
          itemCondition:
            classes.has("new")
              ? "https://schema.org/NewCondition"
              : "https://schema.org/UsedCondition",
        }
      : {}),
    url: absolute(pageUrl),
  }
}

/**
 * One instrument.
 *
 * Returns null with no offers, deliberately: see `aggregateOffer`. The
 * identifiers are passed through only when the resolver actually holds them,
 * because an empty `gtin` is a claim that this product has no barcode rather
 * than a claim that we do not know it.
 */
export function productSchema(input: {
  name: string
  brand: string
  category?: string | null
  image?: string | null
  gtin?: string | null
  mpn?: string | null
  path: string
  offers: OfferRow[]
}): JsonLd | null {
  const offers = aggregateOffer(input.offers, input.path)
  if (!offers) return null

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    brand: { "@type": "Brand", name: input.brand },
    url: absolute(input.path),
    ...(input.category ? { category: input.category } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.gtin ? { gtin: input.gtin } : {}),
    ...(input.mpn ? { mpn: input.mpn } : {}),
    offers,
  }
}

/**
 * A page that lists instruments: a category, or a deals shelf.
 *
 * An `ItemList` of links rather than a list of `Product` nodes. A crawler that
 * follows the link gets the full product markup from the gear page, where the
 * offers actually live; repeating a stripped version here would be two answers
 * to the same question, and the thinner one would sometimes win.
 */
export function itemListSchema(input: {
  name: string
  description?: string
  path: string
  items: { name: string; path: string }[]
}): JsonLd | null {
  if (!input.items.length) return null
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    url: absolute(input.path),
    ...(input.description ? { description: input.description } : {}),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absolute(item.path),
      })),
    },
  }
}

/**
 * An editorial page: an artist rig.
 *
 * `Article` rather than `Product`, because a documented pedalboard is writing
 * about gear rather than an offer of it, and because section 13 is careful that
 * these pages never imply endorsement. Structured data claiming a person
 * endorses a product is precisely the implication that file exists to avoid, so
 * the artist is the SUBJECT and never the author.
 */
export function articleSchema(input: {
  headline: string
  description?: string
  path: string
  image?: string | null
  about?: string
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    url: absolute(input.path),
    mainEntityOfPage: absolute(input.path),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.about ? { about: { "@type": "Thing", name: input.about } } : {}),
    publisher: {
      "@type": "Organization",
      name: env.site.name,
      url: absolute("/"),
    },
  }
}
