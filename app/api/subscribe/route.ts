import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { subscribers } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().trim().email().max(320),
  source: z.string().trim().max(40).optional(),
  hunting: z.string().trim().max(200).optional(),
  // Honeypot: a real visitor never fills this in, since it is hidden from view.
  website: z.string().max(0).optional(),
})

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "That email did not look right." }, { status: 400 })
  }

  const { website: _honeypot, ...data } = parsed.data
  const email = data.email.toLowerCase()

  try {
    const [existing] = await db
      .select({ id: subscribers.id, isActive: subscribers.isActive })
      .from(subscribers)
      .where(eq(subscribers.email, email))

    if (existing) {
      // Re-subscribing after an unsubscribe is an explicit act, so honour it.
      // Anything else is a no-op: saying "already subscribed" would confirm to
      // a stranger that this address is on the list.
      if (!existing.isActive) {
        await db
          .update(subscribers)
          .set({ isActive: true, unsubscribedAt: null })
          .where(eq(subscribers.id, existing.id))
      }
      return NextResponse.json({ subscribed: true }, { status: 200 })
    }

    await db.insert(subscribers).values({
      email,
      source: data.source || "unknown",
      hunting: data.hunting || null,
    })
    return NextResponse.json({ subscribed: true }, { status: 201 })
  } catch (error) {
    console.error(
      `[subscribe] failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return NextResponse.json({ error: "Could not sign you up just now." }, { status: 500 })
  }
}

/** One-click unsubscribe. Kept as a GET so it works straight from an email link. */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

  const updated = await db
    .update(subscribers)
    .set({ isActive: false, unsubscribedAt: new Date() })
    .where(eq(subscribers.unsubscribeToken, token))
    .returning({ id: subscribers.id })

  // Deliberately the same response either way: an unsubscribe link should not
  // report whether a token was real.
  return NextResponse.json({ unsubscribed: true, matched: updated.length > 0 })
}
