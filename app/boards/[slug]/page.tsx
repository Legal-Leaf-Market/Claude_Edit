import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { sql } from "drizzle-orm"
import { BoardPostForm } from "@/components/board-post-form"
import { BOARDS, boardFromSlug } from "@/lib/boards"
import { db } from "@/lib/db"
import { formatPrice, timeAgo, titleCase } from "@/lib/utils"

export const revalidate = 60

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return BOARDS.map((b) => ({ slug: b.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const board = boardFromSlug(slug)
  if (!board) return { title: "Board not found" }

  const title = `${board.title}: ${board.tagline} | Gear Avail`
  return {
    title,
    description: board.description.slice(0, 155),
    alternates: { canonical: `/boards/${board.slug}` },
    openGraph: { title, description: board.description.slice(0, 155), type: "website" },
  }
}

type Row = {
  id: string
  title: string
  category: string
  description: string
  asking_price_cents: number | null
  location: string | null
  created_at: string
  author_name: string | null
  replies: number
}

async function loadBoard(kind: string): Promise<Row[]> {
  const result = await db.execute<Row>(sql`
    SELECT t.id, t.title, t.category, t.description, t.asking_price_cents,
           t.location, t.created_at::text AS created_at,
           u.name AS author_name,
           COUNT(r.id)::int AS replies
    FROM flip_threads t
    LEFT JOIN "user" u ON u.id = t.author_id
    LEFT JOIN flip_replies r ON r.thread_id = t.id
    WHERE t.status = 'open' AND t.kind = ${kind}
    GROUP BY t.id, u.name
    ORDER BY t.created_at DESC
    LIMIT 100
  `)
  return result.rows
}

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params
  const board = boardFromSlug(slug)
  if (!board) notFound()

  const posts = await loadBoard(board.kind).catch(() => [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted-foreground)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/feed" className="hover:text-[var(--cream)]">
              The Feed
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--cream)]">{board.title}</li>
        </ol>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">{board.tagline}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cream)]">{board.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
        {board.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <Link
            key={b.slug}
            href={`/boards/${b.slug}`}
            className={
              b.slug === board.slug
                ? "rounded-full border border-[var(--amber)]/50 bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)]"
                : "rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--amber)]/40 hover:text-[var(--cream)]"
            }
          >
            {b.navLabel}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[var(--cream)]">
            {posts.length > 0
              ? `${posts.length} open ${posts.length === 1 ? board.itemNounPlural.replace(/s$/, "") : board.itemNounPlural}`
              : "The board"}
          </h2>

          {posts.length === 0 ? (
            <p className="panel p-6 text-sm text-[var(--muted-foreground)]">{board.emptyBoardCopy}</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => {
                const replies = Number(post.replies ?? 0)
                return (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.id}`}
                      className="panel block p-4 transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-[var(--cream)]">{post.title}</p>
                        {board.showPrice && (
                          <p className="shrink-0 text-sm font-semibold text-[var(--amber)]">
                            {post.asking_price_cents != null
                              ? formatPrice(post.asking_price_cents)
                              : board.pricePlaceholder}
                          </p>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                        {post.description}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                        {titleCase(post.category.replace(/-/g, " "))}
                        {post.location ? ` · ${post.location}` : ""} · {timeAgo(post.created_at)} ·{" "}
                        {replies === 0 ? "no replies yet" : `${replies} ${replies === 1 ? "reply" : "replies"}`}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="mb-4 text-lg font-semibold text-[var(--cream)]">Post something</h2>
          <BoardPostForm board={board} />
        </aside>
      </div>
    </div>
  )
}
