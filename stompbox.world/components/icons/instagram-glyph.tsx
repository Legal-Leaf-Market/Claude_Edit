/**
 * The Instagram glyph, drawn rather than pulled from an icon pack, so the one
 * place this site depicts another company's mark is a shape we control and can
 * point at rather than a dependency that might redraw it.
 */
export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}
