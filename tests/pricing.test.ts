import { describe, expect, it } from "vitest"
import {
  DEAL_THRESHOLD,
  MIN_SAMPLE_SIZE,
  dealMargin,
  isDeal,
  median,
  trimOutliers,
} from "@/lib/deals/pricing"

describe("median", () => {
  it("returns the middle value of an odd sample", () => {
    expect(median([100, 300, 200])).toBe(200)
  })

  it("averages the two middle values of an even sample", () => {
    expect(median([100, 200, 300, 400])).toBe(250)
  })

  it("returns null for an empty sample", () => {
    expect(median([])).toBeNull()
  })

  it("is unmoved by a single absurd outlier", () => {
    // This is the whole reason the market price is a median and not a mean:
    // one optimist asking $1,200,000 must not make every listing a "deal".
    const prices = [90_000, 95_000, 100_000, 105_000, 110_000]
    const withOutlier = [...prices, 120_000_000]
    expect(median(prices)).toBe(100_000)
    expect(median(withOutlier)).toBe(102_500)
    const mean = withOutlier.reduce((a, b) => a + b, 0) / withOutlier.length
    expect(mean).toBeGreaterThan(20_000_000)
  })

  it("does not mutate its input", () => {
    const input = [300, 100, 200]
    median(input)
    expect(input).toEqual([300, 100, 200])
  })
})

describe("trimOutliers", () => {
  it("leaves a small sample untouched", () => {
    const small = [1, 2, 3, 100]
    expect(trimOutliers(small)).toEqual(small)
  })

  it("drops the outer decile once the sample can afford it", () => {
    const sample = [1, 10, 20, 30, 40, 50, 60, 70, 80, 9999]
    const trimmed = trimOutliers(sample)
    expect(trimmed).not.toContain(1)
    expect(trimmed).not.toContain(9999)
    expect(trimmed).toHaveLength(8)
  })
})

describe("dealMargin", () => {
  it("expresses how far under market a price sits", () => {
    expect(dealMargin(75_000, 100_000)).toBeCloseTo(0.25)
  })

  it("goes negative above market", () => {
    expect(dealMargin(120_000, 100_000)).toBeCloseTo(-0.2)
  })

  it("returns null without a market price", () => {
    expect(dealMargin(75_000, null)).toBeNull()
    expect(dealMargin(75_000, 0)).toBeNull()
  })
})

describe("isDeal", () => {
  const bigSample = MIN_SAMPLE_SIZE + 5

  it("flags a listing more than 20% below the median", () => {
    expect(isDeal(79_000, 100_000, bigSample)).toBe(true)
  })

  it("does not flag one exactly at the threshold", () => {
    // The rule is "more than 20% below", so 0.8 * market is not itself a deal.
    expect(isDeal(80_000, 100_000, bigSample)).toBe(false)
    expect(DEAL_THRESHOLD).toBe(0.2)
  })

  it("does not flag a listing above market", () => {
    expect(isDeal(110_000, 100_000, bigSample)).toBe(false)
  })

  it("refuses to call a deal on a thin sample", () => {
    // Two listings are not a market. Publishing a badge off them would be a
    // guess dressed up as a measurement.
    expect(isDeal(10_000, 100_000, MIN_SAMPLE_SIZE - 1)).toBe(false)
    expect(isDeal(10_000, 100_000, MIN_SAMPLE_SIZE)).toBe(true)
  })

  it("returns false when there is no market price at all", () => {
    expect(isDeal(10_000, null, bigSample)).toBe(false)
  })

  it("honours a custom threshold", () => {
    expect(isDeal(85_000, 100_000, bigSample, 0.1)).toBe(true)
    expect(isDeal(85_000, 100_000, bigSample, 0.3)).toBe(false)
  })
})
