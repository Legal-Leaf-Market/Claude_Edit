import { env } from "@/lib/env"

/**
 * eBay Partner Network links.
 *
 * The happy path is that the feed itself carries `itemAffiliateWebUrl`, which
 * happens when the feed request is made with affiliate context (see the
 * X-EBAY-C-ENDUSERCTX header in lib/ingestion/ebay-feed.ts). That URL is
 * already correctly signed and is always preferred.
 *
 * This module is the fallback for rows that arrive without one: it appends the
 * standard EPN rover parameters to the raw listing URL. It is deliberately a
 * fallback rather than the default, because a hand-built link is easier to get
 * subtly wrong than one eBay generated.
 */

/** EPN's tracking parameter set. campid is the campaign, mkcid/mkrid identify the network. */
const EPN_TOOL_ID = "10001"
const EPN_CUSTOM_ID_MAX = 256

export type EbayLinkOptions = {
  campaignId?: string
  /** Free-form sub-id echoed back in EPN reporting. We use it to tag the listing. */
  customId?: string
}

const EBAY_HOSTS = /(^|\.)ebay\.[a-z.]{2,6}$/i

export function isEbayListingUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    return (u.protocol === "https:" || u.protocol === "http:") && EBAY_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}

/**
 * Append EPN tracking to an eBay listing URL. Returns null when no campaign id
 * is configured, so the caller keeps a clean untracked link rather than an
 * incomplete one that credits nobody.
 */
export function buildEbayAffiliateUrl(
  listingUrl: string,
  options: EbayLinkOptions = {},
): string | null {
  const campaignId = options.campaignId ?? env.ebay.affiliateCampaignId
  if (!campaignId) return null
  if (!isEbayListingUrl(listingUrl)) return null

  let url: URL
  try {
    url = new URL(listingUrl)
  } catch {
    return null
  }

  url.searchParams.set("mkcid", "1")
  url.searchParams.set("mkrid", "711-53200-19255-0")
  url.searchParams.set("siteid", "0")
  url.searchParams.set("campid", campaignId)
  url.searchParams.set("toolid", EPN_TOOL_ID)
  url.searchParams.set("mkevt", "1")
  if (options.customId) {
    url.searchParams.set("customid", options.customId.slice(0, EPN_CUSTOM_ID_MAX))
  }
  return url.toString()
}

/**
 * The affiliate URL to persist for an eBay listing: the feed's own value when
 * present, then a built EPN link, then null.
 */
export function resolveEbayAffiliateUrl(
  feedAffiliateUrl: string | null,
  rawUrl: string,
  options: EbayLinkOptions = {},
): string | null {
  if (feedAffiliateUrl) return feedAffiliateUrl
  return buildEbayAffiliateUrl(rawUrl, options)
}
