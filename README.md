# Gear Avail

A used and vintage music gear aggregator. It pulls listings from eBay and
Reverb, works out which listings are the same physical instrument, computes a
market price for each one, and shows every live price side by side with the
genuinely underpriced listings marked.

Built on Next.js 16 (App Router), TypeScript, Tailwind v4, Drizzle and
PostgreSQL, with optional Typesense for search and BullMQ for ingestion.

---

## Why the data sources are what they are

v1 has two sources, and the reasons are contractual rather than technical.

| Source | How we get it | Why not another way |
|---|---|---|
| **eBay** | Buy Feed API (`/buy/feed/v1_beta`), bulk gzipped TSV | Limited Release, gated on eBay Partner Network approval. Built against **sandbox** by default. |
| **Reverb** | **Awin product datafeed**, if published to publishers | The Reverb API is scoped to managing your own shop, and their terms forbid scraping and the use of API or member data with a third-party marketing platform. |
| **Facebook Marketplace** | Not ingested | No public API. Scraping violates Meta's terms. Out of scope for v1. |

If Reverb turns out not to publish a publisher datafeed, Gear Avail ships as an
eBay-only aggregator that links out to Reverb through Awin. A single-source
aggregator that is fully compliant beats a two-source one that is not.

**Nothing here requires those credentials to run.** Every integration exposes an
`isConfigured` flag and degrades to a logged no-op, so the whole application
runs end to end against seed data before any partner approval lands.

---

## Quick start

```bash
npm install
cp .env.example .env.local          # only DATABASE_URL is required

npm run db:migrate                  # creates pg_trgm/pgcrypto, then the schema
npm run db:seed                     # realistic catalogue: 10 instruments, 80 listings
npm run dev
```

Then open http://localhost:3000. `curl localhost:3000/api/health` reports what
is configured and how fresh the data is.

The seed is deliberately awkward: it includes the same instrument listed on both
marketplaces, listings with no identifiers at all, and a price spread wide
enough for deal detection to have something to find.

### Requirements

- Node 20+
- PostgreSQL 14+ with `pg_trgm` and `pgcrypto` (the migration creates both)
- Redis, only if you want the BullMQ workers instead of the cron routes
- Typesense, only if you want it; Postgres search is a complete fallback

---

## How it fits together

```
eBay Buy Feed  ─┐
                ├─→ ingestion ─→ upsert ─→ canonical resolution ─→ deal detection
Awin datafeed  ─┘   (idempotent on source+external_id)     │
                                                            ↓
                                       search (Typesense or Postgres)
                                                            ↓
                                        storefront ─→ /go/[id] ─→ marketplace
```

**Canonical resolution** is the part that makes the product work. Four tiers,
ordered by how much the evidence deserves trust:

1. **GTIN**, a global barcode
2. **EPID**, eBay's own catalogue id
3. **brand + MPN**, since a part number names one product by definition
4. **brand-scoped trigram similarity** on the parsed model name

Anything that survives all four becomes a provisional row flagged for review.
Every tier is scoped to the brand where it can be, because "Standard" under
Gibson and "Standard" under Squier are instruments an order of magnitude apart
in price. The bias throughout is to under-merge: an unmatched listing still
appears in search, whereas a bad merge corrupts the price history of two
instruments and every deal badge derived from it.

**Deal detection** compares each listing to a rolling median of that
instrument's recent listings. Median rather than mean, because one optimist
asking a collector price would otherwise make every ordinary listing look like
a bargain. Below a minimum sample size the site publishes no market price and
flags no deals, and says so in words rather than inventing a number.

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Full suite, including integration tests against real Postgres |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from the Drizzle schema |
| `npm run db:migrate` | Apply migrations and create extensions |
| `npm run db:seed` | Reset and seed a development catalogue |
| `npm run worker` | Run BullMQ ingestion and maintenance workers |
| `npm run ingest:ebay` | Run the daily eBay pull by hand (`-- snapshot`, `-- bootstrap`) |
| `npm run ingest:reverb` | Run the Awin feed ingest by hand |
| `npm run search:reindex` | Rebuild the Typesense index |

The test suite truncates tables, so never point `DATABASE_URL` at anything you
care about while running it.

---

## Ingestion: two triggers, one implementation

The job functions live in `lib/ingestion/`. There are two ways to fire them,
and they share all their logic.

**Cron routes** (`vercel.json`), which is what a serverless deploy uses:

| Route | Schedule | Does |
|---|---|---|
| `/api/cron/ingest-ebay-daily` | 01:20 UTC | `NEWLY_LISTED` for each category |
| `/api/cron/ingest-ebay-snapshot` | hourly at :10 | Price changes, sold and ended items, then alerts |
| `/api/cron/ingest-reverb` | every 6h | Awin product datafeed |
| `/api/cron/refresh-deals` | 04:00 UTC | Full repricing, resolution sweep, index rebuild |

All four **fail closed** on `CRON_SECRET`: unset returns 503, a wrong bearer
returns 401. These routes burn the eBay call budget and send email, so an
unconfigured deploy refuses to run them rather than running them open.

**BullMQ workers** (`npm run worker`) are the alternative, and the better fit
for the weekly `ALL_ACTIVE` bootstrap feed, which is measured in gigabytes and
will not finish inside a serverless function timeout.

---

## Notes on the eBay feed

It is not a normal REST API, and the client in `lib/ingestion/ebay-feed.ts` is
shaped around four facts:

- **Success returns gzipped TSV; errors return JSON.** The parser branches on
  status, not on Content-Type.
- **`Range` is mandatory.** Files reach several GB, so they are walked in
  sequential byte ranges and reassembled.
- **Chunk boundaries fall mid-gzip-member.** A streaming inflater handles that
  natively, where buffering the whole file would not fit in memory. There is a
  test that chunks a fixture one byte at a time.
- **Columns are bound by header name, never position.** eBay adds fields to the
  ~98-column Item schema over time, and a positional parser silently shifts
  every value the day they do.

`inferredBrand`, `inferredGtin` and `inferredEpid` are eBay's own guesses from
the title, so explicit fields always win. Letting a guess claim a unique
catalogue key merges two unrelated instruments permanently.

---

## Monetisation

`/go/[listingId]` is the only outbound path on the site. It records the click,
then redirects to the affiliate URL when there is one and the raw listing URL
when there is not. Cards never link to a marketplace directly.

Click logging failures are swallowed deliberately: a click we cannot bill for
is a rounding error, a shopper who cannot reach the listing is the product
failing. Destinations are checked against an allowlist so a bad feed row cannot
turn the gateway into an open redirect.

Affiliate commission never affects ranking. Sorting is by price and discount
only, and the footer says so.

---

## Deployment

Vercel is the assumed target, matching the sister sites. Set the environment
variables from `.env.example`, point `DATABASE_URL` at Neon or Supabase, and
the cron entries in `vercel.json` handle ingestion. Add `REDIS_URL` and run
`npm run worker` somewhere long-lived if you want queued ingestion instead.

Before going live, two things gate real data: the eBay Partner Network
production application (the slowest item in the project by a wide margin) and
confirming whether Reverb exposes a product datafeed in your Awin publisher
dashboard.
