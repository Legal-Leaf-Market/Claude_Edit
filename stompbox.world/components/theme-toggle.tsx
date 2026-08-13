"use client"

import { useEffect, useState } from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { applyTheme, readStoredChoice, type ThemeChoice } from "@/lib/theme"

/**
 * The theme switch, drawn as a three-position pickup selector.
 *
 * A guitarist already owns one of these and it already does exactly this job:
 * three detents, a sprung lever, one position at a time. Reusing a control the
 * reader has physically operated is worth more than a labelled dropdown.
 *
 * Rendered only after mount. The server has no idea which of the three states
 * is stored, so painting a position during SSR would guess wrong for anyone
 * not on the default and then correct itself visibly. A fixed-size placeholder
 * holds the space so the masthead does not jump.
 */

const CHOICES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match my system", Icon: Laptop },
]

export function ThemeToggle() {
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
    return <span className="inline-block h-[30px] w-[84px]" aria-hidden="true" />
  }

  const position = CHOICES.findIndex((entry) => entry.value === choice)

  return (
    <div
      className="pickup"
      data-position={position}
      role="group"
      aria-label="Colour theme"
    >
      <span className="pickup-lever" aria-hidden="true" />
      {CHOICES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="pickup-seg"
          aria-pressed={value === choice}
          aria-label={label}
          title={label}
          onClick={() => {
            setChoice(value)
            applyTheme(value)
          }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
