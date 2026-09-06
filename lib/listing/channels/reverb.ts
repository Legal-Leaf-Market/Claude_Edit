import { env } from "@/lib/env"
import type { ListingDraft } from "@/lib/db/schema"
import type { ChannelMeta } from "@/lib/listing/readiness"
import type { PublishResult } from "@/lib/listing/types"

/**
 * Create and end listings in OUR OWN Reverb shop.
 *
 * THIS IS THE ONE THING THE REVERB API IS FOR. Section 2 forbids using it to
 * build the catalogue, and the reason it gives is precisely the licence here:
 * the API is scoped to managing your own shop. `lib/reverb/shop.ts` reads our
 * listings; this writes them. Neither touches `marketplace_listings`, a
 * canonical row, a median or a public page, and no listing created here is ever
 * ingested back into the aggregator, which is what would turn setting our own
 * price into also computing the market price that judges it.
 *
 * It needs the same REVERB_SHOP_TOKEN, and the token's scopes decide whether a
 * write is allowed. A read-only Personal Access Token answers 403 here while
 * working perfectly for the shop page, so a failure that mentions scope is a
 * token to widen rather than a bug to chase.
 */

const API = "https://api.reverb.com/api"

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/hal+json",
    "Content-Type": "application/hal+json",
    "Accept-Version": "3.0",
  }
}

/**
 * Reverb's own listing shape.
 *
 * `sku` is ours and is the whole point: it comes back on the listing and on
 * any order, so a Reverb sale can be traced to the physical unit without
 * trusting Reverb's id to mean anything to eBay.
 *
 * `publish: true` puts it live. Sending false leaves it as a Reverb draft,
 * which is a legitimate way to work but is not what a button labelled "push"
 * should do silently.
 */
function body(draft: ListingDraft) {
  const meta = (draft.channelMeta ?? {}) as ChannelMeta
  const photos = (Array.isArray(draft.photos) ? draft.photos : []) as string[]

  return {
    make: draft.brand ?? undefined,
    model: draft.model ?? undefined,
    title: draft.title,
    description: draft.description ?? "",
    condition: { uuid: meta.reverb?.conditionUuid },
    categories: meta.reverb?.categoryUuid ? [{ uuid: meta.reverb.categoryUuid }] : undefined,
    photos,
    price: {
      amount: ((draft.priceCents ?? 0) / 100).toFixed(2),
      currency: draft.currency || "USD",
    },
    /* Our cost is deliberately absent. Reverb has a seller_cost field and it is
       useful on the inventory page, but it is set by hand there rather than
       pushed from here: a bug in this mapper that wrote cost into price, or the
       reverse, is the one mistake with a real invoice attached. */
    shipping_profile_id: meta.reverb?.shippingProfileId ?? undefined,
    shipping: meta.reverb?.shippingProfileId
      ? undefined
      : {
          local: draft.localPickup,
          rates:
            draft.shippingCents == null
              ? undefined
              : [
                  {
                    region_code: "US_CON",
                    rate: {
                      amount: (draft.shippingCents / 100).toFixed(2),
                      currency: draft.currency || "USD",
                    },
                  },
                ],
        },
    offers_enabled: draft.acceptsOffers,
    year: draft.year ?? undefined,
    finish: draft.finish ?? undefined,
    sku: draft.sku,
    publish: true,
    inventory: 1,
    has_inventory: true,
  }
}

export async function publishToReverb(draft: ListingDraft): Promise<PublishResult> {
  const token = env.reverbShop.token
  if (!token) return { ok: false, reason: "REVERB_SHOP_TOKEN is not set" }

  try {
    const res = await fetch(`${API}/listings`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body(draft)),
      cache: "no-store",
    })

    if (!res.ok) {
      /* Reverb answers 422 with a field-keyed hash, and that hash is the only
         useful part. It is our own listing being described, so quoting it back
         to the admin leaks nothing, unlike the read paths where a body can echo
         the request. Capped, because a validation failure can be long. */
      let detail = ""
      try {
        detail = JSON.stringify(await res.json()).slice(0, 600)
      } catch {
        /* not JSON; the status is the whole answer */
      }
      return { ok: false, reason: `Reverb answered ${res.status}${detail ? `: ${detail}` : ""}` }
    }

    const payload = (await res.json()) as Record<string, unknown>
    const listing = (payload.listing ?? payload) as Record<string, unknown>
    const id = listing.id != null ? String(listing.id) : null
    const links = listing._links as Record<string, { href?: string }> | undefined
    const url =
      links?.web?.href ??
      (typeof listing.slug === "string" ? `https://reverb.com/item/${listing.slug}` : null)

    return { ok: true, externalId: id, externalUrl: url ?? null }
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
}

/**
 * Take it down, because it sold somewhere else.
 *
 * `reason: "not_sold"` is deliberate and is not a detail. Telling Reverb a
 * listing sold there when it sold on eBay inflates their sold-price data and
 * ours, and our own order history is the top-ranked source in the comps
 * lookup. Poisoning it to save a click would quietly bias every offer we make.
 */
export async function endOnReverb(externalId: string): Promise<PublishResult> {
  const token = env.reverbShop.token
  if (!token) return { ok: false, reason: "REVERB_SHOP_TOKEN is not set" }

  try {
    const res = await fetch(`${API}/listings/${encodeURIComponent(externalId)}/state/end`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({ reason: "not_sold" }),
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, reason: `Reverb answered ${res.status}` }
    return { ok: true, externalId, externalUrl: null }
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
}
