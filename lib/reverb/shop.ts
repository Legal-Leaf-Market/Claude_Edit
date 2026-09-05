import { env } from "@/lib/env"

/**
 * OUR OWN REVERB SHOP, AND WHY THIS IS NOT SECTION 2.
 *
 * CLAUDE.md is emphatic that the Reverb API must never build the catalogue,
 * and the reason it gives is the reason this file is allowed to exist: the API
 * "is scoped to managing YOUR OWN shop". Pulling other merchants' listings
 * through it is the breach, on two counts, and the Awin datafeed is the
 * legitimate channel for that. Reading our own shop's own listings, to show
 * them on our own site, is the single use the API was built for.
 *
 * The boundary that keeps the two apart is structural rather than a promise:
 *
 *   NOTHING HERE EVER TOUCHES `marketplace_listings`.
 *
 * These rows never enter a median, never earn a deal badge, never join the
 * comparison grid. Section 24 spells out why: our own stock inside the median
 * means setting a price and also computing the market price that judges it,
 * which is marking our own homework. So this module returns a plain array to
 * whoever asked and writes nothing, anywhere.
 */

export type ShopListing = {
  id: string
  title: string
  condition: string | null
  price: string | null
  currency: string | null
  photo: string | null
  url: string
}

export type ShopResult =
  | { ok: true; listings: ShopListing[]; source: string; raw?: Record<string, unknown> }
  | { ok: false; reason: string }

/**
 * Candidate endpoints, most specific first.
 *
 * `per_page=100` rather than 24, because a page size smaller than the shop is
 * indistinguishable from a shop that size: the total just comes up short and
 * nothing says why. 24 was never hit at nine listings, and would have been the
 * silent explanation the moment stock grew past it.
 *
 * Written as a list rather than a single URL because this could not be
 * verified against the live API from the machine it was written on, and a
 * single wrong guess ships a dead section that fails silently. The first one
 * that answers with listings wins and the result names it, so the next person
 * can delete the others once the real one is known.
 */
const ENDPOINTS = (slug: string) => [
  `https://api.reverb.com/api/my/listings?state=live&per_page=100`,
  `https://api.reverb.com/api/shops/${encodeURIComponent(slug)}/listings?per_page=100`,
  `https://api.reverb.com/api/listings?shop_slug=${encodeURIComponent(slug)}&per_page=100`,
]

function pickPhoto(raw: Record<string, unknown>): string | null {
  const photos = raw.photos
  if (!Array.isArray(photos) || !photos.length) return null
  const first = photos[0] as Record<string, unknown>
  const links = (first?._links ?? {}) as Record<string, { href?: string }>
  return (
    links.large_crop?.href ??
    links.full?.href ??
    links.small_crop?.href ??
    links.thumbnail?.href ??
    null
  )
}

function normalize(raw: Record<string, unknown>): ShopListing | null {
  const links = (raw._links ?? {}) as Record<string, { href?: string }>
  const url = links.web?.href
  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  /* No link is not a listing we can send anybody to, and a titleless row is
     not one a shopper can read. Both are dropped rather than half rendered. */
  if (!url || !title) return null

  const price = (raw.price ?? {}) as Record<string, unknown>
  const condition = (raw.condition ?? {}) as Record<string, unknown>

  return {
    id: String(raw.id ?? url),
    title,
    condition: typeof condition.display_name === "string" ? condition.display_name : null,
    price: typeof price.display === "string" ? price.display
      : typeof price.amount === "string" ? price.amount : null,
    currency: typeof price.currency === "string" ? price.currency : null,
    photo: pickPhoto(raw),
    url,
  }
}

/**
 * Unset is a fully supported state, the same shape as Sweetwater's feed gate.
 * An unconfigured deploy is missing a section rather than showing a broken one.
 */
export async function fetchShopListings(): Promise<ShopResult> {
  const { token, slug } = env.reverbShop
  if (!token) return { ok: false, reason: "REVERB_SHOP_TOKEN is not set" }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/hal+json",
    "Content-Type": "application/hal+json",
    "Accept-Version": "3.0",
  }

  const failures: string[] = []
  for (const url of ENDPOINTS(slug)) {
    try {
      const res = await fetch(url, { headers, next: { revalidate: 900 } })
      if (!res.ok) {
        /* The status only. A body can echo the request, and the request
           carries the bearer token. */
        failures.push(`${new URL(url).pathname} -> ${res.status}`)
        continue
      }
      const body = (await res.json()) as Record<string, unknown>
      const rows = Array.isArray(body.listings) ? body.listings : []
      const listings = rows
        .map((r) => normalize(r as Record<string, unknown>))
        .filter((l): l is ShopListing => l !== null)
      if (listings.length) {
        /* `raw` is the first row exactly as Reverb sent it, carried only for
           the admin diagnostic below. THE PRICE FIELD WAS BOUND WRONG ONCE
           ALREADY: `price` read back well under the live asking price, so the
           shop advertised numbers the shop was not asking. Guessing a second
           field after getting the first one wrong is how you ship a third
           wrong number, so the raw object is what decides it. */
        return {
          ok: true,
          listings,
          source: new URL(url).pathname,
          raw: rows[0] as Record<string, unknown>,
        }
      }
      failures.push(`${new URL(url).pathname} -> 200, no listings`)
    } catch (error) {
      failures.push(`${new URL(url).pathname} -> ${(error as Error).message}`)
    }
  }
  return { ok: false, reason: failures.join("; ") || "no endpoint answered" }
}
