import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { SiteHeader } from "@/components/stompbox/site-header"
import { SiteFooter } from "@/components/stompbox/site-footer"
import { isStompboxHost, sbHref, stompboxBase, STOMPBOX_PREFIX } from "@/lib/stompbox/host"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/stompbox/site"

/**
 * The guide's chrome, on whichever of the two domains asked for it.
 *
 * This used to be a ROOT layout, when stompbox.world was its own Vercel
 * project: it owned `<html>`, the font request and the theme script. All three
 * now live in `app/layout.tsx`, which wraps this one on both hosts and is
 * byte-identical in what it emits either way (the font request was already the
 * same request on both sites, deliberately, so the browser cache hits). What
 * is left here is the part that genuinely differs between the two.
 *
 * STANDALONE, on stompbox.world: the guide's own header and footer, and this
 * layout owns `<main>` because the root layout stepped back.
 *
 * EMBEDDED, on gearavail.com/stompbox: Gear Avail's masthead and footer are
 * already around us, so the guide adds a section bar instead of a second
 * header. Two full mastheads stacked is the usual way an embedded site
 * announces that nobody thought about this case.
 */

/**
 * THE CANONICAL IS ALWAYS stompbox.world, ON BOTH HOSTS.
 *
 * The same pages are reachable at two URLs, which is duplicate content unless
 * one of them is named as home. stompbox.world is the one named, because it is
 * the brand with the audience the whole design follows (CLAUDE.md section 16)
 * and because a guide that owns a domain should not have its own domain
 * demoted to a copy of a subdirectory.
 *
 * So gearavail.com/stompbox/* is a labelled mirror: indexable, linked, and
 * declaring where the original lives. Nothing about that hides it from a
 * reader who arrives on it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const standalone = isStompboxHost((await headers()).get("host"))

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME}: ${SITE_TAGLINE}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
      "guitar pedals",
      "effects pedals",
      "stompbox",
      "signal chain order",
      "pedalboard",
      "overdrive",
      "fuzz",
      "delay",
      "modulation",
    ],
    alternates: { canonical: SITE_URL },
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME}: ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME}: ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    /*
     * The mirror does not get the guide's favicon. A tab open on
     * gearavail.com/stompbox is a Gear Avail tab and should carry Gear Avail's
     * mark; the two icons are deliberately different drawings and
     * tests/favicon.test.ts pins that difference, so handing the aggregator's
     * tab the guide's icon would collapse exactly what that test protects.
     */
    icons: standalone ? { icon: `${STOMPBOX_PREFIX}/icon.svg` } : undefined,
  }
}

export default async function StompboxLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host")
  const standalone = isStompboxHost(host)
  const base = stompboxBase(host)

  /*
   * data-site scopes the handful of guide-only rules in app/globals.css. The
   * tokens are shared and identical between the two sites; this exists for the
   * few component classes that are not, rather than for a second theme.
   */
  if (standalone) {
    return (
      <div data-site="stompbox">
        <SiteHeader base={base} />
        <main id="main">{children}</main>
        <SiteFooter base={base} />
      </div>
    )
  }

  return (
    <div data-site="stompbox">
      {/*
        The section bar, in place of a second masthead. It says where you are
        and that the guide is a real site of its own, because a reader who
        finds it here should be able to find it again without going through
        the aggregator.
      */}
      <div className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <Link
            href={sbHref(base, "/")}
            className="text-sm font-black tracking-tight text-[var(--text)]"
          >
            {SITE_NAME}
          </Link>
          <span className="text-sm text-[var(--dim)]">{SITE_TAGLINE}</span>
          <a
            href={SITE_URL}
            rel="noopener"
            className="ml-auto text-xs font-semibold text-[var(--accent-text)] underline"
          >
            Visit the standalone site
          </a>
        </div>
      </div>
      {children}
    </div>
  )
}
