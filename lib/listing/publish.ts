import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  listingDrafts,
  listingPublications,
  type ListingChannel,
  type ListingDraft,
  type ListingPublication,
} from "@/lib/db/schema"
import { readinessFor } from "@/lib/listing/readiness"
import { endOnReverb, publishToReverb } from "@/lib/listing/channels/reverb"
import { endOnEbay, publishToEbay } from "@/lib/listing/channels/ebay"
import type { PublishResult } from "@/lib/listing/types"

/**
 * Push one unit to one channel, and take it down again.
 *
 * THE ORDER OF THE GUARDS IS THE DESIGN. A push is refused before anything
 * leaves this process if the draft is already live on that channel, and refused
 * again if the channel would reject it. Both refusals are cheap and both
 * failures they prevent are expensive: the first is two listings of one
 * physical pedal, the second is an operator staring at somebody else's error
 * code.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It never writes to
 * `marketplace_listings`, never resolves a canonical row and never touches a
 * median. Our own stock stays out of the aggregator's arithmetic, which is
 * section 24's first guarantee and the reason setting a price here cannot also
 * move the market price that judges it.
 */

const CHANNELS: Record<
  ListingChannel,
  { publish: (d: ListingDraft) => Promise<PublishResult>; end: (id: string) => Promise<PublishResult> }
> = {
  reverb: { publish: publishToReverb, end: endOnReverb },
  ebay: { publish: publishToEbay, end: endOnEbay },
}

export type PublishOutcome =
  | { status: "published"; publication: ListingPublication }
  | { status: "already"; publication: ListingPublication }
  | { status: "not-ready"; missing: string[] }
  | { status: "failed"; reason: string }

async function publicationFor(
  draftId: string,
  channel: ListingChannel,
): Promise<ListingPublication | null> {
  const rows = await db
    .select()
    .from(listingPublications)
    .where(and(eq(listingPublications.draftId, draftId), eq(listingPublications.channel, channel)))
    .limit(1)
  return rows[0] ?? null
}

export async function publishDraft(
  draft: ListingDraft,
  channel: ListingChannel,
): Promise<PublishOutcome> {
  /* Guard one: already live there. Returning the existing record rather than
     an error is deliberate, because the honest answer to "push this" when it
     is already pushed is to show where it is, not to refuse and say nothing. */
  const existing = await publicationFor(draft.id, channel)
  if (existing && existing.state === "published") {
    return { status: "already", publication: existing }
  }

  /* Guard two: the channel would reject it. Our words, before the request. */
  const readiness = readinessFor(draft, channel)
  if (!readiness.ready) return { status: "not-ready", missing: readiness.missing }

  const result = await CHANNELS[channel].publish(draft)

  if (!result.ok) {
    /* A failure is recorded rather than thrown away, so the reason survives a
       page reload and the next person can see what the channel objected to. */
    const row = await upsertPublication(draft.id, channel, {
      state: "failed",
      error: result.reason.slice(0, 2000),
    })
    void row
    return { status: "failed", reason: result.reason }
  }

  const publication = await upsertPublication(draft.id, channel, {
    state: "published",
    externalId: result.externalId,
    externalUrl: result.externalUrl,
    error: null,
    publishedAt: new Date(),
    endedAt: null,
  })

  /* A draft that is live anywhere is no longer a draft. */
  await db
    .update(listingDrafts)
    .set({ status: "listed", updatedAt: new Date() })
    .where(eq(listingDrafts.id, draft.id))

  return { status: "published", publication }
}

async function upsertPublication(
  draftId: string,
  channel: ListingChannel,
  patch: Partial<ListingPublication>,
): Promise<ListingPublication> {
  const rows = await db
    .insert(listingPublications)
    .values({ draftId, channel, state: "failed", ...patch })
    .onConflictDoUpdate({
      target: [listingPublications.draftId, listingPublications.channel],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning()
  return rows[0]
}

/**
 * It sold. Take it down everywhere else.
 *
 * THE REASON THIS EXISTS AT ALL. One physical pedal listed on two marketplaces
 * can be bought on both, and the second buyer is the one who finds out. Every
 * multichannel tool's real job is this, and pushing without it would be worse
 * than listing by hand, because it makes putting one unit in two places
 * effortless while leaving the consequence manual.
 *
 * It is deliberately a button rather than a poll. Polling both marketplaces for
 * orders is the automatic version and is a bigger build; a manual action that
 * ends every other channel in one press is most of the value, and it is honest
 * about being manual instead of appearing to be a sync that is not one.
 */
export type EndElsewhereOutcome = {
  ended: { channel: ListingChannel; ok: boolean; reason?: string }[]
}

export async function endEverywhereExcept(
  draftId: string,
  soldOn: ListingChannel | null,
): Promise<EndElsewhereOutcome> {
  const rows = await db
    .select()
    .from(listingPublications)
    .where(eq(listingPublications.draftId, draftId))

  const ended: EndElsewhereOutcome["ended"] = []

  for (const row of rows) {
    if (row.state !== "published") continue
    if (soldOn && row.channel === soldOn) continue
    if (!row.externalId) {
      ended.push({ channel: row.channel as ListingChannel, ok: false, reason: "no external id recorded" })
      continue
    }
    const result = await CHANNELS[row.channel as ListingChannel].end(row.externalId)
    if (result.ok) {
      await db
        .update(listingPublications)
        .set({ state: "ended", endedAt: new Date(), updatedAt: new Date() })
        .where(eq(listingPublications.id, row.id))
      ended.push({ channel: row.channel as ListingChannel, ok: true })
    } else {
      /* Left as published on purpose. A failed takedown is still live on that
         marketplace, and recording it as ended is exactly how a unit gets sold
         twice while the tool says everything is fine. */
      await db
        .update(listingPublications)
        .set({ error: result.reason.slice(0, 2000), updatedAt: new Date() })
        .where(eq(listingPublications.id, row.id))
      ended.push({ channel: row.channel as ListingChannel, ok: false, reason: result.reason })
    }
  }

  await db
    .update(listingDrafts)
    .set({ status: "sold", updatedAt: new Date() })
    .where(eq(listingDrafts.id, draftId))

  return { ended }
}
