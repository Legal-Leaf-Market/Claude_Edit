"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { applyTheme, readStoredChoice, resolveTheme, type ThemeChoice } from "@/lib/theme"

const ORDER: ThemeChoice[] = ["system", "light", "dark"]

const META: Record<ThemeChoice, { label: string; icon: typeof Sun }> = {
  system: { label: "Match system", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
}

/**
 * Cycles system -> light -> dark. A three-way cycle rather than a switch
 * because "system" is a real state here (see lib/theme.ts) and a two-position
 * switch has nowhere to put it.
 *
 * Renders a fixed-size placeholder until mounted. The server has no idea which
 * theme the inline script picked, so rendering the real icon on the server
 * would either mismatch on hydration or force the whole masthead dynamic; an
 * empty box of the same size avoids both without the layout shifting.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setChoice(readStoredChoice())
    setMounted(true)
  }, [])

  // Follow the OS while the choice is "system". Without this a visitor who
  // switches their laptop to dark at sunset keeps the light theme until they
  // reload, which reads as the toggle being broken.
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined") return
    const query = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => applyTheme("system")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [choice])

  const { label, icon: Icon } = META[choice]

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]
    setChoice(next)
    applyTheme(next)
  }

  if (!mounted) {
    return <div className={`h-9 w-9 ${className}`} aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label}${choice === "system" ? ` (${resolveTheme("system")})` : ""}. Click to change.`}
      aria-label={`Change theme. Currently: ${label}`}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--copper)] hover:text-[var(--text)] ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
