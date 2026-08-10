import type { Metadata } from "next"
import Link from "next/link"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { SubscribeForm } from "@/components/subscribe-form"
import { BOARD_BY_KIND } from "@/lib/boards"
import type { BoardKind } from "@/lib/db/schema"
import { formatPrice, timeAgo } from "@/lib/utils"

export const revalidate = 60

export const metadata: Metadata = {
  title: "The Feed: everything happening on Gear Avail",
  description:
    "One feed for every board: gear being flipped, wanted ads, bandmates, lessons, local shows and free gear. No fees, no algorithm, just what's new.",
  alternates: { canonical: "/feed" },
}

/**
 * The unified feed.
 *
 * Every board writes to one table (see flipThreads.kind), so the feed is a
 * single query rather than six merged ones. Ordered purely by recency: no
 * ranking model, no engagement weighting, and nothing a merchant could pay
 * to move. What's new is what's on top.
 */
type FeedRow = {
  id: string
  kind: string
  title: string
  description: string
  asking_price_cents: number | null
  location: string | null
  created_at: string
  author_name: string | null
  replies: number
}

async function loadFeed(): Promise<FeedRow[]> {
  const result = await db.execute<FeedRow>(sql`
    SELECT t.id, t.kind, t.title, t.description, t.asking_price_cents,
           t.location, t.created_at::text AS created_at,
           u.name AS author_name,
           COUNT(r.id)::int AS replies
    FROM flip_threads t
    LEFT JOIN "user" u ON u.id = t.author_id
    LEFT JOIN flip_replies r ON r.thread_id = t.id
    WHERE t.status = 'open'
    GROUP BY t.id, u.name
    ORDER BY t.created_at DESC
    LIMIT 100
  `)
  return result.rows
}

export default async function FeedPage() {
  const posts = await loadFeed().catch(() => [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">
        Everything, newest first
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--cream)]">The Feed</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
        Gear being flipped, gear being hunted, bandmates, lessons, shows, free stuff. All of it in
        one place, ordered by what's newest and nothing else. No algorithm deciding what you see, and
        nothing a shop can pay to move up.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...BOARD_BY_KIND.values()].map((board) => (
          <Link
            key={board.slug}
            href={`/boards/${board.slug}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--amber)]/40 hover:text-[var(--cream)]"
          >
            {board.navLabel}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <SubscribeForm source="feed" />
      </div>

      <section className="mt-8">
        {posts.length === 0 ? (
          <p className="panel p-8 text-center text-sm text-[var(--muted-foreground)]">
            Nothing posted yet. The feed fills up as people start posting.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => {
              const board = BOARD_BY_KIND.get(post.kind as BoardKind)
              const replies = Number(post.replies ?? 0)
              return (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="panel block p-4 transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                        {board?.navLabel ?? post.kind}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {post.author_name ?? "a member"} · {timeAgo(post.created_at)}
                        {post.location ? ` · ${post.location}` : ""}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium text-[var(--cream)]">{post.title}</p>
                      {board?.showPrice && post.asking_price_cents != null && (
                        <p className="shrink-0 text-sm font-semibold text-[var(--amber)]">
                          {formatPrice(post.asking_price_cents)}
                        </p>
                      )}
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                      {post.description}
                    </p>

                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {replies === 0 ? "No replies yet" : `${replies} ${replies === 1 ? "reply" : "replies"}`}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
