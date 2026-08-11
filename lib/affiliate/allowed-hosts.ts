/**
 * Hosts Gear Avail will ever send a shopper to. Shared between /go (single
 * listing redirect) and /api/cart/checkout (multi-item checkout handoff),
 * since both take a URL that ultimately comes from our own ingestion and both
 * need the same defence in depth: a poisoned or misparsed feed row must not
 * turn either route into an open redirect that launders a phishing link
 * through our domain.
 */
export const ALLOWED_HOSTS = [
  /(^|\.)ebay\.[a-z.]{2,6}$/i,
  /(^|\.)ebayimg\.com$/i,
  /(^|\.)reverb\.com$/i,
  /(^|\.)awin1\.com$/i,
  /(^|\.)ebay\.to$/i,
  /(^|\.)gear4music\.[a-z.]{2,6}$/i,
  /(^|\.)zzounds\.com$/i,
  /(^|\.)fullcompass\.com$/i,
  /(^|\.)pinevillemusic\.com$/i,
  // CJ Affiliate's own tracking domains, for the pre-built BUY_URL links
  // zZounds/Full Compass/Pineville Music feeds carry.
  /(^|\.)(anrdoezrs\.net|apmebf\.com|awltovhc\.com|dpbolvw\.net|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|qksrv\.net)$/i,
  // Impact.com's vanity and platform tracking domains, plus Andertons' own
  // storefront for the untracked fallback. Listed ahead of any Andertons
  // ingestion existing, because the allowlist is defence in depth rather than
  // a feature switch: a destination has to clear it before /go will follow it,
  // and a host missing here fails closed. See lib/affiliate/impact.ts.
  /(^|\.)(pxf\.io|sjv\.io|7eer\.net|evyy\.net|impactradius\.com)$/i,
  /(^|\.)andertons\.co\.uk$/i,
  // Small independent Shopify sellers. GoAffPro-style referral links append a
  // query param to the merchant's own domain rather than redirecting through
  // a separate tracking host, so the raw and affiliate URLs share a host.
  /(^|\.)folkcraft\.com$/i,
  /(^|\.)acousticguitar\.com$/i,
  /(^|\.)jamstik\.com$/i,
  /(^|\.)jackson\.audio$/i,
  /(^|\.)eminence-digital\.com$/i,
  /(^|\.)hazeguitar\.com\.au$/i,
  /(^|\.)eartguitar\.com$/i,
  /(^|\.)playwithauthority\.com$/i,
  /(^|\.)puresmusic\.com$/i,
  /(^|\.)squaver\.in$/i,
  /(^|\.)easonmusicstore\.com$/i,
  /(^|\.)gokalimba\.com$/i,
]

export function isAllowedDestination(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    return ALLOWED_HOSTS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}
