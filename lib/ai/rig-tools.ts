import { EFFECTS, inferEffectType, type EffectType } from "@/lib/pedalboard/chain"
import { BOARDS_BY_SIZE, boardById, findPedalSpec, PEDALS_SORTED, resolvePedal, SUPPLIES, supplyById, supplyOutputCount, supplyTotalMa } from "@/lib/pedalboard/catalog"
import { BOARDS } from "@/lib/pedalboard/catalog/boards"
import { autoArrange, smallestBoardFor, type LayoutItem } from "@/lib/pedalboard/layout"
import { planCables } from "@/lib/pedalboard/cables"
import { estimatedPower, planPower, recommendSupply, type PowerItem } from "@/lib/pedalboard/power-plan"
import { encodeBoard, encodeRig } from "@/lib/pedalboard/board-url"
import { mmToIn } from "@/lib/pedalboard/catalog/types"
import type { ToolResult, ToolSpec } from "./tools"

/**
 * Letting the assistant build a whole rig.
 *
 * THE SPLIT THAT MAKES THIS SAFE. The model picks gear; the engines do the
 * geometry and the electrics. It never computes a placement, never sums a
 * current draw, and never invents a dimension: it names pedals, and
 * `plan_rig` runs exactly the same `autoArrange`, `planPower` and `planCables`
 * the page runs, all of which are pure, tested and deterministic.
 *
 * That is the whole design. An LLM asked to lay out a board will happily tell
 * you a Big Muff is 60mm wide and that nine pedals draw 400mA, confidently and
 * wrongly. Asked instead to choose six pedals and hand them to a function, it
 * is doing the part it is actually good at.
 *
 * NO DATABASE AT ALL. These three tools read the in-repo spec catalogue and
 * nothing else, so they are even narrower than the read-only listing tools
 * beside them: there is no query to build, no table to name, and no user data
 * within reach. Section 14's rule about never handing the model anything that
 * reaches a query builder is satisfied by there being no query builder here.
 *
 * THE OUTPUT IS A URL. A plan the shopper cannot open is a wall of text, so
 * every result carries a /pedalboard link that reconstructs the exact board,
 * which they can then drag around themselves.
 */

export const RIG_TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "list_pedalboards",
      description:
        "List the pedalboards this planner knows, with their usable size in inches. Use when asked which board to buy, or whether a set of pedals will fit on a particular board.",
      parameters: {
        type: "object",
        properties: {
          maxWidthIn: {
            type: "number",
            description: "Only boards this wide or narrower, in inches. Omit for all of them.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_pedal_specs",
      description:
        "Look up the physical size and power draw of pedals: width, depth, current in mA, voltage and polarity. Use before recommending a board or a power supply, and whenever asked how big a pedal is or how much power it needs. Returns nothing for pedals not in the spec catalogue, which is not the same as them not existing.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Brand or model text, e.g. 'strymon' or 'tube screamer'.",
          },
          type: {
            type: "string",
            description: `Optional effect type filter. One of: ${Object.keys(EFFECTS).join(", ")}.`,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_rig",
      description:
        "Lay a set of pedals out on a board to scale, size a power supply, count the patch cables, and return a link that opens the finished board. This is the tool to use whenever asked to build, plan or design a pedalboard. Pass the pedals in signal order. Do not work out positions, power totals or cable counts yourself: this returns all of them, measured.",
      parameters: {
        type: "object",
        properties: {
          pedals: {
            type: "array",
            items: { type: "string" },
            description:
              "Pedal names in signal order, e.g. ['Boss TU-3', 'Ibanez TS9', 'MXR Phase 90', 'Boss DD-3'].",
          },
          boardId: {
            type: "string",
            description:
              "Board id from list_pedalboards. Omit to have the smallest board that fits chosen automatically.",
          },
          supplyId: {
            type: "string",
            description: "Power supply id. Omit to have one recommended.",
          },
          plug: {
            type: "string",
            description:
              "Patch plug profile: 'flat', 'right' or 'straight'. Defaults to right angle, which is what most boards use.",
          },
        },
        required: ["pedals"],
      },
    },
  },
]

export const RIG_TOOL_NAMES = new Set(RIG_TOOL_SPECS.map((t) => t.function.name))

