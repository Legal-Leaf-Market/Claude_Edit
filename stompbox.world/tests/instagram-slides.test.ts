import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { POSTS, SLIDE_COUNT } from "../docs/instagram/design/slides.mjs"

/**
 * docs/instagram/posts.md and docs/instagram/design/slides.mjs describe the
 * same 24 posts: the first is the human-facing queue with captions and alt
 * text, the second is the data the slide images are built from. That is a
 * duplication, so it is a place two files drift apart, and the drift is silent:
 * a post gets a fifth slide in the plan and the renderer keeps emitting four.
 *
 * Same instinct as the sister project's condition classifier existing in three
 * places with a test pinning them together. The rule is not "do not duplicate",
 * it is "if you must, make a test say so".
 */

const DOCS = fileURLToPath(new URL("../docs/instagram/posts.md", import.meta.url))
const md = readFileSync(DOCS, "utf8")

/** Every `## 01. Title` heading in the queue. */
function headings() {
  return [...md.matchAll(/^## (\d{2})\. (.+)$/gm)].map((m) => ({ id: m[1], title: m[2].trim() }))
}

/**
 * The declared slide count per post, read off the Format line.
 *
 * "single image" counts as one, which is the whole reason this is a function
 * rather than a regular expression for a number.
 */
function declaredCounts() {
  const out = new Map<string, number>()
  const sections = md.split(/^## /m).slice(1)
  for (const section of sections) {
    const id = section.slice(0, 2)
    const format = section.match(/\*\*Format:\*\* (.+)$/m)?.[1] ?? ""
    const carousel = format.match(/(\d+) slides?/)
    out.set(id, carousel ? Number(carousel[1]) : /single/.test(format) ? 1 : 0)
  }
  return out
}

describe("the Instagram queue and the slide data agree", () => {
  it("finds the posts in the markdown, so a broken parse cannot pass silently", () => {
    expect(headings().length).toBe(24)
    expect(POSTS.length).toBe(24)
  })

  it("describes the same set of post ids in both files", () => {
    const inMarkdown = headings().map((h) => h.id)
    const inData = POSTS.map((p: { id: string }) => p.id)
    expect(inData).toEqual(inMarkdown)
  })

  it("uses the same title for each post in both files", () => {
    const titles = new Map(headings().map((h) => [h.id, h.title]))
    for (const post of POSTS as { id: string; title: string }[]) {
      expect(post.title, `post ${post.id}`).toBe(titles.get(post.id))
    }
  })

  it("builds exactly as many slides as each Format line declares", () => {
    const declared = declaredCounts()
    for (const post of POSTS as { id: string; slides: unknown[] }[]) {
      expect(declared.get(post.id), `post ${post.id} has no readable Format line`).toBeGreaterThan(0)
      expect(post.slides.length, `post ${post.id} slide count`).toBe(declared.get(post.id))
    }
  })

  it("counts 85 slides in total, so a silent drop is visible in one number", () => {
    expect(SLIDE_COUNT).toBe(85)
  })
})

describe("every slide carries what its kind needs to render", () => {
  /*
   * build.mjs throws on an unknown kind, but a slide of a KNOWN kind with a
   * missing field renders an empty heading or a blank figure, which is exactly
   * the half-written entry tests/pedals.test.ts exists to prevent on the site.
   */
  const REQUIRED: Record<string, string[]> = {
    mark: ["hook"],
    statement: ["hook"],
    closer: ["hook"],
    mechanism: ["kicker", "body"],
    figure: ["kicker", "fig", "body"],
    compare: ["kicker", "panes"],
    compareChain: ["kicker", "chains"],
    order: ["kicker"],
  }

  it("fills every field the kind renders", () => {
    const missing: string[] = []
    for (const post of POSTS as { id: string; slides: Record<string, unknown>[] }[]) {
      post.slides.forEach((slide, i) => {
        const need = REQUIRED[String(slide.kind)]
        expect(need, `post ${post.id} slide ${i + 1} has unknown kind ${slide.kind}`).toBeDefined()
        for (const field of need ?? []) {
          if (!slide[field]) missing.push(`${post.id}-${i + 1} (${slide.kind}) is missing ${field}`)
        }
      })
    }
    expect(missing, missing.join("\n")).toHaveLength(0)
  })

  it("draws a figure that is real SVG on every figure slide", () => {
    for (const post of POSTS as { id: string; slides: Record<string, unknown>[] }[]) {
      post.slides.forEach((slide, i) => {
        if (slide.kind !== "figure") return
        const out = (slide.fig as () => string)()
        expect(out, `${post.id}-${i + 1}`).toMatch(/^<svg viewBox="0 0 852 \d+"/)
      })
    }
  })
})
