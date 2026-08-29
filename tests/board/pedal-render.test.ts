import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { PEDAL_MODELS } from "@/lib/board/pedal-models"
import { RENDER_DIR, RENDER_EXT, renderForGear, renderPath, renderSlug } from "@/lib/board/pedal-render"

/**
 * THE COMMITTED STILLS, AND THE THREE WAYS THEY GO WRONG SILENTLY.
 *
 * These pictures are produced by an offline script (`npm run render:pedals`)
 * and checked in, which means nothing in the normal build ever looks at them.
 * A model added without a render, a render left behind by a model that was
 * renamed, and two models resolving to one filename all fail exactly the same
 * way: no error anywhere, and a card that shows the wrong pedal or no pedal.
 */

const DIR = path.join(process.cwd(), "public", RENDER_DIR)

describe("every measured model has a picture", () => {
  it("has a file per model", () => {
    const missing = PEDAL_MODELS.filter(
      (model) => !existsSync(path.join(DIR, `${renderSlug(model)}.${RENDER_EXT}`)),
    ).map((model) => `${model.maker} ${model.name} -> ${renderSlug(model)}`)

    expect(
      missing,
      "These models have no committed still, so their cards will ask for a file that is not " +
        "there. Serve the bench and run the renderer:\n" +
        "  npm run build && RENDER_BENCH=1 npx next start -p 3000\n" +
        "  npm run render:pedals",
    ).toEqual([])
  })

  it("has no file without a model", () => {
    /*
     * The other direction, which is the one nobody thinks of. Renaming a model
     * changes its slug, so the old picture stays in `public/` forever: it costs
     * bytes on every clone and, worse, it looks like coverage to anybody
     * scanning the directory for what has been done.
     */
    const known = new Set(PEDAL_MODELS.map((model) => `${renderSlug(model)}.${RENDER_EXT}`))
    const orphans = readdirSync(DIR).filter((file) => !file.startsWith(".") && !known.has(file))

    expect(orphans, "Stills with no model behind them. Delete them.").toEqual([])
  })

  it("gives every model its own filename", () => {
    /*
     * A collision does not fail, it serves one pedal's picture under another
     * pedal's name, which is the same class of error as a loose match pattern
     * and just as invisible. Maker plus name is enough today; this is what
     * says so tomorrow.
     */
    const seen = new Map<string, string>()
    const clashes: string[] = []

    for (const model of PEDAL_MODELS) {
      const slug = renderSlug(model)
      const first = seen.get(slug)
      if (first) clashes.push(`${slug}: ${first} and ${model.maker} ${model.name}`)
      else seen.set(slug, `${model.maker} ${model.name}`)
    }

    expect(clashes).toEqual([])
  })

  it("keeps each still small enough to sit on a card", () => {
    /*
     * A CANARY, NOT A BUDGET. These are committed binaries served to every
     * visitor who lands on a listing with no photo, and the encoder settings
     * live in a script nobody runs twice. One run at the wrong quality would
     * put a couple of hundred kilobytes on a search grid without anything
     * failing.
     */
    const heavy = PEDAL_MODELS.map((model) => ({
      name: `${model.maker} ${model.name}`,
      kb: Math.round(statSync(path.join(DIR, `${renderSlug(model)}.${RENDER_EXT}`)).size / 1024),
    })).filter((entry) => entry.kb > 220)

    expect(heavy.map((entry) => `${entry.name} ${entry.kb}kB`)).toEqual([])
  })
})

describe("a render is claimed only for the pedal it is", () => {
  it("answers for a pedal that has been measured", () => {
    const found = renderForGear("Boss", "DS-1 Distortion")
    expect(found?.src).toBe(renderPath({ maker: "Boss", name: "DS-1 Distortion" }))
  })

  it("answers null rather than something close", () => {
    /*
     * THE FAILURE THAT MATTERS RUNS THIS WAY ROUND. A missing render is a card
     * that looks like it always did. A render claimed for the wrong pedal is a
     * confident picture of a different product on a page somebody is about to
     * spend money from, which is section 18's rule about `pedal-models` match
     * patterns reaching through a new door.
     *
     * These are the near misses that were already live once as bugs in the
     * viewer: a Micro Amp is not a Phase 90, a Nano Big Muff is not a Big Muff,
     * and a Tube Screamer Mini is a different enclosure from a TS9.
     */
    expect(renderForGear("Hamilton Beach", "Blender")).toBeNull()
    expect(renderForGear("Boss", "Katana 50")).toBeNull()
    expect(renderForGear(null, "DS-1 Distortion")).toBeNull()
    expect(renderForGear("Boss", null)).toBeNull()

    const microAmp = renderForGear("MXR", "Micro Amp")
    const phase90 = renderForGear("MXR", "Phase 90")
    expect(microAmp?.src).not.toBe(phase90?.src)

    const nano = renderForGear("Electro-Harmonix", "Nano Big Muff Pi")
    const bigMuff = renderForGear("Electro-Harmonix", "Big Muff Pi")
    expect(nano?.src).not.toBe(bigMuff?.src)
  })

  it("builds a path under the public directory the renderer writes to", () => {
    expect(renderPath({ maker: "ProCo", name: "RAT 2" })).toBe(`/${RENDER_DIR}/proco--rat-2.${RENDER_EXT}`)
  })
})
