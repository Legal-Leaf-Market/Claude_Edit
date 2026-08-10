import { CategoryIcon, CATEGORY_HUE } from "./category-icon"

/**
 * The decorative backdrop behind a category page's headline.
 *
 * Each category gets its own abstract line-art motif, not just its own
 * colour: soundhole rings for acoustics, a PCB trace for pedals, cardioid
 * lobes for microphones, and so on. The intent (the user's own framing) is
 * that every category page should read like a different track on the same
 * album, recognisably one artist but with its own mood, rather than one
 * template re-skinned fifteen times with a colour swap.
 *
 * Purely decorative: aria-hidden, and rendered at low opacity behind a solid
 * text layer so it never fights legibility or gets read by a screen reader.
 */
function Motif({ slug, className }: { slug: string; className?: string }) {
  const common = {
    viewBox: "0 0 800 240",
    preserveAspectRatio: "xMidYMid slice" as const,
    className,
    "aria-hidden": true as const,
    fill: "none",
    stroke: "currentColor",
  }

  switch (slug) {
    // Jagged, feedback-and-distortion energy: sharp streaks fanning from one corner.
    case "electric-guitars":
      return (
        <svg {...common}>
          <g strokeWidth="2.5" strokeLinecap="round">
            <path d="M40 220 130 90 160 150 230 40" opacity="0.9" />
            <path d="M90 230 190 130 210 175 300 70" opacity="0.6" />
            <path d="M150 235 260 160 275 195 360 100" opacity="0.4" />
          </g>
          <circle cx="130" cy="90" r="70" fill="currentColor" opacity="0.06" stroke="none" />
        </svg>
      )
    // Warm, soft: soundhole rings and fine diagonal grain.
    case "acoustic-guitars":
      return (
        <svg {...common}>
          <g opacity="0.55" strokeWidth="1.6">
            <circle cx="640" cy="120" r="26" />
            <circle cx="640" cy="120" r="46" />
            <circle cx="640" cy="120" r="68" />
          </g>
          <g opacity="0.25" strokeWidth="1">
            {Array.from({ length: 10 }).map((_, i) => (
              <path key={i} d={`M${480 + i * 24} 240 L${560 + i * 24} 0`} />
            ))}
          </g>
        </svg>
      )
    // Slow, heavy: one thick low sine wave, room-filling.
    case "bass-guitars":
      return (
        <svg {...common}>
          <path
            d="M0 170 Q 100 100 200 170 T 400 170 T 600 170 T 800 170"
            strokeWidth="10"
            opacity="0.35"
          />
          <path
            d="M0 200 Q 100 150 200 200 T 400 200 T 600 200 T 800 200"
            strokeWidth="5"
            opacity="0.2"
          />
        </svg>
      )
    // Amp stack: grille-cloth dot grid inside stacked cabinet outlines.
    case "amplifiers":
      return (
        <svg {...common}>
          <g strokeWidth="2" opacity="0.5">
            <rect x="520" y="40" width="220" height="90" rx="6" />
            <rect x="520" y="140" width="220" height="90" rx="6" />
          </g>
          <g fill="currentColor" stroke="none" opacity="0.3">
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 8 }).map((__, col) => (
                <circle key={`${row}-${col}`} cx={540 + col * 26} cy={62 + row * 15} r="2" />
              )),
            )}
          </g>
        </svg>
      )
    // Precise, electronic: right-angle PCB traces with via-dots.
    case "effects-pedals":
      return (
        <svg {...common}>
          <g strokeWidth="2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 40 H180 V90 H280 V50 H400" />
            <path d="M60 130 H150 V190 H260" />
            <path d="M320 200 H420 V120 H520" />
          </g>
          <g fill="currentColor" stroke="none" opacity="0.5">
            <circle cx="180" cy="40" r="3.5" />
            <circle cx="280" cy="90" r="3.5" />
            <circle cx="150" cy="130" r="3.5" />
            <circle cx="150" cy="190" r="3.5" />
            <circle cx="420" cy="200" r="3.5" />
            <circle cx="420" cy="120" r="3.5" />
          </g>
        </svg>
      )
    // Digital, playful: a step-sequencer bar row.
    case "synthesizers":
      return (
        <svg {...common}>
          <g fill="currentColor" stroke="none" opacity="0.4">
            {[30, 70, 45, 90, 55, 20, 80, 35, 65, 25, 95, 40].map((h, i) => (
              <rect key={i} x={440 + i * 30} y={200 - h} width="14" height={h} rx="2" />
            ))}
          </g>
        </svg>
      )
    // Piano-key stripes: tall thin keys with shorter, denser keys layered over them.
    case "keyboards-and-pianos":
      return (
        <svg {...common}>
          <g fill="currentColor" stroke="none" opacity="0.22">
            {Array.from({ length: 16 }).map((_, i) => (
              <rect key={i} x={20 + i * 24} y="20" width="18" height="200" rx="2" />
            ))}
          </g>
          <g fill="currentColor" stroke="none" opacity="0.5">
            {[1, 2, 4, 5, 6, 8, 9, 11, 12, 13, 15].map((i) => (
              <rect key={i} x={20 + i * 24 + 4} y="20" width="10" height="120" rx="2" />
            ))}
          </g>
        </svg>
      )
    // Drum skin: concentric rings with rim-shot tick marks.
    case "drums-and-percussion":
      return (
        <svg {...common}>
          <g opacity="0.45" strokeWidth="1.8">
            <circle cx="660" cy="120" r="30" />
            <circle cx="660" cy="120" r="55" />
            <circle cx="660" cy="120" r="82" />
          </g>
          <g opacity="0.35" strokeWidth="2" strokeLinecap="round">
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * Math.PI * 2
              const r1 = 88
              const r2 = 100
              return (
                <line
                  key={i}
                  x1={660 + Math.cos(a) * r1}
                  y1={120 + Math.sin(a) * r1}
                  x2={660 + Math.cos(a) * r2}
                  y2={120 + Math.sin(a) * r2}
                />
              )
            })}
          </g>
        </svg>
      )
    // Cardioid polar-pattern lobes, as on a mic spec sheet.
    case "microphones":
      return (
        <svg {...common}>
          <g opacity="0.4" strokeWidth="1.8">
            <path d="M580 120 C 580 60, 700 60, 700 120 C 700 170, 620 180, 580 120 Z" />
            <path d="M560 120 C 560 40, 720 40, 720 120 C 720 190, 600 205, 560 120 Z" opacity="0.6" />
          </g>
        </svg>
      )
    // Multi-track waveform: layered bar clusters, some ghosted.
    case "recording-and-audio":
      return (
        <svg {...common}>
          {[0, 1, 2].map((track) => (
            <g key={track} fill="currentColor" stroke="none" opacity={0.45 - track * 0.13}>
              {Array.from({ length: 24 }).map((_, i) => {
                const seed = (i * 13 + track * 7) % 11
                const h = 10 + seed * 8
                return (
                  <rect
                    key={i}
                    x={40 + i * 20}
                    y={120 - h / 2 + track * 4}
                    width="8"
                    height={h}
                    rx="2"
                  />
                )
              })}
            </g>
          ))}
        </svg>
      )
    // Vinyl groove rings with a spindle and strobe ticks.
    case "dj-equipment":
      return (
        <svg {...common}>
          <g opacity="0.4" strokeWidth="1.2">
            {[24, 40, 56, 72, 88].map((r) => (
              <circle key={r} cx="640" cy="120" r={r} />
            ))}
          </g>
          <circle cx="640" cy="120" r="4" fill="currentColor" stroke="none" opacity="0.6" />
          <g opacity="0.3" strokeWidth="2" strokeLinecap="round">
            {Array.from({ length: 20 }).map((_, i) => {
              const a = (i / 20) * Math.PI * 2
              const r1 = 95
              const r2 = 103
              return (
                <line
                  key={i}
                  x1={640 + Math.cos(a) * r1}
                  y1={120 + Math.sin(a) * r1}
                  x2={640 + Math.cos(a) * r2}
                  y2={120 + Math.sin(a) * r2}
                />
              )
            })}
          </g>
        </svg>
      )
    // Elegant bow-stroke arcs, sweeping and layered.
    case "orchestral-strings":
      return (
        <svg {...common}>
          <g strokeWidth="1.8" opacity="0.5" strokeLinecap="round">
            <path d="M420 200 Q 550 40 720 130" />
            <path d="M400 220 Q 540 90 760 170" opacity="0.7" />
            <path d="M440 180 Q 560 60 680 100" opacity="0.4" />
          </g>
        </svg>
      )
    // Horn-bell arcs radiating outward, with tone-hole dots.
    case "brass-and-woodwind":
      return (
        <svg {...common}>
          <g strokeWidth="1.8" opacity="0.45">
            {[30, 55, 80, 105].map((r) => (
              <path key={r} d={`M${700 - r} 120 A ${r} ${r} 0 0 1 700 ${120 - r}`} />
            ))}
          </g>
          <g fill="currentColor" stroke="none" opacity="0.4">
            <circle cx="500" cy="150" r="4" />
            <circle cx="530" cy="165" r="4" />
            <circle cx="560" cy="150" r="4" />
          </g>
        </svg>
      )
    // Rustic basket-weave crosshatch.
    case "folk-and-traditional":
      return (
        <svg {...common}>
          <g strokeWidth="2" opacity="0.35">
            {Array.from({ length: 9 }).map((_, i) => (
              <path key={`d-${i}`} d={`M${40 + i * 40} 0 L${40 + i * 40 - 240} 240`} />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <path key={`u-${i}`} d={`M${40 + i * 40} 240 L${40 + i * 40 - 240} 0`} />
            ))}
          </g>
        </svg>
      )
    // Workshop pegboard: scattered small hardware silhouettes on a loose grid.
    case "parts-and-accessories":
      return (
        <svg {...common}>
          <g fill="currentColor" stroke="none" opacity="0.35">
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 12 }).map((__, col) => {
                if ((row + col * 2) % 3 === 0) return null
                return <circle key={`${row}-${col}`} cx={20 + col * 32} cy={20 + row * 34} r="2.5" />
              }),
            )}
          </g>
          <g strokeWidth="1.6" opacity="0.4" strokeLinecap="round">
            <path d="M600 60 v20 M590 70 h20" />
            <path d="M700 150 v20 M690 160 h20" />
            <path d="M650 90 v20 M640 100 h20" />
          </g>
        </svg>
      )
    default:
      return null
  }
}

