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
    // Marketplace CDNs only. Anything not listed here falls back to a plain
    // <img> via components/listing-image.tsx rather than 404ing the optimizer.
    remotePatterns: [
      { protocol: "https", hostname: "**.ebayimg.com" },
      { protocol: "https", hostname: "**.ebaystatic.com" },
      { protocol: "https", hostname: "**.reverb.com" },
      { protocol: "https", hostname: "rvb-img.reverb.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
