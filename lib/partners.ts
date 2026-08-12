import { isImpactTrackingUrl } from "@/lib/affiliate/impact"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { env } from "@/lib/env"

/**
 * Focus-page partners: merchants we send traffic to WITHOUT listing a catalogue.
 *
 * WHY THESE TWO ARE NOT IN THE CATALOGUE. Everything in `marketplace_listings`
 * exists to be compared: a price against a median, a condition against its own
 * class, one shop's stock against another's. Martinic sells software
 * instruments, and DistroKid does not sell a product at all, it distributes
 * your record. Neither has a used market, a condition, a second seller to
 * compare against, or a market price that means anything, so a "median" over
 * them would be a number with nothing behind it, and section 8 is unambiguous
 * that inventing a market price is the one error this site cannot afford. They
 * would also sit in the search grid beside real instruments, where a shopper
 * filtering by "under $200, local pickup" gets a plugin licence.
 *
 * So they get a hand-written page each, and the catalogue stays what it says
 * it is.
 *
 * WHY A BANNER IS ALLOWED HERE AND NOWHERE ELSE. CLAUDE.md records that
 * Anderton's vanity link had no home on this site because "putting it on a page
 * would be the first ad on this site, which is a product decision nobody has
 * taken". That decision has now been taken deliberately, for these two only.
 *
 * The footer's promise is specific: commission never affects RANKING, and
 * whether a merchant pays is not why they are listed or delisted. A labelled
 * banner does not touch either. It is not in the ranking, it is not a search
 * result, it does not displace a listing, and it says on its face that it is a
 * partner placement and that we earn from it. What would break the promise is
 * an unlabelled placement dressed as a result, or a paying merchant floating up
 * the grid, and neither is what this is. The label is not decoration: it is the
 * thing that keeps the banner honest, so do not remove it to make the design
 * tidier.
 *
 * LINKS ARE PASTED, NEVER BUILT. There is no buildImpactUrl() anywhere in this
 * repo, for the reason lib/affiliate/impact.ts sets out: an Impact deep link
 * needs /c/<publisherId>/<campaignId>/<adId>, and a campaign id and an ad id
 * are not things a vanity short link carries. Each partner's tracked link comes
 * from Impact's own "create your links" step and is pasted in whole. Unset
 * means the page links to the merchant's own site untracked, which earns
 * nothing and is honest.
 */

export type PartnerProfile = {
  slug: string
  name: string
  /** One line, used as the page's subtitle and in the nav hint. */
  tagline: string
  /** What KIND of thing this is, stated plainly because it is not gear. */
  kind: string
  /** The merchant's own site. The destination when no tracked link is set. */
  homepage: string
  /** Body copy, one string per paragraph. */
  intro: string[]
  /** The three or four things actually worth knowing before clicking through. */
  highlights: { title: string; body: string }[]
  /** Short label/value pairs for the fact panel. */
  facts: { label: string; value: string }[]
  /** Why this is on a page of its own rather than in the catalogue. Shown, not just commented. */
  whyNotListed: string
  /** The banner that appears elsewhere on the site, where one is wanted. */
  banner: { headline: string; body: string; cta: string } | null
  /** The tracked link, as pasted from Impact. Empty when not configured. */
  trackedLink: string
}

