import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin"
import { OperatingModel } from "@/components/admin/operating-model"

export const metadata: Metadata = {
  title: "Operating model",
  description: "24-month projection for the four-site affiliate family.",
}

// Gated on a cookie and a session lookup, so never prerender or cache it.
export const dynamic = "force-dynamic"

const PATH = "/admin/operating-model"

export default async function OperatingModelPage() {
  if (!(await isAdmin())) {
    redirect(`/admin/sign-in?redirect=${encodeURIComponent(PATH)}`)
  }

  return (
    <main>
      <OperatingModel />
    </main>
  )
}
