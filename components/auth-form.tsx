"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"

type Mode = "sign-in" | "sign-up"

export function AuthForm({
  mode,
  redirectTo = "/",
}: {
  mode: Mode
  redirectTo?: string
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isSignUp = mode === "sign-up"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({ email, password, name })
        if (error) throw new Error(error.message || "Could not create account")
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message || "Invalid email or password")
      }
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      })
    } catch {
      setError("Could not start Google sign-in")
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-gold/25 bg-navy/70 p-6 shadow-2xl backdrop-blur sm:p-8">
      <h1 className="text-2xl font-black text-mint sm:text-3xl">
        {isSignUp ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm font-medium text-mint/70">
        {isSignUp
          ? "Save your watchlist and unlock checkout with code."
          : "Log in to reach your watchlist and check out."}
      </p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading || loading}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-gold/30 bg-white px-4 py-3 text-sm font-black text-navy transition hover:bg-white/90 disabled:opacity-60"
      >
        <GoogleIcon />
        {googleLoading ? "Redirecting..." : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-mint/50">
        <span className="h-px flex-1 bg-gold/20" />
        or
        <span className="h-px flex-1 bg-gold/20" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {isSignUp && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-mint/70">Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="rounded-xl border border-gold/25 bg-navy/60 px-4 py-3 text-sm font-semibold text-mint outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20"
              placeholder="Jane Doe"
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-mint/70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="rounded-xl border border-gold/25 bg-navy/60 px-4 py-3 text-sm font-semibold text-mint outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20"
            placeholder="you@email.com"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-mint/70">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="rounded-xl border border-gold/25 bg-navy/60 px-4 py-3 text-sm font-semibold text-mint outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20"
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
          />
        </label>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="mt-1 rounded-xl bg-lime px-4 py-3 text-sm font-black text-navy transition hover:bg-lime/90 disabled:opacity-60"
        >
          {loading
            ? isSignUp
              ? "Creating account..."
              : "Logging in..."
            : isSignUp
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm font-medium text-mint/70">
        {isSignUp ? "Already have an account? " : "New to Legal-Leaf? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-black text-gold underline-offset-2 hover:underline"
        >
          {isSignUp ? "Log in" : "Create one"}
        </Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