export const PARTNERS: PartnerProfile[] = [
  {
    slug: "martinic-audio",
    name: "Martinic Audio",
    tagline: "Software recreations of instruments almost nobody can still buy",
    kind: "Software instruments and effects",
    homepage: "https://www.martinic.com/",
    intro: [
      "Martinic build software versions of specific vintage keyboards, organs and effects: not a synth that sounds vaguely like the era, but a model of one particular instrument, down to the behaviour that makes it recognisable. The originals are the kind of thing that turns up once a year in a listing on this very site, usually needing work.",
      "That is why they are here rather than in the catalogue. A plugin has no condition, no shipping, no second seller to price it against and no used market, so every number this site is built to show you would be missing or made up. What it does have is the sound of an instrument you are otherwise waiting years and a repair bill to own.",
      "They also give a set of plugins away outright, which is worth knowing before you spend anything: you can hear what their modelling actually sounds like on your own tracks first, at no cost and with nothing to cancel.",
    ],
    highlights: [
      {
        title: "Model one instrument, not a genre",
        body: "Each release targets a specific machine rather than a category, which is what makes the quirks survive the port. Quirks are usually the reason anybody wants the original.",
      },
      {
        title: "Free plugins, not a trial",
        body: "Part of the catalogue is genuinely free rather than time limited, so you can judge the modelling on your own material before any money changes hands.",
      },
      {
        title: "A rig you can actually assemble",
        body: "If a documented board on our rigs pages leans on an instrument that costs four figures used, the software version is the version most players end up recording with.",
      },
    ],
    facts: [
      { label: "What it is", value: "Plugins: VST, AU and AAX" },
      { label: "What it is not", value: "Physical gear. Nothing ships" },
      { label: "Where it fits", value: "Studio and DAW, not the pedalboard" },
    ],
    whyNotListed:
      "Software has no condition, no shipping and no used market, so it has no market price for us to measure. Rather than publish a number with nothing behind it, Martinic gets a page of its own and stays out of the search grid.",
    // Deliberately no banner. One labelled placement on the site is a decision;
    // two is the start of an ad network, and this one was not asked for.
    banner: null,
    trackedLink: env.impact.martinicLink,
  },
  {
    slug: "distrokid",
    name: "DistroKid",
    tagline: "Getting the record you made onto the services people listen on",
    kind: "Artist services, not gear",
    homepage: "https://distrokid.com/",
    intro: [
      "DistroKid puts your music on Spotify, Apple Music, YouTube Music, TikTok and the rest of the services people actually use, for a flat yearly fee rather than a cut of what you earn. You keep your royalties; they keep the subscription.",
      "It is the one thing on this site that is not gear and never will be. Everything else here helps you buy an instrument. This is what you use once the instrument has done its job and there is a finished mix sitting on your drive with nowhere to go.",
      "Worth being clear about the trade, because it is a real one: the flat fee model is cheapest for anyone releasing regularly and worst for someone who releases once and never again, since the fee is annual and your catalogue comes down if you stop paying. Read their current terms before you commit a back catalogue to it.",
    ],
    highlights: [
      {
        title: "A flat fee, not a percentage",
        body: "You pay per year rather than per stream, so a track that unexpectedly does well does not start costing you more. Check the current price on their site: we do not quote one here because it would go stale.",
      },
      {
        title: "Splits paid automatically",
        body: "Royalties can be divided between collaborators at the source, which turns the most reliable way to fall out with a band into a form you fill in once.",
      },
      {
        title: "It is a subscription, so plan for it",
        body: "Releases stay up while the subscription does. That is the honest catch of every flat-fee distributor, and it is worth deciding about before you upload rather than a year later.",
      },
    ],
    facts: [
      { label: "What it is", value: "Music distribution and artist services" },
      { label: "What it costs", value: "A flat annual fee, priced on their site" },
      { label: "Who it is for", value: "Anyone with a finished mix and no label" },
    ],
    whyNotListed:
      "A distribution subscription is not an instrument. It has no price to compare, no stock, and nothing to be a deal against, so it stays out of the catalogue and lives here instead.",
    banner: {
      headline: "Finished the record? Now put it out.",
      body: "DistroKid gets your music onto Spotify, Apple Music and the rest for a flat yearly fee, and you keep your royalties.",
      cta: "What DistroKid does",
    },
    trackedLink: env.impact.distrokidLink,
  },
]

export const PARTNER_BY_SLUG = new Map(PARTNERS.map((p) => [p.slug, p]))

export function partnerFromSlug(slug: string): PartnerProfile | null {
  return PARTNER_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** A partner with a banner to place. */
export function bannerPartner(slug: string): PartnerProfile | null {
  const partner = partnerFromSlug(slug)
  return partner?.banner ? partner : null
}

export type PartnerDestination = {
  url: string
  /** True when the shopper is going through our tracked link rather than a plain one. */
  tracked: boolean
}

/**
 * Where /go/partner/[slug] sends someone, and whether we earn from it.
 *
 * Three rules, all of them the same ones /go applies to a listing:
 *
 *   1. A configured link is only trusted if it is actually on an Impact
 *      tracking host. A pasted link that is not one is a mistake (the wrong
 *      thing copied, a merchant's plain URL, a shortener), and using it anyway
 *      would send traffic through something we cannot account for.
 *   2. Anything not on the allowlist is refused outright, tracked or not. The
 *      value comes from our own configuration rather than a feed, so this is
 *      defence in depth: a typo must not turn this route into an open redirect.
 *   3. No link at all means the merchant's own site, untracked. Earning nothing
 *      is strictly better than routing a shopper through a tracker that credits
 *      nobody, which is the rule every other network here already follows.
 */
export function partnerDestination(partner: PartnerProfile): PartnerDestination {
  const configured = partner.trackedLink.trim()

  if (configured) {
    if (isImpactTrackingUrl(configured) && isAllowedDestination(configured)) {
      return { url: configured, tracked: true }
    }
    console.warn(
      `[partners] ${partner.slug} has a link configured that is not an Impact tracking URL on the allowlist. ` +
        "Ignoring it and linking to the merchant directly. Paste the whole link from Impact's own " +
        "\"create your links\" step; nothing here builds one.",
    )
  }

  return { url: partner.homepage, tracked: false }
}

/** True when a partner's outbound link is actually earning. Shown in the admin config line. */
export function partnerIsMonetised(partner: PartnerProfile): boolean {
  return partnerDestination(partner).tracked
}
