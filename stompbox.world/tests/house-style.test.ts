import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The house style rule that is easiest to break and hardest to spot in review.
 *
 * NO EM DASHES ANYWHERE. Use a comma, a colon, or parentheses. It is inherited
 * from the sister projects and it applies to copy, to code comments and to
 * anything else that can end up in front of a reader.
 *
 * The character is built from its code point rather than written literally,
 * because a test file containing the thing it forbids would fail on itself and
 * then get an exemption, and an exemption is how a rule like this dies.
 */
const EM_DASH = String.fromCharCode(0x2014)

const ROOT = fileURLToPath(new URL("..", import.meta.url))

/*
 * `docs` is in here because it holds the Instagram copy, which is the most
 * likely place in the repo for an em dash to arrive: captions get drafted
 * somewhere that inserts one automatically and then pasted in. Copy waiting to
 * be published in front of a reader is exactly what this rule is for, so it is
 * checked the same way the pages are rather than trusted.
 */
const SEARCH_DIRS = ["app", "components", "docs", "lib", "tests"]
const EXTENSIONS = [".ts", ".tsx", ".css", ".md", ".mjs"]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

const FILES = SEARCH_DIRS.flatMap((dir) => walk(join(ROOT, dir)))

describe("house style", () => {
  it("finds source files to check, so a broken walk cannot pass silently", () => {
    expect(FILES.length).toBeGreaterThan(10)
  })

  it("uses no em dashes anywhere in the source", () => {
    const offenders: string[] = []

    for (const file of FILES) {
      const lines = readFileSync(file, "utf8").split("\n")
      lines.forEach((line, index) => {
        if (line.includes(EM_DASH)) {
          offenders.push(`${file.slice(ROOT.length)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders, `Use a comma, a colon or parentheses instead:\n${offenders.join("\n")}`)
      .toHaveLength(0)
  })
})
