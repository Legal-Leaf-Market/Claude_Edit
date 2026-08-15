import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AdminSignInForm } from "@/components/admin-sign-in-form"
import { adminConfigured, isAdmin } from "@/lib/admin/gate"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
}

function safeRedirect(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/admin/operating-model"
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectParam } = await searchParams
  const destination = safeRedirect(redirectParam)

  if (await isAdmin()) redirect(destination)

  const configured = adminConfigured()

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <p className="eyebrow text-xs font-semibold uppercase tracking-wide text-[var(--accent-text)]">
        Admin mode
      </p>
      <h1 className="mb-2 mt-1 text-2xl font-bold text-[var(--cream)]">This page is private</h1>

      {configured ? (
        <>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            Enter the admin passcode to open the operating model.
          </p>
          <AdminSignInForm redirectTo={destination} />
        </>
      ) : (
        <div className="panel space-y-3 p-6 text-sm leading-relaxed text-[var(--muted-foreground)]">
          <p>
            No admin credential is configured on this deployment, so nothing can be unlocked yet.
            The gate fails closed on purpose: an unset variable must never publish the operating
            model.
          </p>
          <p>
            Set this in Vercel → Project → Settings → Environment Variables, then redeploy:
          </p>
          <div className="rounded-lg bg-[var(--secondary)] p-3">
            <code className="font-semibold text-[var(--accent-text)]">ADMIN_PASSCODE</code>
            <p className="mt-1 text-xs">
              A long random string. Enter it here to unlock; it also signs the session cookie, so
              changing it signs everyone out.
            </p>
          </div>
        </div>
      )}

      <p className="mt-6 border-t border-[var(--border)] pt-4 text-sm">
        <Link href="/" className="text-[var(--muted-foreground)] hover:text-[var(--cream)]">
          ← Back to the public site
        </Link>
      </p>
    </div>
  )
}
