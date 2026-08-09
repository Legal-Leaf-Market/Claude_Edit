"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { watchlist } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { sendWatchSavedEmail, type SavedItem } from "@/lib/email"

// Shape the client hook works with. Mirrors the localStorage WatchItem so the
// UI stays identical whether items live on-device (guests) or in the DB.
export type DbWatchItem = {
  id: string
  title: string
  strainName: string
  storeName: string
  link: string
  imageUrl: string
  price: number
  inStock: boolean
  savedAt: number
}

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

// Maps an inserted DB row to the lightweight shape the confirmation email needs.
function rowToSavedItem(row: typeof watchlist.$inferSelect): SavedItem {
  return {
    title: row.title,
    strainName: row.strainName ?? "",
    storeName: row.storeName,
    link: row.url ?? "",
    imageUrl: row.image ?? "",
    price: Number(row.basePrice),
    inStock: row.baseInStock,
  }
}

// Best-effort confirmation email. A mail failure (e.g. Resend hiccup) must never
// break the underlying save, so all errors are swallowed after logging.
async function emailSavedConfirmation(
  user: { email: string; name: string | null },
  items: SavedItem[],
) {
  if (!items.length) return
  try {
    await sendWatchSavedEmail(user.email, user.name ?? "there", items)
  } catch (err) {
    console.log("[v0] saved-confirmation email failed:", err instanceof Error ? err.message : err)
  }
}

function toClient(row: typeof watchlist.$inferSelect): DbWatchItem {
  return {
    id: row.productId,
    title: row.title,
    strainName: row.strainName ?? "",
    storeName: row.storeName,
    link: row.url ?? "",
    imageUrl: row.image ?? "",
    price: Number(row.basePrice),
    inStock: row.baseInStock,
    savedAt: row.createdAt.getTime(),
  }
}

export async function getWatchlist(): Promise<DbWatchItem[]> {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt))
  return rows.map(toClient)
}

export async function addToWatchlist(item: Omit<DbWatchItem, "savedAt">) {
  const user = await getSessionUser()
  // `returning()` yields the row only when it was actually inserted; a duplicate
  // save hits onConflictDoNothing and returns nothing, so we don't re-email.
  const inserted = await db
    .insert(watchlist)
    .values({
      userId: user.id,
      productId: item.id,
      title: item.title,
      storeName: item.storeName,
      strainName: item.strainName || null,
      image: item.imageUrl || null,
      url: item.link || null,
      basePrice: item.price.toFixed(2),
      baseInStock: item.inStock,
    })
    .onConflictDoNothing({
      target: [watchlist.userId, watchlist.productId],
    })
    .returning()

  // Google Flights style: confirm the save immediately so the user has it on
  // record and knows tracking has started.
  if (inserted.length) {
    await emailSavedConfirmation(user, inserted.map(rowToSavedItem))
  }
}

export async function removeFromWatchlist(productId: string) {
  const userId = await getUserId()
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.productId, productId)))
}

export async function resnapshotWatchItem(
  productId: string,
  next: { price: number; inStock: boolean },
) {
  const userId = await getUserId()
  await db
    .update(watchlist)
    .set({ basePrice: next.price.toFixed(2), baseInStock: next.inStock, createdAt: new Date() })
    .where(and(eq(watchlist.userId, userId), eq(watchlist.productId, productId)))
}

export async function clearWatchlist() {
  const userId = await getUserId()
  await db.delete(watchlist).where(eq(watchlist.userId, userId))
}

// Push any device-local items into the account on first login, then return the
// merged server list. Existing rows are left untouched (onConflictDoNothing).
export async function mergeWatchlist(
  items: Omit<DbWatchItem, "savedAt">[],
): Promise<DbWatchItem[]> {
  const user = await getSessionUser()
  if (items.length) {
    // One consolidated confirmation for everything the guest had saved before
    // logging in. `returning()` filters to rows that were genuinely new, so
    // items already in their account don't get re-sent.
    const inserted = await db
      .insert(watchlist)
      .values(
        items.map((item) => ({
          userId: user.id,
          productId: item.id,
          title: item.title,
          storeName: item.storeName,
          strainName: item.strainName || null,
          image: item.imageUrl || null,
          url: item.link || null,
          basePrice: item.price.toFixed(2),
          baseInStock: item.inStock,
        })),
      )
      .onConflictDoNothing({ target: [watchlist.userId, watchlist.productId] })
      .returning()

    if (inserted.length) {
      await emailSavedConfirmation(user, inserted.map(rowToSavedItem))
    }
  }
  return getWatchlist()
}
