/**
 * Instagram glyph, inline.
 *
 * NOT from lucide-react: brand and logo icons were removed from the icon set
 * (importing `Instagram` from lucide-react is a build error, not a missing
 * type), and a third-party icon package can drop a brand mark again on any
 * minor bump. Fifteen lines of SVG has no such failure mode.
 */
export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
