/** @type {import('next').NextConfig} */

// Baseline hardening headers applied to every response, matching the sister
// sites. Listing thumbnails are hotlinked from eBay/Reverb CDNs, so the image
// policy below is the one place this app has to be permissive.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig = {
  images: {
    /*
     * THIS LIST IS NOT ALLOWED TO BE LOAD BEARING, and the reason is a bug it
     * already caused. It held eBay and Reverb only, while every product photo
     * in the live catalogue sits on cdn.shopify.com, so next/image answered
     * 400 INVALID_IMAGE_OPTIMIZE_REQUEST for the entire shelf. Nothing threw.
     * The pedalboard just quietly drew its "no photo" enclosure for every
     * pedal on it, which looks exactly like a catalogue that has no photos.
     *
     * Two fixes, and the second is the one that matters. The hosts below are
     * now the ones actually in the data. But a list that has to grow every
     * time a merchant is added cannot be what decides whether a picture
     * appears, so anything user-facing uses a plain <img> (see
     * components/listing-image.tsx and components/board/pedal-photo.tsx) and
     * treats the optimizer as a bonus rather than a dependency.
     */
    remotePatterns: [
      { protocol: "https", hostname: "**.ebayimg.com" },
      { protocol: "https", hostname: "**.ebaystatic.com" },
      { protocol: "https", hostname: "**.reverb.com" },
      { protocol: "https", hostname: "rvb-img.reverb.com" },
      /* Every Shopify storefront serves from one CDN, so the eleven small
         independent sellers are one entry rather than eleven. */
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "**.goaffpro.com" },
      /* The Awin, CJ and Impact merchants. Each brand serves its own images,
         so these are hosts seen in those feeds rather than one network CDN. */
      { protocol: "https", hostname: "**.gear4music.com" },
      { protocol: "https", hostname: "**.andertons.co.uk" },
      { protocol: "https", hostname: "**.zzounds.com" },
      { protocol: "https", hostname: "**.fullcompass.com" },
      { protocol: "https", hostname: "**.scene7.com" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
