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
 * EVERY ingested storefront gets a page. Not just the ones that pay.
 *
 * The first version of this file listed only merchants with a confirmed
 * referral link, which meant promotion was allocated by payout status: EART
 * Guitar got a page, Folkcraft did not, and the only difference between them
 * was whether a referral code had been handed over. That is the same rule as
 * "commission affects ranking" wearing a different hat, and the footer
 * promises shoppers it does not happen.
 *
 * So the criterion is real live inventory, nothing else. A store that pays
 * 20% and a store that pays nothing get identical treatment here. Jackson
 * Audio pays 0% and keeps its page; Folkcraft has no confirmed link and gets
 * one. The sitemap still gates on a store actually having active listings,
 * because a page promising inventory that is not there fails the shopper,
 * which is a different concern from who pays us.
 *
 * generateStaticParams in the route reads this list, so adding a source here
 * is the only step needed to give it a page.
 */
export type StoreProfile = {
  source: Source
  slug: string
  name: string
  tagline: string
  blurb: string
  /**
   * Merchant logo, served from GoAffPro's own creatives CDN.
   *
   * These are assets the affiliate network distributes to publishers for
   * exactly this use, taken from the Logo column of the programme export.
   * They are NOT scraped from the merchant's own site, which would be taking
   * a mark rather than being given one. A store without a logo simply falls
   * back to its monogram in StoreMark; nothing breaks.
   */
  logoUrl?: string
  /**
   * ISO 3166-1 alpha-2 countries this store will actually ship an order to.
   *
   * ABSENT MEANS UNRESTRICTED, which is the honest default: most stores here
   * ship broadly and we have no evidence otherwise, so we do not invent a
   * restriction. Set it only where the merchant genuinely will not deliver
   * outside a region, and the site then keeps those listings away from
   * shoppers who cannot buy them.
   *
   * This exists because of the house rule in section 16: prices shown must be
   * prices the shopper can actually get. Anderton's is UK only, so showing a
   * shopper in Ohio a Guildford price they can never pay is the same failure
   * as showing a stale one.
   */
  shipsTo?: string[]
}

export const STORES: StoreProfile[] = [
  {
    source: "andertons",
    slug: "andertons",
    name: "Andertons Music Company",
    tagline: "Guildford's guitar institution, making musicians since 1964",
    shipsTo: ["GB"],
    blurb:
      "Andertons has been selling instruments out of Guildford since 1964, and the catalogue is the biggest of any store here by a wide margin: guitars, amps, synths, drums and studio gear. Prices are in pounds and they ship from the UK, which is worth factoring in if you are ordering from elsewhere.",
  },
  {
    source: "eartguitar",
    slug: "eart-guitar",
    name: "EART Guitar",
    tagline: "Direct-from-maker electric and acoustic guitars",
    blurb:
      "EART builds and sells its own guitars direct, without a middleman markup between the workshop and your case. Every listing here is real, current inventory read from their own storefront, not a scrape.",
    logoUrl: "https://creatives.goaffpro.com/167713/files/AkLbDVVAmgwE.png",
  },
  {
    source: "hazeguitar",
    slug: "haze-guitar",
    name: "Haze Guitar",
    tagline: "Strings, cables and small amps at real prices",
    blurb:
      "Haze carries the everyday gear every player restocks constantly -- strings, cables, small practice amps -- at prices that make it worth checking before you default to whatever's nearest.",
    logoUrl: "https://creatives.goaffpro.com/160437/files/tfrqwllk.png",
  },
  {
    source: "easonmusicstore",
    slug: "eason-music-store",
    name: "Eason Music Store",
    tagline: "A long-running independent shop, broad catalogue",
    blurb:
      "A long-running independent shop in Singapore carrying a broad instrument catalogue, from beginner gear to the specialist pieces bigger retailers stop stocking.",
    logoUrl: "https://static.goaffpro.com/75415/files/KgnZvNriWaV.jpg",
  },
  {
    source: "gokalimba",
    slug: "go-kalimba",
    name: "Go Kalimba",
    tagline: "Kalimbas and folk hand percussion",
    blurb:
      "A specialist in kalimbas and related folk instruments -- the kind of niche catalogue that's easy to overlook if you're only searching for guitars and amps.",
    logoUrl: "https://creatives.goaffpro.com/110511/files/6cRpG0HQ11gS.png",
  },
  {
    source: "jacksonaudio",
    slug: "jackson-audio",
    name: "Jackson Audio",
    tagline: "Boutique pedal maker, direct storefront",
    blurb:
      "Jackson Audio is a boutique effects-pedal maker selling direct. The catalogue is small by design, the way boutique pedal runs always are: short builds, high spec, no filler.",
    logoUrl: "https://static.goaffpro.com/11672/images/1566063088358.png",
  },
  {
    source: "eminencedigital",
    slug: "eminence-digital",
    name: "Eminence Digital",
    tagline: "Digital impulse-response packs for cab simulation",
    blurb:
      "Eminence Digital sells impulse-response packs -- digital cabinet simulation profiles, not physical gear -- for anyone modelling amp tone without a mic'd-up cab in the room.",
    logoUrl: "https://creatives.goaffpro.com/115114/files/KbksEfHn-Jug.jpg",
  },
  {
    source: "squaver",
    slug: "squaver",
    name: "Squaver",
    tagline: "An independent WooCommerce storefront",
    blurb:
      "Squaver runs on WooCommerce rather than Shopify like most of the family here, with a smaller, hand-picked catalogue.",
    logoUrl: "https://creatives.goaffpro.com/7188251/files/jqzzwspt.png",
  },
  {
    source: "folkcraft",
    slug: "folkcraft-instruments",
    name: "Folkcraft Instruments",
    tagline: "Dulcimers and traditional folk instruments, built in Indiana",
    blurb:
      "Folkcraft has been building mountain and hammered dulcimers for decades, alongside the strings, cases and parts that keep them playing. The kind of catalogue that exists nowhere else because almost nobody else makes these.",
    logoUrl: "https://static.goaffpro.com/62254/files/1_W8GnC4viG.png",
  },
  {
    source: "acousticguitar",
    slug: "acoustic-guitar",
    name: "Acoustic Guitar",
    tagline: "Books, lessons and gear from the magazine's own store",
    blurb:
      "The storefront attached to Acoustic Guitar: instruction books, songbooks, transcriptions and accessories, aimed at players who want to get better rather than just buy more.",
    logoUrl: "https://creatives.goaffpro.com/160052/files/fabnQfqB6S02s.png",
  },
  {
    source: "jamstik",
    slug: "jamstik",
    name: "Jamstik",
    tagline: "MIDI guitars and practice tools that plug into your DAW",
    blurb:
      "Jamstik builds smart guitars and MIDI controllers designed for players who learn and record on a screen. Narrow catalogue, unusually specific: nothing else here does what these do.",
    logoUrl: "https://static.goaffpro.com/66466/files/2uVEp7WaXPn.png",
  },
  {
    source: "playwithauthority",
    slug: "play-with-authority",
    name: "Play With Authority",
    tagline: "An independent shop for players",
    blurb:
      "A small independent storefront with a tightly chosen catalogue, the sort of shop that carries what its owner actually believes in rather than everything a distributor offers.",
    logoUrl: "https://creatives.goaffpro.com/7099382/files/EjHjMQSZO7j1o.jpg",
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
