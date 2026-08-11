/**
 * Impact.com (formerly Impact Radius) link recognition.
 *
 * Same rule as CJ and Awin, for the same reason: we trust the network's own
 * tracked link and verify its host, and we never hand-build one. An untracked
 * or unrecognised host produces NO affiliate link rather than a half-built one,
 * because routing a shopper through a tracker that credits nobody is worse than
 * a clean direct link.
 *
 * Impact hands each brand a set of branded vanity domains rather than one
 * shared tracking host, so recognition is by domain family rather than by an
 * exact hostname: Andertons is `andertonsmusiccompany.pxf.io`, and the same
 * publisher's Semrush links would be `semrush.sjv.io`. The four domains below
 * are Impact's standard vanity set; `impactradius.com` and its event/tag
 * subdomains are the platform's own hosts and are included for completeness.
 *
 * WHY THERE IS NO buildImpactUrl() HERE. Impact deep links take the shape
 * `https://<brand>.pxf.io/c/<publisherId>/<campaignId>/<adId>?u=<destination>`,
 * which needs a campaign id and an ad id that a vanity short link does not
 * carry. Awin is the one network where we do build links ourselves, and only
 * because a publisher id plus a merchant id is genuinely all Awin needs. Until
 * Andertons' actual feed is in hand (see CLAUDE.md section 1), the feed's own
 * tracked column is the only link we would trust, so there is nothing to build
 * against and guessing the ids would produce links crediting nobody.
 */

/**
 * Impact's vanity and platform tracking domains.
 *
 * Verified against Impact's published integration docs and live publisher
 * links rather than written from memory, the same discipline CLAUDE.md applies
 * to broadening any exclusion or placeholder list. If a fifth vanity domain
 * turns up in a real feed row, add it here after seeing it, not before.
 */
const IMPACT_TRACKING_HOSTS =
  /(^|\.)(pxf\.io|sjv\.io|7eer\.net|evyy\.net|impactradius\.com|impactradius-event\.com|impactradius-tag\.com)$/i

/** True when the URL is one of Impact's own tracking-domain redirect links. */
export function isImpactTrackingUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return IMPACT_TRACKING_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}
