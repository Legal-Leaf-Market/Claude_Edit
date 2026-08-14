import { revalidatePath, revalidateTag } from "next/cache"
import { CATALOG_TAG } from "@/lib/catalog"

/**
 * What a catalogue refresh actually drops.
 *
 * ITS OWN MODULE FOR A TESTING REASON, and a small design one. `next/cache` is
 * an external package, so a test cannot mock it and calling it outside a
 * request throws an invariant; putting the two calls behind a first-party
 * function makes the route testable without a Next server. The design reason
 * is that "refresh the catalogue" is now one named thing rather than two
 * incantations a caller has to remember to pair.
 */

/**
 * The tag and the path, exported so a test can pin them without a request
 * context. A typo in either fails silently: the route answers 200, nothing
 * refreshes, and the only symptom is the stale page this whole route exists
 * to prevent.
 */
export const REFRESH_TARGETS = { tag: CATALOG_TAG, path: "/catalog" } as const

/**
 * Expire the tagged entry NOW rather than letting it be served stale.
 *
 * Next 16 takes a cacheLife profile as revalidateTag's second argument, and it
 * governs how long the existing entry may still be handed out while the new
 * one is fetched. A profile like "max" would allow exactly the thing this
 * route exists to prevent: a reader arriving straight after the sister site
 * deployed and getting the pre-deploy catalogue anyway. `updateTag` is the
 * documented way to say "immediately", and it throws in a route handler by
 * design, so an inline zero-second profile is how a route handler says it.
 */
const IMMEDIATELY = { expire: 0 } as const

/**
 * Drop the cached fetch of the sister site's endpoint AND the page built from
 * it. Both, because the page is what a reader sees and the fetch is what makes
 * it wrong: revalidating the path alone would re-render against a response
 * that is still inside its own fifteen minute window.
 */
export function refreshCatalog(): void {
  revalidateTag(REFRESH_TARGETS.tag, IMMEDIATELY)
  revalidatePath(REFRESH_TARGETS.path)
}
