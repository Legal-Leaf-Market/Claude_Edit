import type { ListingChannel, ListingDraft } from "@/lib/db/schema"

/**
 * What each channel still needs before it will accept this listing.
 *
 * WHY THIS IS ITS OWN MODULE RATHER THAN A TRY/CATCH AROUND THE PUSH. A
 * marketplace rejects an incomplete listing with its own error vocabulary, in
 * its own shape, describing its own field names: eBay answers 25002 with a
 * nested `errors[].parameters[]` naming an aspect you have never heard of, and
 * Reverb answers 422 with a hash keyed by attribute. Neither tells an operator
 * what to type into which box. Checking first means the answer is "this needs a
 * shipping price and an eBay category" in our own words, before anything is
 * sent.
 *
 * IT IS ALSO WHAT MAKES THE MASTER RECORD HONEST. The whole premise is filling
 * one form and pushing it several places, and that only holds if the form knows
 * what every destination wants. The moment a channel needs something the form
 * does not ask for, this is where it shows up.
 *
 * THE TWO CHANNELS DIVERGE MORE THAN THEY LOOK. Reverb takes a category and a
 * condition as UUIDs from its own taxonomy. eBay takes a numeric category id,
 * a numeric condition id, whatever item aspects that category marks required,
 * and three business policy ids that have to exist in the seller account first.
 * That is why `channelMeta` is a document per channel and not a set of shared
 * columns: they have almost nothing in common past the title and the price.
 */

export type ChannelMeta = {
  reverb?: {
    categoryUuid?: string
    conditionUuid?: string
    shippingProfileId?: string
  }
  ebay?: {
    categoryId?: string
    conditionId?: string
    /** Item specifics. eBay marks some required per category. */
    aspects?: Record<string, string[]>
    fulfillmentPolicyId?: string
    paymentPolicyId?: string
    returnPolicyId?: string
    /** Where it ships from. eBay requires a merchant location key. */
    merchantLocationKey?: string
  }
}

export type Readiness = {
  channel: ListingChannel
  ready: boolean
  /** In our own words, one line each, in the order worth fixing them. */
  missing: string[]
}

/** Fields no channel will take a listing without. */
function coreMissing(draft: ListingDraft): string[] {
  const missing: string[] = []
  if (!draft.title?.trim()) missing.push("a title")
  if (!draft.description?.trim()) missing.push("a description")
  if (draft.priceCents == null || draft.priceCents <= 0) missing.push("a price")
  if (!draft.condition?.trim()) missing.push("a condition")
  const photos = Array.isArray(draft.photos) ? draft.photos : []
  if (photos.length === 0) missing.push("at least one photo")
  return missing
}

export function readinessFor(draft: ListingDraft, channel: ListingChannel): Readiness {
  const meta = (draft.channelMeta ?? {}) as ChannelMeta
  const missing = coreMissing(draft)

  if (channel === "reverb") {
    if (!meta.reverb?.categoryUuid) missing.push("a Reverb category (its own UUID, not ours)")
    if (!meta.reverb?.conditionUuid) missing.push("a Reverb condition UUID")
    if (draft.shippingCents == null && !draft.localPickup) {
      missing.push("a shipping price, or local pickup ticked")
    }
  }

  if (channel === "ebay") {
    if (!meta.ebay?.categoryId) missing.push("an eBay category id")
    if (!meta.ebay?.conditionId) missing.push("an eBay condition id")
    if (!meta.ebay?.merchantLocationKey) missing.push("an eBay merchant location key")
    // eBay's Inventory API will not publish an offer without all three
    // policies, and the failure it gives names the policy type only.
    if (!meta.ebay?.fulfillmentPolicyId) missing.push("an eBay shipping (fulfillment) policy id")
    if (!meta.ebay?.paymentPolicyId) missing.push("an eBay payment policy id")
    if (!meta.ebay?.returnPolicyId) missing.push("an eBay return policy id")
    if (!draft.brand?.trim()) missing.push("a brand, which eBay requires as an item aspect")
  }

  return { channel, ready: missing.length === 0, missing }
}
