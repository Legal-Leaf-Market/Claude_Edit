import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { BoardBuilder } from "@/components/board/board-builder"
import { decodeBoard, resolveBoard } from "@/lib/board/share"
import { FEATURED_RIG_SLUGS, RIG_BY_SLUG } from "@/lib/rigs"
import { fetchCatalog } from "@/lib/stompbox/catalog"
import { sbHref, stompboxBase } from "@/lib/stompbox/host"

export const metadata: Metadata = {
  title: "Build a board",
  description:
    "Put real pedals on a board and see the conventional signal order, with the reason behind every position. Stomp them on and off, and send the board as a link.",
}

/**
 * The board.
 *
 * WHY IT IS A SEPARATE PAGE FROM /chain. That page is the argument: eleven
 * slots, each with the reason it sits where it does, server rendered and
 * indexable, and it is the thing somebody arriving from a search should land
 * on. This is the toy built on top of that argument. Keeping them apart means
 * the explanation is never buried under an interface, and the interface is
 * never carrying the weight of being the site's main content.
 *
 * THE CATALOGUE IS FETCHED HERE, ON THE SERVER, so the parts bin is in the
 * HTML rather than assembled by the browser. That is deliberate: the pedals
 * you can put on a board are content, and a page whose content only exists
 * after JavaScript runs is a page a crawler and a screen reader both see as
 * empty. The board itself is interactive and client side, which is right for
 * something that only means anything once somebody is playing with it.
 *
 * A CATALOGUE FAILURE IS NOT AN ERROR HERE, same as everywhere else on this
 * site: fetchCatalog returns an empty list with a reason, the bin falls back
 * to the documented circuits, and the board still works.
 */
export const revalidate = 900

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const base = stompboxBase((await headers()).get("host"))
  const { pedals } = await fetchCatalog(200)

  /*
   * RESOLVE THE SHARED BOARD ON THE SERVER, exactly as /pedalboard does.
   *
   * This page used to leave it to a client effect, on the reasoning that a
   * visitor's board is not the page's indexable content. That was right when
   * this route was statically prerendered and had no other choice. It reads
   * the Host header now, so it is already dynamic and the searchParams cost
   * nothing, and leaving it client-only had a real consequence: a shared link
   * arrived with an empty deck and no advice in the HTML, so the two mounts of
   * the same component behaved differently and the guide's version was the
   * worse one. A board in the markup also works before hydration and for a
   * reader who never gets JavaScript at all.
   */
  const params = await searchParams
  const initial = resolveBoard(
    decodeBoard(typeof params.b === "string" ? params.b : undefined),
    pedals,
  )

  /*
   * ARTIST RIGS BELONG HERE TOO, and they are not the commerce half.
   *
   * `lib/rigs/data.ts` is hand-written editorial with sourced album and track
   * attribution: no feed row, no price, no merchant, nothing partner terms
   * restrict. So the rule that keeps prices off this domain has nothing to say
   * about it, and a guide about what circuits do is arguably where documented
   * boards belong most. The builder swaps each one for real stock only where
   * the page it is mounted on supplied any.
   */
  const rigs = FEATURED_RIG_SLUGS.map((slug) => RIG_BY_SLUG.get(slug))
    .filter((rig): rig is NonNullable<typeof rig> => Boolean(rig))
    .map((rig) => ({
      slug: rig.slug,
      name: rig.name,
      context: rig.context,
      pedals: rig.pedals.map((p) => `${p.brand} ${p.model}`),
    }))

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="stencil">The board</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
        Build a board
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Add pedals and they patch themselves up in the conventional order, guitar first
        and amp last. Press one to bypass it, the way you would with your foot. The
        reasons behind every position are on the{" "}
        <Link href={sbHref(base, "/chain")} className="underline">
          signal chain page
        </Link>
        , and the order here is the same convention that page argues for.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Nothing is saved and nothing is sent anywhere. The board lives in the address
        bar, so copying the link is how you send it to somebody.
      </p>

      <div className="mt-10">
        {/*
          NO COMMERCE PROP, and that is the whole difference between this page
          and /pedalboard. Same component, same attendant, same engines; the
          guide simply passes no prices, no merchants and no buy links, because
          it is a second domain and those rows are not ours to republish there
          (CLAUDE.md section 20).
        */}
        <BoardBuilder catalog={pedals} initial={initial} rigs={rigs} />
      </div>
    </main>
  )
}
