/**
 * The Gear Avail mark and wordmark, drawn rather than typeset.
 *
 * WHY IT IS A PEDAL. The site sells guitar gear and its best page is a
 * pedalboard planner, so the mark is a stompbox: a chamfered enclosure with a
 * gold silkscreen line, a status LED, and a guitar silhouette on the face where
 * a pedal would print its name. Every other surface here then inherits the same
 * vocabulary. Buttons are footswitches, toggles are knobs, the focus ring is
 * the LED. A logo that explains the rest of the interface is doing more work
 * than a logo that just sits in the corner.
 *
 * WHY THE LETTERS ARE PATHS AND NOT TEXT. A wordmark set in a webfont is at
 * the mercy of the font loading, of the platform's fallback, and of whoever
 * changes --display next. These are stroked polylines with mitred joins, so
 * they render identically everywhere, need no font, and survive being inlined
 * into an email or a favicon. The forms are deliberately chamfered rather than
 * rounded: it is the geometry of an amp faceplate and a flight case stencil,
 * which is the visual world a guitarist already lives in, and it stays legible
 * when the whole lockup is 20px tall in a browser tab.
 *
 * WHY IT AVOIDS THE OBVIOUS. No flames, no headstock-as-lightning-bolt, no
 * guitar leaning on the letter A. The silhouette is built from two circles and
 * two rectangles, which is how you draw a guitar when you want it read at
 * 16 pixels rather than admired at 400.
 *
 * COLOUR. Everything resolves through CSS custom properties, so the mark
 * follows the theme instead of shipping a light copy and a dark copy. The LED
 * is the one fixed hue: it is the same green as an engaged pedal, and it is
 * always on, because a shop that is open says so.
 */

type MarkProps = {
  /** Rendered size in pixels. The mark is square. */
  size?: number
  className?: string
  /** Turns off the LED glow filter, which is wasted below about 32px. */
  flat?: boolean
}

/**
 * THE MARK: a tuning fork in a ring.
 *
 * This is the site's identity and the thing in the favicon. It was the
 * original mark, it was replaced during the redesign by a pedal enclosure
 * containing a guitar, and it was put back because it was simply better.
 *
 * Worth writing down WHY, because the enclosure mark was the more elaborate
 * drawing and elaborate is easy to mistake for better:
 *
 *   IT SURVIVES 16 PIXELS. Two tines, a stem and a ring. The enclosure mark
 *   had a guitar inside a box inside a border, and at favicon size all three
 *   collapsed into a smudge with a green dot on it.
 *
 *   IT COVERS THE WHOLE CATALOGUE. A tuning fork means pitch, and pitch is
 *   every instrument here. A guitar in a stompbox means guitar pedals, which
 *   is one shelf of a shop that also sells drums, mics, keys and PA.
 *
 *   IT IS NOT A PICTURE OF THE PRODUCT. Marks that draw the product date
 *   badly and compete with the photography they sit next to.
 *
 * The pedal-enclosure drawing is kept below as `GearAvailEnclosureMark`. It is
 * genuinely good at large sizes and belongs to the builder rather than to the
 * brand.
 */
