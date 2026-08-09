import { Resend } from "resend"
import { env } from "@/lib/env"
import { formatPrice, sourceLabel } from "@/lib/utils"

/**
 * Outbound notifications for price alerts.
 *
 * Both channels are optional and both no-op with a logged warning when their
 * credentials are absent, following the same rule as every other integration
 * here: a missing key degrades a feature, it never crashes a cron.
 */

export type AlertMatchPayload = {
  listingId: string
  title: string
  priceCents: number
  currency: string
  source: string
  condition: string | null
  marketPriceCents: number | null
  gearSlug: string | null
}

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!env.alerts.canEmail) return null
  if (!resendClient) resendClient = new Resend(env.alerts.resendApiKey)
  return resendClient
}

/* -------------------------------------------------------------------------- */
/*  Email                                                                     */
/* -------------------------------------------------------------------------- */

function matchRows(matches: AlertMatchPayload[]): string {
  return matches
    .map((match) => {
      const saving =
        match.marketPriceCents != null && match.marketPriceCents > match.priceCents
          ? ` <span style="color:#16a34a">(${Math.round(
              ((match.marketPriceCents - match.priceCents) / match.marketPriceCents) * 100,
            )}% below market)</span>`
          : ""
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
            <a href="${env.site.url}/go/${match.listingId}"
               style="color:#111827;font-weight:600;text-decoration:none">${escapeHtml(match.title)}</a>
            <div style="margin-top:4px;color:#6b7280;font-size:14px">
              <strong style="color:#111827">${formatPrice(match.priceCents, match.currency)}</strong>${saving}
              &middot; ${sourceLabel(match.source)}${match.condition ? ` &middot; ${escapeHtml(match.condition)}` : ""}
            </div>
          </td>
        </tr>`
    })
    .join("")
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendAlertEmail(
  to: string,
  query: string,
  matches: AlertMatchPayload[],
): Promise<boolean> {
  const client = getResend()
  if (!client) {
    console.warn("[notify] RESEND_API_KEY is unset; skipping alert email")
    return false
  }
  if (matches.length === 0) return false

  const subject =
    matches.length === 1
      ? `${matches[0].title} is listed at ${formatPrice(matches[0].priceCents)}`
      : `${matches.length} new matches for "${query}"`

  try {
    await client.emails.send({
      from: env.alerts.fromEmail,
      to,
      subject,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827">
            New gear matching "${escapeHtml(query)}"
          </p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:14px">
            Used inventory moves fast, so these may not last long.
          </p>
          <table style="width:100%;border-collapse:collapse">${matchRows(matches)}</table>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">
            You are getting this because you saved a price alert on MusicTime.
            <a href="${env.site.url}/alerts" style="color:#6b7280">Manage your alerts</a>.
            MusicTime earns a commission if you buy through these links, at no cost to you.
          </p>
        </div>`,
    })
    return true
  } catch (error) {
    console.error(
      `[notify] email send failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}

/* -------------------------------------------------------------------------- */
/*  Discord                                                                   */
/* -------------------------------------------------------------------------- */

export async function sendDiscordAlert(
  query: string,
  matches: AlertMatchPayload[],
): Promise<boolean> {
  if (!env.alerts.canDiscord) {
    console.warn("[notify] DISCORD_WEBHOOK_URL is unset; skipping Discord alert")
    return false
  }
  if (matches.length === 0) return false

  try {
    const response = await fetch(env.alerts.discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "MusicTime",
        // Discord caps embeds at 10 per message.
        embeds: matches.slice(0, 10).map((match) => ({
          title: match.title.slice(0, 250),
          url: `${env.site.url}/go/${match.listingId}`,
          color: 0xf0a830,
          fields: [
            { name: "Price", value: formatPrice(match.priceCents, match.currency), inline: true },
            { name: "Source", value: sourceLabel(match.source), inline: true },
            ...(match.condition
              ? [{ name: "Condition", value: match.condition, inline: true }]
              : []),
          ],
          footer: { text: `Alert: ${query}`.slice(0, 2048) },
        })),
      }),
    })
    if (!response.ok) {
      console.error(`[notify] Discord webhook returned ${response.status}`)
      return false
    }
    return true
  } catch (error) {
    console.error(
      `[notify] Discord send failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}
