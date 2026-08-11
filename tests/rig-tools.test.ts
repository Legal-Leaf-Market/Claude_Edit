import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { RIG_TOOL_NAMES, RIG_TOOL_SPECS, runRigTool } from "@/lib/ai/rig-tools"
import { decodeRig } from "@/lib/pedalboard/board-url"

/**
 * The assistant's rig-building tools.
 *
 * The design these tests defend: the model picks gear, the engines do the
 * geometry and the electrics. So the things worth pinning are that the tools
 * return MEASURED numbers rather than leaving room for the model to invent
 * them, that they say plainly when a figure is a guess, and that the link they
 * hand back actually reconstructs the board.
 */

function run(name: string, args: Record<string, unknown> = {}) {
  const result = runRigTool(name, args)
  if (!result) throw new Error(`no such rig tool: ${name}`)
  return result
}

describe("the tool surface", () => {
  it("declares exactly the three tools it implements", () => {
    expect([...RIG_TOOL_NAMES].sort()).toEqual(["list_pedalboards", "plan_rig", "search_pedal_specs"])
    for (const spec of RIG_TOOL_SPECS) {
      expect(spec.type).toBe("function")
      expect(spec.function.description.length).toBeGreaterThan(40)
    }
  })

  it("takes only bounded scalars and lists of names, never a structured object", () => {
    for (const spec of RIG_TOOL_SPECS) {
      const props = (spec.function.parameters as { properties?: Record<string, { type?: string }> }).properties ?? {}
      for (const [name, schema] of Object.entries(props)) {
        expect(["string", "number", "array"], `${spec.function.name}.${name}`).toContain(schema.type)
      }
    }
  })

  /**
   * Section 14's real rule, asserted the only way that actually means
   * something: nothing the model can reach here may touch a database.
   *
   * An earlier version of this test banned parameters NAMED like SQL, which
   * caught `query` on a substring match over an in-memory array and proved
   * nothing either way. What matters is not the name, it is whether a
   * connection is in scope at all. It is not: these tools read the in-repo
   * spec catalogue and the pure engines, so there is no query to build.
   */
  it("imports no database, so there is no query builder to reach", () => {
    const source = readFileSync(new URL("../lib/ai/rig-tools.ts", import.meta.url), "utf8")
    const imports = source.split("\n").filter((line) => line.startsWith("import "))

    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) {
      expect(line).not.toMatch(/@\/lib\/db|drizzle-orm|\bpg\b/)
    }
    expect(source).not.toMatch(/\bsql`/)
  })

  it("returns null for a tool it does not own, so the dispatcher can fall through", () => {
    expect(runRigTool("search_listings", {})).toBeNull()
  })
})

describe("list_pedalboards", () => {
  it("lists boards smallest first with their usable size", () => {
    const result = run("list_pedalboards")
    expect(result.summary).toMatch(/pedaltrain-nano/)
    expect(result.summary).toMatch(/usable/)
  })

  it("narrows to a width, and says so when nothing is small enough", () => {
    expect(run("list_pedalboards", { maxWidthIn: 16 }).summary).not.toMatch(/terra-42/)
    expect(run("list_pedalboards", { maxWidthIn: 2 }).summary).toMatch(/smallest is/i)
  })
})

describe("search_pedal_specs", () => {
  it("returns real dimensions and draw for a pedal it knows", () => {
    const result = run("search_pedal_specs", { query: "tube screamer" })
    expect(result.summary).toMatch(/Ibanez TS9/)
    expect(result.summary).toMatch(/74 x 124mm/)
    expect(result.summary).toMatch(/8mA at 9V/)
  })

  /**
   * The distinction that stops the assistant laundering a guess into a spec.
   */
  it("labels a typical figure as typical, and leaves a real one unqualified", () => {
    const known = run("search_pedal_specs", { query: "el capistan" })
    expect(known.summary).toMatch(/250mA/)
    expect(known.summary).not.toMatch(/typical/i)

    const guessed = run("search_pedal_specs", { query: "small stone" })
    expect(guessed.summary).toMatch(/typical, not the maker/i)
  })

  it("calls out the pedals that will kill themselves on the wrong output", () => {
    expect(run("search_pedal_specs", { query: "dl4" }).summary).toMatch(/AC/)
    expect(run("search_pedal_specs", { query: "h9" }).summary).toMatch(/center positive/i)
    expect(run("search_pedal_specs", { query: "fuzz face" }).summary).toMatch(/battery only/i)
  })

  /**
   * "Not in our catalogue" and "does not exist" are different claims, and only
   * one of them is true. The tool has to make the model say the right one.
   */
  it("tells the model to say the figures are unknown rather than estimate them", () => {
    const result = run("search_pedal_specs", { query: "zzzz nonexistent pedal" })
    expect(result.summary).toMatch(/not known here/i)
    expect(result.summary).toMatch(/does not mean the pedal does not exist/i)
  })
})

describe("plan_rig", () => {
  const chain = ["Boss TU-3", "Ibanez TS9", "MXR Phase 90", "Boss DD-3"]

  it("measures the fit, the power and the cables in one call", () => {
    const result = run("plan_rig", { pedals: chain })

    expect(result.summary).toMatch(/Board:/)
    expect(result.summary).toMatch(/Power:/)
    expect(result.summary).toMatch(/Cables: 3 patch cables plus 2 instrument leads/)
    expect(result.summary).toMatch(/All 4 pedals fit/)
  })

  it("hands back a link that reconstructs the board it just planned", () => {
    const result = run("plan_rig", { pedals: chain, boardId: "pedaltrain-classic-2" })

    const match = result.summary.match(/\/pedalboard\?board=([^\s&]+)&rig=([^\s]+)/)
    expect(match).not.toBeNull()

    const decoded = decodeRig(decodeURIComponent(match![2]))
    expect(decoded.boardId).toBe("pedaltrain-classic-2")
    expect(decoded.placements).toHaveLength(4)
  })

  it("chooses a board when none is given, and honours one when it is", () => {
    expect(run("plan_rig", { pedals: chain }).summary).toMatch(/Board: /)
    expect(run("plan_rig", { pedals: chain, boardId: "pedaltrain-nano" }).summary).toMatch(/Nano/)
  })

  /** The instruction that keeps the model from doing the arithmetic itself. */
  it("tells the model to report the numbers rather than recompute them", () => {
    const summary = run("plan_rig", { pedals: chain }).summary
    expect(summary).toMatch(/Report these numbers as given/i)
    expect(summary).toMatch(/do not state a price/i)
  })

  it("leads with the problem when something does not fit", () => {
    const tooMany = [
      "Electro-Harmonix Big Muff Pi",
      "Electro-Harmonix Deluxe Memory Man",
      "Boss DD-500",
      "Dunlop Cry Baby",
      "Strymon TimeLine",
      "Strymon BigSky",
    ]
    const result = run("plan_rig", { pedals: tooMany, boardId: "pedaltrain-nano" })
    expect(result.summary).toMatch(/did NOT fit|PROBLEMS/)
  })

  /**
   * A rig is usually half pedals we have measured and half we have not.
   * Dropping the unmeasured ones would silently plan a smaller board than the
   * shopper actually needs, so they are planned AND declared.
   */
  it("plans unknown pedals too, and declares that their figures are estimates", () => {
    const result = run("plan_rig", { pedals: ["Boss DS-1", "Some Boutique Fuzz", "Another Mystery Box"] })

    expect(result.summary).toMatch(/All 3 pedals fit/)
    expect(result.summary).toMatch(/NOT MEASURED/)
    expect(result.summary).toMatch(/Some Boutique Fuzz/)
  })

  it("refuses an empty request rather than planning an empty board", () => {
    expect(run("plan_rig", { pedals: [] }).summary).toMatch(/No pedals given/i)
    expect(run("plan_rig", {}).summary).toMatch(/No pedals given/i)
  })

  it("caps a huge pedal list rather than trying to lay out a hundred", () => {
    const huge = Array.from({ length: 60 }, (_, i) => `Boss DS-${i}`)
    const result = run("plan_rig", { pedals: huge })
    expect(result.summary).toMatch(/Board:/)
    expect(result.trace).toMatch(/16 pedal|1[0-6] pedal/)
  })

  it("respects the plug profile, since it changes what fits", () => {
    const many = ["Boss TU-3", "Ibanez TS9", "MXR Phase 90", "Boss DD-3", "Boss RV-6", "Boss GE-7"]
    const flat = run("plan_rig", { pedals: many, boardId: "pedaltrain-metro-16", plug: "flat" })
    const straight = run("plan_rig", { pedals: many, boardId: "pedaltrain-metro-16", plug: "straight" })

    const fitCount = (s: string) => Number(s.match(/All (\d+) pedals fit/)?.[1] ?? 0)
    expect(fitCount(flat.summary)).toBeGreaterThanOrEqual(fitCount(straight.summary))
  })
})
