import type { Metadata } from "next"
import Link from "next/link"
import { BoardBuilder } from "@/components/board-builder"
import { fetchCatalog } from "@/lib/catalog"

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

export default async function BoardPage() {
  const { pedals } = await fetchCatalog(200)

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
        <Link href="/chain" className="underline">
          signal chain page
        </Link>
        , and the order here is the same convention that page argues for.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Nothing is saved and nothing is sent anywhere. The board lives in the address
        bar, so copying the link is how you send it to somebody.
      </p>

      <div className="mt-10">
        <BoardBuilder catalog={pedals} />
      </div>
    </main>
  )
}
