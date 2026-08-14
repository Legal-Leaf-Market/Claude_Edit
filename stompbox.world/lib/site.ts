/**
 * Site-wide constants.
 *
 * Kept in one file rather than scattered through metadata blocks so the name,
 * the description and the URL cannot drift apart between the layout, the
 * sitemap and the Open Graph tags.
 */

export const SITE_NAME = "stompbox.world"

export const SITE_TAGLINE = "What the circuit does, and where it goes"

export const SITE_DESCRIPTION =
  "A plain guide to guitar effects pedals. What each circuit actually does to your signal, what to listen for, and what order to put them in."

/**
 * Canonical origin, no trailing slash.
 *
 * Falls back to the production domain rather than to localhost: an unset
 * variable on a preview deploy should still produce absolute URLs that point
 * somewhere real, and a canonical tag pointing at localhost is worse than one
 * pointing at production.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://stompbox.world").replace(
  /\/+$/,
  "",
)
