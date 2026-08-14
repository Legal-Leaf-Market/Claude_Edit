import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Rig } from "@/lib/rigs"

/*
 * The catalogue queries are mocked rather than exercised. They are already
 * covered by the Postgres integration suites; what needs pinning here is the
 * behaviour layered on top of them, which is entirely about what a store page
 * is allowed to claim.
 */
vi.mock("@/lib/pedalboard/queries", () => ({
  matchPedalsByName: vi.fn(),
  pedalBoardDetails: vi.fn(),
}))

const { matchPedalsByName, pedalBoardDetails } = await import("@/lib/pedalboard/queries")
const { andertonsRigCoverage, andertonsRigCoverages } = await import("@/lib/andertons/rigs")

const mockMatch = vi.mocked(matchPedalsByName)
const mockDetails = vi.mocked(pedalBoardDetails)

function rig(slug: string, pedals: Rig["pedals"]): Rig {
  return {
    slug,
    name: slug,
    context: "the 1972 tour",
    genre: "rock",
    era: "1972",
    decade: "1970s",
    blurb: "A board.",
    pedals,
    records: [],
  }
}

function pedal(brand: string, model: string, extra: Partial<Rig["pedals"][number]> = {}) {
  return { brand, model, type: "drive" as const, role: "Dirt", ...extra }
}

/** A matchPedalsByName result: the resolver found a canonical row for each. */
function matched(pedals: { brand: string; model: string }[]) {
  return pedals.map((p) => ({
    brand: p.brand,
    model: p.model,
    matched: {
      slug: `${p.brand}-${p.model}`.toLowerCase().replace(/\s+/g, "-"),
      brand: p.brand,
      model: p.model,
      imageUrl: null,
      marketPriceCents: null,
      sampleSize: 0,
      type: "drive" as const,
    },
  }))
}

/** One pedalBoardDetails row, with an Anderton's availability attached. */
function detail(slug: string, andertons: { newCents?: number | null; usedCents?: number | null } | null) {
  return {
    slug,
    brand: "b",
    model: "m",
    imageUrl: null,
    marketPriceCents: null,
    sampleSize: 0,
    type: "drive" as const,
    bySource: andertons
      ? [
          {
            source: "andertons",
            cheapestNewCents: andertons.newCents ?? null,
            cheapestUsedCents: andertons.usedCents ?? null,
            count: 1,
            cheapestListingId: `listing-${slug}`,
          },
        ]
      : [],
  }
}

