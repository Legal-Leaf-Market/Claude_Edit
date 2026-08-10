/**
 * LinkConnector product-link tracking.
 *
 * LinkConnector uses "Naked Link Technology": approved affiliates link straight
 * to the merchant's own domain, with tracking carried in query parameters,
 * rather than through a network redirect domain the way Awin's cread.php and
 * CJ's anrdoezrs.net links do. So a LinkConnector affiliate URL is host-
 * indistinguishable from a plain merchant URL, and a host check alone cannot
 * tell a tracked link from an untracked one.
 *
 * WHY THAT MATTERS. Click-commission campaigns on this network pay only on
 * product-oriented links. The Zoro campaign terms say it outright: "Affiliates
 * will only be paid if they use product-oriented links (i.e., those that
 * utilize lc_pid)." A merchant-host URL WITHOUT lc_pid therefore earns nothing
 * while looking, in our own database, exactly like a monetised link. That is
 * the failure section 5 of CLAUDE.md forbids: routing a shopper through a
 * tracker that credits nobody is worse than a clean direct link, and an
 * unapproved or empty id must produce null rather than a half-built link.
 *
 * So merchants whose LinkConnector campaign is click-priced require the
 * parameter to be present before we will store a feed link as affiliate_url.
 */

/** LinkConnector's product id parameter, per the campaign terms. */
export const LC_PRODUCT_PARAM = "lc_pid"

/**
 * True when the URL carries a non-empty lc_pid, i.e. it is the product-oriented
 * form LinkConnector actually pays click commission on.
 */
export function hasLinkConnectorProductTracking(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    // Parameter casing varies between the feed export and the link manager.
    for (const [key, value] of u.searchParams) {
      if (key.toLowerCase() === LC_PRODUCT_PARAM && value.trim() !== "") return true
    }
    return false
  } catch {
    return false
  }
}
