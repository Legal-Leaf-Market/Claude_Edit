import { photoForRig, creditLine } from "@/lib/rigs/photos"

/**
 * An artist photograph with the credit its licence requires, or the monogram.
 *
 * THE CREDIT IS NOT OPTIONAL AND NOT DETACHABLE. CC-BY and CC-BY-SA both
 * require attribution, so the caption is rendered by the same component as the
 * image and there is no prop to turn it off. A future refactor that wanted a
 * bare photograph would have to delete the caption deliberately rather than
 * forget it.
 *
 * FALLING BACK IS THE NORMAL CASE, not an error path. Most artists have no
 * freely licensed photograph on Commons, and `lib/rigs/photos.ts` is empty
 * until somebody runs the fetch script. A monogram is what the site already
 * draws and what section 13 chose on purpose, so an absent photo is simply the
 * status quo rather than a hole.
 */
export function ArtistPhoto({
  rigSlug,
  name,
  hue,
  initials,
  className = "",
}: {
  rigSlug: string
  name: string
  hue: string
  initials: string
  className?: string
}) {
  const photo = photoForRig(rigSlug)

  if (!photo) {
    return (
      <span
        className={`icon-badge flex items-center justify-center font-display font-black ${className}`}
        style={{ "--icon-hue": hue } as React.CSSProperties}
        aria-hidden="true"
      >
        {initials}
      </span>
    )
  }

  return (
    <figure className={`m-0 ${className}`}>
      {/*
        A plain <img>: these are upload.wikimedia.org URLs, and a host the Next
        optimizer does not recognise renders as a hard 500 rather than a
        missing picture. Same reasoning as components/listing-image.tsx.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={`${name}, photographed by ${photo.author || "an unnamed photographer"}`}
        width={photo.width || undefined}
        height={photo.height || undefined}
        loading="lazy"
        decoding="async"
        className="h-full w-full rounded-[10px] object-cover"
      />
      <figcaption className="mt-1 text-[0.6rem] leading-snug text-[var(--dim)]">
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {creditLine(photo)}
        </a>
        {" / "}
        <a
          href={photo.licence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          licence
        </a>
      </figcaption>
    </figure>
  )
}