export function GearAvailMark({ size = 40, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Gear Avail"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="var(--brand-gold, #ffc233)"
        strokeWidth="1.6"
        opacity="0.55"
      />
      {/* Two tines rising from a stem through the centre. */}
      <path
        d="M11.5 9v7.5a4.5 4.5 0 0 0 9 0V9"
        stroke="var(--brand-gold, #ffc233)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M16 21v5.5"
        stroke="var(--brand-gold, #ffc233)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="1.4" fill="var(--brand-gold, #ffc233)" />
    </svg>
  )
}

/**
 * The pedal enclosure with a guitar on its face.
 *
 * No longer the brand mark (see `GearAvailMark`), kept because it is the right
 * illustration for the board builder, where the subject genuinely is a
 * stompbox and there is room to render it at a size that reads.
 */
export function GearAvailEnclosureMark({ size = 40, className, flat = false }: MarkProps) {
  const glowId = "ga-led-glow"
  const faceId = "ga-face"

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Gear Avail"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* A brushed-metal face: light catches the top edge the way it does on
            an anodised enclosure sitting under a stage light. */}
        <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--metal-hi, #3a3f45)" />
          <stop offset="52%" stopColor="var(--metal, #23272b)" />
          <stop offset="100%" stopColor="var(--metal-lo, #16191c)" />
        </linearGradient>
        {!flat && (
          <filter id={glowId} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* The enclosure. A portrait rounded rectangle, because that is the
          shape of every die-cast box a guitarist has ever stood on, and it is
          what makes the mark read as a pedal rather than as a badge. An
          earlier draft chamfered this into an octagon and it read as a road
          sign, which is the failure mode of clever geometry in a 20px tab. */}
      <rect
        x="19"
        y="3"
        width="62"
        height="94"
        rx="10"
        fill={`url(#${faceId})`}
        stroke="var(--brand-gold, #ffc233)"
        strokeWidth="4"
      />
      {/* The silkscreen line pedals print inside the edge. It is what makes the
          face read as printed rather than as empty. */}
      <rect
        x="24.5"
        y="8.5"
        width="51"
        height="83"
        rx="6.5"
        fill="none"
        stroke="var(--brand-gold, #ffc233)"
        strokeOpacity="0.28"
        strokeWidth="1.4"
      />

      {/* Status LED, above the guitar the way it sits above a footswitch.
          Always lit: a shop that is open says so. */}
      <circle
        cx="50"
        cy="13.2"
        r="3.2"
        fill="var(--brand-led, #24e07a)"
        filter={flat ? undefined : `url(#${glowId})`}
      />

      <g fill="var(--brand-gold, #ffc233)">
        {/* Headstock, tapering slightly wider at the tip. */}
        <path d="M44.4 20 H55.6 L56.6 30 H43.4 Z" />
        {/* Tuners. Gone at favicon scale, and the reason it holds up big. */}
        <circle cx="46.3" cy="22.6" r="0.95" fillOpacity="0.5" />
        <circle cx="46.3" cy="26" r="0.95" fillOpacity="0.5" />
        <circle cx="53.7" cy="22.6" r="0.95" fillOpacity="0.5" />
        <circle cx="53.7" cy="26" r="0.95" fillOpacity="0.5" />
        {/* Neck. */}
        <rect x="46.9" y="29.5" width="6.2" height="24" />
        {/*
          A single-cutaway body. The shoulders sit HIGH and the cutaway is a
          shallow scoop rather than a deep V, which is the entire difference
          between a guitar and a cat: an earlier draft cut two deep notches
          either side of the neck and produced, unmistakably, a pair of ears.
        */}
        <path
          d="M50 92 C67 92 79 82.5 79 68.5 C79 57 74 50.5 66.5 49
             C61 48 55.5 50 52.5 52.8 L47.5 52.8
             C44 50 39 48 34 49 C28.5 50.2 25 54 24 59
             C23.2 63 21.5 65.5 21.5 70 C21.5 83 33 92 50 92 Z"
        />
      </g>
      {/* Pickup and control knob, punched back out of the body so the
          silhouette has something to give at large sizes. Kept off the
          centreline: symmetrical bars either side of a face read as whiskers. */}
      <g fill="var(--metal, #23272b)">
        <rect x="41" y="62" width="18" height="4" rx="1.2" />
        <circle cx="63" cy="75" r="2.4" />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  Wordmark                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Letterforms as stroked polylines on a 100-unit cap height.
 *
 * Stroke rather than outline halves the coordinate count and makes the weight a
 * single number to tune. Every corner is chamfered on the same 10-unit break so
 * the alphabet is internally consistent, which is the whole difference between
 * "custom" and "hand-drawn".
 *
 * The centreline is inset 10 units from the glyph box on every side, which is
 * half the stroke width, so the painted edge lands exactly on the box.
 */
const GLYPHS: Record<string, { d: string; advance: number }> = {
  G: {
    advance: 70,
    d: "M60 30 V20 L50 10 H20 L10 20 V80 L20 90 H50 L60 80 V55 H38",
  },
  E: { advance: 66, d: "M60 10 H10 V90 H60 M10 50 H48" },
  A: { advance: 70, d: "M10 90 V25 L25 10 H45 L60 25 V90 M10 56 H60" },
  R: { advance: 70, d: "M10 90 V10 H48 L60 22 V40 L48 52 H10 M40 52 L60 90" },
  V: { advance: 70, d: "M10 10 V60 L35 90 L60 60 V10" },
  I: { advance: 24, d: "M12 10 V90" },
  L: { advance: 62, d: "M10 10 V90 H60" },
}

const WORD_GAP = 46
const LETTER_GAP = 20

function layout(text: string): { glyphs: { d: string; x: number }[]; width: number } {
  const glyphs: { d: string; x: number }[] = []
  let x = 0
  for (const char of text) {
    if (char === " ") {
      x += WORD_GAP
      continue
    }
    const glyph = GLYPHS[char]
    if (!glyph) continue
    glyphs.push({ d: glyph.d, x })
    x += glyph.advance + LETTER_GAP
  }
  return { glyphs, width: Math.max(0, x - LETTER_GAP) }
}

const LOCKUP = layout("GEAR AVAIL")

export function GearAvailWordmark({
  height = 18,
  className,
  color = "var(--text)",
}: {
  height?: number
  className?: string
  color?: string
}) {
  const stroke = 20
  const pad = stroke / 2
  const vbWidth = LOCKUP.width + stroke
  const vbHeight = 100 + stroke

  return (
    <svg
      width={(height * vbWidth) / vbHeight}
      height={height}
      viewBox={`${-pad} ${-pad} ${vbWidth} ${vbHeight}`}
      className={className}
      role="img"
      aria-label="Gear Avail"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeMiterlimit={8}
      >
        {LOCKUP.glyphs.map((glyph, i) => (
          <path key={i} d={glyph.d} transform={`translate(${glyph.x} 0)`} />
        ))}
      </g>
    </svg>
  )
}

/**
 * The full lockup: mark, wordmark, and the descriptor rule under it.
 *
 * The rule is not decoration. It is the same hairline as the silkscreen inside
 * the enclosure, which is what visually binds a square mark to a wide wordmark
 * without resorting to a box around the whole thing.
 */
export function GearAvailLogo({
  size = 38,
  className,
  showTagline = true,
}: {
  size?: number
  className?: string
  showTagline?: boolean
}) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <GearAvailMark size={size} />
      <span style={{ display: "block", lineHeight: 1 }}>
        <GearAvailWordmark height={size * 0.42} />
        {showTagline && (
          <span
            style={{ display: "block", marginTop: size * 0.13 }}
            className="border-t border-[color:color-mix(in_srgb,var(--brand-gold)_38%,transparent)] pt-[3px] font-sans text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[var(--dim)]"
          >
            Used &middot; Vintage &middot; New
          </span>
        )}
      </span>
    </span>
  )
}
