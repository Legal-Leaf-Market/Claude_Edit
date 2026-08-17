import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { THEME_INIT_SCRIPT } from "@/lib/theme"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site"
import "./globals.css"

/*
 * Two faces, loaded with one request. Chakra Petch carries display, Jost carries
 * UI and the heavy condensed uppercase the rack panel uses.
 *
 * Chakra Petch replaced Fraunces because the Instagram account's wordmark is
 * heavy angular capitals and the site follows the account. Fraunces is not
 * requested at all any more rather than left in the URL unused.
 *
 * Loaded as a plain stylesheet link rather than through next/font because the
 * mark and the wordmark are drawn as paths, so nothing structural depends on a
 * font arriving. If this request fails the site falls back to Georgia and the
 * system sans and still looks like itself, which is the whole reason the logo
 * is not typeset.
 */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700" +
  "&family=Jost:wght@300;400;500;600;700;800;900&display=swap"

export const metadata: Metadata = {
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
  alternates: { canonical: "/" },
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
  referrer: "origin-when-cross-origin",
}

export const viewport: Viewport = {
  /*
   * Both, because the light theme is real. Declaring only "dark" here makes the
   * browser paint its own dark chrome around a light page for anyone who chose
   * light, which is exactly the seam this is meant to prevent.
   */
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070c1c" },
    { media: "(prefers-color-scheme: light)", color: "#f0f2f8" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
        {/*
          Runs before first paint. It has to be inline and synchronous: anything
          React renders is already too late and the page flashes the wrong theme
          for a frame. See lib/theme.ts for why absence means dark.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
