import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** /admin has nothing of its own; the one admin page today is the operating model. */
export default function AdminIndexPage() {
  redirect("/admin/operating-model")
}
