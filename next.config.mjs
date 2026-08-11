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
  /*
   * SSH BINDINGS CANNOT BE BUNDLED, so they are loaded at runtime instead.
   *
   * The Anderton's catalogue arrives over SFTP (probed: port 22 answers with
   * an SSH banner, port 21 refuses AUTH TLS), which means ssh2, which ships
   * optional native addons for its crypto. Turbopack fails the whole build on
   * those with "non-ecmascript placeable asset" rather than skipping them, and
   * the failure names the asset rather than the import that dragged it in.
   *
   * Listing them here leaves them as ordinary runtime requires in the server
   * bundle. The import in lib/ingestion/andertons-impact.ts is already dynamic
   * so nothing loads ssh2 unless a pull actually runs.
   */
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
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