/* -------------------------------------------------------------------------- */

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asPedalList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => asString(v))
    .filter(Boolean)
    .slice(0, 16)
}

function inches(mm: number): string {
  return `${Math.round(mmToIn(mm) * 10) / 10}"`
}

function runListPedalboards(args: Record<string, unknown>): ToolResult {
  const maxWidthIn = typeof args.maxWidthIn === "number" ? args.maxWidthIn : null
  const boards = BOARDS_BY_SIZE.filter((b) => maxWidthIn == null || b.labelWidthIn <= maxWidthIn)

  if (boards.length === 0) {
    return {
      summary: `No board in the catalogue is ${maxWidthIn}" or narrower. The smallest is the ${BOARDS_BY_SIZE[0].brand} ${BOARDS_BY_SIZE[0].model} at ${BOARDS_BY_SIZE[0].labelWidthIn}".`,
      trace: `Listed pedalboards under ${maxWidthIn}"`,
    }
  }

  const lines = boards.map(
    (b) =>
      `${b.id}: ${b.brand} ${b.model}, ${b.labelWidthIn}" x ${b.labelDepthIn}" (usable ${inches(b.usableWidthMm)} x ${inches(b.usableDepthMm)}), ${b.rails.length} rail${b.rails.length === 1 ? "" : "s"}${b.tiered ? ", tiered" : ""}${b.underMount ? ", supply mounts underneath" : ""}`,
  )

  return {
    summary: `${boards.length} boards, smallest first:\n${lines.join("\n")}`,
    trace: `Listed ${boards.length} pedalboards`,
  }
}

function runSearchPedalSpecs(args: Record<string, unknown>): ToolResult {
  const query = asString(args.query).toLowerCase()
  const typeFilter = asString(args.type) as EffectType
  if (!query) return { summary: "No search text given.", trace: "Empty pedal spec search" }

  const matches = PEDALS_SORTED.filter((p) => {
    if (typeFilter && p.type !== typeFilter) return false
    const haystack = `${p.brand} ${p.model} ${(p.aliases ?? []).join(" ")}`.toLowerCase()
    return haystack.includes(query)
  }).slice(0, 12)

  if (matches.length === 0) {
    return {
      summary: `No pedal matching "${query}" is in the spec catalogue. Say the size and power figures are not known here rather than estimating them, and that this does not mean the pedal does not exist.`,
      trace: `No spec match for "${query}"`,
    }
  }

  const lines = matches.map((p) => {
    const power = p.power.dcJack === false
      ? "battery only, no DC jack"
      : `${p.power.ma}mA at ${p.power.volts}V ${p.power.polarity.replace("-", " ")}${p.power.ac ? " AC" : ""}${p.power.source === "estimate" ? " (typical, not the maker's figure)" : ""}`
    return `${p.brand} ${p.model} [${p.type}]: ${p.dims.widthMm} x ${p.dims.depthMm}mm, ${power}${p.power.note ? `. ${p.power.note}` : ""}`
  })

  return {
    summary: lines.join("\n"),
    trace: `Looked up specs for "${query}"`,
  }
}

