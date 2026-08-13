import type { Metadata } from "next"
import { PedalCard } from "@/components/pedal-card"
import { pedalsByFamily, PEDALS } from "@/lib/pedals"

export const metadata: Metadata = {
  title: "Pedals",
  description:
    "Every circuit in the directory, grouped the way a pedalboard is laid out: filter, dynamics, fuzz, drive, modulation, then time.",
  alternates: { canonical: "/pedals" },
}

export default function PedalsPage() {
  const groups = pedalsByFamily()

  return (
    <div className="shell py-12">
      <header className="max-w-prose">
        <p className="stencil">The directory</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)]">
          {PEDALS.length} circuits
        </h1>
        <p className="mt-4 leading-relaxed text-[var(--dim)]">
          Grouped in signal order rather than alphabetically, so the list reads the way a
          board is laid out. Every entry says what the circuit does, what to listen for,
          and where it belongs in the chain.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {groups.map((group) => (
          <section key={group.family} id={group.family.toLowerCase()}>
            <h2 className="text-2xl font-black text-[var(--text)]">{group.family}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.pedals.map((pedal) => (
                <PedalCard key={pedal.slug} pedal={pedal} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
