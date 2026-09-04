import { cn } from "@/lib/utils"
import type { LabPhoto } from "@/lib/lab/photos"

/**
 * ONE OF OUR OWN BENCH PHOTOGRAPHS, SAYING WHAT IT IS.
 *
 * The twin of `ModelledRender`, and it exists for the identical reason. That
 * component prints "Illustration" because a drawing standing in silently for a
 * photograph is a claim about what arrives in the post: this colour, this
 * clean, this complete. A photograph of a DIFFERENT unit of the same pedal
 * makes a quieter version of the same claim, and it is still a claim nobody
 * made. So it says so.
 *
 * "Our photo" rather than "stock photo", because stock photo means the
 * manufacturer's, and the whole point of this is that it is not.
 *
 * A plain <img>, matching `ListingImage`. The optimizer's `remotePatterns` has
 * already caused one sitewide outage of every product shot on this site, and
 * these are local files that need none of it.
 */
export function LabPhotoImage({
  photo,
  className,
  /** Suppressed at thumbnail size, where the type would be illegible anyway
      and a two-word label on a 36px tile is noise rather than disclosure. The
      alt text still carries it at every size. */
  compact = false,
}: {
  photo: LabPhoto
  className?: string
  compact?: boolean
}) {
  const caption = `Our photo of another ${photo.brand} ${photo.model}, not this listing's unit.`

  return (
    <figure className={cn("lab-photo", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={`${photo.alt} ${caption}`}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        className="lab-photo-img"
      />
      {compact ? null : (
        <figcaption className="lab-photo-mark" aria-hidden="true">
          Our photo, another unit
        </figcaption>
      )}
    </figure>
  )
}
