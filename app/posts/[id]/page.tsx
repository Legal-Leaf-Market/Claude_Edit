import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { FlipMatchReplyForm } from "@/components/flip-match-reply-form"
import { ListingImage } from "@/components/listing-image"
import { BOARD_BY_KIND } from "@/lib/boards"
import { db } from "@/lib/db"
import { flipReplies, flipThreads, user, type BoardKind } from "@/lib/db/schema"
import { formatPrice, timeAgo, titleCase } from "@/lib/utils"

export const revalidate = 60

type PageProps = { params: Promise<{ id: string }> }

/** One post, whichever board it came from. Replies are always public. */
async function loadPost(id: string) {
  const [thread] = await db
    .select({
      id: flipThreads.id,
      kind: flipThreads.kind,
      title: flipThreads.title,
      category: flipThreads.category,
      description: flipThreads.description,
      askingPriceCents: flipThreads.askingPriceCents,
      location: flipThreads.location,
      imageUrl: flipThreads.imageUrl,
      patreonUrl: flipThreads.patreonUrl,
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
  const data = await loadPost(id).catch(() => null)
  if (!data) return { title: "Post not found" }

  const board = BOARD_BY_KIND.get(data.thread.kind as BoardKind)
  const title = `${data.thread.title} | ${board?.title ?? "Gear Avail"}`
  return {
    title,
    description: data.thread.description.slice(0, 155),
    alternates: { canonical: `/posts/${id}` },
    // User-generated and short-lived by nature: reachable from the feed and
    // the board, but not worth a search snippet that outlives the post.
    robots: { index: false, follow: true },
  }
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params
  const data = await loadPost(id).catch(() => null)
  if (!data) notFound()

  const { thread, replies } = data
  const board = BOARD_BY_KIND.get(thread.kind as BoardKind)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/feed" className="hover:text-[var(--cream)]">
              The Feed
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/boards/${board?.slug ?? ""}`} className="hover:text-[var(--cream)]">
              {board?.title ?? "Board"}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--cream)]">{thread.title}</h1>
          {board?.showPrice && (
            <p className="text-xl font-semibold text-[var(--amber)]">
              {thread.askingPriceCents != null
                ? formatPrice(thread.askingPriceCents)
                : board.pricePlaceholder}
            </p>
          )}
        </div>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          {titleCase(thread.category.replace(/-/g, " "))}
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

        {thread.patreonUrl && (
          <a
            href={thread.patreonUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--cream)] transition-colors hover:bg-[var(--secondary)]"
          >
            Follow on Patreon
          </a>
        )}
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-[var(--cream)]">
          {replies.length > 0
            ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`
            : "No replies yet"}
        </h2>

        {replies.length > 0 && (
          <ul className="mb-4 space-y-3">
            {replies.map((reply) => (
              <li key={reply.id} className="panel p-4">
                <p className="whitespace-pre-wrap text-sm text-[var(--cream)]">{reply.body}</p>
                <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  {reply.authorName ?? "a Gear Avail member"} · {timeAgo(reply.createdAt.toISOString())}
                </p>
              </li>
            ))}
          </ul>
        )}

        <FlipMatchReplyForm
          threadId={thread.id}
          authorId={thread.authorId}
          isClosed={thread.status !== "open"}
          closeButtonLabel={board?.closeButtonLabel}
          closedCopy={board?.closedCopy}
        />
      </section>
    </div>
  )
}
