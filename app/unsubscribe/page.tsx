import type { Metadata } from "next"
import Link from "next/link"
import { UnsubscribeConfirm } from "@/components/unsubscribe-confirm"

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * The page an unsubscribe link lands on.
 *
 * IT DOES NOT UNSUBSCRIBE ON LOAD, and that is deliberate. Mail clients and
 * crawlers pre-fetch links: Gmail and Outlook both scan them, and a link
 * shared or forwarded gets fetched again. Performing the unsubscribe on GET
 * would quietly drop people who never clicked anything, and they would only
 * find out by noticing the emails stopped.
 *
 * So the token is carried to a single confirm button that POSTs. One click is
 * still one click, which keeps unsubscribing genuinely easy, while a fetch
 * alone does nothing.
 */
export default async function UnsubscribePage({ searchParams }: PageProps) {
  const query = await searchParams
  const token = typeof query.token === "string" ? query.token : null

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="panel p-7 text-center">
          <h1 className="text-xl font-black text-[var(--cream)]">This link is incomplete</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Unsubscribe links carry a code that identifies which subscription to end, and this one
            arrived without it. Use the link at the bottom of any email we sent you, or reply to it
            and a person will sort it out.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
          >
            Back to Gear Avail
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <UnsubscribeConfirm token={token} />
    </div>
  )
}
