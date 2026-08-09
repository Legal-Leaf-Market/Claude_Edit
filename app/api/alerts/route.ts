import { and, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { savedAlerts, SOURCES } from "@/lib/db/schema"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

/** Stops one account filling the alert worker with thousands of queries. */
const MAX_ALERTS_PER_USER = 25

const createSchema = z.object({
  query: z.string().trim().min(2).max(200),
  maxPriceDollars: z.number().positive().max(1_000_000).nullable().optional(),
  sourceFilter: z.enum(SOURCES).nullable().optional(),
  conditionFilter: z.string().trim().max(50).nullable().optional(),
  channel: z.enum(["email", "discord", "both"]).default("email"),
})

async function currentUserId(request: NextRequest): Promise<string | null> {
  if (!env.auth.isConfigured) return null
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

export async function GET(request: NextRequest) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const alerts = await db.select().from(savedAlerts).where(eq(savedAlerts.userId, userId))
  return NextResponse.json({ alerts })
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid alert", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await db.select({ id: savedAlerts.id }).from(savedAlerts).where(eq(savedAlerts.userId, userId))
  if (existing.length >= MAX_ALERTS_PER_USER) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_ALERTS_PER_USER} alerts. Delete one to add another.` },
      { status: 409 },
    )
  }

  const data = parsed.data
  const [created] = await db
    .insert(savedAlerts)
    .values({
      userId,
      query: data.query,
      // Cents everywhere in the database; dollars only at the edges.
      maxPriceCents: data.maxPriceDollars != null ? Math.round(data.maxPriceDollars * 100) : null,
      sourceFilter: data.sourceFilter ?? null,
      conditionFilter: data.conditionFilter ?? null,
      channel: data.channel,
    })
    .returning()

  return NextResponse.json({ alert: created }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing alert id" }, { status: 400 })

  // Scoped to the owner, so a guessed id cannot delete someone else's alert.
  const deleted = await db
    .delete(savedAlerts)
    .where(and(eq(savedAlerts.id, id), eq(savedAlerts.userId, userId)))
    .returning({ id: savedAlerts.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 })
  }
  return NextResponse.json({ deleted: deleted[0].id })
}
