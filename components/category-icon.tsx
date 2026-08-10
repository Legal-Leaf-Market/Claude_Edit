/**
 * Category icons, drawn inline.
 *
 * NOT from an icon package, and that is a scar rather than a preference:
 * lucide-react silently dropped its brand icons, and importing one that no
 * longer existed broke every deploy for ten commits before anyone noticed.
 * A dependency cannot remove a path element that lives in this file.
 *
 * These are our own taxonomy (see lib/categories.ts), so unlike merchant or
 * manufacturer marks there is nothing to license and nobody to ask.
 *
 * Each category also carries a hue, which is where most of the site's colour
 * variety now lives. The palette stays adjacent to the amber rather than
 * fighting it: warm through cool, all readable on the near-black ground.
 */

type IconProps = { className?: string }

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

/**
 * Hue used for a category with no entry in CATEGORY_HUE below.
 *
 * Kept as a hex literal rather than `var(--copper)` on purpose: several call
 * sites build a translucent wash by appending a two-digit alpha to this string
 * ("...22"), which is only valid on a hex colour. It must therefore track
 * --copper in app/globals.css by hand. It exists as a constant because the old
 * value (#f0a830, the pre-house amber) was duplicated at four call sites and
 * was left behind by the palette change at every one of them.
 */
export const FALLBACK_HUE = "#d2703a"

/** Slug -> accent. Keyed by slug so a rename is a visible edit, not a silent reshuffle. */
export const CATEGORY_HUE: Record<string, string> = {
  "electric-guitars": "#f0a830",
  "acoustic-guitars": "#e6c98a",
  "bass-guitars": "#d98a5a",
  amplifiers: "#e2795f",
  "effects-pedals": "#c678b4",
  synthesizers: "#9e8ce0",
  "keyboards-and-pianos": "#8fa8d8",
  "drums-and-percussion": "#78c496",
  microphones: "#6fbfae",
  "recording-and-audio": "#7da8d0",
  "dj-equipment": "#b48ad4",
  "orchestral-strings": "#d6ba5c",
  "brass-and-woodwind": "#e0b050",
  "folk-and-traditional": "#c9a06a",
  "parts-and-accessories": "#a89e90",
}

