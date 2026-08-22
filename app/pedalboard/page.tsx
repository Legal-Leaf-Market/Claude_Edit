import type { Metadata } from "next"
import Link from "next/link"
import { BoardBuilder } from "@/components/board/board-builder"
import { itemFromCatalog, type BoardCommerce, type CatalogInput } from "@/lib/board/model"
import { decodeBoard, resolveBoard } from "@/lib/board/share"
import { pedalBoardDetails, searchPedals } from "@/lib/pedalboard/queries"
import { FEATURED_RIG_SLUGS, RIG_BY_SLUG } from "@/lib/rigs"
import { STORE_BY_SOURCE } from "@/lib/stores"

export const metadata: Metadata = {
  title: "Pedalboard builder",
  description:
    "Build a pedalboard from gear that is actually in stock. See what each circuit does, what order it goes in, and exactly what power and cables you will need.",
}

/**
 * The builder, with commerce on.
 *
 * SAME COMPONENT AS /stompbox/board. The two builders used to be separate code
 * in separate projects and drifted exactly where you would expect: the
 * aggregator's knew about stock and power, the guide's knew what the circuits
 * did and drew the pedals, and neither was whole. There is one now, and the
 * ONLY difference between the two mounts is what this page passes in:
 * `commerce` and `gearHrefBase`, which the guide passes neither of.
 *
 * That is not a stylistic choice. stompbox.world is a second domain, and
 * per-listing prices, merchant names and deep links carry partner terms that
 * restrict republishing them there (section 20). Making the difference a PROP
 * rather than a second component is what stops the two pages drifting apart
 * again, and `tests/stompbox/boundary.test.ts` now walks the shared tree to
 * keep the builder itself from ever fetching what it is handed.
 */
export const revalidate = 900

/** How much of the shelf the picker can offer. */
const SHOWN = 200

export default async function PedalboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = typeof params.b === "string" ? params.b : undefined

  /*
   * The picker's stock, and the shared shape the builder wants. `searchPedals`
   * with an empty query returns the most-listed pedals, which is the right
   * default for a parts bin: what a shopper is most likely to be able to buy.
   */
  const stock = await searchPedals("", SHOWN)
  const catalog: CatalogInput[] = stock.map((pedal) => ({
    slug: pedal.slug,
    brand: pedal.brand,
    model: pedal.model,
    imageUrl: pedal.imageUrl,
    type: pedal.type,
  }))

  /*
   * Commerce for whatever the link already contains, so a shared board arrives
   * priced rather than filling in after a round trip. Only the pedals actually
   * on the board are looked up: pricing all two hundred in the picker would be
   * a large query for rows nobody has chosen yet.
   */
  const tokens = decodeBoard(raw)
  const initial = resolveBoard(tokens, catalog)
  const details = initial.length
    ? await pedalBoardDetails(initial.map((item) => item.catalogSlug).filter((s): s is string => !!s))
    : []

  const commerce: BoardCommerce = {}
  for (const entry of details) {
    const item = itemFromCatalog({
      slug: entry.slug,
      brand: entry.brand,
      model: entry.model,
      imageUrl: entry.imageUrl,
      type: entry.type,
    })
    if (!item) continue

    const cheapest = entry.bySource
      .map((s) => ({
        source: s.source,
        cents: s.cheapestUsedCents ?? s.cheapestNewCents,
        listingId: s.cheapestListingId,
      }))
      .filter((s): s is { source: string; cents: number; listingId: string | null } => s.cents != null)
      .sort((a, b) => a.cents - b.cents)[0]

    commerce[item.key] = {
      cheapestCents: cheapest?.cents ?? null,
      listingCount: entry.bySource.reduce((sum, s) => sum + s.count, 0),
      /* ALWAYS /go, never a merchant URL. That route is what records the click
         and attaches attribution, and section 5 makes it the only way out. */
      buyHref: cheapest?.listingId ? `/go/${cheapest.listingId}` : null,
      /* The shop's display name, falling back to the raw source key rather
         than dropping the row: a store we have no profile for still tells the
         shopper who has it. */
      stores: entry.bySource.map(
        (s) => STORE_BY_SOURCE.get(s.source as never)?.name ?? s.source,
      ),
    }
  }

  const rigs = FEATURED_RIG_SLUGS.map((slug) => RIG_BY_SLUG.get(slug))
    .filter((rig): rig is NonNullable<typeof rig> => Boolean(rig))
    .map((rig) => ({
      slug: rig.slug,
      name: rig.name,
      context: rig.context,
      pedals: rig.pedals.map((p) => `${p.brand} ${p.model}`),
    }))

  return (
    <main className="shell py-12 sm:py-16">
      <p className="stencil">The board</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
        Build a pedalboard
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Pick pedals out and they patch themselves up in the conventional order, guitar first and
        amp last. Swap any of them for something else in the same slot, press one to bypass it,
        and the counter on the right tells you what each circuit does and exactly what you will
        need to run the lot.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Prices come from shops with the pedal live right now. The order and the reasoning behind
        it are the same ones argued for on{" "}
        <Link href="/stompbox/chain" className="underline">
          the signal chain page
        </Link>
        , and nothing here is ranked by what anybody pays us.
      </p>

      <div className="mt-10">
        <BoardBuilder
          catalog={catalog}
          commerce={commerce}
          gearHrefBase="/gear"
          rigs={rigs}
          initial={initial}
        />
      </div>
    </main>
  )
}
