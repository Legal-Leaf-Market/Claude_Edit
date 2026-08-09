import { and, desc, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { BOARD_KINDS, flipThreads, user } from "@/lib/db/schema"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

/** Board hygiene, not a business limit: stops one account burying the board in open posts. */
const MAX_OPEN_THREADS_PER_USER = 20

const createSchema = z.object({
  kind: z.enum(BOARD_KINDS).default("flip"),
  title: z.string().trim().min(3).max(200),
  category: z.enum(["pedals", "guitars", "amps", "recording", "drums", "other"]).default("other"),
  description: z.string().trim().min(10).max(4000),
  askingPriceDollars: z.number().positive().max(1_000_000).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  patreonUrl: z.string().trim().max(300).nullable().optional(),
  // Honeypot: a real visitor never fills this in, since it is hidden from view.
  website: z.string().max(0).optional(),
})

async function currentUserId(request: NextRequest): Promise<string | null> {
  if (!env.auth.isConfigured) return null
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

export async function GET() {
  const rows = await db
    .select({
      id: flipThreads.id,
      title: flipThreads.title,
      category: flipThreads.category,
      description: flipThreads.description,
      askingPriceCents: flipThreads.askingPriceCents,
      location: flipThreads.location,
      imageUrl: flipThreads.imageUrl,
      status: flipThreads.status,
      createdAt: flipThreads.createdAt,
      authorName: user.name,
    })
    .from(flipThreads)
    .leftJoin(user, eq(user.id, flipThreads.authorId))
    .orderBy(desc(flipThreads.createdAt))
    .limit(200)

  return NextResponse.json({ threads: rows })
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const openCount = await db
    .select({ id: flipThreads.id })
    .from(flipThreads)
    .where(and(eq(flipThreads.authorId, userId), eq(flipThreads.status, "open")))
  if (openCount.length >= MAX_OPEN_THREADS_PER_USER) {
    return NextResponse.json(
      {
        error: `You have ${MAX_OPEN_THREADS_PER_USER} open posts already. Close one before posting another.`,
      },
      { status: 409 },
    )
  }

  const { website: _honeypot, ...data } = parsed.data
  const [created] = await db
    .insert(flipThreads)
    .values({
      authorId: userId,
      title: data.title,
      category: data.category,
      description: data.description,
      askingPriceCents:
        data.askingPriceDollars != null ? Math.round(data.askingPriceDollars * 100) : null,
      location: data.location || null,
      imageUrl: data.imageUrl || null,
      patreonUrl: data.patreonUrl || null,
    })
    .returning()

  return NextResponse.json({ thread: created }, { status: 201 })
}
