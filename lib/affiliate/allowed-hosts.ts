import { STOREFRONT_MERCHANTS } from "@/lib/storefronts"

/**
 * A storefront's own host, and any subdomain of the registrable domain it
 * sits on, so `store.acousticguitar.com` and `www.jamstik.com` are one rule
 * each rather than two.
 *
 * The leading `(^|\.)` is what makes it a suffix match; the trailing `$` is
 * what stops `folkcraft.com.evil.example` clearing it. Both matter, and
 * dropping either turns the allowlist into decoration.
 */
function hostPattern(merchant: { baseUrl: string }): RegExp {
  const host = new URL(merchant.baseUrl).hostname.replace(/^www\./i, "")
  return new RegExp(`(^|\\.)${host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
}

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
  /(^|\.)sweetwater\.com$/i,
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
  // Impact merchants' own storefronts, for the untracked `Original Url` their
  // catalogues carry beside the tracked link. Each domain is declared beside
  // its merchant in lib/ingestion/impact-merchants.ts and asserted against this
  // list by a test, so approving a ninth merchant cannot quietly leave every
  // one of its listings 502ing at /go.
  /(^|\.)andertons\.co\.uk$/i,
  /(^|\.)americanmusical\.com$/i,
  /(^|\.)musiciansfriend\.com$/i,
  /(^|\.)native-instruments\.com$/i,
  /(^|\.)fender\.com$/i,
  /(^|\.)uaudio\.com$/i,
  /(^|\.)donnermusic\.com$/i,
  /(^|\.)donnerdeal\.com$/i,
  /(^|\.)plugin-alliance\.com$/i,
  // The two focus-page partners (lib/partners.ts). They have no listings and
  // no catalogue, but /go/partner still checks its destination against this
  // list, so an unset tracked link falls back to a host that is known good
  // rather than to whatever a config edit happens to contain.
  /(^|\.)martinic\.com$/i,
  /(^|\.)distrokid\.com$/i,
  // Independent storefronts, DERIVED from lib/storefronts.ts rather than
  // retyped. GoAffPro-style referral links append a query param to the
  // merchant's own domain instead of redirecting through a separate tracking
  // host, so the raw and affiliate URLs share a host and one pattern covers
  // both.
  //
  // Derived because a hand-maintained copy fails in the worst available
  // direction: adding a store's row and forgetting its line here leaves every
  // one of that store's listings failing closed at /go, which looks like a
  // broken shop rather than a missing config line. The Impact merchants keep
  // their literals above and a test asserts them, because those hosts are the
  // network's rather than ours; these are one field on a row we own.
  ...STOREFRONT_MERCHANTS.map(hostPattern),
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
