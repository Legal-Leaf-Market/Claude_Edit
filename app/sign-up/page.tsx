import type { Metadata } from "next"
import { AuthForm } from "@/components/auth-form"
import { env } from "@/lib/env"

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Gear Avail account to save price alerts on used gear.",
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--cream)]">Create an account</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        We use your address for one thing: telling you when gear you are watching drops below your
        price. No cart, no checkout, no newsletter.
      </p>
      <AuthForm mode="sign-up" googleEnabled={env.auth.google.isConfigured} />
    </div>
  )
}
