import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CartProvider } from "@/lib/cart/context"
import { env } from "@/lib/env"
import "./globals.css"

/*
 * The three house faces are loaded with the SAME Google Fonts request the
 * sister sites make, byte for byte, and that is deliberate rather than lazy.
 * Nicotia's own CLAUDE.md (section 4) records the reason: a visitor crossing
 * between the family's sites gets a browser cache hit on the font files
 * instead of a second download. next/font/google would self-host these and
 * silently break that, which is why this site does not use it despite being
 * the only one of the four on Next.js.
 */
const HOUSE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900" +
  "&family=Cormorant+Garamond:ital,wght@1,600&family=Jost:wght@300;400;500;600;700&display=swap"

const SITE_NAME = "Gear Avail"
const SITE_DESCRIPTION =
  "Browse real-time inventory from independent music gear makers and retailers in one place. Sort by price and see which listings are genuinely below market."

export const metadata: Metadata = {
  metadataBase: new URL(env.site.url),
  title: {
    default: "Gear Avail: Music Gear From Independent Makers and Retailers",
    template: "%s | Gear Avail",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "music gear",
    "guitar pedals",
    "electric guitars",
    "independent music gear makers",
    "compare gear prices",
    "amplifiers",
    "synthesizers",
    "effects pedals",
    "gear price comparison",
  ],
  authors: [{ name: SITE_NAME, url: env.site.url }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "shopping",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: env.site.url,
    siteName: SITE_NAME,
    title: "Gear Avail: Music Gear From Independent Makers and Retailers",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gear Avail: Music Gear From Independent Makers and Retailers",
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
  colorScheme: "dark",
  /* Matches --bg, so the phone chrome meets the masthead without a seam. */
  themeColor: "#0d0b09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={HOUSE_FONTS_HREF} />
      </head>
      <body className="font-sans antialiased">
        {/*
          Impact Radius (impact.com) publisher verification/tracking tag,
          requested for the Anderton's affiliate application. `beforeInteractive`
          is required (Next.js only allows that strategy in the root layout),
          and Next's own docs place it as the first child of <body>, not as a
          sibling of <body> under <html>: a <script> is not a valid child of
          <html> outside <head>/<body>, and putting it there throws a
          hydration error. The tag still lands in the server-rendered HTML
          either way, which is what a plain HTML-fetch verifier checks for.
          Note for later: this tag's own `transformLinks()` call can rewrite
          outbound links on the page. Nothing here is wired to any real
          Anderton's campaign yet, so it has nothing to rewrite today, but once
          (if) that program goes live, verify it does not fight with this
          site's own /go and /api/cart/checkout attribution path (section 5,
          CLAUDE.md) rather than assuming the two coexist for free.
        */}
        <Script id="impact-radius-tag" strategy="beforeInteractive">
          {`(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7529144-7865-4e40-bff1-87bccca16ec61.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`}
        </Script>
        {/* Keyboard users get past the header and filter rail in one tab. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        <CartProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
