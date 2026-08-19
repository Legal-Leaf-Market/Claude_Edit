import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SITE_NAME } from "@/lib/stompbox/site"

/**
 * The site name belongs in exactly one place: the title template in
 * `app/layout.tsx`.
 *
 * That template is `"%s | stompbox.world"`, so a page that also names the site
 * in its own title gets it printed twice. This is not hypothetical: /catalog
 * shipped to production reading
 * "Pedal catalogue | stompbox.world | stompbox.world",
 * and it was invisible in review because the title tag is the one piece of a
 * page nobody looks at while looking at the page.
 *
 * A source scan rather than a render check, because the failure is in what the
 * page declares, not in how it draws, and the sister tests already establish
 * that reading the tree is how this project pins its conventions.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const APP = join(ROOT, "app", "stompbox")

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

/** Every route file, minus the layout, which is where the template lives. */
const PAGES = walk(APP).filter((file) => !file.endsWith("layout.tsx"))

describe("page metadata", () => {
  it("finds route files, so a broken walk cannot pass silently", () => {
    expect(PAGES.length).toBeGreaterThan(3)
  })

  it("never repeats the site name in a page title", () => {
    const offenders: string[] = []

    for (const file of PAGES) {
      const lines = readFileSync(file, "utf8").split("\n")
      lines.forEach((line, index) => {
        const isTitle = /^\s*title:/.test(line)
        if (!isTitle) return
        if (line.includes("SITE_NAME") || line.includes(SITE_NAME)) {
          offenders.push(`${file.slice(ROOT.length)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(
      offenders,
      `The layout template already appends "| ${SITE_NAME}". Pass a bare title:\n${offenders.join("\n")}`,
    ).toHaveLength(0)
  })
})
