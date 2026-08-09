import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { FlipMatchReplyForm } from "@/components/flip-match-reply-form"
import { ListingImage } from "@/components/listing-image"
import { db } from "@/lib/db"
import { flipReplies, flipThreads, user } from "@/lib/db/schema"
import { formatPrice, timeAgo, titleCase } from "@/lib/utils"

export const revalidate = 60

type PageProps = { params: Promise<{ id: string }> }

async function loadThread(id: string) {
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

  if (!thread) return null

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

  return { thread, replies }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const data = await loadThread(id).catch(() => null)
  if (!data) return { title: "Post not found" }

  const title = `${data.thread.title} | Flip Match`
  const description = data.thread.description.slice(0, 155)
  return {
    title,
    description,
    alternates: { canonical: `/flip-match/${id}` },
    // User-generated and time-limited by nature; findable via the board, not worth a search snippet.
    robots: { index: false, follow: true },
  }
}

export default async function FlipMatchThreadPage({ params }: PageProps) {
  const { id } = await params
  const data = await loadThread(id).catch(() => null)
  if (!data) notFound()

  const { thread, replies } = data

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/flip-match" className="hover:text-[var(--cream)]">
              Flip Match
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-[var(--cream)]">{thread.title}</li>
        </ol>
      </nav>

      <header className="panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--cream)]">{thread.title}</h1>
          <p className="text-xl font-semibold text-[var(--amber)]">
            {thread.askingPriceCents ? formatPrice(thread.askingPriceCents) : "Make an offer"}
          </p>
        </div>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          {titleCase(thread.category)}
          {thread.location ? ` · ${thread.location}` : ""} · posted by{" "}
          {thread.authorName ?? "a Gear Avail member"} · {timeAgo(thread.createdAt.toISOString())}
          {thread.status !== "open" && (
            <span className="ml-2 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
              Closed
            </span>
          )}
        </p>

        {thread.imageUrl && (
          <ListingImage
            src={thread.imageUrl}
            alt={thread.title}
            className="mt-4 max-h-96 w-full rounded-lg object-contain"
          />
        )}

        <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-[var(--cream)]">
          {thread.description}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-[var(--cream)]">
          {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "No replies yet"}
        </h2>

        {replies.length > 0 && (
          <ul className="mb-4 space-y-3">
            {replies.map((reply) => (
              <li key={reply.id} className="panel p-4">
                <p className="text-sm text-[var(--cream)]">{reply.body}</p>
                <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  {reply.authorName ?? "a Gear Avail member"} · {timeAgo(reply.createdAt.toISOString())}
                </p>
              </li>
            ))}
          </ul>
        )}

        <FlipMatchReplyForm threadId={thread.id} authorId={thread.authorId} isClosed={thread.status !== "open"} />
      </section>
    </div>
  )
}
