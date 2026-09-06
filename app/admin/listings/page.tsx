import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { desc } from "drizzle-orm"
import { isAdmin } from "@/lib/admin/gate"
import { db } from "@/lib/db"
import { listingDrafts, listingPublications } from "@/lib/db/schema"
import { readinessFor } from "@/lib/listing/readiness"
import { LISTING_CHANNELS } from "@/lib/db/schema"
import { ListingsWorkbench } from "@/components/admin/listings-workbench"
import { env } from "@/lib/env"

/**
 * WRITE THE LISTING ONCE, PUSH IT WHERE YOU CHOOSE.
 *
 * The record is the physical unit. Reverb and eBay are places it gets
 * published to, not the places it lives, so correcting a typo corrects it
 * everywhere it has not gone yet and the two copies cannot drift apart in the
 * first place.
 *
 * ADMIN ONLY AND SERVER RENDERED, like /admin/inventory, because these rows
 * carry what we paid and the least we would take.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false, nocache: true },
}

export default async function ListingsPage() {
  if (!(await isAdmin())) redirect("/admin/sign-in?next=" + encodeURIComponent("/admin/listings"))

  const drafts = await db.select().from(listingDrafts).orderBy(desc(listingDrafts.updatedAt))
  const publications = await db.select().from(listingPublications)

  const rows = drafts.map((draft) => ({
    draft,
    publications: publications.filter((p) => p.draftId === draft.id),
    readiness: LISTING_CHANNELS.map((c) => readinessFor(draft, c)),
  }))

  return (
    <ListingsWorkbench
      rows={rows}
      channelStatus={{
        reverb: env.reverbShop.isConfigured
          ? "ready"
          : "REVERB_SHOP_TOKEN is not set, so nothing can be pushed to Reverb.",
        ebay: env.ebaySell.isConfigured
          ? env.ebaySell.isSandbox
            ? "sandbox"
            : "ready"
          : "EBAY_SELL_ACCESS_TOKEN is not set, so nothing can be pushed to eBay.",
      }}
    />
  )
}
