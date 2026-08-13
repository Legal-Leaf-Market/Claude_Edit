/**
 * The stompbox.world mark and wordmark, drawn rather than typeset.
 *
 * WHY IT IS A PEDAL. The site is about pedals, so the mark is one: a die-cast
 * enclosure with a brass silkscreen edge, a status LED, two knobs and a
 * footswitch. Every other surface then inherits the same vocabulary. Buttons
 * are footswitches, icon controls are knobs, the theme switch is a pickup
 * selector. A logo that explains the rest of the interface is doing more work
 * than a logo that just sits in the corner.
 *
 * WHY THE FACE CARRIES CONTROLS AND NOT AN INSTRUMENT. The obvious move is to
 * print a guitar on the enclosure, and it is the wrong one twice over. A
 * guitar inside a box inside a border is three nested shapes that collapse
 * into a smudge at favicon size, and it narrows the subject to guitar players
 * when a pedal is equally a bass, keys and studio object. Controls are what
 * every stompbox has in common, and a big circle low on the face reads as a
 * footswitch at 16 pixels when nothing else would read at all.
 *
 * WHAT DISAPPEARS AT SMALL SIZES, ON PURPOSE. The knob pointers and the inner
 * footswitch ring are drawn at low opacity. They give the mark something to
 * offer at 200px and they vanish rather than muddy it at 16px, which is the
 * trick that lets one drawing serve both.
 *
 * WHY THE LETTERS ARE PATHS AND NOT TEXT. A wordmark set in a webfont is at
 * the mercy of the font loading, of the platform's fallback, and of whoever
 * changes --display next. These are stroked polylines with mitred joins, so
 * they render identically everywhere, need no font, and survive being inlined
 * into an email or a favicon. The forms are chamfered rather than rounded: it
 * is the geometry of an amp faceplate and a flight-case stencil.
 *
 * COLOUR. Everything resolves through CSS custom properties, so the mark
 * follows the theme instead of shipping a light copy and a dark copy. The LED
 * is the one fixed hue, and it is always on, because that is what an LED on a
 * pedal is for.
 */

type MarkProps = {
  /** Rendered size in pixels. The mark is square. */
  size?: number
  className?: string
  /** Turns off the LED glow filter and the fine detail, wasted below about 32px. */
  flat?: boolean
}

export function StompboxMark({ size = 40, className, flat = false }: MarkProps) {
  const glowId = "sb-led-glow"
  const faceId = "sb-face"

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="stompbox.world"
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

      {/* The enclosure. A portrait rounded rectangle, because that is the shape
          of every die-cast box a guitarist has ever stood on. Chamfering this
          into an octagon reads as a road sign in a 20px tab, which is the
          failure mode of clever geometry at small sizes. */}
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

      {/* Status LED, at the top where it sits on a real enclosure. */}
      <circle
        cx="50"
        cy="15.5"
        r="3.3"
        fill="var(--brand-led, #24e07a)"
        filter={flat ? undefined : `url(#${glowId})`}
      />

      {/* Two knobs. Gone at favicon scale, and the reason it holds up big. */}
      {!flat && (
        <g stroke="var(--brand-gold, #ffc233)" strokeWidth="2">
          <circle cx="37" cy="35" r="7" strokeOpacity="0.85" />
          <path d="M37 30.5 V35" strokeOpacity="0.55" strokeLinecap="round" />
          <circle cx="63" cy="35" r="7" strokeOpacity="0.85" />
          <path d="M63 30.5 V35" strokeOpacity="0.55" strokeLinecap="round" />
        </g>
      )}

      {/* The footswitch. One big circle low on the face: the single element
          that still reads when the whole mark is 16 pixels across. */}
      <circle
        cx="50"
        cy="68"
        r="14"
        fill="var(--metal-lo, #070f24)"
        stroke="var(--brand-gold, #ffc233)"
        strokeWidth="3.4"
      />
      {!flat && (
        <circle
          cx="50"
          cy="68"
          r="7"
          stroke="var(--brand-gold, #ffc233)"
          strokeOpacity="0.4"
          strokeWidth="1.6"
        />
      )}
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
  S: { advance: 66, d: "M60 20 L50 10 H20 L10 20 V40 L20 50 H50 L60 60 V80 L50 90 H20 L10 80" },
  T: { advance: 70, d: "M10 10 H60 M35 10 V90" },
  O: { advance: 70, d: "M20 10 H50 L60 20 V80 L50 90 H20 L10 80 V20 Z" },
  M: { advance: 82, d: "M10 90 V20 L20 10 L41 46 L62 10 L72 20 V90" },
  P: { advance: 66, d: "M10 90 V10 H48 L60 22 V40 L48 52 H10" },
  B: { advance: 66, d: "M10 90 V10 H46 L58 22 V38 L48 48 L60 60 V78 L48 90 H10 M10 48 H48" },
  X: { advance: 70, d: "M10 10 L60 90 M60 10 L10 90" },
}

const LETTER_GAP = 20

function layout(text: string): { glyphs: { d: string; x: number }[]; width: number } {
  const glyphs: { d: string; x: number }[] = []
  let x = 0
  for (const char of text) {
    const glyph = GLYPHS[char]
    if (!glyph) continue
    glyphs.push({ d: glyph.d, x })
    x += glyph.advance + LETTER_GAP
  }
  return { glyphs, width: Math.max(0, x - LETTER_GAP) }
}

const LOCKUP = layout("STOMPBOX")

export function StompboxWordmark({
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
      aria-label="stompbox"
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
 * without resorting to a box around the whole thing. The descriptor carries
 * the ".WORLD" half of the domain, so the lockup reads as the address rather
 * than needing a second wordmark to spell it out.
 */
export function StompboxLogo({
  size = 38,
  className,
  showDescriptor = true,
}: {
  size?: number
  className?: string
  showDescriptor?: boolean
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 11 }}
      aria-label="stompbox.world"
    >
      <StompboxMark size={size} flat={size < 32} />
      <span style={{ display: "block", lineHeight: 1 }}>
        <StompboxWordmark height={size * 0.4} />
        {showDescriptor && (
          <span
            style={{ display: "block", marginTop: size * 0.13 }}
            className="border-t border-[color:color-mix(in_srgb,var(--brand-gold)_38%,transparent)] pt-[3px] text-[0.58rem] font-semibold uppercase tracking-[0.34em] text-[var(--dim)]"
          >
            .World
          </span>
        )}
      </span>
    </span>
  )
}
