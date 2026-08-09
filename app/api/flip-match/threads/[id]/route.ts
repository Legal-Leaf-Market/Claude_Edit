import { asc, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { flipReplies, flipThreads, user } from "@/lib/db/schema"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

async function currentUserId(request: NextRequest): Promise<string | null> {
  if (!env.auth.isConfigured) return null
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [thread] = await db
    .select({
      id: flipThreads.id,
      title: flipThreads.title,
      category: flipThreads.category,
      description: flipThreads.description,
      askingPriceCents: flipThreads.askingPriceCents,
      location: flipThreads.location,
      imageUrl: flipThreads.imageUrl,
      status: flipThreads.status,
      authorId: flipThreads.authorId,
      createdAt: flipThreads.createdAt,
      authorName: user.name,
    })
    .from(flipThreads)
    .leftJoin(user, eq(user.id, flipThreads.authorId))
    .where(eq(flipThreads.id, id))

  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const replies = await db
    .select({
      id: flipReplies.id,
      body: flipReplies.body,
      createdAt: flipReplies.createdAt,
      authorName: user.name,
    })
    .from(flipReplies)
    .leftJoin(user, eq(user.id, flipReplies.authorId))
    .where(eq(flipReplies.threadId, id))
    .orderBy(asc(flipReplies.createdAt))

  return NextResponse.json({ thread, replies })
}

const patchSchema = z.object({ status: z.enum(["open", "closed"]) })

/** The poster closing their own thread once it's flipped or off the table. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 })

  const [existing] = await db.select({ authorId: flipThreads.authorId }).from(flipThreads).where(eq(flipThreads.id, id))
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.authorId !== userId) return NextResponse.json({ error: "Not your post" }, { status: 403 })

  const [updated] = await db
    .update(flipThreads)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(flipThreads.id, id))
    .returning()

  return NextResponse.json({ thread: updated })
}
