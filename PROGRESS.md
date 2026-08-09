# MusicTime build progress and handoff

Status as of 2026-08-09. Written so a fresh session can pick this up cold,
without the original conversation.

- **Repo:** `Legal-Leaf-Market/Claude_Edit`
- **Branch:** `claude/build-larger-project-33xzkn`
- **Commits:** 3, on top of `main` (`1442721`)
- **HEAD:** `f55ebd4`
- **Build state:** typecheck clean, 149 tests passing, production build prerenders 34 pages

---

## 1. FIRST: the code is not on GitHub yet

The three commits exist locally but **could not be pushed**. This is an access
problem, not an unfinished task.

| Attempt | Result |
|---|---|
| `git push` from the working clone | `403` |
| `git push` from a fresh `/workspace` clone | `403` |
| GitHub API `create_branch` | `403 Resource not accessible by integration` |
| `add_repo` with `access: "push"` | returns `already_present`, does not re-mint credentials |

Reads work fine (clone succeeds), writes do not. `Resource not accessible by
integration` is GitHub's specific error for a **GitHub App installation whose
`contents` permission is read-only**. The fix is to grant `contents: write` on
that installation, not merely repository access.

### Recovering the work

A verified git bundle was produced and delivered (206K, incremental against the
`main` you already have). It was test-restored: cloning from it reproduces all
three commits and the full tree.

```bash
# from a local clone of Legal-Leaf-Market/Claude_Edit
git fetch /path/to/musictime-branch.bundle \
  claude/build-larger-project-33xzkn:claude/build-larger-project-33xzkn
git checkout claude/build-larger-project-33xzkn
git push -u origin claude/build-larger-project-33xzkn
```

**The sandbox this was built in is ephemeral.** If the bundle is lost and the
container is reclaimed, the work is gone. Landing it on GitHub is the first
thing to do.

---

## 2. What MusicTime is

A used and vintage music gear aggregator. It ingests listings, works out which
listings are the same physical instrument, computes a market price per
instrument, and sends the shopper out through an affiliate link. It never takes
an order and never holds stock.

**Two data sources in v1, and the reasons are contractual, not technical:**

| Source | Route | Why not another way |
|---|---|---|
| eBay | Buy Feed API (`/buy/feed/v1_beta`), gzipped TSV | Limited Release, gated on eBay Partner Network approval. Built against **sandbox**. |
| Reverb | **Awin product datafeed**, if published to publishers | The Reverb API is scoped to managing your own shop; their terms forbid scraping and the use of API or member data with a third-party marketing platform. |
| Facebook Marketplace | Not ingested, out of scope | No public API. Scraping violates Meta's terms and is the exact conduct Meta litigates. |

These constraints are written up in full in `CLAUDE.md` section 2, and the hard
"do not" list is section 13. Read those before changing ingestion.

---

## 3. What is built

96 files, roughly 21,000 lines, in three commits that map to the three phases of
the original plan.

### Commit 1: foundation (`d03c11a`)

- **Drizzle schema:** `canonical_gear`, `marketplace_listings`,
  `listing_price_history`, `saved_alerts`, `alert_matches`, `outbound_clicks`,
  `ingest_runs`, plus Better Auth tables. GTIN and EPID are unique but nullable,
  so unidentified gear still gets a row.
- **`lib/ingestion/ebay-feed.ts`:** Range-chunked download, streaming gunzip
  that survives a chunk boundary splitting a gzip member, and a TSV parser that
  binds columns by **header name** rather than position.
- **`lib/affiliate/awin.ts` and `ebay.ts`:** Awin `cread.php` deep links and EPN
  fallback links. Both return `null` rather than emit a link that credits nobody.

### Commit 2: search and storefront (`494ccc2`)

- **Four-tier canonical resolution** (see section 5).
- **Search facade** over Typesense with a genuinely usable Postgres backend.
- **Storefront:** faceted search with a filter rail that becomes a sheet on
  mobile, gear detail pages comparing every live listing across sources, and an
  inline-SVG price chart with a crosshair and a table view.
- **`/go/[listingId]`:** the only outbound path on the site.

### Commit 3: jobs, alerts, SEO (`f55ebd4`)

- **Four cron routes** plus **BullMQ workers**, sharing one implementation.
- **Saved alerts** with email (Resend) and Discord delivery.
- **Programmatic SEO:** `/used/[category]` and `/deals/[brand-model]`.
- **`/api/health`,** sitemap, robots, Better Auth wiring.

---

## 4. What is verified, and what is not

This distinction matters more than the file count. Be honest about it when
picking the work back up.

### Verified against real infrastructure

A real Postgres 16 (with `pg_trgm`) and Redis were run in the sandbox.

- Migrations apply cleanly from scratch, including the trigram GIN indexes
- All three resolution tiers, against real `similarity()` rather than a mock
- Deal threshold maths, including the exact `0.8 * market` boundary
- Upsert idempotency, in-batch deduplication, and the "never overwrite a stored
  affiliate URL with null" rule
- gzip and TSV parsing, including a fixture chunked one byte at a time
- Awin link building, asserted **on the string only** (never GET a `cread.php`
  URL, it registers a real click)
- Cron auth: 503 unset, 401 wrong bearer, 200 correct, over real HTTP
- `/go` redirect end to end: 302 with EPN params, click row written,
  `was_affiliate = true`
- `/api/health` returning real counts and freshness
- Every page rendered in a real browser and screenshotted
- **BullMQ worker boots, registers 4 schedulers, and re-registering across
  restarts leaves 3 ingestion schedulers rather than duplicating them**

### NOT verified, because credentials or services were unavailable

