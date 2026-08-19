/**
 * WHICH SITE IS THIS REQUEST FOR.
 *
 * One Next app now serves two domains, and every difference between them is
 * decided here rather than guessed at each call site.
 *
 *   gearavail.com/stompbox/pedals   the guide as a section of the aggregator
 *   stompbox.world/pedals           the same page, standing alone
 *
 * ONE COPY OF EVERY PAGE, TWO URLS. `middleware.ts` rewrites the stompbox
 * host's `/:path*` onto `/stompbox/:path*`, so both hosts land on the same
 * route files and the only thing that varies is the chrome around them, the
 * canonical tag, and the prefix internal links need.
 *
 * WHY A HOST LIST RATHER THAN "ANYTHING THAT IS NOT GEAR AVAIL". Preview
 * deployments, `localhost`, and Vercel's own `*.vercel.app` domains all have
 * to resolve to SOMETHING, and defaulting them to the standalone site would
 * hide the embedded one from every environment except production. Gear Avail
 * is the default and the guide is the special case, which is also the honest
 * description of the two: the aggregator is the app, the guide is a section of
 * it that happens to own a domain.
 */

/**
 * Hosts that serve the standalone guide. Ports are stripped before comparison,
 * so `stompbox.world:3000` in local development matches.
 *
 * `NEXT_PUBLIC_STOMPBOX_HOST` adds one more, for previewing the standalone
 * shape on a Vercel preview URL without editing this list.
 */
const STOMPBOX_HOSTS = new Set(
  ["stompbox.world", "www.stompbox.world", process.env.NEXT_PUBLIC_STOMPBOX_HOST]
    .filter((host): host is string => Boolean(host?.trim()))
    .map((host) => host.trim().toLowerCase()),
)

/** The path prefix the guide lives at inside the app, on every host. */
export const STOMPBOX_PREFIX = "/stompbox"

/**
 * Is this Host header the standalone guide?
 *
 * Case and port are normalised because neither is meaningful in a hostname and
 * both really do arrive: browsers send the port in development, and a `Host`
 * of `Stompbox.World` is legal.
 */
export function isStompboxHost(host: string | null | undefined): boolean {
  if (!host) return false
  const bare = host.trim().toLowerCase().split(":")[0]
  return STOMPBOX_HOSTS.has(bare)
}

/**
 * What to put in front of an internal guide link, given the host.
 *
 * Empty on the standalone domain (`/pedals`) and `/stompbox` on Gear Avail
 * (`/stompbox/pedals`). Threaded through as a value rather than read from
 * global state at each call site so client components can take it as a prop
 * and stay renderable in a test without a request.
 */
export function stompboxBase(host: string | null | undefined): string {
  return isStompboxHost(host) ? "" : STOMPBOX_PREFIX
}

/**
 * An internal guide link, prefixed for whichever host is being served.
 *
 * `sbHref("", "/pedals")` is `/pedals`; `sbHref("/stompbox", "/pedals")` is
 * `/stompbox/pedals`. The root is special-cased: `${base}/` would render as
 * `/stompbox/`, and a trailing slash on a route Next serves without one is a
 * redirect on every logo click.
 */
export function sbHref(base: string, path: string): string {
  if (path === "/") return base || "/"
  return `${base}${path}`
}
