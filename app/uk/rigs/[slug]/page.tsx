import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, Minus } from "lucide-react"
import { StompLink } from "@/components/ui/stomp"
import { ShipsToBadge } from "@/components/region-notice"
import { andertonsRigCoverage, type AndertonsSlot } from "@/lib/andertons/rigs"
import { RIGS, rigFromSlug } from "@/lib/rigs"
import { shipsToLabel } from "@/lib/regions"
import { formatPrice } from "@/lib/utils"

/**
 * One documented rig, priced against Anderton's live stock.
 *
 * THE GAPS ARE THE POINT. Every slot on the board is listed in signal-chain
 * order whether or not Anderton's has it, and the ones they do not have say
 * so. Dropping them would silently redraw somebody's signal chain into
 * whatever happened to be in stock, which is section 15's dishonesty ("do not
 * hide what a shopper cannot buy without saying so") committed against the rig
 * rather than against the listing.
 *
 * THE SUBTOTAL IS NOT A PRICE FOR THE RIG. It adds up the slots that are
 * actually in stock, and the copy says so in the same breath. A number that
 * reads like the cost of the board while silently omitting three pedals is the
 * same class of error as publishing a market price from two listings.
 *
 * NO ENDORSEMENT, same as every page built from the rigs dataset: nobody named
 * here is affiliated with Gear Avail or with Anderton's, and the rig is scoped
 * to the era it is documented on rather than presented as a current setup.
 */

export const revalidate = 900

export function generateStaticParams() {
  return RIGS.map((rig) => ({ slug: rig.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const rig = rigFromSlug(slug)
  if (!rig) return { title: "Rig not found" }

  return {
    title: `${rig.name}'s rig at Anderton's`,
    description: `The pedals documented on ${rig.name}'s board, ${rig.context}, priced against Anderton's live UK stock.`,
    alternates: { canonical: `/uk/rigs/${rig.slug}` },
  }
}

export default async function AndertonsRigPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rig = rigFromSlug(slug)
  if (!rig) notFound()

  const coverage = await andertonsRigCoverage(rig).catch(() => null)
  const slots = coverage?.slots ?? []

  return (
    <div className="shell space-y-8 py-10">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/uk" className="hover:text-[var(--accent-text)]">
            Anderton&apos;s
          </Link>{" "}
          /{" "}
          <Link href="/uk/rigs" className="hover:text-[var(--accent-text)]">
            Rigs
          </Link>
        </p>
        <h1 className="h-display">{rig.name}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
          {rig.blurb}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Documented on {rig.context}. {rig.name} is not affiliated with Gear Avail.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ShipsToBadge label={shipsToLabel("andertons")} />
          <StompLink href={`/rigs/${rig.slug}`} variant="ghost">
            The full rig, every store
          </StompLink>
        </div>
      </header>

      {coverage && coverage.total > 0 && (
        <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              Anderton&apos;s has {coverage.stocked} of the {coverage.total} pedals on this board
            </p>
            {coverage.subtotalCents != null ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                <span className="card-price">{formatPrice(coverage.subtotalCents, "GBP")}</span> for
                those {coverage.stocked}
                {!coverage.complete && ", not for the whole board"}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                None of them are live right now.
              </p>
            )}
          </div>
          {coverage.complete && (
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--sage)]">
              Every pedal in stock
            </span>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-black text-[var(--text)]">
          The chain, in signal order
        </h2>
        {slots.length === 0 ? (
          <p className="panel p-5 text-sm text-[var(--muted-foreground)]">
            No stock has been ingested for Anderton&apos;s yet, so there is nothing to price this
            board against.
          </p>
        ) : (
          <ol className="space-y-2">
            {slots.map((slot, index) => (
              <SlotRow key={`${slot.brand}-${slot.model}-${index}`} slot={slot} position={index + 1} />
            ))}
          </ol>
        )}
      </section>

      {rig.records.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-[var(--text)]">Documented on</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rig.records.map((record) => (
              <li key={record.title} className="panel p-3 text-sm">
                <span className="font-semibold text-[var(--text)]">{record.title}</span>
                <span className="text-[var(--muted-foreground)]"> ({record.year})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SlotRow({ slot, position }: { slot: AndertonsSlot; position: number }) {
  return (
    <li
      className="panel flex flex-wrap items-center gap-4 p-4"
      // Out of stock is stated in words below; the dimming is a second,
      // redundant cue rather than the only one, so it survives being read
      // without colour.
      style={slot.inStock ? undefined : { opacity: 0.72 }}
    >
      <span className="w-6 shrink-0 text-center font-display text-sm font-black text-[var(--muted-foreground)]">
        {position}
      </span>

      <div className="min-w-[12rem] flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">
          <span className="text-[var(--muted-foreground)]">{slot.brand}</span> {slot.model}
          {slot.signature && (
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent-text)]">
              Signature
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">{slot.role}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {slot.notPedal ? (
          <span className="text-xs text-[var(--muted-foreground)]">Not a pedal</span>
        ) : slot.inStock ? (
          <>
            <span className="card-price">{formatPrice(slot.priceCents, "GBP")}</span>
            {/*
              Straight to /go with the listing id the availability query
              already returned. Never to raw_url, and never to a search page
              that guesses at the product a second time.
            */}
            {slot.listingId && (
              <StompLink href={`/go/${slot.listingId}`} size="sm">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                View
              </StompLink>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            {slot.gearSlug ? "Not in stock at Anderton's" : "Not in this catalogue"}
          </span>
        )}

        {slot.gearSlug && (
          <Link
            href={`/gear/${slot.gearSlug}`}
            className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent-text)] hover:underline"
          >
            All stores
          </Link>
        )}
      </div>
    </li>
  )
}
