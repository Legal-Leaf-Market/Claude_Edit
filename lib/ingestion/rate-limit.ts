import { env } from "@/lib/env"
import { getRedis } from "@/lib/queue/redis"

/**
 * Call budgeting and retry policy for gated third-party feeds.
 *
 * eBay enforces a daily call limit per keyset and answers a breach with 429.
 * Hitting that ceiling costs us the rest of the day's ingestion, so the guard
 * here is a client-side budget checked BEFORE each call, not just a reaction to
 * the 429 after the fact.
 *
 * The counter lives in Redis when it is configured, so several workers share
 * one budget. Without Redis it falls back to a per-process counter, which is
 * correct for a single worker and merely optimistic for several.
 */

const memoryCounters = new Map<string, { count: number; resetAt: number }>()

/**
 * A budget window: the counter key it accumulates into, and when it expires.
 *
 * Two windows exist because the two callers are budgeting different things.
 * eBay's is a genuine daily quota imposed by eBay per keyset, so the window has
 * to be their day. The assistant's is our own spend guard, where a calendar day
 * is the wrong shape entirely: it locks out anyone who hits the cap early and
 * hands a fresh allowance to anyone who starts at 23:59.
 *
 * Both are FIXED windows rather than rolling ones. A true rolling window needs
 * a sorted set of timestamps per key, which is a real cost for a guard whose
 * job is stopping a scraper rather than metering a customer. Everything that
 * prints one of these says "fixed", so nobody configures against a rolling
 * window that does not exist.
 */
type BudgetWindow = { key: string; expiresAt: number }

function utcDayWindow(prefix: string, now = new Date()): BudgetWindow {
  const end = new Date(now)
  end.setUTCHours(23, 59, 59, 999)
  return {
    key: `gearavail:ratelimit:${prefix}:${now.toISOString().slice(0, 10)}`,
    expiresAt: end.getTime(),
  }
}

function utcHourWindow(prefix: string, now = new Date()): BudgetWindow {
  const end = new Date(now)
  end.setUTCMinutes(59, 59, 999)
  return {
    // Includes the hour, so each clock hour accumulates into its own key.
    key: `gearavail:ratelimit:${prefix}:${now.toISOString().slice(0, 13)}`,
    expiresAt: end.getTime(),
  }
}

export type BudgetResult = { allowed: boolean; used: number; limit: number }

async function consumeWindow(
  window: BudgetWindow,
  limit: number,
  cost: number,
): Promise<BudgetResult> {
  const redis = getRedis()

  if (redis) {
    const used = await redis.incrby(window.key, cost)
    // Only set the expiry on first write; re-setting it every call would keep
    // pushing the reset forward and the budget would never roll over.
    if (used === cost) {
      await redis.pexpireat(window.key, window.expiresAt)
    }
    return { allowed: used <= limit, used, limit }
  }

  const now = Date.now()
  const entry = memoryCounters.get(window.key)
  if (!entry || entry.resetAt < now) {
    memoryCounters.set(window.key, { count: cost, resetAt: window.expiresAt })
    return { allowed: cost <= limit, used: cost, limit }
  }
  entry.count += cost
  return { allowed: entry.count <= limit, used: entry.count, limit }
}

/**
 * Consume one unit of a per-UTC-calendar-day budget. Returns allowed=false once
 * it is spent. This is eBay's window, matching the quota eBay actually enforces.
 */
export async function consumeDailyBudget(
  prefix: string,
  limit: number,
  cost = 1,
): Promise<BudgetResult> {
  return consumeWindow(utcDayWindow(prefix), limit, cost)
}

/**
 * Consume one unit of a per-clock-hour budget, resetting on the hour.
 *
 * Used by /api/ask. The assistant is unauthenticated by design (a shopper
 * should be able to ask a question without making an account), so the ceiling
 * on abuse is the Groq bill and an hour is the right amount of time to make a
 * scraper wait and the wrong amount to punish a real shopper for.
 */
export async function consumeHourlyBudget(
  prefix: string,
  limit: number,
  cost = 1,
): Promise<BudgetResult> {
  return consumeWindow(utcHourWindow(prefix), limit, cost)
}

export async function budgetRemaining(prefix: string, limit: number): Promise<number> {
  const { key } = utcDayWindow(prefix)
  const redis = getRedis()
  if (redis) {
    const raw = await redis.get(key)
    return Math.max(0, limit - Number.parseInt(raw ?? "0", 10))
  }
  const entry = memoryCounters.get(key)
  if (!entry || entry.resetAt < Date.now()) return limit
  return Math.max(0, limit - entry.count)
}

/** Test hook. Never called from application code. */
export function __resetBudgets(): void {
  memoryCounters.clear()
}

/* -------------------------------------------------------------------------- */
/*  Retry                                                                     */
/* -------------------------------------------------------------------------- */

export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  /** Injectable so tests do not actually sleep. */
  sleepImpl?: (ms: number) => Promise<void>
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Status codes worth retrying: rate limiting and transient server faults. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600)
}

function statusOf(error: unknown): number | null {
  const s = (error as { status?: unknown })?.status
  return typeof s === "number" ? s : null
}

/**
 * Exponential backoff with full jitter.
 *
 * Jitter matters more than the exponent here: several workers that all back off
 * by exactly 2s, 4s, 8s will retry in lockstep and rebuild the same spike that
 * triggered the 429. Randomising across the whole interval spreads them out.
 */
export async function withBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 5
  const baseDelay = options.baseDelayMs ?? 2000
  const maxDelay = options.maxDelayMs ?? 60_000
  const doSleep = options.sleepImpl ?? sleep

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const status = statusOf(error)
      // A 400 or 403 will fail identically on every retry; only spend attempts
      // on faults that might actually clear.
      if (status != null && !isRetryableStatus(status)) throw error
      if (attempt === attempts - 1) break

      const ceiling = Math.min(maxDelay, baseDelay * 2 ** attempt)
      const delay = Math.floor(Math.random() * ceiling)
      options.onRetry?.(attempt + 1, delay, error)
      await doSleep(delay)
    }
  }
  throw lastError
}

/** Daily budget key for the eBay feed, shared by every eBay job. */
export const EBAY_BUDGET_KEY = "ebay-feed"

export async function guardEbayCall(cost = 1): Promise<BudgetResult> {
  return consumeDailyBudget(EBAY_BUDGET_KEY, env.ebay.dailyCallBudget, cost)
}
