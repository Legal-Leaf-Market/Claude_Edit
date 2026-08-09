/**
 * CJ Affiliate (formerly Commission Junction) link recognition.
 *
 * CJ's product feeds carry a pre-built tracked BUY_URL per row, the same way
 * Awin's aw_deep_link and LinkConnector's Link column do. We do not hand-build
 * a CJ tracking link ourselves; we only trust the feed's own BUY_URL when it
 * resolves to one of CJ's known tracking domains. An untracked or unrecognised
 * host produces no affiliate link, not a half-built one.
 *
 * CJ has used several tracking domains across its history (legacy acquisitions
 * and rebrands); all route through the same network.
 */

const CJ_TRACKING_HOSTS =
  /(^|\.)(anrdoezrs\.net|apmebf\.com|awltovhc\.com|dpbolvw\.net|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|qksrv\.net)$/i

/** True when the URL is one of CJ's own tracking-domain redirect links. */
export function isCjTrackingUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return CJ_TRACKING_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}
