import type { Source } from "@/lib/db/schema"
import { StoreLogo } from "@/components/store-logo"
import { STORE_BY_SOURCE } from "@/lib/stores"

/**
 * A visual mark for a store.
 *
 * Uses the merchant's real logo where the affiliate network supplies one.
 * Those come from GoAffPro's creatives CDN, which distributes them to
 * publishers for this purpose; none is scraped from a merchant's own site.
 *
 * Where no logo exists the store falls back to a monogram in a colour of its
 * own, keyed to the source string so it never changes between pages and
 * adding a store needs no decision. The fallback is also what renders if a
 * logo URL dies, since a broken image must not leave a hole in a grid.
 */

/** Hues chosen to read clearly on #0f0c0a and to stay distinct from each other. */
const PALETTE = [
  { bg: "rgba(240,168,48,0.16)", fg: "#f7c877" }, // amber, the house colour
  { bg: "rgba(125,168,208,0.16)", fg: "#93bde0" }, // cool blue
  { bg: "rgba(198,120,180,0.16)", fg: "#dc9ecd" }, // magenta
  { bg: "rgba(120,196,150,0.16)", fg: "#8fd6ad" }, // green
  { bg: "rgba(226,124,102,0.16)", fg: "#f0a08a" }, // coral
  { bg: "rgba(158,140,224,0.16)", fg: "#b8a6f0" }, // violet
  { bg: "rgba(214,186,92,0.16)", fg: "#e6d18a" }, // brass
]

/** Stable hash so a store keeps its colour across pages and deploys. */
function hueFor(source: string): (typeof PALETTE)[number] {
  let h = 0
  for (let i = 0; i < source.length; i += 1) h = (h * 31 + source.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * Up to two letters. Multi-word names take initials (EART Guitar -> EG),
 * single words take their first two (Squaver -> SQ), which keeps every mark
 * the same visual weight.
 */
function monogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function StoreMark({
  source,
  name,
  size = "md",
}: {
  source: Source | string
  name: string
  size?: "sm" | "md" | "lg"
}) {
  const { bg, fg } = hueFor(source)
  const dims =
    size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs"
  const logoUrl = STORE_BY_SOURCE.get(source as Source)?.logoUrl

  if (logoUrl) {
    return (
      <StoreLogo
        src={logoUrl}
        alt=""
        className={`shrink-0 rounded-lg bg-white/90 object-contain p-0.5 ${dims}`}
        fallback={<Monogram name={name} bg={bg} fg={fg} dims={dims} />}
      />
    )
  }
  return <Monogram name={name} bg={bg} fg={fg} dims={dims} />
}

function Monogram({ name, bg, fg, dims }: { name: string; bg: string; fg: string; dims: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight ${dims}`}
      style={{ background: bg, color: fg }}
    >
      {monogram(name)}
    </span>
  )
}
