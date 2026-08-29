import type { Metadata } from "next"
import { ChordStudio } from "@/components/chord-teacher/studio"
import { env } from "@/lib/env"

/**
 * THE CHORD TEACHER.
 *
 * A guitar harmony workbench: what a chord is made of, where it sits on the
 * neck, what moves when one chord becomes the next, and how to get from one
 * key to another. Ported from a single-file studio and rebuilt so that
 * everything it says is computed rather than typed, which is the difference
 * between a tool and a poster.
 *
 * WHY IT IS ON THIS SITE AT ALL. Gear Avail sells nothing itself and its
 * useful pages are the ones that answer a question before somebody spends
 * money: what a circuit does, where a pedal goes in the chain, what a rig on a
 * record actually was. This is the same kind of page for the instrument rather
 * than for the pedals, it is entirely static, and it earns nothing, which is
 * fine: section 17's promise is that payout never decides what is here.
 */
export const metadata: Metadata = {
  title: "Chord teacher: voice leading, reharmonisation and key changes on guitar",
  description:
    "A guitar workbench for harmony. Every voicing is found by searching the neck rather than typed, so it works in any key and any tuning, and every claim about what moves between two chords is measured rather than asserted.",
  alternates: { canonical: `${env.site.url.replace(/\/+$/, "")}/chord-teacher` },
}

export default function ChordTeacherPage() {
  return (
    <main className="shell py-10 sm:py-14">
      <p className="stencil">The workbench</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
        What the chord is doing
      </h1>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Most chord tools hand you a grip and leave. This one shows what the shape is made of, what
        it becomes when the next chord arrives, and which single note is doing the work. Change the
        key or the tuning and every shape on the page is found again, because none of them were
        stored in the first place.
      </p>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Nothing here is for sale and nothing links out. Arrow keys move through the progression and
        space plays the chord, once the sound is on.
      </p>

      <div className="mt-9">
        <ChordStudio />
      </div>
    </main>
  )
}
