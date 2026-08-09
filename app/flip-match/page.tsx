import type { Metadata } from "next"
import Link from "next/link"
import { desc, eq } from "drizzle-orm"
import { FlipMatchCreateForm } from "@/components/flip-match-create-form"
import { db } from "@/lib/db"
import { flipThreads } from "@/lib/db/schema"
import { formatPrice, timeAgo, titleCase } from "@/lib/utils"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Flip Match: post gear, flip it yourself",
  description:
    "A public board for musicians flipping their own gear. No fees, no cut, no middleman. Post it, someone replies, you two work out the sale.",
  alternates: { canonical: "/flip-match" },
}

async function openThreads() {
  return db
    .select({
      id: flipThreads.id,
      title: flipThreads.title,
      category: flipThreads.category,
      description: flipThreads.description,
      askingPriceCents: flipThreads.askingPriceCents,
      location: flipThreads.location,
      createdAt: flipThreads.createdAt,
    })
    .from(flipThreads)
    .where(eq(flipThreads.status, "open"))
    .orderBy(desc(flipThreads.createdAt))
    .limit(100)
}

export default async function FlipMatchPage() {
  const threads = await openThreads().catch(() => [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">
        Flipper enablement, not a marketplace
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cream)]">Flip Match</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
        Post what you're flipping. Whoever's interested replies right here, in the open, old-school
        forum style: no DMs, no algorithm deciding who sees it. We never take a fee and never touch
        the sale itself; that happens between the two of you once you connect.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[var(--cream)]">
            {threads.length > 0 ? `${threads.length} open post${threads.length === 1 ? "" : "s"}` : "The board"}
          </h2>

          {threads.length === 0 ? (
            <p className="panel p-6 text-sm text-[var(--muted-foreground)]">
              Nothing posted yet. Be the first to flip something here.
            </p>
          ) : (
            <ul className="space-y-3">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    href={`/flip-match/${thread.id}`}
                    className="panel block p-4 transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium text-[var(--cream)]">{thread.title}</p>
                      <p className="shrink-0 text-sm font-semibold text-[var(--amber)]">
                        {thread.askingPriceCents ? formatPrice(thread.askingPriceCents) : "Make an offer"}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">{thread.description}</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {titleCase(thread.category)}
                      {thread.location ? ` · ${thread.location}` : ""} · {timeAgo(thread.createdAt.toISOString())}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="mb-4 text-lg font-semibold text-[var(--cream)]">Post something</h2>
          <FlipMatchCreateForm />
        </aside>
      </div>
    </div>
  )
}
