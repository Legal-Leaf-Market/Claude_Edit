# Legal Leaf — Growth & Resilience Plan

Status: **planning only, not yet built.** Written to preserve the roadmap
between sessions so we don't burn credits re-deriving it.

## The verdict, distilled

- Schema/metadata = done. Table stakes; won't drive traffic on its own.
- Real gaps:
  1. **Zero editorial content** → ranks for nothing but the brand name.
  2. **4-store scraper fragility** → business dies silently if a scraper breaks.
  3. **No growth channel** → Meta/Google ban hemp ads, so we need organic + referral.
- Fix order: **Content moat → Scraper monitoring → Influencer tracking.**
  Content first because it compounds and is cheapest to ship.

## Current app structure (as of this plan)

- `app/page.tsx` — the live price-comparison grid (main product).
- `app/sign-in/`, `app/sign-up/` — Better Auth email+password.
- `app/robots.ts`, `app/sitemap.ts` — already added.
- `app/api/cron/watch-alerts/route.ts` — existing cron (guarded by `CRON_SECRET`).
- Key libs to reuse: `lib/aggregator.ts`, `lib/products.ts`
  (`discountedPrice`/`discountPercent`/`checkoutUrlFor`), `lib/email.ts`,
  `lib/structured-data.ts`.
- `app/` is otherwise a clean slate for content.

---

## Phase 1 — SEO content moat (DO FIRST)

### Architecture (best for SEO)

- New route group `app/(content)/` with one shared layout (breadcrumb + JSON-LD).
- `app/blog/page.tsx` — hub/index linking every article (internal-link equity).
- `app/blog/[slug]/page.tsx` — dynamic route reading from local `lib/articles/`
  (typed TS objects or MDX). **No database** — static content is free, instant,
  fully prerendered.
- `app/learn/thca-legal/[state]/page.tsx` — programmatic state-legality pages via
  `generateStaticParams` (50 pages from one template + a data file). Highest-intent,
  highest-volume queries ("is THCA legal in Texas").
- Every article page: `Article`/`BlogPosting` JSON-LD, `generateMetadata` for
  per-page title/description/OG, and auto-inclusion in `sitemap.ts`.

### Content, prioritized by intent (buyer-ready → informational)

1. **State legality pages** (`/learn/thca-legal/[state]`) — highest ROI, pure
   high-intent traffic.
2. **"Cheapest THCA Flower 2026: True Cost by $/100mg"** — unique moat angle,
   ties directly to the app's core feature.
3. **"THCA vs Delta-8 vs Delta-9"** — huge informational volume, funnels to grid.
4. **"The Federal Hemp Ban: What Happens to THCA"** — urgency / "stock up" CTA.
5. **"How to Read a COA Like a Pro"** — trust / E-E-A-T signal.
6. Remaining briefs: best earthy/piney strains, bulk vs eighths, concentrates,
   greenhouse light-dep, spotting fake deals.

### Notes on the supplied drafts (Gemini's articles)

- **Rewrite before publishing.** Remove unverifiable legal specifics (exact bill
  numbers, dates, mg caps) unless fact-checked against current sources at build
  time — publishing wrong legal facts is a liability on a hemp site.
- Add internal links from each article to live grid filters so content funnels
  to conversion.

### Build cost

- Session A: route scaffolding + blog hub + article template + 2 flagship
  articles (state-legality + $/100mg). **Start here on reload.**
- Session B: remaining articles.
- Session C: state-legality generator + data file.

---

## Phase 2 — Scraper-break monitoring

- `lib/healthcheck.ts`: 2-3 canary URLs per store; run existing selectors; assert
  `price` is a finite `Number` and `title` is non-empty.
- `app/api/cron/healthcheck/route.ts` guarded by `CRON_SECRET` (same pattern as
  the alert cron); add hourly entry to `vercel.json`.
- On `null`/`NaN`: POST to a Discord/Slack webhook (free; cheaper than Twilio).
  Env var `ALERT_WEBHOOK_URL`.
- Reuses aggregator + cron infra, so it's small. **~1 session.**

---

## Phase 3 — Influencer referral tracking

- Read `?ref=<name>` in a small client effect (copy the existing `?add=` pattern),
  drop a 30-day cookie.
- Append the ref tag to outbound "Checkout at [Store]" URLs (`checkoutUrlFor`
  already builds these — one param to add).
- Optional `referral` table (Neon) only if a dashboard is wanted; skip initially
  and use UTM + cookie to stay free. **~1 session.**

---

## Recommended next action (budget-aware)

Do **Phase 1, Session A only** first: scaffold `(content)` group + article
template + the 2 flagship articles. That yields indexable, high-intent pages and
proves the pattern; everything after reuses the template cheaply.
