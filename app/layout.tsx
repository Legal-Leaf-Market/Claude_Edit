import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import Script from "next/script"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CartProvider } from "@/lib/cart/context"
import { env } from "@/lib/env"
import { isStompboxHost } from "@/lib/stompbox/host"
import { THEME_INIT_SCRIPT } from "@/lib/theme"
import "./globals.css"

/*
 * Two faces, loaded with one request that is byte for byte the one
 * stompbox.world makes: Chakra Petch carries display, Jost carries UI and the
 * heavy condensed uppercase the rack panel uses. The hemp family's serif pair
 * (Fraunces, Cormorant Garamond) is not requested at all any more rather than
 * left in the URL unused; the sister-site cache-hit argument now points at
 * stompbox.world, whose audience is the front door for this brand.
 *
 * Loaded as a plain stylesheet link rather than through next/font because the
 * mark and the wordmark are drawn as paths, so nothing structural depends on a
 * font arriving, and because sharing the sister site's exact request is what
 * gets the cache hit.
 */
const HOUSE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700" +
  "&family=Jost:wght@300;400;500;600;700;800;900&display=swap"

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
  /* Both, now that the light theme is real. Declaring only "dark" here made
     the browser paint its own dark chrome around a light page for anyone whose
     OS is set to light, which is the seam this is supposed to prevent. */
  colorScheme: "dark light",
  /* The royal scale's two grounds, so the browser chrome matches the page.
     These are --bg from app/globals.css, written out because a manifest value
     cannot resolve a custom property. */
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070c1c" },
    { media: "(prefers-color-scheme: light)", color: "#f0f2f8" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

/**
 * THE SHELL BOTH SITES SHARE, AND THE THREE THINGS IT WITHHOLDS FROM ONE.
 *
 * One deployment serves gearavail.com and stompbox.world (see middleware.ts),
 * so this layout wraps every page on both. What it renders is identical apart
 * from three deliberate omissions on the guide's own domain:
 *
 *   - GEAR AVAIL'S HEADER AND FOOTER. app/stompbox/layout.tsx supplies the
 *     guide's own chrome instead. On gearavail.com/stompbox both appear, which
 *     is what makes the guide read as a section of the aggregator there and as
 *     its own site here.
 *   - THE CART PROVIDER. Nothing on the guide can add to a cart, and a
 *     localStorage-backed provider on a domain with no way to fill it is state
 *     nobody can see or clear.
 *   - THE IMPACT TRACKING TAG. It is Gear Avail's affiliate verification tag
 *     and it calls `transformLinks()`, which rewrites outbound links on
 *     whatever page it loads on. The guide carries no affiliate links by
 *     design (stompbox.world/CLAUDE.md section 2a), so shipping it there would
 *     put a link rewriter on the one site whose whole claim is that nothing is
 *     riding on its opinion. That is a rule worth keeping mechanical.
 *
 * Reading the host makes this layout dynamic, and therefore every page under
 * it. That is a real cost and it was taken knowingly: the alternative is two
 * copies of every route file, one per chrome, and a duplicated route tree is a
 * far more expensive thing to keep honest than a cache miss. Pages that want
 * caching set their own `revalidate`.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const standalone = isStompboxHost((await headers()).get("host"))

  return (
    <html lang="en">
      <head>
        {/*
          impact.com publisher site verification: the crawl-time half of the
          Impact setup whose runtime half, the Universal Tracking Tag, is the
          first child of <body> below. The token is public by definition, since
          it ships in the HTML of every page.

          Two deliberate awkwardnesses, both from the same cause. It is a raw
          tag rather than `metadata.other` because Impact issues the token in
          `value` and Next's metadata API only ever emits `content`; and the
          props are cast because `value` is not a standard <meta> attribute, so
          React's own types do not carry it. React DOM does render it through,
          verified against the installed react-dom. Reproduce the tag as issued
          rather than "correcting" the attribute: the checker reads `value`.
        */}
        <meta
          {...({
            name: "impact-site-verification",
            value: "272beb06-3345-476c-8a71-5f03c2b82ffe",
          } as React.MetaHTMLAttributes<HTMLMetaElement>)}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={HOUSE_FONTS_HREF} />
        {/*
          Theme, applied before first paint.
          dangerouslySetInnerHTML rather than next/script because this has to
          run synchronously in <head>, ahead of the body being painted at all.
          Any strategy that defers it, including beforeInteractive, leaves a
          frame of the wrong theme on screen. The content is a constant defined
          in lib/theme.ts, never anything user-supplied.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
        {!standalone && (
          <Script id="impact-radius-tag" strategy="beforeInteractive">
            {`(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7529144-7865-4e40-bff1-87bccca16ec61.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`}
          </Script>
        )}
        {/* Keyboard users get past the header and filter rail in one tab. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        {standalone ? (
          /* The guide brings its own header and footer, in app/stompbox/layout.tsx. */
          children
        ) : (
          <CartProvider>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
          </CartProvider>
        )}
        <Analytics />
      </body>
    </html>
  )
}
