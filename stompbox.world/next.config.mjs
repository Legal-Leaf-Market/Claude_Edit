/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * Pin the tracing root to this directory. Next infers it from the nearest
   * lockfile, and if this project ever sits inside another checkout it will
   * pick the outer one and trace the wrong tree. Naming it removes the guess.
   */
  outputFileTracingRoot: import.meta.dirname,

  /*
   * TWO HOSTS, NAMED, AND THAT IS THE WHOLE ALLOWLIST.
   *
   * This block used to say there should not be one, on the grounds that every
   * image here is inline SVG or served from /public. That stopped being true
   * when the catalogue landed: Gear Avail sends a product photo for every
   * pedal and the card was throwing it away, so a shelf of real gear rendered
   * as a wall of text. These are the two hosts those photos actually come
   * from, counted off the live response rather than guessed:
   *
   *   cdn.shopify.com       the small independent storefronts (most of them)
   *   upload.wikimedia.org  Wikimedia Commons, used for the seeded models
   *
   * NAME THE HOST, NEVER OPEN THE PATTERN. Same instinct as the outbound-link
   * allowlist on the sister project: the URL arrives over HTTP from another
   * service, so a misparsed feed row must not turn this site's image
   * optimizer into an open proxy for fetching arbitrary remote content. If a
   * new source starts serving photos from somewhere else, add that host here
   * and nothing will render from it until you do.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ]
  },
}

export default nextConfig
