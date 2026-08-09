import type { Metadata } from "next"
import { AuthForm } from "@/components/auth-form"
import { env } from "@/lib/env"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your Gear Avail price alerts.",
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--cream)]">Sign in</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        An account exists only so your price alerts have somewhere to live.
      </p>
      <AuthForm mode="sign-in" googleEnabled={env.auth.google.isConfigured} />
    </div>
  )
}
