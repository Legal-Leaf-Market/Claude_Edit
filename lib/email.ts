import { Resend } from "resend"
import type { WatchAlert } from "@/lib/watch-alerts"

// Sends from the verified legal-leafmarket.com domain so alerts reach any
// recipient (not just the Resend account owner). Override with EMAIL_FROM if
// you want a different verified sender address.
const FROM = process.env.EMAIL_FROM ?? "Legal Leaf <alerts@legal-leafmarket.com>"

// Absolute base URL for links/images in the email (emails have no relative
// base). Prefers an explicit override, then the deployment URL, then the
// production domain.
function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  if (explicit) return explicit.replace(/\/+$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://legal-leafmarket.com"
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const CANNABINOID_LABEL: Record<string, string> = {
  thca: "THCA",
  cbd: "CBD",
  d8: "Delta-8",
  d9: "Delta-9",
  other: "",
}

// A single rich product "card" row, styled to mirror the on-site card:
// image, badges, strain, discounted pricing, and two CTAs.
function alertCardHtml(a: WatchAlert, base: string): string {
  const isRestock = a.kind === "restock"
  const eventBadge = isRestock
    ? `<span style="display:inline-block;background:#c6f135;color:#071423;font-weight:800;font-size:11px;letter-spacing:0.04em;padding:4px 10px;border-radius:999px">BACK IN STOCK</span>`
    : `<span style="display:inline-block;background:#c6f135;color:#071423;font-weight:800;font-size:11px;letter-spacing:0.04em;padding:4px 10px;border-radius:999px">PRICE DROP &minus;${money(Math.abs(a.delta))}</span>`

  const cannaLabel = CANNABINOID_LABEL[a.cannabinoid] || ""
  const metaChips = [cannaLabel, a.potencyPct ? `${a.potencyPct}%` : "", a.category]
    .filter(Boolean)
    .map(
      (t) =>
        `<span style="display:inline-block;background:#f1f5f0;color:#374151;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;margin:0 4px 4px 0">${escapeHtml(
          t,
        )}</span>`,
    )
    .join("")

  // Price block: struck saved price -> current, then the discounted "with code"
  // out-the-door price highlighted like the site card.
  const priceBlock = isRestock
    ? `<div style="font-size:15px;color:#111827;font-weight:800">${money(a.currentPrice)}</div>`
    : `<div style="font-size:13px;color:#9ca3af"><s>${money(a.savedPrice)}</s> &rarr;
         <span style="color:#0f5132;font-weight:800;font-size:15px">${money(a.currentPrice)}</span>
       </div>`

  const discountLine =
    a.discountPercent > 0
      ? `<div style="margin-top:6px;font-size:14px;color:#071423">
           <strong style="color:#0f5132;font-size:17px">${money(a.discountedPrice)}</strong>
           <span style="font-size:12px;color:#6b7280"> with code </span>
           <span style="background:#071423;color:#c6f135;font-weight:800;font-size:11px;padding:2px 8px;border-radius:6px;letter-spacing:0.03em">${escapeHtml(
             a.discountCode,
           )}</span>
           <span style="font-size:12px;color:#16a34a;font-weight:700"> (${a.discountPercent}% off)</span>
         </div>`
      : ""

  const ppgLine = a.ppgDisplay
    ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">${escapeHtml(a.ppgDisplay)}</div>`
    : ""

  const img = a.imageUrl
    ? `<img src="${escapeHtml(a.imageUrl)}" width="120" height="120" alt="${escapeHtml(
        a.title,
      )}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;display:block;background:#f1f5f0" />`
    : `<div style="width:120px;height:120px;border-radius:12px;background:#f1f5f0"></div>`

  // Two CTAs: add to the Legal Leaf cart (returns to the site) and buy now
  // (deep link straight into the store cart with the discount applied).
  const addUrl = `${base}/?add=${encodeURIComponent(a.title)}`
  const buyUrl = a.checkoutUrl || a.url

  return `
  <tr>
    <td style="padding:0 0 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;overflow:hidden">
        <tr>
          <td width="120" valign="top" style="padding:14px 0 14px 14px">${img}</td>
          <td valign="top" style="padding:14px">
            ${eventBadge}
            <div style="margin-top:8px;font-size:16px;font-weight:800;color:#071423;line-height:1.25">${escapeHtml(
              a.title,
            )}</div>
            <div style="margin-top:2px;font-size:13px;color:#6b7280">${escapeHtml(
              [a.strainName, a.storeName].filter(Boolean).join(" \u00b7 "),
            )}</div>
            <div style="margin-top:8px">${metaChips}</div>
            <div style="margin-top:8px">${priceBlock}${discountLine}${ppgLine}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 14px 14px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:5px">
                  <a href="${escapeHtml(addUrl)}" style="display:block;text-align:center;background:#ffffff;border:1.5px solid #0f5132;color:#0f5132;text-decoration:none;font-weight:800;font-size:13px;padding:11px 8px;border-radius:12px">Add to Legal Leaf cart</a>
                </td>
                <td width="50%" style="padding-left:5px">
                  <a href="${escapeHtml(buyUrl)}" style="display:block;text-align:center;background:#0f5132;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:11px 8px;border-radius:12px">Buy now &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

export function buildAlertEmailHtml(name: string, alerts: WatchAlert[]): string {
  const base = siteUrl()
  const rows = alerts.map((a) => alertCardHtml(a, base)).join("")
  const count = alerts.length
  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
        <tr><td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
            <tr><td style="padding:0 20px 16px">
              <div style="font-size:20px;font-weight:900;color:#0f5132;letter-spacing:-0.02em">Legal Leaf</div>
              <div style="font-size:13px;color:#6b7280;margin-top:2px">Watchlist alerts</div>
            </td></tr>
            <tr><td style="padding:20px;background:#071423;border-radius:16px">
              <div style="font-size:18px;font-weight:800;color:#ffffff">Hi ${escapeHtml(
                name,
              )}, we found ${count} update${count === 1 ? "" : "s"} on your watchlist</div>
              <div style="font-size:13px;color:#a7f3d0;margin-top:6px">Prices you saved dropped or items came back in stock. Add them to your Legal Leaf cart or buy now with your discount applied.</div>
            </td></tr>
            <tr><td style="height:16px"></td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            </td></tr>
            <tr><td style="padding:6px 20px 0">
              <a href="${escapeHtml(base)}" style="display:block;text-align:center;background:#c6f135;color:#071423;text-decoration:none;font-weight:800;font-size:14px;padding:13px;border-radius:12px">Browse all deals on Legal Leaf</a>
            </td></tr>
            <tr><td style="padding:14px 20px 0;font-size:11px;color:#9ca3af;line-height:1.6">
              You're receiving this because you saved these items to your Legal Leaf watchlist. Prices are estimates from live store data and may change at checkout. Discounts apply via code at the store's checkout.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`
}

// ---------------------------------------------------------------------------
// Watchlist "saved" confirmation email (Google Flights style). Deliberately
// lightweight: it uses only the snapshot fields already stored on the row, so
// it needs no live-inventory fetch or discount enrichment (keeps sends cheap).
// ---------------------------------------------------------------------------
export type SavedItem = {
  title: string
  strainName: string
  storeName: string
  link: string
  imageUrl: string
  price: number
  inStock: boolean
}

function savedCardHtml(item: SavedItem, base: string): string {
  const img = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" width="88" height="88" alt="${escapeHtml(
        item.title,
      )}" style="width:88px;height:88px;object-fit:cover;border-radius:12px;display:block;background:#f1f5f0" />`
    : `<div style="width:88px;height:88px;border-radius:12px;background:#f1f5f0"></div>`
  const stock = item.inStock
    ? `<span style="color:#0f5132;font-weight:700">In stock</span>`
    : `<span style="color:#b45309;font-weight:700">Currently out of stock</span>`
  const viewUrl = `${base}/?add=${encodeURIComponent(item.title)}`
  return `
  <tr>
    <td style="padding:0 0 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff">
        <tr>
          <td width="88" valign="top" style="padding:12px 0 12px 12px">${img}</td>
          <td valign="top" style="padding:12px">
            <div style="font-size:15px;font-weight:800;color:#071423;line-height:1.25">${escapeHtml(
              item.title,
            )}</div>
            <div style="margin-top:2px;font-size:12px;color:#6b7280">${escapeHtml(
              [item.strainName, item.storeName].filter(Boolean).join(" \u00b7 "),
            )}</div>
            <div style="margin-top:6px;font-size:14px;color:#111827"><strong>${money(
              item.price,
            )}</strong> <span style="font-size:12px;color:#6b7280">saved price</span></div>
            <div style="margin-top:2px;font-size:12px">${stock}</div>
            <div style="margin-top:8px"><a href="${escapeHtml(
              viewUrl,
            )}" style="display:inline-block;background:#0f5132;color:#ffffff;text-decoration:none;font-weight:800;font-size:12px;padding:8px 14px;border-radius:10px">View on Legal Leaf &rarr;</a></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

export function buildSavedEmailHtml(name: string, items: SavedItem[]): string {
  const base = siteUrl()
  const rows = items.map((i) => savedCardHtml(i, base)).join("")
  const count = items.length
  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
        <tr><td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
            <tr><td style="padding:0 20px 16px">
              <div style="font-size:20px;font-weight:900;color:#0f5132;letter-spacing:-0.02em">Legal Leaf</div>
              <div style="font-size:13px;color:#6b7280;margin-top:2px">Watchlist confirmation</div>
            </td></tr>
            <tr><td style="padding:20px;background:#071423;border-radius:16px">
              <div style="font-size:18px;font-weight:800;color:#ffffff">Hi ${escapeHtml(
                name,
              )}, we're now tracking ${count} item${count === 1 ? "" : "s"} for you</div>
              <div style="font-size:13px;color:#a7f3d0;margin-top:6px">We saved your price and we'll email you the moment ${
                count === 1 ? "it" : "any of these"
              } drop${count === 1 ? "s" : ""} in price or come${
                count === 1 ? "s" : ""
              } back in stock.</div>
            </td></tr>
            <tr><td style="height:16px"></td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            </td></tr>
            <tr><td style="padding:6px 20px 0">
              <a href="${escapeHtml(base)}" style="display:block;text-align:center;background:#c6f135;color:#071423;text-decoration:none;font-weight:800;font-size:14px;padding:13px;border-radius:12px">Browse all deals on Legal Leaf</a>
            </td></tr>
            <tr><td style="padding:14px 20px 0;font-size:11px;color:#9ca3af;line-height:1.6">
              You're receiving this because you saved ${
                count === 1 ? "this item" : "these items"
              } to your Legal Leaf watchlist. Prices are estimates from live store data and may change at checkout.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`
}

// Sends the "we're tracking this" confirmation. Fire-and-forget friendly:
// throws only on hard config errors; callers wrap in try/catch so a mail
// failure never blocks the save itself.
export async function sendWatchSavedEmail(to: string, name: string, items: SavedItem[]) {
  if (!items.length) return
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set")
  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject =
    items.length === 1
      ? `Tracking ${items[0].title} on your Legal Leaf watchlist`
      : `Tracking ${items.length} items on your Legal Leaf watchlist`
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: buildSavedEmailHtml(name || "there", items),
  })
  if (result.error) throw new Error(result.error.message || "Resend rejected the email")
  return result
}

// Sends a watchlist alert email. Returns the Resend result or throws on config
// errors so callers can surface a clear message.
export async function sendWatchAlertEmail(to: string, name: string, alerts: WatchAlert[]) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set")
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const count = alerts.length
  const subject =
    count === 1
      ? `Watchlist alert: ${alerts[0].kind === "restock" ? "back in stock" : "price drop"} on ${alerts[0].title}`
      : `${count} watchlist updates on Legal Leaf`

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: buildAlertEmailHtml(name || "there", alerts),
  })
  // The Resend SDK returns { data, error } and does NOT throw on API errors
  // (e.g. unverified domain, invalid recipient). Surface those as thrown
  // errors so callers report an accurate status instead of false success.
  if (result.error) {
    throw new Error(result.error.message || "Resend rejected the email")
  }
  return result
}
