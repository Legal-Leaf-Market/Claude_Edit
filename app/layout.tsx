import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { FloatingToolbar } from '@/components/floating-toolbar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const SITE_URL = 'https://legal-leafmarket.com'
const SITE_NAME = 'Legal-Leaf Market'
const SITE_DESCRIPTION =
  'Compare real-time hemp deals across trusted THCA, Delta-8, Delta-9, and CBD retailers in one place. Filter by cannabinoid, strain, and budget, sort by price-per-gram, then check out directly at each store with your discount applied.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Legal-Leaf Market — Compare Legal Hemp Deals by Price Per Gram',
    template: '%s | Legal-Leaf Market',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: 'v0.app',
  keywords: [
    'legal hemp deals',
    'THCA flower deals',
    'price per gram comparison',
    'Delta-8',
    'Delta-9',
    'CBD flower',
    'hemp strain comparison',
    'cheap THCA',
    'hemp marketplace',
    'compare hemp prices',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'shopping',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'Legal-Leaf Market — Compare Legal Hemp Deals by Price Per Gram',
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Legal-Leaf Market — compare legal hemp deals by price per gram',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal-Leaf Market — Compare Legal Hemp Deals by Price Per Gram',
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  referrer: 'origin-when-cross-origin',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#071423',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <FloatingToolbar />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
