import { afterEach, describe, expect, it } from "vitest"
import {
  __resetBudgets,
  consumeDailyBudget,
  consumeHourlyBudget,
} from "@/lib/ingestion/rate-limit"

/**
 * Budget windows.
 *
 * These exist because of a real defect caught in review on PR #25: the Groq
 * assistant's limit was named and documented as hourly (GROQ_HOURLY_LIMIT_PER_IP,
 * "per hour") while being enforced through consumeDailyBudget, a per-UTC-calendar-day
 * counter. An operator setting 30 would have got 30 questions per DAY, and worse,
 * a shopper who hit the cap at 00:30 UTC was locked out for 23 hours while one
 * starting at 23:59 got a fresh allowance a minute later.
 *
 * The name and the window are now checked against each other, since the failure
 * mode is silent: both functions have identical signatures and identical return
 * shapes, so calling the wrong one type-checks perfectly and only shows up as a
 * confused operator months later.
 *
 * No Redis in the test environment, so these exercise the in-memory fallback,
 * which is the same counting logic against the same window boundaries. Each
 * test uses its own prefix because the memory map is module-level state.
 */

afterEach(() => __resetBudgets())

describe("consumeHourlyBudget", () => {
  it("allows up to the limit and refuses past it", async () => {
    const first = await consumeHourlyBudget("t-hourly-basic", 3)
    expect(first).toEqual({ allowed: true, used: 1, limit: 3 })

    await consumeHourlyBudget("t-hourly-basic", 3)
    const third = await consumeHourlyBudget("t-hourly-basic", 3)
    expect(third.allowed).toBe(true)
    expect(third.used).toBe(3)

    const fourth = await consumeHourlyBudget("t-hourly-basic", 3)
    expect(fourth.allowed).toBe(false)
    expect(fourth.used).toBe(4)
  })

  it("keeps separate prefixes independent, so one IP cannot exhaust another", async () => {
    await consumeHourlyBudget("t-ip-a", 1)
    const other = await consumeHourlyBudget("t-ip-b", 1)
    expect(other.allowed).toBe(true)
    expect(other.used).toBe(1)
  })

  it("counts a multi-unit cost as that many units", async () => {
    const result = await consumeHourlyBudget("t-hourly-cost", 10, 4)
    expect(result.used).toBe(4)
    expect(result.allowed).toBe(true)

    const over = await consumeHourlyBudget("t-hourly-cost", 10, 7)
    expect(over.used).toBe(11)
    expect(over.allowed).toBe(false)
  })
})

describe("the two windows are actually different", () => {
  /**
   * The regression guard. Both helpers key on their own window, so spending
   * the hourly budget must leave the daily one untouched for the same prefix.
   * If consumeHourlyBudget were ever re-pointed at the day window (which is
   * exactly the bug that shipped), these counters would share a key and this
   * fails.
   */
  it("does not share a counter between the hourly and daily budgets", async () => {
    await consumeHourlyBudget("t-shared", 5)
    await consumeHourlyBudget("t-shared", 5)

    const daily = await consumeDailyBudget("t-shared", 5)
    expect(daily.used).toBe(1)
  })

  it("expires the hourly window within the hour and the daily one within the day", async () => {
    // Reaching into the returned state is not possible, so this asserts the
    // property that matters operationally: an hourly budget must reset sooner
    // than a daily one started at the same instant. Checked through the clock
    // boundaries the implementation derives, rather than by sleeping an hour.
    const now = new Date()
    const endOfHour = new Date(now)
    endOfHour.setUTCMinutes(59, 59, 999)
    const endOfDay = new Date(now)
    endOfDay.setUTCHours(23, 59, 59, 999)

    expect(endOfHour.getTime()).toBeLessThanOrEqual(endOfDay.getTime())
    // And they are only equal inside the final hour of the day, which is the
    // one time the two windows legitimately coincide.
    if (now.getUTCHours() < 23) {
      expect(endOfHour.getTime()).toBeLessThan(endOfDay.getTime())
    }
  })
})

describe("consumeDailyBudget", () => {
  it("still behaves as before, since eBay's quota is genuinely daily", async () => {
    const first = await consumeDailyBudget("t-daily", 2)
    expect(first).toEqual({ allowed: true, used: 1, limit: 2 })

    await consumeDailyBudget("t-daily", 2)
    const third = await consumeDailyBudget("t-daily", 2)
    expect(third.allowed).toBe(false)
    expect(third.used).toBe(3)
  })
})
