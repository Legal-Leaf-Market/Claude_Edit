/**
 * The Gear Avail mark: a tuning fork inside a ring, reused at every size so
 * it stays legible down to a favicon.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      {/* Tuning fork: two tines rising from a stem through the clock centre. */}
      <path
        d="M11.5 9v7.5a4.5 4.5 0 0 0 9 0V9"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M16 21v5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  )
}