function runPlanRig(args: Record<string, unknown>): ToolResult {
  const names = asPedalList(args.pedals)
  if (names.length === 0) {
    return { summary: "No pedals given to plan.", trace: "plan_rig with no pedals" }
  }

  const plugArg = asString(args.plug)
  const plug = plugArg === "flat" || plugArg === "straight" ? plugArg : "right"

  /*
   * Every name becomes a slot whether or not it is in the spec catalogue. A rig
   * is usually half pedals we have measured and half we have not, and dropping
   * the unmeasured ones would silently plan a smaller board than the shopper
   * actually needs.
   */
  const items: LayoutItem[] = []
  const powerItems: PowerItem[] = []
  const estimated: string[] = []

  names.forEach((name, index) => {
    const spec = findPedalSpec(name.split(/\s+/)[0] ?? "", name)
    const brand = spec?.brand ?? (name.split(/\s+/)[0] ?? "Unknown")
    const model = spec?.model ?? name
    const type = spec?.type ?? inferEffectType(brand, name)
    const resolved = spec ? { dims: spec.dims, treadle: spec.treadle ?? false } : resolvePedal(brand, name, type)
    if (!spec) estimated.push(name)

    const key = `p${index}`
    items.push({
      key,
      label: spec ? `${spec.brand} ${spec.model}` : name,
      widthMm: resolved.dims.widthMm,
      depthMm: resolved.dims.depthMm,
      treadle: resolved.treadle,
    })
    powerItems.push({
      id: key,
      brand,
      model,
      type,
      power: spec?.power ?? estimatedPower(type),
    })
  })

  const requestedBoard = boardById(asString(args.boardId))
  const board = requestedBoard ?? smallestBoardFor(BOARDS, items, { plug }) ?? BOARDS_BY_SIZE[BOARDS_BY_SIZE.length - 1]

  const layout = autoArrange(board, items, { plug })
  const requestedSupply = supplyById(asString(args.supplyId))
  const supply = requestedSupply ?? recommendSupply(powerItems, SUPPLIES)
  const power = planPower(powerItems, supply)
  const cables = planCables(items, layout.placements, plug)

  // The link the shopper opens. Off-catalogue slots keep working as the feeds
  // pick these pedals up, which is the same reason the slot codec has them.
  const boardParam = encodeBoard(
    names.map((name) => {
      const spec = findPedalSpec(name.split(/\s+/)[0] ?? "", name)
      return spec
        ? { kind: "off" as const, brand: spec.brand, model: spec.model }
        : { kind: "off" as const, brand: name.split(/\s+/)[0] ?? name, model: name }
    }),
  )
  const rigParam = encodeRig({
    boardId: board.id,
    supplyId: supply?.id ?? null,
    placements: layout.placements,
  })
  const url = `/pedalboard?board=${encodeURIComponent(boardParam)}&rig=${encodeURIComponent(rigParam)}`

  const parts: string[] = []
  parts.push(
    `Board: ${board.brand} ${board.model} (${board.labelWidthIn}" x ${board.labelDepthIn}"). ${layout.unplaced.length === 0 ? `All ${items.length} pedals fit` : `${layout.unplaced.length} did NOT fit`}, using about ${Math.round(layout.utilisation * 100)}% of the usable area.`,
  )

  if (supply) {
    parts.push(
      `Power: ${supply.brand} ${supply.model}, ${supplyOutputCount(supply)} outputs, ${supplyTotalMa(supply)}mA total. The board draws about ${power.totalMa}mA across ${power.poweredCount} powered pedals, leaving ${Math.round(power.headroom * 100)}% headroom.`,
    )
  } else {
    parts.push(`Power: about ${power.totalMa}mA across ${power.poweredCount} powered pedals. No supply in the catalogue covers this cleanly.`)
  }

  const fatal = [...layout.issues, ...power.issues].filter((i) => i.severity === "fatal")
  const warn = [...layout.issues, ...power.issues].filter((i) => i.severity === "warn")
  if (fatal.length > 0) parts.push(`PROBLEMS that must be mentioned:\n- ${fatal.map((i) => i.message).join("\n- ")}`)
  if (warn.length > 0) parts.push(`Worth mentioning:\n- ${warn.slice(0, 4).map((i) => i.message).join("\n- ")}`)

  parts.push(
    `Cables: ${cables.patchCount} patch cables plus ${cables.instrumentLeads} instrument leads. ${cables.byLength.map((e) => `${e.count} x ${inches(e.lengthMm)}`).join(", ")}.`,
  )

  if (estimated.length > 0) {
    parts.push(
      `NOT MEASURED, so their size and draw are typical figures rather than the maker's: ${estimated.join(", ")}. Say so.`,
    )
  }

  parts.push(`Open this board: ${url}`)
  parts.push(
    "Report these numbers as given. Do not recalculate the fit, the power or the cable count, and do not state a price: no price was looked up here.",
  )

  return {
    summary: parts.join("\n\n"),
    trace: `Planned a ${items.length} pedal rig on the ${board.brand} ${board.model}`,
  }
}

export function runRigTool(name: string, args: Record<string, unknown>): ToolResult | null {
  switch (name) {
    case "list_pedalboards":
      return runListPedalboards(args)
    case "search_pedal_specs":
      return runSearchPedalSpecs(args)
    case "plan_rig":
      return runPlanRig(args)
    default:
      return null
  }
}
