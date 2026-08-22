"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signIn, signUp } from "@/lib/auth-client"

/** Matches the minPasswordLength configured on the server in lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 10

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: "sign-in" | "sign-up"
  googleEnabled?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  const isSignUp = mode === "sign-up"

  async function onGoogleClick() {
    setError(null)
    setGooglePending(true)
    try {
      const result = await signIn.social({ provider: "google", callbackURL: "/alerts" })
      if (result.error) {
        setError(result.error.message ?? "Could not sign in with Google.")
        setGooglePending(false)
      }
      // On success Better Auth redirects the browser itself; nothing more to do here.
    } catch {
      setError("Could not sign in with Google. Try again in a moment.")
      setGooglePending(false)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "").trim()

    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      setPending(false)
      return
    }

    try {
      const result = isSignUp
        ? await signUp.email({ email, password, name: name || email.split("@")[0] })
        : await signIn.email({ email, password })

      if (result.error) {
        // Deliberately not distinguishing "no such account" from "wrong
        // password": the difference tells an attacker which addresses exist.
        setError(
          isSignUp
            ? (result.error.message ?? "Could not create that account.")
            : "That email and password combination did not work.",
        )
        return
      }

      router.push("/alerts")
      router.refresh()
    } catch {
      setError("Something went wrong. Try again in a moment.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="panel space-y-4 p-6">
      {googleEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={googlePending}
            onClick={onGoogleClick}
            className="w-full"
          >
            {googlePending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            or use email
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
              Name
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              className="plate h-10 w-full px-3 text-sm"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="plate h-10 w-full px-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="plate h-10 w-full px-3 text-sm"
          />
          {isSignUp && (
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link href="/sign-in" className="text-[var(--accent-text)] underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              Need an account?{" "}
              <Link href="/sign-up" className="text-[var(--accent-text)] underline-offset-2 hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