export function CategoryIcon({ slug, className = "h-5 w-5" }: IconProps & { slug: string }) {
  const common = { viewBox: "0 0 24 24", className, "aria-hidden": true as const, ...S }

  switch (slug) {
    case "electric-guitars":
      return (
        <svg {...common}>
          <path d="M14.5 3.5 20.5 9.5" />
          <path d="M17 6 20 3" />
          <path d="M13 5 8.5 9.5" />
          <path d="M19 11 14.5 15.5" />
          <path d="M8.5 9.5c-2 0-4 1-4.7 3.2-.6 1.9.4 3.6 1.6 4.8 1.2 1.2 2.9 2.2 4.8 1.6 2.2-.7 3.2-2.7 3.2-4.7" />
          <circle cx="9.5" cy="14.5" r="1.8" />
        </svg>
      )
    case "acoustic-guitars":
      return (
        <svg {...common}>
          <path d="M15.5 3.5 20.5 8.5" />
          <path d="M14 5 9.5 9.5" />
          <path d="M9.5 9.5c-2.2 0-4.4 1.2-5.1 3.5-.6 2 .5 3.9 1.8 5.2 1.3 1.3 3.2 2.4 5.2 1.8 2.3-.7 3.5-2.9 3.5-5.1" />
          <circle cx="9.8" cy="14.2" r="2" />
          <path d="M12 5.5 15 8.5" />
        </svg>
      )
    case "bass-guitars":
      return (
        <svg {...common}>
          <path d="M15 3 21 9" />
          <path d="M18 4.5 20.5 2" />
          <path d="M13.5 4.5 8 10" />
          <path d="M8 10c-2.3 0-4.6 1.2-5.3 3.6-.6 2.1.5 4 1.9 5.4 1.4 1.4 3.3 2.5 5.4 1.9 2.4-.7 3.6-3 3.6-5.3" />
          <circle cx="9" cy="15" r="2.1" />
        </svg>
      )
    case "amplifiers":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="13" r="3.4" />
          <circle cx="9" cy="13" r="1" />
          <path d="M15 9h3.5M15 12h3.5M15 15h3.5" />
          <path d="M3 8h18" />
        </svg>
      )
    case "effects-pedals":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="9" cy="8" r="1.6" />
          <circle cx="15" cy="8" r="1.6" />
          <rect x="7.5" y="14" width="9" height="4" rx="1.4" />
          <path d="M9 8V6.8M15 8V6.8" />
        </svg>
      )
    case "synthesizers":
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="6" cy="10" r="1.4" />
          <circle cx="10.5" cy="10" r="1.4" />
          <path d="M15 9v2M17 9v2M19 9v2" />
          <path d="M5 14h14" />
          <path d="M8 14v4M12 14v4M16 14v4" />
        </svg>
      )
    case "keyboards-and-pianos":
      return (
        <svg {...common}>
          <rect x="2.5" y="6" width="19" height="12" rx="1.6" />
          <path d="M7 6v7M11 6v7M15 6v7M19 6v7" />
          <path d="M2.5 13h19" />
        </svg>
      )
    case "drums-and-percussion":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="8" rx="8.5" ry="3.4" />
          <path d="M3.5 8v7c0 1.9 3.8 3.4 8.5 3.4s8.5-1.5 8.5-3.4V8" />
          <path d="M6 10.6 4 20M18 10.6 20 20" />
          <path d="M12 11.4V20" />
        </svg>
      )
    case "microphones":
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21" />
          <path d="M8.5 21h7" />
        </svg>
      )
    case "recording-and-audio":
      return (
        <svg {...common}>
          <path d="M3 12v-1M6.5 12V7M10 12V4M13.5 12V6M17 12V8.5M20.5 12v-2" />
          <path d="M3 15h18" />
          <path d="M6.5 18v2M12 18v2M17.5 18v2" />
        </svg>
      )
    case "dj-equipment":
      return (
        <svg {...common}>
          <circle cx="8" cy="12" r="5.5" />
          <circle cx="8" cy="12" r="1.2" />
          <path d="M16 7h5M16 12h5M16 17h5" />
          <path d="M18.5 5.6v2.8M19.5 10.6v2.8M17.5 15.6v2.8" />
        </svg>
      )
    case "orchestral-strings":
      return (
        <svg {...common}>
          <path d="M14.5 2.5 19 7" />
          <path d="M13 4 9 8" />
          <path d="M9 8c-2.4.6-4 2.8-4 5.4 0 3 2.4 6.1 5.4 6.1 2.6 0 4.8-1.9 5.2-4.4" />
          <path d="M15.6 15.1c1.9-.9 3-2.7 2.6-4.6" />
          <path d="M10 11.5 13 14.5" />
        </svg>
      )
    case "brass-and-woodwind":
      return (
        <svg {...common}>
          <path d="M4 15c0-4 2.5-8 6.5-8 2 0 3.5 1 3.5 3" />
          <path d="M14 10c3 0 6 1.6 6 4.5S17 19 14 19c-2.2 0-4-1.2-4-3" />
          <circle cx="8" cy="11.5" r="1" />
          <circle cx="6.2" cy="14" r="1" />
        </svg>
      )
    case "folk-and-traditional":
      return (
        <svg {...common}>
          <path d="M16 3 20.5 7.5" />
          <path d="M14.5 4.5 9 10" />
          <path d="M9 10c-2 .6-3.4 2.6-3.4 5 0 2.9 2.3 5.6 5.2 5.6 2.4 0 4.4-1.6 5-3.7" />
          <path d="M8.2 13.5 11.5 16.8" />
          <circle cx="10.4" cy="15.2" r="1.5" />
        </svg>
      )
    case "parts-and-accessories":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          <path d="M5.6 5.6 7.8 7.8M16.2 16.2l2.2 2.2M18.4 5.6 16.2 7.8M7.8 16.2l-2.2 2.2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9.5h6M9 12h6M9 14.5h4" />
        </svg>
      )
  }
}
