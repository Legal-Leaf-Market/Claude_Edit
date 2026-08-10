import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { subscribers } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

const schema = z.object({ token: z.string().trim().min(8).max(64) })

/**
 * POST, not GET, on purpose.
 *
 * Mail clients and crawlers pre-fetch links, so an unsubscribe that happened
 * on GET would silently drop people who never clicked. Requiring a POST means
 * a fetch alone does nothing, while the confirm button on /unsubscribe is
 * still a single click.
 *
 * This shape also matches RFC 8058 one-click unsubscribe, which bulk senders
 * are expected to support and which posts rather than gets.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  await db
    .update(subscribers)
    .set({ isActive: false, unsubscribedAt: new Date() })
    .where(eq(subscribers.unsubscribeToken, parsed.data.token))
    .catch((error) => {
      console.error(
        `[unsubscribe] failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    })

  // Same response whether or not the token matched: an unsubscribe endpoint
  // must not reveal whether a given token is real.
  return NextResponse.json({ unsubscribed: true })
}
