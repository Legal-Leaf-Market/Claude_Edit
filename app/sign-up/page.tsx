import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AuthForm } from "@/components/auth-form"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const { redirect: redirectTo } = await searchParams
  const dest = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/"
  if (session?.user) redirect(dest)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-12">
      <AuthForm mode="sign-up" redirectTo={dest} />
    </main>
  )
}
