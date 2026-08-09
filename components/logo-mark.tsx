export function LogoMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-[54px] w-[54px] rounded-[18px]" : "h-8 w-8 rounded-[11px]"
  const leaf = size === "lg" ? "h-8 w-8" : "h-5 w-5"
  return (
    <span
      className={`relative inline-flex items-center justify-center ${dim} border border-gold/70 shadow-[0_0_34px_rgba(50,215,75,0.30),0_10px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]`}
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #0f5132 0, #0b2138 55%, #071423 100%)",
      }}
      aria-hidden="true"
    >
      <CannabisLeaf className={`${leaf} relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]`} />
    </span>
  )
}

export function CannabisLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="llm-leaf" x1="50" y1="10" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8ef06b" />
          <stop offset="0.55" stopColor="#32d74b" />
          <stop offset="1" stopColor="#0f5132" />
        </linearGradient>
      </defs>
      <g
        fill="url(#llm-leaf)"
        stroke="#0b2a1c"
        strokeWidth="0.75"
        strokeLinejoin="round"
      >
        <path d="M50,90 Q60,51 50,12 Q40,51 50,90 Z" />
        <path d="M50,90 Q75.4,67.4 86.9,35.3 Q61.4,57.9 50,90 Z" />
        <path d="M50,90 Q24.6,67.4 13.1,35.3 Q38.6,57.9 50,90 Z" />
        <path d="M50,90 Q75.7,86.2 95.7,69.6 Q70.0,73.4 50,90 Z" />
        <path d="M50,90 Q24.3,86.2 4.3,69.6 Q30.0,73.4 50,90 Z" />
        <path d="M50,90 Q65.3,97.2 81.8,93.4 Q66.5,86.2 50,90 Z" />
        <path d="M50,90 Q34.7,97.2 18.2,93.4 Q33.5,86.2 50,90 Z" />
      </g>
      <rect x="48.6" y="86" width="2.8" height="11" rx="1.4" fill="#0f5132" />
    </svg>
  )
}
