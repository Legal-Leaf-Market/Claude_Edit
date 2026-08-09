/**
 * Sweetwater host recognition.
 *
 * LinkConnector (the affiliate network Sweetwater's program runs on) uses
 * "Naked Link Technology": approved affiliates link straight to the merchant's
 * own domain, with tracking carried in query parameters, rather than through a
 * network redirect domain the way Awin's cread.php works. That means the
 * datafeed's own tracked link is expected to be a sweetwater.com URL, not a
 * separate linkconnector.com host.
 *
 * We do not hand-build a tracking link the way lib/affiliate/awin.ts does for
 * Awin, because we have no verified spec for how LinkConnector's tracking
 * parameters are constructed. Instead the ingestion layer trusts the feed's own
 * Link column IF AND ONLY IF it resolves to a Sweetwater host; otherwise it
 * drops to null rather than storing an unverified destination. An unrecognised
 * host produces no affiliate link, not a half-built one.
 */

const SWEETWATER_HOSTS = /(^|\.)sweetwater\.com$/i

export function isSweetwaterProductUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return SWEETWATER_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}
