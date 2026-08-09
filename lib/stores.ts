import type { Source } from "@/lib/db/schema"
import { sourceLabel } from "@/lib/utils"

/**
 * Per-merchant showcase pages (/shop/[source]), mirroring /used/[category]'s
 * pattern: server-rendered against real current listings, not a static
 * template. Inspired by the sister sites' own per-merchant pages
 * (legal-leafmarket.com/greekglass, nicotiamarket.com/black-buffalo) but
 * deliberately not copying their bespoke illustrated styling -- Gear Avail's
 * own dark-amber marketplace look carries the brand here instead.
 *
 * Only sources worth a dedicated page (an actual confirmed storefront with
 * real inventory, not a paused/unconfirmed feed) get a slug below.
 * generateStaticParams in the route reads this list, so adding a source here
 * is the only step needed to give it a page.
 */
export type StoreProfile = {
  source: Source
  slug: string
  name: string
  tagline: string
  blurb: string
}

export const STORES: StoreProfile[] = [
  {
    source: "eartguitar",
    slug: "eart-guitar",
    name: "EART Guitar",
    tagline: "Direct-from-maker electric and acoustic guitars",
    blurb:
      "EART builds and sells its own guitars direct, without a middleman markup between the workshop and your case. Confirmed, working referral link -- every listing here is real, current inventory from their own storefront, not a scrape.",
  },
  {
    source: "hazeguitar",
    slug: "haze-guitar",
    name: "Haze Guitar",
    tagline: "Strings, cables and small amps at real prices",
    blurb:
      "Haze carries the everyday gear every player restocks constantly -- strings, cables, small practice amps -- at prices that make it worth checking before you default to whatever's nearest.",
  },
  {
    source: "easonmusicstore",
    slug: "eason-music-store",
    name: "Eason Music Store",
    tagline: "An independent storefront with a confirmed referral link",
    blurb:
      "Eason Music Store is one of the independent shops with a confirmed, working referral link -- clicking through here credits them correctly, every time.",
  },
  {
    source: "gokalimba",
    slug: "go-kalimba",
    name: "Go Kalimba",
    tagline: "Kalimbas and folk hand percussion",
    blurb:
      "A specialist in kalimbas and related folk instruments -- the kind of niche catalogue that's easy to overlook if you're only searching for guitars and amps.",
  },
  {
    source: "jacksonaudio",
    slug: "jackson-audio",
    name: "Jackson Audio",
    tagline: "Boutique pedal maker, direct storefront",
    blurb:
      "Jackson Audio is a boutique effects-pedal maker selling direct. Their catalogue here is small by design -- boutique pedal runs usually are -- but the referral link is real and confirmed.",
  },
  {
    source: "eminencedigital",
    slug: "eminence-digital",
    name: "Eminence Digital",
    tagline: "Digital impulse-response packs for cab simulation",
    blurb:
      "Eminence Digital sells impulse-response packs -- digital cabinet simulation profiles, not physical gear -- for anyone modelling amp tone without a mic'd-up cab in the room.",
  },
  {
    source: "squaver",
    slug: "squaver",
    name: "Squaver",
    tagline: "An independent WooCommerce storefront",
    blurb:
      "Squaver runs on WooCommerce rather than Shopify like most of the family here, with a smaller, hand-picked catalogue and a confirmed referral link.",
  },
]

export const STORE_BY_SLUG = new Map<string, StoreProfile>(STORES.map((s) => [s.slug, s]))
export const STORE_BY_SOURCE = new Map<Source, StoreProfile>(STORES.map((s) => [s.source, s]))

export function storeFromSlug(slug: string): StoreProfile | null {
  return STORE_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** Fallback for a source with real listings but no curated profile yet -- generic, not blank. */
export function genericStoreProfile(source: Source): StoreProfile {
  const name = sourceLabel(source)
  return {
    source,
    slug: source,
    name,
    tagline: `Live inventory from ${name}`,
    blurb: `Real-time listings from ${name}, one of the independent sellers Gear Avail aggregates.`,
  }
}
