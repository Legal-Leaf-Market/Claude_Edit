import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { MIN_SAMPLE_SIZE } from "@/lib/deals/pricing"
import { analyzeChain, EFFECTS, inferEffectType, estimatePower } from "@/lib/pedalboard/chain"
import { allRecords, creditsForGear, RIGS, rigFromSlug } from "@/lib/rigs"
import { search } from "@/lib/search"
import type { SearchHit, SortOption } from "@/lib/search/types"
import { STORES } from "@/lib/stores"
import { formatPrice, sourceLabel } from "@/lib/utils"
import { RIG_TOOL_SPECS, runRigTool } from "./rig-tools"

/**
 * The tools the assistant is allowed to call, and nothing else.
 *
 * THE ONE RULE THAT MATTERS: the model never writes SQL, never receives a
 * connection, and never has a tool whose argument reaches a query builder
 * uninterpreted. Every tool here takes typed scalars, validates them, and
 * calls the same functions the pages call. A "run this query" tool would be
 * three lines and would hand anyone who can type into a text box the ability
 * to read the user table, so it does not exist and must not be added. If a
 * question cannot be answered by the tools below, the right fix is another
 * narrow tool, not a general one.
 *
 * Second rule: these read. Nothing here writes a row, sends mail, or spends an
 * eBay call. The blast radius of a prompt injection carried in a listing title
 * is therefore bounded at "returns a wrong answer", not "mutates the site".
 *
 * Third rule, and it is the reason this is worth building at all: every tool
 * returns REAL rows from this database. The assistant is a query interface
 * over the catalogue, not a chat that happens to know about guitars. Answers
 * carry the listings they came from so a shopper can check them, and the model
 * is instructed (see lib/ai/ask.ts) to say it does not know rather than fill a
 * gap from memory, because a hallucinated price on a price-comparison site is
 * the worst thing this feature could do.
 */

/** JSON Schema for the tools, in the shape Groq's OpenAI-compatible API expects. */
export type ToolSpec = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** What a tool hands back: prose for the model, plus listings for the UI to render. */
export type ToolResult = {
  /** Compact text the model reads. Kept small: every token here is a token of context. */
  summary: string
  /** Listings worth showing as cards under the answer. */
  hits?: SearchHit[]
  /** One line describing what was actually run, shown to the shopper. */
  trace: string
}

const MAX_HITS = 8

function clampLimit(value: unknown, fallback = 6): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_HITS, Math.max(1, Math.floor(n)))
}

