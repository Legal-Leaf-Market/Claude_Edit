import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { flipReplies, flipThreads } from "@/lib/db/schema"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

const replySchema = z.object({ body: z.string().trim().min(2).max(2000) })

async function currentUserId(request: NextRequest): Promise<string | null> {
  if (!env.auth.isConfigured) return null
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const { id } = await params
  const [thread] = await db.select({ status: flipThreads.status }).from(flipThreads).where(eq(flipThreads.id, id))
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (thread.status !== "open") {
    return NextResponse.json({ error: "This post is closed" }, { status: 409 })
  }

  const parsed = replySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply", details: parsed.error.flatten() }, { status: 400 })
  }

  const [created] = await db
    .insert(flipReplies)
    .values({ threadId: id, authorId: userId, body: parsed.data.body })
    .returning()

  return NextResponse.json({ reply: created }, { status: 201 })
}
