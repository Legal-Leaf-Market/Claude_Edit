"use client"

import { useEffect, useState } from "react"
import { applyTheme, readStoredChoice, type ThemeChoice } from "@/lib/theme"

/**
 * The theme switch, drawn as a Les Paul toggle.
 *
 * It was a blade-style pickup selector: three icon buttons in a pill with a
 * chrome cap sliding between them. Same idea, wrong guitar. A Les Paul toggle
 * is the switch most people picture when they picture a guitar switch, and it
 * has exactly three detents, which is exactly how many theme states this site
 * has. It is also the control the sister site ships, and since its design
 * took over (CLAUDE.md section 16), the two sites sharing one switch is the
 * point rather than a coincidence.
 *
 * IT CYCLES ON CLICK RATHER THAN OFFERING THREE TARGETS, and that is the real
 * change rather than a drawing. You do not pick a position on a toggle, you
 * flip it. Committing to that turns three cramped 26x24 buttons into one 54x50
 * control, which is a better touch target than what it replaces rather than a
 * worse one, and three states means the furthest any theme can be is two
 * flips. The label says where it is and where the next flip goes, so the
 * behaviour is announced rather than discovered.
 *
 * Rendered only after mount. The server has no idea which of the three states
 * is stored, so painting a position during SSR would guess wrong for anyone not
 * on the default and then visibly correct itself. A fixed-size placeholder
 * holds the space so the masthead does not jump.
 */

/*
 * Order is the LEVER's order, not a menu's: left, middle, right. Light sits
 * left and dark sits right so the throw runs bright to dark the way a reader
 * would guess, and system sits in the middle detent because it is the one that
 * is neither.
 */
const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "Match my system" },
  { value: "dark", label: "Dark" },
]

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null)

  useEffect(() => {
    setChoice(readStoredChoice())
  }, [])

  /*
   * "system" has to keep listening. The other two are fixed once chosen, but a
   * reader who picked "follow my OS" expects the page to change when the OS
   * does, without a reload.
   */
  useEffect(() => {
    if (choice !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [choice])

  if (choice === null) {
    return <span className={`inline-block h-[50px] w-[54px] ${className}`} aria-hidden="true" />
  }

  const position = CHOICES.findIndex((entry) => entry.value === choice)
  const current = CHOICES[position]
  const next = CHOICES[(position + 1) % CHOICES.length]

  return (
    <button
      type="button"
      className={`lp ${className}`}
      data-position={position}
      aria-label={`Colour theme: ${current.label}. Flip to ${next.label}.`}
      title={`Theme: ${current.label}. Flip to ${next.label}.`}
      onClick={() => {
        setChoice(next.value)
        applyTheme(next.value)
      }}
    >
      {/* Three detents. The lit one is where the lever is sitting. */}
      <span className="lp-detents" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="lp-arm" aria-hidden="true">
        <span className="lp-tip" />
      </span>
    </button>
  )
}
