import { env } from "@/lib/env"
import type { ListingDraft } from "@/lib/db/schema"
import type { ChannelMeta } from "@/lib/listing/readiness"
import type { PublishResult } from "@/lib/listing/types"

/**
 * Create and end listings in OUR OWN eBay account, through the Sell Inventory
 * API.
 *
 * NOT THE SAME API AS THE ONE THE AGGREGATOR READS. `lib/ingestion/ebay-feed.ts`
 * pulls the Buy Feed: bulk TSV, read only, other people's listings. This writes
 * ours. Different base path, different OAuth scopes, separate approval, and
 * `env.ebaySell` rather than `env.ebay` so a token for one can never quietly be
 * used for the other.
 *
 * THE FLOW IS THREE CALLS, AND THAT IS WHY THE SKU MATTERS SO MUCH.
 *
 *   1. PUT  /sell/inventory/v1/inventory_item/{sku}   the thing itself
 *   2. POST /sell/inventory/v1/offer                  price, policies, category
 *   3. POST /sell/inventory/v1/offer/{offerId}/publish  it goes live
 *
 * Step 1 is a PUT keyed by OUR SKU, so it is idempotent for free: running it
 * twice updates rather than duplicates. Step 2 is a POST and is NOT, which is
 * the one place a double press creates two offers for one pedal. So step 2 is
 * preceded by a lookup of any existing offer for that SKU, and the database's
 * unique index on (draft, channel) is the second belt. Neither is decorative:
 * two live offers for one physical unit is an oversold customer.
 *
 * SANDBOX BY DEFAULT. EBAY_SELL_API_ORIGIN has to be set deliberately to reach
 * the real marketplace, for the same reason EBAY_FEED_BASE_URL does.
 */

type Ok = { ok: true; body: Record<string, unknown> }
type Err = { ok: false; reason: string }

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": "en-US",
    "X-EBAY-C-MARKETPLACE-ID": env.ebaySell.marketplaceId,
  }
}

/**
 * eBay reports failures as `errors[]`, each with a message and often a
 * `parameters[]` naming the field. That is genuinely the useful part and it
 * describes our own listing, so it is surfaced rather than swallowed. The raw
 * body is not, because it echoes the request we sent.
 */
function explain(status: number, payload: unknown): string {
  const body = payload as { errors?: { message?: string; longMessage?: string; parameters?: { name?: string; value?: string }[] }[] }
  const errors = Array.isArray(body?.errors) ? body.errors : []
  if (errors.length === 0) return `eBay answered ${status}`
  const lines = errors.slice(0, 4).map((e) => {
    const params = (e.parameters ?? [])
      .map((p) => [p.name, p.value].filter(Boolean).join("="))
      .filter(Boolean)
      .join(", ")
    return [e.longMessage || e.message, params && `(${params})`].filter(Boolean).join(" ")
  })
  return `eBay answered ${status}: ${lines.join("; ")}`.slice(0, 800)
}

