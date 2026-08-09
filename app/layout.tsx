import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { env } from "@/lib/env"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const SITE_NAME = "MusicTime"
const SITE_DESCRIPTION =
  "Search used and vintage music gear across eBay and Reverb in one place. Compare every live listing for the same instrument side by side, sort by price, and see which ones are genuinely below market."

export const metadata: Metadata = {
  metadataBase: new URL(env.site.url),
  title: {
    default: "MusicTime: Compare Used and Vintage Music Gear Prices",
    template: "%s | MusicTime",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "used music gear",
    "vintage guitars",
    "used guitar prices",
    "compare gear prices",
    "used amps",
    "used synthesizers",
    "used pedals",
    "gear price comparison",
    "reverb vs ebay",
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
    title: "MusicTime: Compare Used and Vintage Music Gear Prices",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MusicTime: Compare Used and Vintage Music Gear Prices",
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
  themeColor: "#0f0c0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {/* Keyboard users get past the header and filter rail in one tab. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