function dollarsToCents(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n * 100)
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** One line per listing, which is all the model needs to talk about it. */
function describeHit(hit: SearchHit): string {
  const parts = [
    hit.title.slice(0, 90),
    formatPrice(hit.priceCents, hit.currency),
    hit.condition ?? "condition unstated",
    `at ${sourceLabel(hit.source)}`,
  ]
  if (hit.isDeal && hit.dealMargin) {
    parts.push(`${Math.round(hit.dealMargin * 100)}% under market`)
  }
  return parts.join(", ")
}

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "search_listings",
      description:
        "Search the live catalogue of gear currently for sale. Use this for any question about what is available, what something costs right now, or what is on sale. Returns real listings from the database.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free text, e.g. 'stratocaster' or 'big muff'. Leave empty to browse a whole category.",
          },
          category: {
            type: "string",
            description:
              "One of: Electric Guitars, Acoustic Guitars, Bass Guitars, Amplifiers, Effects Pedals, Synthesizers, Keyboards & Pianos, Drums & Percussion, Microphones, Recording & Audio, DJ Equipment, Orchestral Strings, Brass & Woodwind, Folk & Traditional, Parts & Accessories.",
          },
          max_price: { type: "number", description: "Maximum price in dollars." },
          min_price: { type: "number", description: "Minimum price in dollars." },
          condition: { type: "string", description: "e.g. 'New' or 'Used'." },
          deals_only: {
            type: "boolean",
            description: "Only listings measurably below their instrument's median price.",
          },
          sort: {
            type: "string",
            enum: ["relevance", "price_asc", "price_desc", "newest", "deal"],
            description: "Default relevance when there is a query, newest otherwise.",
          },
          limit: { type: "number", description: "1 to 8. Default 6." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_price",
      description:
        "Get the measured market price for a specific instrument or pedal: the rolling median of prices actually observed, plus how many listings that median came from. Use this whenever asked what something is worth or whether a price is fair. Returns explicitly that there is no market price when the sample is too small, and that answer must be reported as-is rather than replaced with a guess.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Brand and model, e.g. 'Fender Player Stratocaster'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_artist_rig",
      description:
        "Look up a documented artist pedalboard: which pedals, what each one does on that board, and which albums and songs the rig is documented on. Use for any question about what gear a player used or how a record was made.",
      parameters: {
        type: "object",
        properties: {
          artist: { type: "string", description: "Player or band name, e.g. 'Gilmour' or 'Radiohead'." },
        },
        required: ["artist"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_rigs_by_record",
      description:
        "Find which documented rigs are associated with an album or a song title. Use when asked how a specific record or track was made, or what gear is on it.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Album or song title, or part of one." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_signal_chain",
      description:
        "Check a list of pedals against the conventional signal chain order and estimate the power supply needed. Use when asked what order to put pedals in, or how big a power supply a board needs.",
      parameters: {
        type: "object",
        properties: {
          pedals: {
            type: "array",
            items: { type: "string" },
            description: "Pedal names in the order they are currently chained, e.g. ['Boss DD-3', 'Ibanez TS9'].",
          },
        },
        required: ["pedals"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_stores",
      description:
        "List the storefronts whose live inventory this site carries, with what each specialises in. Use when asked where listings come from or who is being aggregated.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "catalogue_stats",
      description:
        "Current totals: live listings, distinct instruments tracked, and how many are below market. Use for questions about the size or freshness of the catalogue.",
      parameters: { type: "object", properties: {} },
    },
  },
]

/**
 * The rig-building tools live in ./rig-tools.ts and are merged in here.
 *
 * Separate file because they are a different KIND of tool: these three read
 * the in-repo spec catalogue and the pure layout, power and cable engines, and
 * touch no database at all. The model picks gear and the engines do the
 * geometry, which is the split that keeps an LLM from confidently inventing a
 * pedal's dimensions.
 */
export const TOOL_SPECS_ALL: ToolSpec[] = [...TOOL_SPECS, ...RIG_TOOL_SPECS]

export const TOOL_NAMES = new Set(TOOL_SPECS_ALL.map((t) => t.function.name))

/* -------------------------------------------------------------------------- */
/*  Implementations                                                           */
/* -------------------------------------------------------------------------- */

async function runSearchListings(args: Record<string, unknown>): Promise<ToolResult> {
  const query = str(args.query)
  const category = str(args.category)
  const limit = clampLimit(args.limit)
  const sort = (str(args.sort) || undefined) as SortOption | undefined

  const result = await search({
    q: query || undefined,
    categories: category ? [category] : undefined,
    conditions: str(args.condition) ? [str(args.condition)] : undefined,
    maxPriceCents: dollarsToCents(args.max_price),
    minPriceCents: dollarsToCents(args.min_price),
    dealsOnly: args.deals_only === true,
    sort,
    perPage: limit,
  })

  const filters = [
    query && `"${query}"`,
    category,
    args.max_price != null && `under $${args.max_price}`,
    args.deals_only === true && "below market only",
  ]
    .filter(Boolean)
    .join(", ")

  if (result.hits.length === 0) {
    return {
      summary: `No listings match${filters ? ` ${filters}` : ""}. The catalogue only carries what the live feeds currently stock, so this means nobody we track has one right now, not that it does not exist.`,
      trace: `Searched listings${filters ? `: ${filters}` : ""}, no matches`,
    }
  }

  return {
    summary: [
      `${result.found} matching listing${result.found === 1 ? "" : "s"}. Showing ${result.hits.length}:`,
      ...result.hits.map((hit, i) => `${i + 1}. ${describeHit(hit)}`),
    ].join("\n"),
    hits: result.hits,
    trace: `Searched ${result.found} listings${filters ? `: ${filters}` : ""}`,
  }
}

/**
 * Market price for one instrument.
 *
 * Reads canonical_gear directly rather than going through search, because the
 * median and the sample size live on that row and are the entire answer. The
 * MIN_SAMPLE_SIZE floor is repeated here rather than trusted from upstream: the
 * column can be non-null from an older run whose sample has since shrunk, and
 * section 8 of CLAUDE.md is unambiguous that publishing a price below the floor
 * is not allowed anywhere, including through this door.
 */
async function runGetMarketPrice(args: Record<string, unknown>): Promise<ToolResult> {
  const query = str(args.query)
  if (!query) return { summary: "No instrument given.", trace: "Market price lookup, no query" }

  const pattern = `%${query}%`
  const result = await db.execute<{
    brand: string
    model: string
    category: string
    slug: string
    avg_used_price_cents: number | null
    price_sample_size: number
    live_count: number
  }>(sql`
    SELECT g.brand, g.model, g.category, g.slug, g.avg_used_price_cents, g.price_sample_size,
           COUNT(l.id) FILTER (WHERE l.listing_status = 'active')::int AS live_count
    FROM canonical_gear g
    LEFT JOIN marketplace_listings l ON l.canonical_gear_id = g.id
    WHERE (g.brand || ' ' || g.model) ILIKE ${pattern}
       OR g.model ILIKE ${pattern}
    GROUP BY g.id, g.brand, g.model, g.category, g.slug, g.avg_used_price_cents, g.price_sample_size
    ORDER BY g.price_sample_size DESC
    LIMIT 3
  `)

  if (result.rows.length === 0) {
    return {
      summary: `Nothing in the catalogue matches "${query}", so there is no measured market price for it here.`,
      trace: `Market price lookup for "${query}", no match`,
    }
  }

  const lines = result.rows.map((row) => {
    const priced =
      row.avg_used_price_cents != null && row.price_sample_size >= MIN_SAMPLE_SIZE
        ? `median ${formatPrice(row.avg_used_price_cents)} from ${row.price_sample_size} observed listings`
        : `NO market price published: only ${row.price_sample_size} observation${row.price_sample_size === 1 ? "" : "s"}, and the floor is ${MIN_SAMPLE_SIZE}. Report this honestly, do not estimate one.`
    return `${row.brand} ${row.model} (${row.category}): ${priced}. ${row.live_count} listed live now. Page: /gear/${row.slug}`
  })

  return {
    summary: lines.join("\n"),
    trace: `Market price lookup for "${query}"`,
  }
}

function runLookupArtistRig(args: Record<string, unknown>): ToolResult {
  const artist = str(args.artist).toLowerCase()
  if (!artist) return { summary: "No artist given.", trace: "Rig lookup, no artist" }

  const matches = RIGS.filter(
    (rig) =>
      rig.name.toLowerCase().includes(artist) ||
      rig.context.toLowerCase().includes(artist) ||
      rig.slug.includes(artist.replace(/\s+/g, "-")),
  )

  if (matches.length === 0) {
    return {
      summary: `No documented rig for "${artist}" in the curated set. There are ${RIGS.length} rigs in it and it is hand-written, so absence here means it has not been written up yet, not that nothing is known. Say that rather than reciting gear from memory.`,
      trace: `Rig lookup for "${artist}", no match`,
    }
  }

  const lines = matches.slice(0, 3).map((rig) => {
    const pedals = rig.pedals
      .map((p) => `${p.brand} ${p.model} (${EFFECTS[p.type].label}, ${p.role})`)
      .join("; ")
    const records = rig.records
      .map((r) => `${r.title} (${r.year})${r.tracks.length ? `: ${r.tracks.join(", ")}` : ""}`)
      .join("; ")
    return `${rig.name}, ${rig.context}, ${rig.era}. Board: ${pedals}. Documented on: ${records}. Page: /rigs/${rig.slug}`
  })

  return { summary: lines.join("\n\n"), trace: `Rig lookup for "${artist}"` }
}

function runFindRigsByRecord(args: Record<string, unknown>): ToolResult {
  const title = str(args.title).toLowerCase()
  if (!title) return { summary: "No title given.", trace: "Record lookup, no title" }

  const matches = allRecords().filter(
    ({ record }) =>
      record.title.toLowerCase().includes(title) ||
      record.tracks.some((track) => track.toLowerCase().includes(title)),
  )

  if (matches.length === 0) {
    return {
      summary: `No record or track matching "${title}" in the curated set. Say so rather than answering from memory.`,
      trace: `Record lookup for "${title}", no match`,
    }
  }

  const lines = matches.slice(0, 4).map(({ rig, record }) => {
    const pedals = rig.pedals.map((p) => `${p.brand} ${p.model}`).join(", ")
    return `${record.title} (${record.year}), ${rig.name} of ${rig.context}. Tracks documented: ${record.tracks.join(", ") || "album level only"}. Board: ${pedals}.${record.note ? ` Note: ${record.note}` : ""} Page: /rigs/${rig.slug}`
  })

  return { summary: lines.join("\n\n"), trace: `Record lookup for "${title}"` }
}

function runAnalyzeSignalChain(args: Record<string, unknown>): ToolResult {
  const raw = Array.isArray(args.pedals) ? args.pedals : []
  const names = raw.map((v) => str(v)).filter(Boolean).slice(0, 16)
  if (names.length === 0) {
    return { summary: "No pedals given.", trace: "Chain analysis, no pedals" }
  }

  const items = names.map((name, i) => {
    // Everything before the first space is treated as the brand, which is
    // right for "Boss DD-3" and wrong for "Electro Harmonix Big Muff". It
    // only feeds the type guess, which reads the whole string anyway, so a
    // bad split costs nothing here.
    const [brand, ...rest] = name.split(/\s+/)
    const model = rest.join(" ") || name
    return { key: `${i}`, brand, model, type: inferEffectType(brand, model) }
  })

  const analysis = analyzeChain(items)
  const power = estimatePower(items)

  const orderLine = analysis.inConventionalOrder
    ? "This chain is already in the conventional order."
    : `Conventional order would be: ${analysis.suggested.map((i) => `${i.brand} ${i.model}`).join(" -> ")}.`

  const notes = analysis.notes.length
    ? analysis.notes.map((n) => `- ${n.message}`).join("\n")
    : "Nothing worth flagging."

  return {
    summary: [
      `Read as: ${items.map((i) => `${i.brand} ${i.model} (${EFFECTS[i.type].label})`).join(" -> ")}`,
      orderLine,
      notes,
      `Power: roughly ${power.totalMa}mA total across ${power.outputsNeeded} pedals, ${power.highDrawCount} of them high draw. A supply of about ${power.recommendedSupplyMa}mA with isolated outputs covers it. These are typical draws per effect type, NOT the spec of these specific pedals, and must be described that way.`,
    ].join("\n\n"),
    trace: `Analysed a ${items.length} pedal chain`,
  }
}

function runListStores(): ToolResult {
  return {
    summary: STORES.map((s) => `${s.name}: ${s.tagline}. Page: /shop/${s.slug}`).join("\n"),
    trace: `Listed ${STORES.length} stores`,
  }
}

async function runCatalogueStats(): Promise<ToolResult> {
  const result = await db.execute<{ listings: number; gear: number; deals: number; sources: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE listing_status = 'active')::int AS listings,
      COUNT(DISTINCT canonical_gear_id)::int AS gear,
      COUNT(*) FILTER (WHERE is_deal AND listing_status = 'active')::int AS deals,
      COUNT(DISTINCT source)::int AS sources
    FROM marketplace_listings
  `)
  const row = result.rows[0]
  return {
    summary: `${row?.listings ?? 0} live listings, ${row?.gear ?? 0} distinct instruments tracked, ${row?.deals ?? 0} currently below market, across ${row?.sources ?? 0} sources.`,
    trace: "Read catalogue totals",
  }
}

/**
 * Dispatch. An unknown name returns an error string to the model rather than
 * throwing, so a model that invents a tool gets a correction it can act on
 * instead of collapsing the whole turn.
 */
export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    // Rig tools first: they are synchronous and hit no database.
    const rig = runRigTool(name, args)
    if (rig) return rig

    switch (name) {
      case "search_listings":
        return await runSearchListings(args)
      case "get_market_price":
        return await runGetMarketPrice(args)
      case "lookup_artist_rig":
        return runLookupArtistRig(args)
      case "find_rigs_by_record":
        return runFindRigsByRecord(args)
      case "analyze_signal_chain":
        return runAnalyzeSignalChain(args)
      case "list_stores":
        return runListStores()
      case "catalogue_stats":
        return await runCatalogueStats()
      default:
        return {
          summary: `No tool named "${name}". Use one of: ${[...TOOL_NAMES].join(", ")}.`,
          trace: `Rejected unknown tool "${name}"`,
        }
    }
  } catch (error) {
    // A failed tool must not take the answer down with it. The model gets told
    // the lookup failed and can say so, which beats a 500 on the whole turn.
    console.error(`[ai] tool ${name} failed:`, error)
    return {
      summary: `The ${name} lookup failed. Tell the user this could not be checked right now rather than answering from memory.`,
      trace: `${name} failed`,
    }
  }
}

/** Re-exported so the gear page can show rig credits without importing the tool module. */
export { creditsForGear, rigFromSlug }
