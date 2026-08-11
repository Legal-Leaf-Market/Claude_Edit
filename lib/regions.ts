import type { Source } from "@/lib/db/schema"
import { STORES } from "@/lib/stores"

/**
 * Where the shopper is, and which stores can actually deliver to them.
 *
 * WHY THIS EXISTS. Anderton's ships only within the UK. Their catalogue is by
 * far the largest here (27,052 products), so without this a shopper in Ohio
 * searching for a Victory preamp gets a page full of Guildford prices they can
 * never pay. That is the same failure as showing a stale price, and section 17
 * is explicit about it: prices shown must be prices the shopper can actually
 * get.
 *
 * WHY IT HIDES RATHER THAN LABELS. A badge saying "UK only" on every fourth
 * card still means a shopper scans, compares, gets interested and then loses.
 * Filtering them out is kinder. But hiding inventory silently is its own
 * dishonesty on a site whose whole promise is showing everything, so the count
 * of what was hidden is always reported and always one click from being shown.
 *
 * WHY THE DEFAULT IS "SHOW EVERYTHING". Geo-IP is a guess: VPNs, mobile
 * carriers routing through another country, a missing header in development.
 * When we do not know where someone is, the failure mode of hiding is that a
 * British shopper is silently denied the biggest catalogue on the site, which
 * is worse than the failure mode of showing, which is a clearly labelled
 * listing they cannot order. So unknown region shows everything, and the
 * labelling carries the honesty instead.
 */

/** A resolved shopper region. `null` means unknown, which shows everything. */
export type Region = string | null

/** The cookie an explicit choice is stored in. Outranks any geo guess. */
export const REGION_COOKIE = "ga_ships_to"

/**
 * Stores that will not ship everywhere, as source -> countries.
 *
 * Derived from STORES rather than listed again here, so declaring a store's
 * restriction in one place is genuinely enough.
 */
const RESTRICTED: { source: Source; shipsTo: string[]; name: string }[] = STORES.filter(
  (store): store is typeof store & { shipsTo: string[] } =>
    Array.isArray(store.shipsTo) && store.shipsTo.length > 0,
).map((store) => ({ source: store.source, shipsTo: store.shipsTo, name: store.name }))

export function normalizeRegion(raw: string | null | undefined): Region {
  if (!raw) return null
  const trimmed = raw.trim().toUpperCase()
  // Two letters exactly. Anything else is a malformed header or a crafted
  // cookie, and treating it as unknown is the safe reading.
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null
}

/** True when this store will ship to this region. Unknown region means yes. */
export function storeShipsTo(source: string, region: Region): boolean {
  if (region == null) return true
  const restricted = RESTRICTED.find((entry) => entry.source === source)
  if (!restricted) return true
  return restricted.shipsTo.includes(region)
}

/**
 * Sources to exclude for a shopper in this region.
 *
 * Returns an empty array for an unknown region, so the search layer adds no
 * filter at all rather than one that always passes.
 */
export function excludedSourcesFor(region: Region): Source[] {
  if (region == null) return []
  return RESTRICTED.filter((entry) => !entry.shipsTo.includes(region)).map((entry) => entry.source)
}

/** Human names of the stores being hidden, for the "we hid some" notice. */
export function excludedStoreNamesFor(region: Region): string[] {
  if (region == null) return []
  return RESTRICTED.filter((entry) => !entry.shipsTo.includes(region)).map((entry) => entry.name)
}

/** Where a restricted store ships, phrased for a shopper. */
export function shipsToLabel(source: string): string | null {
  const restricted = RESTRICTED.find((entry) => entry.source === source)
  if (!restricted) return null
  if (restricted.shipsTo.length === 1 && restricted.shipsTo[0] === "GB") return "UK only"
  return `${restricted.shipsTo.join(", ")} only`
}

/**
 * Resolve the shopper's region from request headers.
 *
 * An explicit cookie choice always wins over the geo guess, because a shopper
 * who has told us where they are knows better than an IP lookup does. The
 * header names cover Vercel and Cloudflare; anything else falls through to
 * unknown, which shows everything.
 */
export function regionFromHeaders(headers: {
  get(name: string): string | null
}): Region {
  const cookie = headers.get("cookie") ?? ""
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]+)`))
  if (match) {
    // An explicit "worldwide" choice is a real answer, not an absent one.
    if (decodeURIComponent(match[1]).toUpperCase() === "ALL") return null
    const chosen = normalizeRegion(decodeURIComponent(match[1]))
    if (chosen) return chosen
  }

  return (
    normalizeRegion(headers.get("x-vercel-ip-country")) ??
    normalizeRegion(headers.get("cf-ipcountry")) ??
    null
  )
}
