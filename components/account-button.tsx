"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function AccountButton() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  async function onSignOut() {
    await authClient.signOut()
    setOpen(false)
    router.refresh()
  }

  if (isPending) {
    return <div className="h-10 w-10 animate-pulse rounded-xl border border-gold/40 bg-white/10" />
  }

  if (!session?.user) {
    return (
      <a
        href="/sign-in"
        className="flex h-10 items-center gap-2 rounded-xl border border-gold/40 bg-white/10 px-3.5 text-sm font-black text-mint transition hover:bg-white/15"
      >
        <User className="h-5 w-5" />
        <span className="hidden sm:inline">Log in</span>
      </a>
    )
  }

  const label = session.user.name || session.user.email
  const initial = (label || "?").charAt(0).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-gold/40 bg-white/10 px-2 text-sm font-black text-mint transition hover:bg-white/15 sm:px-3"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-xs font-black text-navy">
          {initial}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-gold/25 bg-navy/95 p-2 shadow-2xl backdrop-blur">
          <div className="border-b border-gold/15 px-3 py-2.5">
            <div className="truncate text-sm font-black text-mint">{session.user.name}</div>
            <div className="truncate text-xs font-medium text-mint/60">{session.user.email}</div>
          </div>
          <button
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-mint transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
