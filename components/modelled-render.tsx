import { cn } from "@/lib/utils"

/**
 * A MEASURED MODEL STANDING IN FOR A PHOTOGRAPH THAT DOES NOT EXIST.
 *
 * Most listings in a used-gear feed have no usable picture. Marketplace CDN
 * URLs expire, plenty of rows never carried one, and until now every one of
 * those rendered as a grey rectangle with a broken-image glyph: sixteen
 * listings on `/used/effects-pedals` meant sixteen voids, which is most of what
 * made the page look like it had failed to load rather than like a shop.
 *
 * `lib/board/pedal-models.ts` already holds 88 pedals measured in millimetres,
 * and `scripts/render-pedal-models.ts` photographs them offline. So where the
 * seller gave us nothing and we have measured that exact pedal, the card shows
 * the model.
 *
 * AND IT SAYS SO. This is the whole reason the component exists rather than the
 * caller just swapping the `src`. A render standing silently in for a
 * photograph is a claim about what will arrive in the post: that it is this
 * colour, this clean, this complete, with these knobs still on it. The model
 * knows the shape and knows nothing else, so the picture is labelled every time
 * it is big enough to carry a label, and the alt text says it at every size.
 * Same instinct as the inspector's `p3d-truth` line and as refusing to publish
 * a market price under `MIN_SAMPLE_SIZE`: the honest version of a thing you do
 * not know is saying which part you do not know.
 */
export function ModelledRender({
  src,
  name,
  className,
  /**
   * Too small for a legend.
   *
   * A 36px thumbnail in the parts bin cannot carry readable type: a chip at
   * that size is three grey pixels that look like a rendering bug. It keeps the
   * alt text, which is the part a screen reader was going to get anyway, and
   * the label reappears the moment the picture is big enough to hold one.
   */
  compact = false,
}: {
  src: string
  name: string
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn("modelled", className)}>
      {/*
        A plain <img>, matching every other picture on this site. These are our
        own files in `public/`, so the optimizer would work, but a picture that
        appears only when a host is on a list is exactly what section 18 says
        must not decide whether a photo shows up.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name}, drawn from our measurements. Not a photograph of this listing.`}
        loading="lazy"
        decoding="async"
        className="modelled-img"
      />
      {compact ? null : <span className="modelled-mark">Illustration</span>}
    </div>
  )
}
