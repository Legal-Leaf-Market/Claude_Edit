import { env } from "@/lib/env"

/**
 * Awin deep links for Reverb.
 *
 * Format is the same one the sister sites use:
 *   https://www.awin1.com/cread.php?awinmid=<mid>&awinaffid=<affid>&ued=<encoded destination>
 *
 * TESTING RULE, carried over from Herbal Leaf Market: never GET a cread.php URL
 * while testing. Every request registers a real click and pollutes the
 * conversion stats with our own traffic. Assert on the string, do not follow it.
 *
 * An unapproved merchant id is worse than no link at all: it routes the shopper
 * through a tracker that credits nobody. So when either id is missing,
 * buildAwinDeepLink returns null and the caller keeps the clean direct URL.
 */

const AWIN_CREAD = "https://www.awin1.com/cread.php"

/** Hosts we are willing to wrap. Guards against building a tracked link to somewhere unexpected. */
const REVERB_HOSTS = /(^|\.)reverb\.com$/i

/** Gear4music runs regional storefronts (.com, .ie, .fr, .dk, .pl, ...) on one merchant account. */
const GEAR4MUSIC_HOSTS = /(^|\.)gear4music\.[a-z.]{2,6}$/i

export type AwinLinkOptions = {
  publisherId?: string
  merchantId?: string
  /** Optional click reference passed through to Awin reporting (max 100 chars). */
  clickRef?: string
}

/** True when the URL is a Reverb product URL we are prepared to deep link. */
export function isReverbProductUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return REVERB_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}

/** True when the URL is a Gear4music product URL we are prepared to deep link. */
export function isGear4MusicProductUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return GEAR4MUSIC_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}

/**
 * Wrap a destination URL in an Awin tracking link.
 * Returns null when the publisher or merchant id is unset, or when the
 * destination is not a URL we recognise.
 */
export function buildAwinDeepLink(
  destinationUrl: string,
  options: AwinLinkOptions = {},
): string | null {
  const publisherId = options.publisherId ?? env.awin.publisherId
  const merchantId = options.merchantId ?? env.awin.reverbMerchantId
  if (!publisherId || !merchantId) return null
  if (!destinationUrl) return null

  let normalized: string
  try {
    normalized = new URL(destinationUrl).toString()
  } catch {
    return null
  }

  const params = new URLSearchParams()
  params.set("awinmid", merchantId)
  params.set("awinaffid", publisherId)
  if (options.clickRef) params.set("clickref", options.clickRef.slice(0, 100))
  // `ued` carries the destination and must be percent encoded as a single
  // value. URLSearchParams handles that, including the query string of the
  // destination, which is exactly where a hand-rolled concat goes wrong.
  params.set("ued", normalized)

  return `${AWIN_CREAD}?${params.toString()}`
}

/**
 * The link we should store for a Reverb listing: an Awin deep link when we can
 * build one, otherwise null so the row keeps a nullable affiliate_url and the
 * /go gateway falls back to the raw listing URL.
 */
export function reverbAffiliateUrl(productUrl: string, options: AwinLinkOptions = {}): string | null {
  if (!isReverbProductUrl(productUrl)) return null
  return buildAwinDeepLink(productUrl, options)
}

/** Same rule as reverbAffiliateUrl, for Gear4music's regional storefronts. */
export function gear4musicAffiliateUrl(productUrl: string, options: AwinLinkOptions = {}): string | null {
  if (!isGear4MusicProductUrl(productUrl)) return null
  return buildAwinDeepLink(productUrl, options)
}
