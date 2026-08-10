import { hasLinkConnectorProductTracking } from "./linkconnector"

/**
 * Zoro host recognition, for the LinkConnector click campaign.
 *
 * Zoro's campaign (LinkConnector, active to 2032-01-31) pays a variable click
 * commission of up to $0.36 per valid user-generated click, and pays it ONLY on
 * product-oriented links carrying lc_pid. Unlike the Sweetwater pair in
 * lib/affiliate/sweetwater.ts, a bare zoro.com URL is therefore not merely
 * unattributed, it is explicitly unpaid, so the host check is necessary but not
 * sufficient here and both conditions are required together.
 *
 * We never hand-build the parameter. The value comes from the feed's own Link
 * column or LinkConnector's link manager; we only verify it is there.
 */

const ZORO_HOSTS = /(^|\.)zoro\.com$/i

export function isZoroProductUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return ZORO_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}

/**
 * True only for a Zoro-host URL that also carries lc_pid, which is the sole
 * form the campaign pays on. Anything else stores no affiliate_url at all.
 */
export function isZoroTrackedProductUrl(rawUrl: string): boolean {
  return isZoroProductUrl(rawUrl) && hasLinkConnectorProductTracking(rawUrl)
}
