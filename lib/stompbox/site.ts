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
 * Canonical origin of the guide, no trailing slash.
 *
 * Falls back to the production domain rather than to localhost: an unset
 * variable on a preview deploy should still produce absolute URLs that point
 * somewhere real, and a canonical tag pointing at localhost is worse than one
 * pointing at production.
 *
 * NAMED `NEXT_PUBLIC_STOMPBOX_URL`, AND IT USED TO BE `NEXT_PUBLIC_SITE_URL`.
 * That was safe while this was its own Vercel project with its own environment,
 * and it stopped being safe the moment one deployment started serving both
 * domains: "the site URL" is now an ambiguous phrase, and setting it to
 * gearavail.com is the obvious thing to do to a variable with that name. Doing
 * so would have repointed every canonical tag on the guide at the aggregator,
 * which is the exact opposite of what those tags are for, and nothing would
 * have failed. The aggregator's own origin is `SITE_URL` (lib/env.ts) and is a
 * different variable; this one names the site it belongs to.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_STOMPBOX_URL || "https://stompbox.world").replace(
  /\/+$/,
  "",
)
