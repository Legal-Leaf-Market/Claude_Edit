"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { applyTheme, readStoredChoice, resolveTheme, type ThemeChoice } from "@/lib/theme"

/**
 * A three-way pickup selector, for the three theme states.
 *
 * The old control was a circular icon button that cycled system, light, dark.
 * It worked and it was the same widget every website has. A guitarist already
 * owns a three-position selector: it is the switch on a Les Paul, and it does
 * exactly this job, which is choosing one of three states with the position of
 * a lever telling you which.
 *
 * So the lever slides. Left is dark, right is light, and the middle detent is
 * "follow my machine", which is the correct place for it because it sits
 * between the two things it might resolve to.
 *
 * ACCESSIBILITY: three real buttons in a group rather than one button that
 * cycles. A cycling button forces a screen reader user to press up to three
 * times and listen to the label change to reach a known state; three buttons
 * let anyone jump straight to the one they want. The lever is decorative and
 * `aria-hidden`, since the pressed state is already on the buttons.
 */

const ORDER = ["dark", "system", "light"] as const

const META: Record<ThemeChoice, { label: string; icon: typeof Sun }> = {
  dark: { label: "Dark", icon: Moon },
  system: { label: "Match my system", icon: Monitor },
  light: { label: "Light", icon: Sun },
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setChoice(readStoredChoice())
    setMounted(true)
  }, [])

  // Follow the OS while the choice is "system". Without this, someone whose
  // laptop flips to dark at sunset keeps the light theme until they reload,
  // which reads as the switch being broken.
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined") return
    const query = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => applyTheme("system")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [choice])

  function select(next: ThemeChoice) {
    setChoice(next)
    applyTheme(next)
  }

  /*
   * A same-size placeholder until mounted. The server cannot know which theme
   * the inline script picked, so rendering the real lever position on the
   * server would either mismatch on hydration or force the masthead dynamic.
   */
  if (!mounted) {
    return <div className={`h-[30px] w-[86px] ${className}`} aria-hidden="true" />
  }

  const index = ORDER.indexOf(choice as (typeof ORDER)[number])

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`pickup ${className}`}
      data-position={index < 0 ? 0 : index}
    >
      {/* The lever. Decorative: the pressed state below is the real signal. */}
      <span className="pickup-lever" aria-hidden="true" />
      {ORDER.map((value) => {
        const { label, icon: Icon } = META[value]
        const active = value === choice
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            aria-pressed={active}
            title={
              value === "system"
                ? `Match my system (currently ${resolveTheme("system")})`
                : label
            }
            aria-label={label}
            className="pickup-seg"
          >
            <Icon className="h-[13px] w-[13px]" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