async function call(
  path: string,
  init: { method: string; body?: unknown },
  token: string,
): Promise<Ok | Err> {
  try {
    const res = await fetch(`${env.ebaySell.origin}${path}`, {
      method: init.method,
      headers: headers(token),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    })
    // 204 is a success with nothing to say, which several of these return.
    if (res.status === 204) return { ok: true, body: {} }
    let payload: unknown = {}
    try {
      payload = await res.json()
    } catch {
      /* empty body */
    }
    if (!res.ok) return { ok: false, reason: explain(res.status, payload) }
    return { ok: true, body: (payload ?? {}) as Record<string, unknown> }
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
}

function inventoryItem(draft: ListingDraft) {
  const meta = (draft.channelMeta ?? {}) as ChannelMeta
  const photos = (Array.isArray(draft.photos) ? draft.photos : []) as string[]

  /* Brand and MPN are required aspects in most gear categories, and a missing
     required aspect is a publish failure with a message naming a field the
     operator never filled in. Seeding them from the master record is what makes
     the readiness check's promise true. */
  const aspects: Record<string, string[]> = { ...(meta.ebay?.aspects ?? {}) }
  if (draft.brand && !aspects.Brand) aspects.Brand = [draft.brand]
  if (draft.model && !aspects.Model) aspects.Model = [draft.model]
  if (draft.countryOfOrigin && !aspects["Country/Region of Manufacture"]) {
    aspects["Country/Region of Manufacture"] = [draft.countryOfOrigin]
  }

  return {
    availability: { shipToLocationAvailability: { quantity: 1 } },
    condition: meta.ebay?.conditionId,
    product: {
      title: draft.title.slice(0, 80), // eBay's hard limit, and it truncates badly
      description: draft.description ?? "",
      aspects,
      imageUrls: photos.slice(0, 24),
      brand: draft.brand ?? undefined,
    },
  }
}

function offer(draft: ListingDraft) {
  const meta = (draft.channelMeta ?? {}) as ChannelMeta
  return {
    sku: draft.sku,
    marketplaceId: env.ebaySell.marketplaceId,
    format: "FIXED_PRICE",
    availableQuantity: 1,
    categoryId: meta.ebay?.categoryId,
    merchantLocationKey: meta.ebay?.merchantLocationKey,
    listingDescription: draft.description ?? "",
    pricingSummary: {
      price: {
        value: ((draft.priceCents ?? 0) / 100).toFixed(2),
        currency: draft.currency || "USD",
      },
    },
    listingPolicies: {
      fulfillmentPolicyId: meta.ebay?.fulfillmentPolicyId,
      paymentPolicyId: meta.ebay?.paymentPolicyId,
      returnPolicyId: meta.ebay?.returnPolicyId,
      bestOfferTerms: draft.acceptsOffers ? { bestOfferEnabled: true } : undefined,
    },
  }
}

/** Any offer eBay already holds for this SKU, so step 2 cannot duplicate one. */
async function existingOfferId(sku: string, token: string): Promise<string | null> {
  const res = await call(
    `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${env.ebaySell.marketplaceId}`,
    { method: "GET" },
    token,
  )
  if (!res.ok) return null
  const offers = (res.body.offers ?? []) as { offerId?: string }[]
  return offers[0]?.offerId ?? null
}

export async function publishToEbay(draft: ListingDraft): Promise<PublishResult> {
  const token = env.ebaySell.accessToken
  if (!token) return { ok: false, reason: "EBAY_SELL_ACCESS_TOKEN is not set" }

  // 1. The item. PUT on our own SKU, so this is safe to repeat.
  const item = await call(
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(draft.sku)}`,
    { method: "PUT", body: inventoryItem(draft) },
    token,
  )
  if (!item.ok) return { ok: false, reason: item.reason }

  // 2. The offer. POST, so check for one first: this is the step that
  //    duplicates if it is run twice.
  let offerId = await existingOfferId(draft.sku, token)
  if (!offerId) {
    const created = await call("/sell/inventory/v1/offer", { method: "POST", body: offer(draft) }, token)
    if (!created.ok) return { ok: false, reason: created.reason }
    offerId = created.body.offerId != null ? String(created.body.offerId) : null
    if (!offerId) return { ok: false, reason: "eBay created an offer but returned no offerId" }
  } else {
    const updated = await call(
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
      { method: "PUT", body: offer(draft) },
      token,
    )
    if (!updated.ok) return { ok: false, reason: updated.reason }
  }

  // 3. Live.
  const published = await call(
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    { method: "POST" },
    token,
  )
  if (!published.ok) return { ok: false, reason: published.reason }

  const listingId = published.body.listingId != null ? String(published.body.listingId) : null
  const host = env.ebaySell.isSandbox ? "https://sandbox.ebay.com" : "https://www.ebay.com"

  return {
    ok: true,
    /* The OFFER id, not the listing id, because ending and updating both take
       the offer. The listing id is for humans and lives in the URL. */
    externalId: offerId,
    externalUrl: listingId ? `${host}/itm/${listingId}` : null,
  }
}

/**
 * Withdraw the offer, because it sold somewhere else.
 *
 * Withdraw rather than delete: the inventory item and the offer survive, so
 * relisting the same unit later is one publish call rather than retyping it.
 */
export async function endOnEbay(offerId: string): Promise<PublishResult> {
  const token = env.ebaySell.accessToken
  if (!token) return { ok: false, reason: "EBAY_SELL_ACCESS_TOKEN is not set" }

  const res = await call(
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
    { method: "POST" },
    token,
  )
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, externalId: offerId, externalUrl: null }
}
