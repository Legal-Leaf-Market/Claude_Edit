import Script from "next/script"
import { Instagram } from "lucide-react"
import { env } from "@/lib/env"

/**
 * Official Instagram post embeds (embed.js), loaded lazily, not a scraped
 * or unofficial feed widget. Falls back to a plain follow callout when no
 * permalinks are configured, so an unset INSTAGRAM_POST_URLS never ships a
 * broken widget, the same isConfigured shape as every other integration in
 * lib/env.ts.
 */
export function InstagramStrip() {
  const handle = env.social.instagramHandle
  const postUrls = env.social.instagramPostUrls
  const profileUrl = `https://instagram.com/${handle}`

  return (
    <section className="pb-16">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-[var(--cream)]">From @{handle} on Instagram</h2>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--amber)] underline-offset-2 hover:underline"
        >
          <Instagram className="h-4 w-4" aria-hidden="true" />
          Follow
        </a>
      </div>

      {postUrls.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {postUrls.map((url) => (
              <blockquote
                key={url}
                className="instagram-media panel !m-0 overflow-hidden"
                data-instgrm-permalink={url}
                data-instgrm-version="14"
              />
            ))}
          </div>
          <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
        </>
      ) : (
        <p className="panel p-6 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Real gear talk, flips, and finds from the community that started this whole thing.
          Follow along at{" "}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--amber)] underline-offset-2 hover:underline"
          >
            @{handle}
          </a>
          .
        </p>
      )}
    </section>
  )
}