- **The real eBay feed.** No `EBAY_OAUTH_TOKEN`. Transport and parsing are
  fixture-tested; the live call path has never run.
- **The real Awin feed.** No `AWIN_REVERB_FEED_URL`, which is the expected state
  until Reverb's publisher feed is confirmed.
- **The Typesense backend.** Never had a server. The Postgres backend is what
  every screenshot shows.
- **Email and Discord delivery.** No `RESEND_API_KEY` or webhook URL.
- **Auth sign-up and sign-in end to end.** Routes and forms exist and build; the
  flow was never exercised against a session.

---

## 5. Key decisions, and why

### The plan's resolution tiers had a gap, found by measurement

The original plan specified GTIN, then EPID, then fuzzy title matching. Seeding
exposed a real failure: six instruments split into duplicate canonical rows
purely on title wording (`SM58 Dynamic Vocal` against `SM58-LC Cardioid
Dynamic`) while both listings carried the **identical MPN** the whole time.

A brand-scoped MPN tier was added between the identifier tiers and the fuzzy
one. An MPN names one product by definition, so it is deterministic rather than
probabilistic. Measured effect on the seed:

| Metric | Before | After |
|---|---|---|
| `canonical_gear` rows | 16 | **10** (the correct count) |
| `needs_review` | 6 | **0** |
| Deals detected | 1 | **4** |

Deals rose because the bargains had been landing on single-listing rows with no
market price to compare against.

Two rules that must not be relaxed: MPN matching is **scoped to the brand**
(short part numbers like `2203` collide across manufacturers), and
`normalizeMpn()` **rejects placeholders** like "N/A" and "Does Not Apply", which
would otherwise merge the entire catalogue into one row.

### Search has two real backends, not one plus a stub

The plan called for Typesense. Postgres was built as a full backend rather than
a fallback stub, because the deploy target is Vercel and Typesense is another
service to run and pay for. The site is completely usable on Postgres alone, so
MusicTime can ship before any search infrastructure exists. A Typesense failure
falls **through** to Postgres rather than erroring the page, and the result
reports which engine answered so a permanent silent fallback is visible on
`/api/health`.

### Two bugs found by looking at the rendered page, not the code

- Broken marketplace images left alt text spilling out of a zero-height box.
  On prerendered pages the image fails **before React hydrates**, so the
  `onError` listener is attached too late and the event is lost. Fixed with a
  ref that asks the element whether it already failed.
- The mobile filter sheet was trapped inside `<main>`'s stacking context by the
  `globals.css` rule giving every body child a `z-index`, so the sticky header
  painted over its close button. Fixed by portalling the sheet to `document.body`.

### Deliberate non-choices

- **`EBAY_FEED_BASE_URL` defaults to sandbox** and was not flipped. A
  misconfigured deploy sending a sandbox-shaped token at the live feed burns the
  call budget for nothing.
- **Paid embeddings are not wired up.** `resolveByEmbedding()` is a marked stub.
  Structured fields carry the vast majority of rows; do not spend on embeddings
  before the `needs_review` queue proves a miss rate that justifies it.

---

## 6. Resuming work

```bash
npm install
cp .env.example .env.local     # only DATABASE_URL is strictly required

npm run db:migrate             # creates pg_trgm/pgcrypto, then the schema
npm run db:seed                # 10 instruments, 80 listings, 4 deals
npm run dev
```

Then `curl localhost:3000/api/health` to see what is configured and how fresh
the data is.

The seed is deliberately awkward: it includes the same instrument listed on both
marketplaces, listings carrying no identifiers at all, and a price spread wide
enough for deal detection to have something to find. **After any resolver
change, reseed and check the `canonical_gear` row count against the 10
instruments in `scripts/seed.ts`.** If they differ, the resolver is splitting or
merging, and that count is the fastest way to see it.

The test suite includes integration tests that **truncate tables**. Never point
`DATABASE_URL` at anything you care about while running them.

Other docs in the repo:

- **`CLAUDE.md`** is the operating guide: the legal constraints, the eBay feed
  traps, the resolution tiers, the money path, and a hard "do not" list.
- **`README.md`** is the project overview and command reference.

---

## 7. What is next

**Blocking, and outside the code:**

1. **Land the branch on GitHub.** Grant `contents: write`, or push from the
   bundle. Nothing else matters until the work is off the ephemeral sandbox.
2. **File the eBay Partner Network production application.** It is the slowest
   item in the whole project by a wide margin and gates all real eBay data.
3. **Check the Awin publisher dashboard** for whether Reverb (merchant profile
   67144) exposes a product datafeed. Yes means Reverb is a second catalogue
   source. No means MusicTime ships as an eBay-only aggregator that still links
   out to Reverb through Awin, which is a complete and compliant product.

**Once eBay sandbox credentials exist:**

4. Run `npm run ingest:ebay` against sandbox and confirm the feed actually
   parses. Everything about the transport is fixture-tested, but a live response
   is the real proof.
5. Confirm whether passing `EBAY_AFFILIATE_CAMPAIGN_ID` populates
   `itemAffiliateWebUrl` in the feed. If it does, the built EPN fallback links
   become dead code worth deleting.
6. Re-verify category `619` with the Taxonomy API rather than trusting the
   constant. eBay reshuffles categories roughly quarterly.

**Product work that can happen any time:**

7. A `needs_review` queue UI, so provisional canonical rows can be confirmed or
   merged by hand. The resolver currently has no human-in-the-loop path.
8. Real brand and category imagery. Listing thumbnails are hotlinked from
   marketplace CDNs and `canonical_gear.image_url` is only ever borrowed from
   the first listing that had one.
9. Decide whether Typesense is worth running at all, once there is real
   catalogue volume to measure Postgres search against.