export function CategoryHero({
  slug,
  eyebrow,
  title,
  kicker,
}: {
  slug: string
  eyebrow: string
  title: string
  kicker?: string
}) {
  /*
   * Falls back to the site accent rather than the old hardcoded #f0a830,
   * which was the pre-house amber and would now be the one colour on the page
   * belonging to no palette at all.
   */
  const hue = CATEGORY_HUE[slug] ?? "var(--copper)"

  return (
    <div
      className="panel relative mb-8 overflow-hidden px-5 py-7 sm:px-8 sm:py-9"
      style={{
        /* `--hero-hue` is the same variable the homepage hero reads, so a
           category page tints its own headline and wash by setting one value
           instead of restyling. color-mix rather than an appended hex alpha,
           because the fallback is now a var() and `var(--copper)14` is not a
           colour. */
        ["--hero-hue" as string]: hue,
        background: `radial-gradient(ellipse at 75% 30%, color-mix(in srgb, ${hue} 8%, transparent), var(--card) 65%)`,
        color: hue,
      }}
    >
      <Motif slug={slug} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative z-10 max-w-2xl">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${hue} 13%, transparent)`, color: hue }}
          >
            <CategoryIcon slug={slug} className="h-6 w-6" />
          </span>
          <span className="eyebrow">{eyebrow}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--cream)] sm:text-4xl">
          {title}
        </h1>
        {kicker && (
          <p className="mt-2 text-base italic leading-relaxed text-[var(--muted-foreground)]">
            {kicker}
          </p>
        )}
      </div>
    </div>
  )
}
