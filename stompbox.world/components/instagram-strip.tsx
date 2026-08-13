import Script from "next/script"
import { InstagramGlyph } from "@/components/icons/instagram-glyph"
import { env } from "@/lib/env"

/**
 * Official Instagram post embeds (embed.js), loaded lazily. Not a scraped feed
 * and not an unofficial widget: the only sanctioned way to put a post on
 * another site is the permalink embed, so that is what this uses.
 *
 * Falls back to a plain follow callout when no permalinks are configured, so
 * an unset INSTAGRAM_POST_URLS ships a smaller section rather than a row of
 * broken grey boxes. Same isConfigured shape as everything else in lib/env.ts.
 */
export function InstagramStrip() {
  const handle = env.social.instagramHandle
  const profileUrl = `https://instagram.com/${handle}`

  return (
    <section className="pb-4">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-black text-[var(--text)]">From @{handle}</h2>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
        >
          <InstagramGlyph className="h-4 w-4" />
          Follow
        </a>
      </div>

      {env.social.hasEmbeds ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {env.social.instagramPostUrls.map((url) => (
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
        <p className="panel p-6 text-sm leading-relaxed text-[var(--dim)]">
          Pedals in the wild, one circuit at a time. Follow along at{" "}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
          >
            @{handle}
          </a>
          .
        </p>
      )}
    </section>
  )
}
