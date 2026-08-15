/**
 * The Gear Avail mark and wordmark, drawn rather than typeset.
 *
 * WHY IT IS A PEDAL. The site sells guitar gear, its best page is a pedalboard
 * planner, and the brand it now wears (stompbox.world's, by the owner's call:
 * see CLAUDE.md section 16) is built around one image, a royal blue enclosure
 * printed in white. So the mark is that enclosure with Gear Avail's tuning
 * fork silkscreened on the face, which is where a pedal prints its graphic
 * anyway. Every other surface here then inherits the same vocabulary: buttons
 * are footswitches, icon controls are knobs, the theme switch is a Les Paul
 * toggle.
 *
 * WHY THE FORK MOVED ONTO THE ENCLOSURE. The fork used to stand alone in a
 * ring, and the favicon already carried the enclosure-with-fork at the owner's
 * request, so the header and the tab were two drawings of one identity. The
 * redesign settled it for a mechanical reason: the line art is CHROME (white)
 * now, and white strokes on the light theme's paper are invisible. An
 * enclosure gives the print a metal plate to sit on in both themes, which is
 * the same reason the sister site's mark is a box rather than bare lines.
 *
 * WHY THE FORK AND NOT KNOBS. stompbox.world's face carries controls and a
 * bare footswitch. Two projects in one repository must not put the same
 * picture in two tabs, so this face carries the fork, stem running down into
 * the footswitch ring: one graphic, one weight. A fork means pitch, and pitch
 * is every instrument here, where knobs on a box mean pedals, which is one
 * shelf of a shop that also sells drums, mics, keys and PA.
 *
 * WHY THE LETTERS ARE PATHS AND NOT TEXT. A wordmark set in a webfont is at
 * the mercy of the font loading, of the platform's fallback, and of whoever
 * changes --display next. These are stroked polylines with mitred joins, so
 * they render identically everywhere, need no font, and survive being inlined
 * into an email or a favicon. The forms are deliberately chamfered rather than
 * rounded: it is the geometry of an amp faceplate and a flight case stencil,
 * and it stays legible when the whole lockup is 20px tall in a browser tab.
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
 * THE MARK: the enclosure with the fork on its face.
 *
 * The same drawing as app/icon.svg, resolved through tokens instead of literal
 * hex because this one renders inside the document. Keep the two in step: a
 * header that disagrees with its own tab reads as two brands.
 */
export function GearAvailMark({ size = 40, className, flat = false }: MarkProps) {
  const glowId = "ga-led-glow"
  const faceId = "ga-mark-face"

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
          <stop offset="0%" stopColor="var(--metal-hi, #2c56b0)" />
          <stop offset="52%" stopColor="var(--metal, #183573)" />
          <stop offset="100%" stopColor="var(--metal-lo, #070f24)" />
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
          shape of every die-cast box a guitarist has ever stood on. An earlier
          draft chamfered this into an octagon and it read as a road sign,
          which is the failure mode of clever geometry in a 20px tab. */}
      <rect
        x="18"
        y="2"
        width="64"
        height="96"
        rx="11"
        fill={`url(#${faceId})`}
        stroke="var(--chrome, #ffffff)"
        strokeWidth="4"
      />
      {/* The silkscreen line pedals print inside the edge. It is what makes
          the face read as printed rather than as empty. */}
      <rect
        x="23.5"
        y="7.5"
        width="53"
        height="85"
        rx="7"
        fill="none"
        stroke="var(--chrome, #ffffff)"
        strokeOpacity="0.3"
        strokeWidth="1.4"
      />

      {/* Status LED, always lit: a shop that is open says so. */}
      <circle
        cx="50"
        cy="13.5"
        r="3.2"
        fill="var(--brand-led, #24e07a)"
        filter={flat ? undefined : `url(#${glowId})`}
      />

      {/* The tuning fork, tines up, its stem running into the footswitch. One
          graphic, one weight: a fork and a switch drawn as two separate small
          marks both dissolve at 16px. */}
      <g
        stroke="var(--chrome, #ffffff)"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M37 27v14a13 13 0 0 0 26 0V27" />
        <path d="M50 54v9" />
      </g>
      <circle
        cx="50"
        cy="76"
        r="11"
        fill="var(--metal-lo, #070f24)"
        stroke="var(--chrome, #ffffff)"
        strokeWidth="3"
      />
    </svg>
  )
}

/**
 * The pedal enclosure with a guitar on its face.
 *
 * Not the brand mark (see `GearAvailMark`), kept because it is the right
 * illustration for the board builder, where the subject genuinely is a
 * stompbox and there is room to render it at a size that reads. The guitar is
 * a silkscreen print on the face, which is why it may be chrome-filled where
 * the UI rules say chrome is an edge: a pedal's printed graphic is ink, not
 * interface.
 */
export function GearAvailEnclosureMark({ size = 40, className, flat = false }: MarkProps) {
  const glowId = "ga-enc-led-glow"
  const faceId = "ga-enc-face"

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
          <stop offset="0%" stopColor="var(--metal-hi, #2c56b0)" />
          <stop offset="52%" stopColor="var(--metal, #183573)" />
          <stop offset="100%" stopColor="var(--metal-lo, #070f24)" />
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
          what makes the mark read as a pedal rather than as a badge. */}
      <rect
        x="19"
        y="3"
        width="62"
        height="94"
        rx="10"
        fill={`url(#${faceId})`}
        stroke="var(--chrome, #ffffff)"
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
        stroke="var(--chrome, #ffffff)"
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

      <g fill="var(--chrome, #ffffff)">
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
      <g fill="var(--metal, #183573)">
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
      <GearAvailMark size={size} flat={size < 32} />
      <span style={{ display: "block", lineHeight: 1 }}>
        <GearAvailWordmark height={size * 0.42} />
        {showTagline && (
          <span
            style={{ display: "block", marginTop: size * 0.13 }}
            className="border-t border-[color:color-mix(in_srgb,var(--chrome)_38%,transparent)] pt-[3px] font-sans text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[var(--dim)]"
          >
            Used &middot; Vintage &middot; New
          </span>
        )}
      </span>
    </span>
  )
}
