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
   * This site has no database, no image feeds and no user uploads, so there is
   * no remotePatterns block here and there should not be one. Every image on
   * the site is either drawn as inline SVG or served from /public. If a future
   * change needs a remote image, add the specific host rather than opening
   * this up, the same instinct as the outbound-link allowlist on the sister
   * project.
   */
  images: { formats: ["image/avif", "image/webp"] },

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
