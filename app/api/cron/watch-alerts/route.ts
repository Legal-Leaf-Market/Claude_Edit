import { db } from "@/lib/db"
import { user, watchlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getLiveInventory } from "@/lib/aggregator"
import { computeAlerts, type SavedSnapshot } from "@/lib/watch-alerts"
import { sendWatchAlertEmail } from "@/lib/email"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Scheduled scan: for every user with a watchlist, compare their saved prices to
// the live catalog and email any price drops / restocks. Protected by
// CRON_SECRET so only Vercel Cron (or an authorized caller) can trigger it.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Pull every watched row alongside the owner's email + name.
  const rows = await db
    .select({
      userId: watchlist.userId,
      email: user.email,
      name: user.name,
      productId: watchlist.productId,
      title: watchlist.title,
      strainName: watchlist.strainName,
      storeName: watchlist.storeName,
      url: watchlist.url,
      image: watchlist.image,
      basePrice: watchlist.basePrice,
      baseInStock: watchlist.baseInStock,
    })
    .from(watchlist)
    .innerJoin(user, eq(user.id, watchlist.userId))

  if (rows.length === 0) {
    return Response.json({ ok: true, users: 0, emailsSent: 0, message: "No watchlists to scan" })
  }

  const { products, cachedAt } = await getLiveInventory()

  // Group snapshots per user.
  const byUser = new Map<string, { email: string; name: string; saved: SavedSnapshot[] }>()
  for (const r of rows) {
    let entry = byUser.get(r.userId)
    if (!entry) {
      entry = { email: r.email, name: r.name, saved: [] }
      byUser.set(r.userId, entry)
    }
    entry.saved.push({
      productId: r.productId,
      title: r.title,
      strainName: r.strainName ?? "",
      storeName: r.storeName,
      url: r.url ?? "",
      imageUrl: r.image ?? "",
      price: Number(r.basePrice),
      inStock: r.baseInStock,
    })
  }

  let emailsSent = 0
  let totalAlerts = 0
  const errors: string[] = []

  for (const [, entry] of byUser) {
    const alerts = computeAlerts(entry.saved, products)
    if (alerts.length === 0) continue
    try {
      await sendWatchAlertEmail(entry.email, entry.name, alerts)
      emailsSent += 1
      totalAlerts += alerts.length
    } catch (err) {
      errors.push(`${entry.email}: ${err instanceof Error ? err.message : "send failed"}`)
    }
  }

  return Response.json({
    ok: true,
    scannedAt: cachedAt,
    users: byUser.size,
    emailsSent,
    totalAlerts,
    ...(errors.length ? { errors } : {}),
  })
}
