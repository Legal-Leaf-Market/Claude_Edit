import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * WHAT THE MERGE COST, AND THE ONLY THING STANDING IN FOR IT.
 *
 * stompbox.world used to be its own Vercel project. It could not reach the
 * database because it had no connection string, could not spend an eBay call
 * because it had no token, and could not read the admin dashboard because it
 * had no passcode. That was not a rule anybody had to keep: it was physics,
 * and stompbox.world/CLAUDE.md section 2a stated it as a flat fact ("No
 * credentials live here").
 *
 * One deployment serves both domains now, so every credential in the process
 * is in reach of every module in it. The boundary went from physical to
 * disciplinary, which is a genuine downgrade and was taken knowingly. THIS
 * FILE IS WHAT WAS PUT IN ITS PLACE, and it is the reason the downgrade is
 * survivable rather than merely accepted.
 *
 * The rule: nothing in the guide's tree may import ingestion, admin, affiliate,
 * queue, auth or mail code. There is exactly ONE sanctioned crossing, and it is
 * `lib/stompbox/catalog.ts` reading the pedal shelf through `liveModels()`,
 * which is the aggregator's own published projection and drops every field
 * partner terms restrict (see that file, and the projection test beside this
 * one).
 *
 * WHY A FILE WALK RATHER THAN A LINT RULE. This is the same instinct as
 * `tests/impact-merchants.test.ts` asserting the word "commission" never
 * appears in the merchant registry: the failure it prevents is silent. An
 * import of `lib/ingestion` from a guide page throws nothing, breaks no test,
 * and renders fine. It just quietly puts the ingestion path, and whatever
 * credential it reads, on a domain whose entire claim is that it has nothing
 * riding on its opinion.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

/**
 * The guide's tree, plus the SHARED board tree.
 *
 * `lib/board` and `components/board` are new and are not the guide's, but the
 * guide mounts them: /stompbox/board renders the same builder /pedalboard does.
 * That reopens the hole from the side this walk was not watching, because the
 * check is on DIRECT imports: a shared component that pulled in `lib/db` would
 * put the database one hop from the standalone domain and nothing here would
 * notice.
 *
 * So the shared tree obeys the same rule, which is also what forces its design:
 * commerce reaches the builder as a PROP passed by whichever page rendered it,
 * never as something the builder fetches. The aggregator's page hands it prices
 * and buy links; the guide's page hands it none.
 */
const GUIDE_DIRS = [
  "app/stompbox",
  "components/stompbox",
  "lib/stompbox",
  "lib/board",
  "components/board",
]

/**
 * Import prefixes the guide must never reach for, and what each one would drag
 * in if it did.
 */
const FORBIDDEN: [string, string][] = [
  ["@/lib/ingestion", "feed readers, and the FTP and API credentials they carry"],
  ["@/lib/admin", "the operating-model projection, behind ADMIN_PASSCODE"],
  ["@/lib/affiliate", "outbound link building and the tracking-host allowlist"],
  ["@/lib/queue", "BullMQ, and the Redis connection string"],
  ["@/lib/auth", "Better Auth, and therefore the user table"],
  ["@/lib/email", "the subscriber list and the Resend key"],
  ["@/lib/cart", "a checkout path, on a domain with nothing to sell"],
  ["@/lib/db", "a raw database handle, in place of the one sanctioned projection"],
]

/**
 * The one sanctioned crossing.
 *
 * Named as a single file rather than as a prefix, so widening the boundary is
 * an edit to this line with this comment attached rather than something that
 * happens by adding a file to a directory.
 */
const SANCTIONED = "lib/stompbox/catalog.ts"

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

const FILES = GUIDE_DIRS.flatMap((dir) => walk(join(ROOT, dir)))

/** Import specifiers only. A path named inside a comment is prose, not a reach. */
function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])
}

describe("the guide cannot reach the aggregator's credentials", () => {
  it("finds the guide's files, so a broken walk cannot pass silently", () => {
    expect(FILES.length).toBeGreaterThan(18)
  })

  it("imports nothing from the ingestion, admin, auth or affiliate trees", () => {
    const offenders: string[] = []

    for (const file of FILES) {
      const relative = file.slice(ROOT.length)
      if (relative === SANCTIONED) continue

      for (const specifier of importsOf(readFileSync(file, "utf-8"))) {
        for (const [prefix, drags] of FORBIDDEN) {
          if (specifier === prefix || specifier.startsWith(`${prefix}/`)) {
            offenders.push(`${relative} imports ${specifier} (${drags})`)
          }
        }
      }
    }

    expect(
      offenders,
      "The guide's tree must not reach these. If a page genuinely needs data " +
        "from the aggregator, project it through lib/stompbox/catalog.ts the " +
        "way the pedal shelf is, rather than widening this list:\n" +
        offenders.join("\n"),
    ).toHaveLength(0)
  })

  it("keeps the one sanctioned crossing narrow", () => {
    // It may read the catalogue projection and nothing else. `liveModels()` is
    // a read-only query over canonical_gear and active listings; anything
    // reaching past it (a raw db handle, an ingestion job) is the crossing
    // widening rather than being used.
    const source = readFileSync(join(ROOT, SANCTIONED), "utf-8")
    const crossings = importsOf(source).filter((s) => s.startsWith("@/lib/") && !s.startsWith("@/lib/stompbox/"))

    expect(crossings.sort()).toEqual([
      "@/lib/catalog/live-models",
      "@/lib/categories",
      "@/lib/deals/pricing",
      "@/lib/pedalboard/chain",
    ])
  })
})
