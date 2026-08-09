import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { alertMatches, savedAlerts, user } from "@/lib/db/schema"
import { sendAlertEmail, sendDiscordAlert, type AlertMatchPayload } from "@/lib/notify"

/**
 * Saved price alert evaluation.
 *
 * Runs after every ingest. The design constraint that shapes everything here is
 * that the hourly snapshot touches most of the catalogue, so a naive "find
 * matches and email them" would re-send the same guitar every hour forever.
 *
 * alert_matches is the guard: one row per (alert, listing) already notified,
 * with a unique index. We insert BEFORE sending and let ON CONFLICT DO NOTHING
 * tell us which ones are genuinely new. Inserting first means a crash between
 * insert and send loses a notification, which is far better than the reverse,
 * where a retry loop mails someone the same listing repeatedly.
 */

/** Never mail someone a wall of listings from one run. */
const MAX_MATCHES_PER_ALERT = 12

export type AlertEvaluation = {
  alertsEvaluated: number
  matchesFound: number
  notificationsSent: number
  errors: number
}

type AlertRow = {
  id: string
  userId: string
  query: string
  maxPriceCents: number | null
  sourceFilter: string | null
  conditionFilter: string | null
  channel: string
  email: string | null
}

async function activeAlerts(): Promise<AlertRow[]> {
  const rows = await db
    .select({
      id: savedAlerts.id,
      userId: savedAlerts.userId,
      query: savedAlerts.query,
      maxPriceCents: savedAlerts.maxPriceCents,
      sourceFilter: savedAlerts.sourceFilter,
      conditionFilter: savedAlerts.conditionFilter,
      channel: savedAlerts.channel,
      email: user.email,
    })
    .from(savedAlerts)
    .leftJoin(user, eq(user.id, savedAlerts.userId))
    .where(eq(savedAlerts.isActive, true))
  return rows
}

/**
 * Listings matching one alert.
 *
 * Text matching mirrors the Postgres search backend so an alert fires on the
 * same rows the shopper would have seen had they run the search by hand. An
 * alert that matches differently to its own saved search is a bug report
 * waiting to happen.
 */
async function matchesForAlert(alert: AlertRow): Promise<AlertMatchPayload[]> {
  const result = await db.execute<{
    id: string
    title: string
    price_cents: number
    currency: string
    source: string
    condition: string | null
    market_price_cents: number | null
    gear_slug: string | null
  }>(sql`
    SELECT
      l.id, l.title, l.price_cents, l.currency, l.source, l.condition,
      g.avg_used_price_cents AS market_price_cents, g.slug AS gear_slug
    FROM marketplace_listings l
    LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
    WHERE l.listing_status = 'active'
      AND (
        l.title ILIKE ${"%" + alert.query + "%"}
        OR similarity(l.title, ${alert.query}) > 0.3
        OR g.model ILIKE ${"%" + alert.query + "%"}
      )
      ${alert.maxPriceCents != null ? sql`AND l.price_cents <= ${alert.maxPriceCents}` : sql``}
      ${alert.sourceFilter ? sql`AND l.source = ${alert.sourceFilter}` : sql``}
      ${alert.conditionFilter ? sql`AND l.condition = ${alert.conditionFilter}` : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM alert_matches m
        WHERE m.alert_id = ${alert.id} AND m.listing_id = l.id
      )
    ORDER BY l.price_cents ASC
    LIMIT ${MAX_MATCHES_PER_ALERT}
  `)

  return result.rows.map((row) => ({
    listingId: row.id,
    title: row.title,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    source: row.source,
    condition: row.condition,
    marketPriceCents: row.market_price_cents == null ? null : Number(row.market_price_cents),
    gearSlug: row.gear_slug,
  }))
}

/**
 * Claim matches by inserting them, and return only the ones this run won.
 * The unique index on (alert_id, listing_id) makes this safe against two
 * workers evaluating the same alert at once.
 */
async function claimMatches(
  alertId: string,
  matches: AlertMatchPayload[],
): Promise<AlertMatchPayload[]> {
  if (matches.length === 0) return []

  const claimed = await db
    .insert(alertMatches)
    .values(
      matches.map((match) => ({
        alertId,
        listingId: match.listingId,
        priceCentsAtMatch: match.priceCents,
      })),
    )
    .onConflictDoNothing()
    .returning({ listingId: alertMatches.listingId })

  const claimedIds = new Set(claimed.map((row) => row.listingId))
  return matches.filter((match) => claimedIds.has(match.listingId))
}

export async function evaluateAlerts(): Promise<AlertEvaluation> {
  const alerts = await activeAlerts()
  const summary: AlertEvaluation = {
    alertsEvaluated: 0,
    matchesFound: 0,
    notificationsSent: 0,
    errors: 0,
  }

  for (const alert of alerts) {
    summary.alertsEvaluated += 1
    try {
      const candidates = await matchesForAlert(alert)
      const fresh = await claimMatches(alert.id, candidates)
      summary.matchesFound += fresh.length

      if (fresh.length > 0) {
        const wantsEmail = alert.channel === "email" || alert.channel === "both"
        const wantsDiscord = alert.channel === "discord" || alert.channel === "both"

        if (wantsEmail && alert.email) {
          if (await sendAlertEmail(alert.email, alert.query, fresh)) summary.notificationsSent += 1
        }
        if (wantsDiscord) {
          if (await sendDiscordAlert(alert.query, fresh)) summary.notificationsSent += 1
        }
      }

      await db
        .update(savedAlerts)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(savedAlerts.id, alert.id))
    } catch (error) {
      summary.errors += 1
      console.error(
        `[alerts] alert ${alert.id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return summary
}

/**
 * Drop notification records for listings that have gone. Without this the table
 * grows without bound, and a relisted item could never alert again.
 */
export async function pruneAlertMatches(olderThanDays = 90): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`
    WITH deleted AS (
      DELETE FROM alert_matches
      WHERE notified_at < NOW() - ${`${olderThanDays} days`}::interval
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `)
  return Number(result.rows[0]?.count ?? 0)
}

/** Alerts belonging to one user, for the management page. */
export async function alertsForUser(userId: string) {
  return db
    .select()
    .from(savedAlerts)
    .where(and(eq(savedAlerts.userId, userId)))
    .orderBy(savedAlerts.createdAt)
}