describe("Anderton's rig coverage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  /**
   * THE HONEST-GAP RULE, and the reason this file exists.
   *
   * A slot Anderton's does not stock stays on the board, greyed. Dropping it
   * would quietly redraw somebody's signal chain into whatever happened to be
   * in stock, which is section 15's "never hide what a shopper cannot buy
   * without saying so" committed against the rig instead of the listing.
   */
  it("keeps a pedal the store does not stock, rather than dropping it", async () => {
    const pedals = [pedal("Ibanez", "TS9"), pedal("MXR", "Phase 90")]
    mockMatch.mockResolvedValue(matched(pedals))
    mockDetails.mockResolvedValue([detail("ibanez-ts9", { newCents: 12900 }), detail("mxr-phase-90", null)])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.slots).toHaveLength(2)
    expect(coverage.slots.map((s) => s.model)).toEqual(["TS9", "Phase 90"])
    expect(coverage.slots[1].inStock).toBe(false)
    expect(coverage.stocked).toBe(1)
    expect(coverage.total).toBe(2)
    expect(coverage.complete).toBe(false)
  })

  /**
   * The subtotal covers the stocked slots ONLY. Presenting it as the price of
   * the board would quote something nobody can buy, which is the same class of
   * error as publishing a market price below MIN_SAMPLE_SIZE: a number that
   * reads like a measurement and is not one.
   */
  it("adds up only the pedals actually in stock", async () => {
    const pedals = [pedal("Ibanez", "TS9"), pedal("MXR", "Phase 90"), pedal("Boss", "DD-3")]
    mockMatch.mockResolvedValue(matched(pedals))
    mockDetails.mockResolvedValue([
      detail("ibanez-ts9", { newCents: 10000 }),
      detail("mxr-phase-90", null),
      detail("boss-dd-3", { newCents: 5000 }),
    ])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.subtotalCents).toBe(15000)
    expect(coverage.stocked).toBe(2)
  })

  it("publishes no subtotal at all when nothing is in stock", async () => {
    const pedals = [pedal("Ibanez", "TS9")]
    mockMatch.mockResolvedValue(matched(pedals))
    mockDetails.mockResolvedValue([detail("ibanez-ts9", null)])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.subtotalCents).toBeNull()
    expect(coverage.complete).toBe(false)
  })

  /**
   * Anderton's is a new-retail feed. A used row there is an ex-demo or a
   * mis-normalised condition, so quoting it as the headline would advertise
   * something the shopper probably cannot get.
   */
  it("prefers the new price, and falls back to used rather than showing nothing", async () => {
    const pedals = [pedal("Ibanez", "TS9"), pedal("MXR", "Phase 90")]
    mockMatch.mockResolvedValue(matched(pedals))
    mockDetails.mockResolvedValue([
      detail("ibanez-ts9", { newCents: 12900, usedCents: 8000 }),
      detail("mxr-phase-90", { newCents: null, usedCents: 4500 }),
    ])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.slots[0].priceCents).toBe(12900)
    expect(coverage.slots[1].priceCents).toBe(4500)
  })

  /** Another store's stock is not Anderton's stock, however cheap it is. */
  it("ignores availability at every other store", async () => {
    const pedals = [pedal("Ibanez", "TS9")]
    mockMatch.mockResolvedValue(matched(pedals))
    mockDetails.mockResolvedValue([
      {
        ...detail("ibanez-ts9", null),
        bySource: [
          {
            source: "reverb",
            cheapestNewCents: 100,
            cheapestUsedCents: 100,
            count: 9,
            cheapestListingId: "reverb-1",
          },
        ],
      },
    ])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.slots[0].inStock).toBe(false)
    expect(coverage.slots[0].priceCents).toBeNull()
    expect(coverage.stocked).toBe(0)
  })

  /**
   * Amps and guitars sit on the board but are not pedals, and counting them
   * would make every rig look permanently incomplete against a pedal
   * catalogue.
   */
  it("leaves amps and guitars out of the ratio while still listing them", async () => {
    const pedals = [pedal("Ibanez", "TS9"), pedal("Fender", "Twin Reverb", { notPedal: true })]
    mockMatch.mockResolvedValue(matched([{ brand: "Ibanez", model: "TS9" }]))
    mockDetails.mockResolvedValue([detail("ibanez-ts9", { newCents: 12900 })])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.slots).toHaveLength(2)
    expect(coverage.total).toBe(1)
    expect(coverage.stocked).toBe(1)
    expect(coverage.complete).toBe(true)
  })

  /**
   * Ranked by PROPORTION, so a small board fully in stock beats a big one half
   * there. That is the order somebody deciding what to build wants, and it is
   * a fact about inventory rather than about which brands pay 4%.
   */
  it("ranks a fully stocked short board above a partly stocked long one", async () => {
    const short = rig("short", [pedal("Ibanez", "TS9")])
    const long = rig("long", [pedal("MXR", "Phase 90"), pedal("Boss", "DD-3"), pedal("EHX", "Big Muff")])

    mockMatch.mockImplementation(async (input) => matched(input))
    mockDetails.mockImplementation(async (slugs) =>
      slugs.map((slug) => detail(slug, slug === "ibanez-ts9" || slug === "mxr-phase-90" ? { newCents: 9900 } : null)),
    )

    const ranked = await andertonsRigCoverages([long, short])

    expect(ranked[0].rig.slug).toBe("short")
    expect(ranked[0].complete).toBe(true)
    expect(ranked[1].rig.slug).toBe("long")
  })

  /** A database that is down must not 500 a store page. */
  it("degrades to an unstocked board when the catalogue query fails", async () => {
    const pedals = [pedal("Ibanez", "TS9")]
    mockMatch.mockRejectedValue(new Error("no database"))
    mockDetails.mockResolvedValue([])

    const coverage = await andertonsRigCoverage(rig("a", pedals))

    expect(coverage.slots).toHaveLength(1)
    expect(coverage.stocked).toBe(0)
    expect(coverage.subtotalCents).toBeNull()
  })
})
