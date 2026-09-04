"use client"

import { useEffect, useState } from "react"

/**
 * OUR OWN REVERB STOCK, ON ANY PAGE THAT WANTS IT.
 *
 * ONE COMPONENT, BOTH DOMAINS. Gear Avail's home page and the guide's home
 * page mount the same thing. Two implementations of a grid this simple is
 * section 7's fork, and the drift it produces is the worst kind: one site
 * quietly showing stock the other has already sold.
 *
 * IT FETCHES RATHER THAN READING THE MODULE, and that is the guide's
 * credential boundary rather than an oversight. `lib/reverb/shop.ts` holds
 * the token, so anything under `app/stompbox` importing it would be the first
 * credential in that tree since the merge. This component imports nothing but
 * React and talks to `/api/reverb/shop`, which is safe to mount anywhere.
 *
 * IT RENDERS NOTHING UNTIL IT HAS SOMETHING. No skeleton, no empty heading,
 * no "loading our shop" that sometimes never resolves. A section that fails
 * by disappearing costs a reader nothing; one that fails visibly makes a
 * working page look broken.
 *
 * THESE ARE OUR OWN LISTINGS AND THEY ARE LABELLED AS SUCH. Everything else
 * in a grid on these pages is somebody else's inventory being compared;
 * section 24 is emphatic that our own stock must say whose it is rather than
 * sitting anonymously among merchants we rank. It also never enters a median:
 * it does not come from the catalogue at all.
 */

type Listing = {
  id: string
  title: string
  condition: string | null
  price: string | null
  photo: string | null
  url: string
}

export function ReverbShopGrid({
  limit = 6,
  heading = "From our own shop",
  blurb = "Gear we own, photographed and shipped by us. Sold through our Reverb shop.",
}: {
  limit?: number
  heading?: string
  blurb?: string
}) {
  const [rows, setRows] = useState<Listing[]>([])

  useEffect(() => {
    let live = true
    fetch("/api/reverb/shop", { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!live || !data || !Array.isArray(data.listings)) return
        setRows(data.listings.slice(0, limit))
      })
      .catch(() => {
        /* No shop section today. Nothing else on the page is affected. */
      })
    return () => {
      live = false
    }
  }, [limit])

  if (!rows.length) return null

  return (
    <section className="pb-12">
      <div className="section-head">
        <h2>{heading}</h2>
        <a href="/shop">See the shop</a>
      </div>
      <p className="mb-4 max-w-[62ch] text-sm text-[var(--text-dim)]">{blurb}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {rows.map((row) => (
          <a
            key={row.id}
            href={row.url}
            target="_blank"
            rel="noopener"
            className="tile flex flex-col overflow-hidden rounded-[4px] border border-[var(--edge)] no-underline"
          >
            {row.photo ? (
              /* A plain img on purpose: the optimizer's remotePatterns list is
                 the wrong thing to depend on for a host that can change, and
                 section 18 already learned that the hard way. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.photo}
                alt={row.title}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-[var(--sunk)] object-contain"
              />
            ) : (
              <span className="grid aspect-square w-full place-items-center bg-[var(--sunk)] text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                No photo
              </span>
            )}
            <span className="flex flex-1 flex-col gap-1 p-2.5">
              <span className="line-clamp-2 text-xs leading-snug text-[var(--text)]">{row.title}</span>
              <span className="mt-auto flex items-baseline justify-between gap-2 pt-1.5">
                <span className="font-black tabular-nums text-[var(--text)]">{row.price}</span>
                <span className="text-[9px] uppercase tracking-widest text-[var(--text-faint)]">
                  {row.condition}
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
