import { sql } from "drizzle-orm"
import { Resend } from "resend"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { formatPrice, sourceLabel } from "@/lib/utils"

/**
 * The weekly digest.
 *
 * A list nobody sends to is worth nothing, so this is the half that makes the
 * signup form real. Content is drawn entirely from what actually happened in
 * the past week rather than from a template: the biggest genuine discounts,
 * what is newly listed, and what the community posted. If a week produces
 * nothing worth reading, it sends nothing at all, because a habitual empty
 * email trains people to ignore the ones that matter.
 *
 * Sends are sequential and failures are per-recipient. One bad address must
 * not abort the run, and Resend's rate limits are friendlier to a steady
 * trickle than to a burst.
 */

const MIN_ITEMS_TO_SEND = 3
/** Guards the free tier and a runaway list; the rest roll to the next run. */
const MAX_RECIPIENTS_PER_RUN = 400

export type DigestItem = {
  id: string
  title: string
  price_cents: number
  currency: string
  source: string
  condition: string | null
  deal_margin: number | null
  gear_slug: string | null
}

export type DigestPost = {
  id: string
  kind: string
  title: string
  author_name: string | null
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Biggest genuine discounts listed in the past week. */
async function weeklyDeals(limit = 6): Promise<DigestItem[]> {
  const result = await db.execute<DigestItem>(sql`
    SELECT l.id, l.title, l.price_cents, l.currency, l.source, l.condition,
           l.deal_margin, g.slug AS gear_slug
    FROM marketplace_listings l
    LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
    WHERE l.listing_status = 'active'
      AND l.is_deal
      AND l.deal_margin IS NOT NULL
      AND COALESCE(l.listed_at, l.created_at) > now() - interval '7 days'
    ORDER BY l.deal_margin DESC
    LIMIT ${limit}
  `)
  return result.rows
}

/** New arrivals, one per store, so a big catalogue cannot fill the whole email. */
async function weeklyArrivals(limit = 6): Promise<DigestItem[]> {
  const result = await db.execute<DigestItem>(sql`
    SELECT id, title, price_cents, currency, source, condition, deal_margin, gear_slug
    FROM (
      SELECT l.id, l.title, l.price_cents, l.currency, l.source, l.condition,
             l.deal_margin, g.slug AS gear_slug,
             ROW_NUMBER() OVER (PARTITION BY l.source ORDER BY COALESCE(l.listed_at, l.created_at) DESC) AS rn
      FROM marketplace_listings l
      LEFT JOIN canonical_gear g ON g.id = l.canonical_gear_id
      WHERE l.listing_status = 'active'
        AND COALESCE(l.listed_at, l.created_at) > now() - interval '7 days'
    ) ranked
    WHERE rn = 1
    LIMIT ${limit}
  `)
  return result.rows
}

/** Community posts from the past week, newest first. */
async function weeklyPosts(limit = 5): Promise<DigestPost[]> {
  const result = await db.execute<DigestPost>(sql`
    SELECT t.id, t.kind, t.title, u.name AS author_name
    FROM flip_threads t
    LEFT JOIN "user" u ON u.id = t.author_id
    WHERE t.status = 'open' AND t.created_at > now() - interval '7 days'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `)
  return result.rows
}

function itemRows(items: DigestItem[]): string {
  return items
    .map((item) => {
      const off =
        item.deal_margin != null && item.deal_margin > 0
          ? ` <span style="color:#16a34a">(${Math.round(item.deal_margin * 100)}% below market)</span>`
          : ""
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
            <a href="${env.site.url}/go/${item.id}"
               style="color:#111827;font-weight:600;text-decoration:none">${escapeHtml(item.title)}</a>
            <div style="margin-top:4px;color:#6b7280;font-size:14px">
              <strong style="color:#111827">${formatPrice(item.price_cents, item.currency)}</strong>${off}
              &middot; ${escapeHtml(sourceLabel(item.source))}${item.condition ? ` &middot; ${escapeHtml(item.condition)}` : ""}
            </div>
          </td>
        </tr>`
    })
    .join("")
}

function postRows(posts: DigestPost[]): string {
  return posts
    .map(
      (post) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb">
            <a href="${env.site.url}/posts/${post.id}"
               style="color:#111827;font-weight:600;text-decoration:none">${escapeHtml(post.title)}</a>
            <div style="margin-top:3px;color:#6b7280;font-size:13px">
              ${escapeHtml(post.kind)}${post.author_name ? ` &middot; ${escapeHtml(post.author_name)}` : ""}
            </div>
          </td>
        </tr>`,
    )
    .join("")
}

function buildHtml({
  deals,
  arrivals,
  posts,
  unsubscribeUrl,
}: {
  deals: DigestItem[]
  arrivals: DigestItem[]
  posts: DigestPost[]
  unsubscribeUrl: string
}): string {
  const section = (title: string, body: string) =>
    body
      ? `<h2 style="margin:28px 0 4px;font-size:16px;color:#111827">${title}</h2>
         <table width="100%" cellpadding="0" cellspacing="0">${body}</table>`
      : ""

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b45309;font-weight:700">The weekly hunt</p>
    <h1 style="margin:0 0 6px;font-size:22px;color:#111827">What turned up this week</h1>
    <p style="margin:0;color:#6b7280;font-size:14px">
      Every price here is what the seller is asking right now. We earn a commission if you buy
      through a link, which never changes your price.
    </p>

    ${section("Biggest discounts", itemRows(deals))}
    ${section("Newly listed", itemRows(arrivals))}
    ${section("From the boards", postRows(posts))}

    <p style="margin:32px 0 0;color:#6b7280;font-size:13px">
      <a href="${env.site.url}/feed" style="color:#b45309">See everything on Gear Avail</a>
    </p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">
      You are getting this because you signed up at gearavail.com. No fees, no cut of your sale,
      and we never sell this list.
      <br />
      <a href="${unsubscribeUrl}" style="color:#9ca3af">Unsubscribe</a>
    </p>
  </div>`
}

export type DigestResult = {
  status: "sent" | "skipped"
  reason?: string
  recipients: number
  failed: number
  items: number
}

export async function sendWeeklyDigest(): Promise<DigestResult> {
  if (!env.alerts.canEmail) {
    console.warn("[digest] RESEND_API_KEY unset, skipping")
    return { status: "skipped", reason: "email-unconfigured", recipients: 0, failed: 0, items: 0 }
  }

  const [deals, arrivals, posts] = await Promise.all([
    weeklyDeals(),
    weeklyArrivals(),
    weeklyPosts(),
  ])
  const items = deals.length + arrivals.length + posts.length

  // A thin week is not worth an email. Sending one anyway is how a list
  // learns to ignore you.
  if (items < MIN_ITEMS_TO_SEND) {
    return { status: "skipped", reason: "not-enough-content", recipients: 0, failed: 0, items }
  }

  const recipients = await db.execute<{ email: string; unsubscribe_token: string }>(sql`
    SELECT email, unsubscribe_token::text AS unsubscribe_token
    FROM subscribers
    WHERE is_active
    ORDER BY created_at ASC
    LIMIT ${MAX_RECIPIENTS_PER_RUN}
  `)
  if (recipients.rows.length === 0) {
    return { status: "skipped", reason: "no-subscribers", recipients: 0, failed: 0, items }
  }

  const resend = new Resend(env.alerts.resendApiKey)
  let failed = 0

  for (const row of recipients.rows) {
    const unsubscribeUrl = `${env.site.url}/unsubscribe?token=${row.unsubscribe_token}`
    try {
      await resend.emails.send({
        from: env.alerts.fromEmail,
        to: row.email,
        subject: "What turned up this week",
        html: buildHtml({ deals, arrivals, posts, unsubscribeUrl }),
        // Lets a mail client offer unsubscribe in its own chrome, which is
        // both better for the reader and better for deliverability.
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })
    } catch (error) {
      failed += 1
      console.error(
        `[digest] send failed for one recipient: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return {
    status: "sent",
    recipients: recipients.rows.length - failed,
    failed,
    items,
  }
}
