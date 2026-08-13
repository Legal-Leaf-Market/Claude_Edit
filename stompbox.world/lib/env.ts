/**
 * Environment access, with the sister project's two house rules kept intact.
 *
 * 1. EVERY STRING IS TRIMMED, AND WHITESPACE-ONLY COUNTS AS UNSET. A leading
 *    space pasted into a dashboard field is invisible everywhere the value is
 *    printed, and it has already cost one debugging session on the sister
 *    project by sending DNS a hostname containing a space. Nothing this file
 *    reads has meaningful edge whitespace.
 *
 * 2. NOTHING THROWS. Every integration exposes an `isConfigured` boolean and
 *    unset is always a supported state that degrades to a smaller site rather
 *    than a broken one. This site has no database and no credentials, so the
 *    only thing that can be unconfigured is the Instagram strip.
 */

function str(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Comma or newline separated list, trimmed, with blanks dropped. */
function list(value: string | undefined): string[] {
  const raw = str(value)
  if (!raw) return []
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Only real Instagram permalinks are accepted.
 *
 * The embed script is handed these verbatim, so a typo or a pasted shortlink
 * would render an empty grey box that looks like a broken site rather than an
 * unconfigured one. Dropping anything that is not an instagram.com permalink
 * means a bad paste degrades to the plain follow callout instead.
 */
function instagramPermalinks(value: string | undefined): string[] {
  return list(value).filter((url) => {
    try {
      const parsed = new URL(url)
      return (
        parsed.protocol === "https:" &&
        (parsed.hostname === "instagram.com" || parsed.hostname === "www.instagram.com") &&
        /^\/(p|reel|tv)\/[^/]+\/?$/.test(parsed.pathname)
      )
    } catch {
      return false
    }
  })
}

/*
 * The handle is NOT the domain. The original brand grid is at @stompbox.world
 * and the account this site links to is @stomp_box_world, so the two strings
 * look near enough alike to get "corrected" into each other by anyone tidying
 * up. They are different accounts. Change this only on the owner's word.
 */
const instagramHandle = str(process.env.INSTAGRAM_HANDLE) ?? "stomp_box_world"
const instagramPostUrls = instagramPermalinks(process.env.INSTAGRAM_POST_URLS)

export const env = {
  social: {
    instagramHandle,
    instagramPostUrls,
    /** Posts are optional. The handle always has a value, so the follow link always works. */
    hasEmbeds: instagramPostUrls.length > 0,
  },
}

export const _internals = { str, list, instagramPermalinks }
