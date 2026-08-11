# CLAUDE.md - Operating guide for Gear Avail

Read this fully before editing. Sister project to **Legal-Leaf Market**,
**Herbal Leaf Market** and **Nicotia Market**, and it inherits their house
rules (section 16). The difference: those sites scrape public storefront JSON
from merchants who want the traffic. This one mostly consumes **gated partner
feeds** whose terms say exactly what you may and may not do with their data.
That constraint shapes most of the decisions below, and undoing one of them
casually is how this project gets a legal letter rather than a bug. (Small
independent Shopify-based sellers are the exception: their public storefront
JSON, the same pattern the sister sites use, is fair game when the merchant is
enrolled in an affiliate program that explicitly wants the traffic. See the
GoAffPro note in section 2.)

---

## 1. What this is

A music gear aggregator, used and vintage first, expanding into new gear where
a legitimate feed exists (Gear4music). It ingests listings, works out which
listings are the same physical instrument, computes a market price per
instrument, and sends the shopper out to the marketplace through an affiliate
link. We never take an order and never hold stock.

**Data sources, and the rule that governs adding another:** every source must
have a legitimate feed or partner API meant for third-party aggregation. No
source is ever added by scraping a storefront or hitting an interface that was
built for that site's own frontend rather than published for this use.

- **eBay**, via the Buy Feed API (`/buy/feed/v1_beta`). Bulk TSV feeds.
- **Reverb**, via the **Awin product datafeed**. This is now CONFIRMED to
  exist: Awin advertiser **67144** ("Reverb (US)"), `feedEnabled=yes`,
  `productReporting=yes`, 30-day cookie, **100% approval rate**, live since
  November 2023, payment status green. Checked against Awin's own advertiser
  directory on 10 Aug 2026. The commission rate is not published there, so it
  is still unknown rather than assumed. This does NOT relax section 2: the
  Reverb API remains off limits, and the Awin feed is precisely the legitimate
  channel that rule points at.
- **Sweetwater**, via a **LinkConnector product datafeed**, if and only if one
  is confirmed to exist. `lib/ingestion/sweetwater-linkconnector.ts` no-ops on
  an unset `LINKCONNECTOR_SWEETWATER_FEED_URL`, the same shape as Reverb's
  gate. Sweetwater has no published product API; the only channel meant for
  third parties is whatever datafeed their affiliate program (run on
  LinkConnector) actually offers. Do not scrape sweetwater.com or its Algolia-
  backed search/Gear Exchange listings as a substitute.
- **Gear4music**, via their **Awin product datafeed** (`lib/ingestion/
  gear4music-awin.ts`, gated on `AWIN_GEAR4MUSIC_FEED_URL`). Confirmed in
  Awin's directory: advertiser **1117**, `feedEnabled=yes`, **3.5-5%**
  commission, 30-day cookie, 92.6% approval. The four regional programmes
  (IE 27588, FR 27586, DK 27600, PL 27598) match the five domains
  `isGear4MusicProductUrl` already recognises. Same network as
  Reverb, different merchant account and feed URL. Primarily NEW retail
  inventory, which is why its condition normalizer defaults an empty condition
  column to "New" rather than "Unspecified" the way Reverb's does. Ships
  several regional storefronts (.com, .ie, .fr, .dk, .pl) under one Awin
  merchant; `isGear4MusicProductUrl` in `lib/affiliate/awin.ts` recognises all
  of them.
- **zZounds, Full Compass Systems, Pineville Music**, each via their own
  **CJ Affiliate (Commission Junction) product feed** (`lib/ingestion/
  zzounds-cj.ts`, `fullcompass-cj.ts`, `pinevillemusic-cj.ts`, gated on
  `CJ_ZZOUNDS_FEED_URL` / `CJ_FULLCOMPASS_FEED_URL` /
  `CJ_PINEVILLEMUSIC_FEED_URL`). All three are separate CJ advertiser
  programmes, not one shared feed. CJ's product feed schema has no untracked
  merchant-URL column, only a pre-built `BUY_URL`; `isCjTrackingUrl` in
  `lib/affiliate/cj.ts` checks it resolves to one of CJ's own tracking domains
  before trusting it as the affiliate link, the same "trust the network's own
  link, verify the host, never hand-build one" rule as Sweetwater and
  Gear4music. All three default an empty condition to "New" like Gear4music:
  new-inventory retailers, not peer marketplaces.
- **Small independent sellers, via public Shopify storefront JSON
  (`/products.json`)**, on a per-merchant basis, the same pattern the sister
  sites use. Only for merchants confirmed to be enrolled in an affiliate
  program (GoAffPro or similar) that explicitly wants publisher-driven
  traffic, not a blanket license to hit any Shopify store's JSON endpoint.
  Verify the endpoint is actually public and check the individual merchant's
  own affiliate terms before wiring one in; this is a per-store decision, not
  a feed that covers many merchants at once the way Awin/LinkConnector do. The
  concrete basis for each store is its own `/agents.md`, which Shopify now
  ships platform-wide with a "Read-Only Browsing (No Authentication
  Required)" section explicitly naming `/products.json` as the sanctioned
  no-auth path for agents that read catalogue data without transacting; that
  is stronger evidence than inferring permission from `robots.txt` alone, and
  it is checked per store before wiring one in, in `lib/ingestion/
  shopify-storefront.ts`. Confirmed so far: Folkcraft Instruments, Acoustic
  Guitar, Jamstik, Jackson Audio (`jacksonaudio-shopify.ts`), Eminence Digital
  (`eminencedigital-shopify.ts`, digital impulse-response packs, not physical
  gear, included on explicit request despite condition/shipping fields not
  really applying), Haze Guitar, EART Guitar, Play With Authority, Eason
  Music Store, and Go Kalimba. Pures Music (`puresmusic-shopify.ts`, mixed
  catalogue of real instruments and sound-healing accessories, ingested whole
  with no category filtering) is built but **paused indefinitely**: the
  product mix (crystal singing bowls, chakra tuning forks) isn't a fit the
  user wants on the site, a product decision independent of and on top of
  GoAffPro enrollment never having been confirmed either. Its cron entry is
  pulled from `vercel.json` and its BullMQ scheduler registration is
  commented out in `lib/queue/queues.ts`, the same "code stays, schedule
  doesn't" treatment as Full Compass and Pineville Music above. Do not
  re-enable without an explicit decision to carry the product-mix concern
  anyway.
- **Squaver (`squaver-woocommerce.ts`) is the one exception to the Shopify
  pattern above, and its basis is deliberately weaker.** Squaver runs
  WordPress + WooCommerce, not Shopify: it has no `agents.md` at all, and the
  only public catalogue read is WooCommerce's Store API
  (`/wp-json/wc/store/v1/products`), which is unauthenticated by default
  because it backs WooCommerce's own cart/checkout blocks, not because
  Squaver published it for third-party aggregation. That is the same "built
  for the site's own frontend, not published for this use" shape rejected for
  Guitar Center below. The user was told this explicitly and chose to build
  it anyway for this one confirmed GoAffPro store; treat that as a decision
  specific to Squaver, not precedent for wiring up other WooCommerce stores
  on the same reasoning without an equivalent explicit call.
- **Guitar Center was evaluated and rejected.** No official product API exists;
  their `robots.txt` explicitly disallows `/search`, `/pdp/`, `/product-detail-
  page`, `/category-page`, and the query params their own site search uses;
  their Terms of Use forbids reproducing/republishing site Content. The
  "Used Gear API" name floating around online is Guitar Center's own URL
  taxonomy, not a data API, and the community tools that exist scrape an
  undocumented frontend Algolia index. Do not build against it.
- **Anderton's, via Impact.com (formerly Impact Radius). APPROVED 11 Aug 2026**,
  one day after the application went in, and INGESTED by
  `lib/ingestion/andertons-impact.ts`. Roughly 27,000 products, easily the
  largest source here. The site's Universal Tracking Tag (`app/layout.tsx`) was
  already live sitewide for Impact's own site-verification step; that was always
  independent of catalogue ingestion and is not what the approval turned on.
  What makes it unlike every other feed here:
  **It arrives by FTP**, not an authenticated HTTPS URL: Impact drops
  catalogues on `products.impact.com`, one directory per advertiser. That is
  why the job runs on the BullMQ worker and NOT a cron route, since a
  serverless function cannot hold an FTP control connection plus passive data
  ports open for a 27k-row download.
  **The schema is the brand's, not the network's.** Impact mandates exactly
  three fields (item id, name, link URL) and lets brands name the rest;
  Anderton's catalogue is literally "Custom AMC Feed". So the parser binds by
  HEADER NAME through an alias table and, when a mandatory column cannot be
  resolved, throws naming both what it needed and the headers it actually saw.
  Never bind by position, for the same reason section 3 gives for the eBay feed.
  **It is priced in GBP and ships UK ONLY.** See section 15 on regions: a
  Guildford price shown to a shopper in Ohio fails the same house rule a stale
  price does.
  **Commission is 1% to 4%, and the 4% is scoped to a NAMED BRAND LIST rather
  than the catalogue.** As of the welcome mail: Victory, Ordo, Browne,
  EastCoast, Landlord, Tone City, Alvarez, Sire, Valeton, Behringer, TC
  Electronic, Divitone, Hils, Soloking, Music Man and Sterling by Music Man.
  Andertons told us they expect to add more later, so treat the list as current
  rather than final. **That list must never become an ingestion filter or a
  ranking input.** Andertons stocks far more than those sixteen brands and we
  earn nothing on the rest, which makes this the sharpest test yet of the
  section 16 rule that commission never affects ranking and that payout is not
  why a merchant is listed. The list is deliberately invisible to the ingester:
  a commission-aware feed reader is one refactor from filtering down to the
  paying brands, which is ranking by payout performed at the row level, and the
  footer promises shoppers it does not happen. Ingest the whole feed, rank it
  exactly like every other source, and earn on the subset.
  **Links come from the feed, never from us.** `lib/affiliate/impact.ts`
  recognises Impact's tracking hosts (`pxf.io`, `sjv.io`, `7eer.net`,
  `evyy.net`, `impactradius.com`), and those plus `andertons.co.uk` are on the
  `/go` allowlist. There is deliberately NO `buildImpactUrl()`: Impact deep
  links need `/c/<publisherId>/<campaignId>/<adId>`, and a campaign and an ad id
  are not something a vanity short link carries. Awin is the one network we
  build links for ourselves, and only because a publisher id plus a merchant id
  is genuinely all it needs.
  **The publisher vanity link is `andertonsmusiccompany.pxf.io/7XKanr`.** It is
  a marketing asset (the "create your links" step in Andertons' own onboarding
  mail), not site plumbing: it lands on their storefront rather than on a
  listing, so it has no home on a site whose every outbound link points at a
  specific listing we have actually seen in a feed. Putting it on a page would
  be the first ad on this site, which is a product decision nobody has taken.

**Facebook Marketplace is out of scope.** Not "later", not "behind a flag". It
has no public API, scraping it violates Meta's terms, and it is the exact
conduct Meta litigates. If it ever returns it is as user-submitted local
listings, never as a proxy-rotating scraper.

```
app/
  page.tsx                  Home: stats, biggest discounts, category mesh
  search/                   Faceted search, filter rail collapses to a sheet
  gear/[slug]/              One instrument, every live listing, price chart
  deals/[slug]/             Programmatic SEO, per model
  used/[category]/          Programmatic SEO, per category
  go/[listingId]/           THE outbound gateway (section 5)
  rigs/                     Artist rigs, and the records each is documented on
  pedalboard/               The rig builder (chain check, power, live pricing)
  alerts/, sign-in/, sign-up/
  api/
    health                  Freshness and config, read this first when confused
    ask                     The Groq assistant. 503s when unconfigured
    alerts                  Saved alert CRUD
    auth/[...all]           Better Auth
    cron/*                  Ingest per source, refresh-deals, weekly-digest.
                            All fail closed on CRON_SECRET
lib/
  env.ts                    Every integration exposes isConfigured; nothing throws
  nav.ts                    THE nav tree. Header, mobile sheet and footer all read it
  theme.ts                  Light/dark/system, and the no-flash init script
  rigs/                     Curated artist rigs and the reverse index (section 13)
  ai/                       Groq client + the allowlisted DB tools (section 14)
  pedalboard/chain.ts       Signal-chain order rules and power estimates
  regions.ts                Who can buy from which store (section 15)
  ingestion/ebay-feed.ts    Transport + TSV parsing (section 3)
  ingestion/ebay-ingest.ts  The three eBay jobs
  ingestion/reverb-awin.ts  Awin feed only. Never the Reverb API (section 2)
  ingestion/andertons-impact.ts  Impact FTP drop, header-bound. Worker only
  ingestion/upsert.ts       Idempotent writes, price history, run bookkeeping
  canonical/resolve.ts      Four-tier entity resolution (section 4)
  canonical/model-parse.ts  Brand/model/category from keyword-soup titles
  deals/pricing.ts          Rolling median, deal threshold
  search/                   Typesense with a real Postgres fallback (section 6)
  queue/                    BullMQ; the OTHER way to run ingestion (section 7)
scripts/                    migrate, seed, worker, run-ingest, reindex
```

---

## 2. THE LEGAL CONSTRAINTS, and why the code looks paranoid

These are not preferences. Each one is a term of service.

- **Never use the Reverb API to build the catalogue.** It is scoped to managing
  *your own* shop, and their terms forbid scraping AND "use of API or member
  data with a third-party advertising or marketing platform, whether or not
  aggregated". Aggregating their catalogue through it is a breach on two
  counts. `lib/ingestion/reverb-awin.ts` reads the Awin datafeed or it no-ops.
  It has no fallback path, deliberately, so nobody can add one "temporarily".
- **`LINKCONNECTOR_SWEETWATER_FEED_URL` unset is the EXPECTED state**, not a
  bug to route around. `AWIN_REVERB_FEED_URL` and `AWIN_GEAR4MUSIC_FEED_URL`
  are a different case as of 10 Aug 2026: both feeds are confirmed to exist in
  Awin's advertiser directory (Reverb 67144, Gear4music 1117 plus four
  regional programmes), so those two are pending retrieval from the Awin
  dashboard rather than pending existence. Each source ships only if its feed is confirmed; Gear Avail degrades
  gracefully to whichever subset of eBay/Reverb/Sweetwater/Gear4music actually
  has a working feed. A smaller aggregator that is fully compliant beats a
  bigger one that is not.
- **eBay production access is not guaranteed.** `EBAY_FEED_BASE_URL` defaults
  to **sandbox** on purpose. Never flip that default; set it per environment
  once a production keyset is actually approved. A misconfigured deploy sending
  a sandbox-shaped token at the live feed burns the call budget for nothing.
- Reverb changed hands in April 2025 (Creator Partners + Servco). If indexing
  their catalogue becomes load bearing for the business, get written permission
  from their partnerships contact. Do not infer it from the affiliate terms,
  which point the other way.
- None of the above is a legal opinion. It is the engineering-visible shape of
  the constraints. A lawyer who has seen the actual setup is the right source.

---

## 3. The eBay feed is not a normal REST API

Four things break naive code, and all four are handled in
`lib/ingestion/ebay-feed.ts`:

1. **Success returns gzipped TSV. Errors return JSON.** So the response parser
   branches on status, never on Content-Type. `Accept` must list both types.
2. **`Range` is mandatory and the file can be gigabytes.** We walk it in
   sequential byte ranges and learn the true size from the first
   `Content-Range`. A 200 instead of a 206 means the server ignored the range
   and handed us everything, which we accept and stop on.
3. **Chunk boundaries land mid-gzip-member.** Do NOT try to buffer the whole
   file and then gunzip it; a bootstrap feed will not fit in memory. A
   *streaming* inflater keeps its window across writes, so a split member is
   invisible to it. There is a test that chunks a fixture one byte at a time.
4. **Columns are bound by HEADER NAME, never by position.** eBay adds fields to
   the ~98-column Item schema over time, and a positional parser silently
   shifts every value the day they do. If a new field is needed, add it to
   `COLUMN_ALIASES` rather than counting columns.

Two more traps:

- **`inferredBrand`/`inferredGtin`/`inferredEpid` are eBay's own guesses from
  the title.** Explicit fields always win. Letting a guess claim `canonical_gear`'s
  unique `gtin` or `epid` merges two unrelated instruments permanently.
- **Snapshot files lag ~2 hours.** Asking for the current hour reliably 404s.
  `snapshotHourStamp()` defaults three hours back. Do not "fix" it to now.

Category `619` is Musical Instruments & Gear (L1, EBAY_US). eBay reshuffles
categories roughly quarterly, so re-verify with the Taxonomy API rather than
trusting the constant.

---

## 4. Entity resolution: four tiers, and why the order is the order

`lib/canonical/resolve.ts`. Ordered by how much the evidence deserves trust.

| Tier | Key | Why here |
|---|---|---|
| 1a | GTIN | A global barcode. Hard identity. |
| 1b | EPID | eBay's own catalogue id. Hard identity. |
| 1c | **brand + MPN** | An MPN names one product by definition. |
| 2 | brand-scoped pg_trgm on model | Probabilistic, so it sits below all identifiers. |
| 3 | provisional row, `needs_review = true` | Last resort. |

**Tier 1c exists because of measured evidence, not theory.** Seeding split six
instruments into duplicate canonical rows purely on title wording ("SM58
Dynamic Vocal" against "SM58-LC Cardioid Dynamic") while both listings carried
the identical MPN the whole time. Adding it took the seed from 16 canonical
rows to the correct 10, `needs_review` from 6 to 0, and deals from 1 to 4,
because the bargains had been landing on single-listing rows with no market
price to compare against.

Two rules that must not be relaxed:

- **MPN matching is scoped to the brand.** Short part numbers like "2203"
  certainly collide across manufacturers.
- **`normalizeMpn()` rejects placeholders** ("N/A", "None", "Does Not Apply",
  repeated-character filler). Treating one as an identity key would merge the
  entire catalogue into one row. If you widen that list, check live MPN values
  first, the same way `isExcluded` is treated on the hemp sites.

**Fuzzy matching is brand-scoped for the same reason.** "Standard" under Gibson
and "Standard" under Squier are instruments an order of magnitude apart in
price. An unscoped `similarity()` search happily merges them.

Paid embeddings are deliberately NOT wired up. `resolveByEmbedding()` is a
marked stub. Structured fields carry the vast majority of rows; do not spend on
embeddings before the `needs_review` queue proves a miss rate that justifies it.

**Bias throughout: under-merge rather than over-merge.** An unmatched listing
still shows up in search on its own text. A bad merge corrupts the price
history of two instruments and every deal badge computed from it.

---

## 5. Money: the outbound path is `/go/[listingId]` or `/api/cart/checkout`, nothing else

- **Never link a card or a listing row straight to `raw_url`.** These two
  routes are what record the click and attach attribution. A direct link
  costs revenue and loses the analytics in one move. Everything user-facing
  links to one of them.
- **`/api/cart/checkout` is the multi-item sibling of `/go`, not a bypass of
  it.** The GA Cart (`lib/cart/`) is entirely client-side (localStorage: item
  id, title, price, image, qty; never a raw or affiliate URL). Checkout is
  always scoped to ONE store's items at a time, since no unified checkout
  across unrelated merchants exists anywhere in this space (confirmed against
  the sister sites' own cart implementations): the route looks up each
  listing's real `rawUrl`/`affiliateUrl`/`platformVariantId` server-side,
  builds the best URL the store's platform allows
  (`lib/cart/checkout.ts`), checks it against the same allowlist as `/go`
  (`lib/affiliate/allowed-hosts.ts`, shared by both routes), and logs one
  `outboundClicks` row per item actually included. Shopify's cart permalink
  (`/cart/{variantId}:{qty},...`) fills the WHOLE group in one URL;
  WooCommerce's `?add-to-cart={id}&quantity={n}` takes exactly one line, so
  anything past the first item in a WooCommerce group has to be added by
  hand once the shopper is there; every other source (the paused eBay/
  Reverb/CJ/Awin feeds) has no prefillable cart at all, so checkout there is
  just the first item's own link, same destination `/go` would use for it.
- **Click logging failures are swallowed on purpose.** A click we cannot bill
  for is a rounding error; a shopper who cannot reach the listing is the
  product failing at the one moment that matters.
- **The destination is checked against an allowlist.** The URL comes from our
  own ingestion, so this is defence in depth: a poisoned or misparsed feed row
  must not turn `/go` into an open redirect for laundering phishing links
  through our domain.
- **`affiliate_url` is nullable and the upsert NEVER overwrites a stored one
  with null** (`COALESCE(excluded.affiliate_url, ...)`). A later feed pulled
  without affiliate context would otherwise strip monetisation off every row it
  touched, silently.
- **eBay:** the feed's own `itemAffiliateWebUrl` is always preferred; the built
  EPN link is only a fallback. Passing `EBAY_AFFILIATE_CAMPAIGN_ID` is what
  makes eBay populate that field, via `X-EBAY-C-ENDUSERCTX`.
- **NEVER GET an `awin1.com/cread.php` link while testing.** Same rule as
  Herbal Leaf. Every request registers a real click and pollutes conversion
  reporting with our own traffic. Assert on the string; do not follow it. The
  Awin tests do exactly this.
- An unapproved or empty merchant id produces **null**, not a half-built link.
  Routing a shopper through a tracker that credits nobody is worse than a clean
  direct link.

---

## 6. Search has two backends and both are real

`lib/search/index.ts` is a facade. Typesense when configured, Postgres
otherwise, and **a Typesense failure falls through to Postgres** rather than
erroring the page. The result carries `backend`, and `/api/health` reports it,
so a permanent silent fallback is visible instead of looking like everything
working.

The Postgres backend is not a stub. The site is fully usable on it, which is
what lets Gear Avail deploy before any search infrastructure exists.

**Facet counting follows the Legal-Leaf rule:** each facet's counts are
computed with every OTHER filter applied but not its own, so no visible option
can ever lead to an empty grid. If you add a facet, add it to `allExcept` too
or it will start lying.

---

## 7. Two ways to run ingestion, one implementation

The job functions live in `lib/ingestion/`. There are two triggers:

- **`/api/cron/*` routes** (`vercel.json`). What a Vercel deploy uses.
- **BullMQ workers** (`npm run worker`). Concurrency control, retries, and a
  durable queue for the bootstrap feed that will not finish inside a serverless
  timeout.

Never fork the logic between them. Add work to the job function.

- Every cron route **fails closed on `CRON_SECRET`**: unset returns 503,
  wrong bearer returns 401. Unset mattering more than wrong is the point, these
  routes burn the eBay call budget and send email.
- Ingestion worker concurrency is **1** on purpose. These jobs are bounded by
  the eBay daily call budget and Postgres write throughput, not CPU. Running
  several in parallel spends the same budget faster and races on the same
  upsert targets.
- BullMQ 6 removed `repeat` on `add()`. Schedules use `upsertJobScheduler` with
  **stable ids**, so editing a cron pattern updates the schedule instead of
  leaving the old one running beside it and pulling the feed twice.

---

## 8. Deal detection is the most load-bearing claim on the site

`lib/deals/pricing.ts`.

- **Median, never mean.** One optimist asking $1.2m for a Strat would drag a
  mean high enough to make every ordinary listing look like a bargain.
- **`MIN_SAMPLE_SIZE` is a floor, not a suggestion.** Below it we publish NO
  market price and flag NO deals, and the gear page says so in words. Inventing
  a market price from two listings is a guess dressed up as a measurement.
- **Recently ended listings count towards the sample.** Restricting to active
  listings biases it towards overpriced gear, because the well priced items are
  exactly the ones that already sold.
- The threshold is "more than 20% below", so exactly `0.8 * market` is not a
  deal. There is a test pinning that boundary.
- **NEW AND USED ARE TWO MARKETS, measured separately, and a listing is only
  ever judged against the median of its own class.** `canonical_gear` carries
  `avg_used_price_cents` / `price_sample_size` and `avg_new_price_cents` /
  `new_price_sample_size`, and `MIN_SAMPLE_SIZE` applies to each independently:
  forty new listings and two used ones publish a new median, no used one, and
  no deal badge on those two.
  This is not tidiness. One blended median was fine while the catalogue was
  small mixed-stock sellers, and breaks the moment a large new-retail feed
  lands (Andertons alone is ~27k products, and Gear4music, zZounds, Full
  Compass and Pineville Music all default an empty condition to "New"). New
  retail sits well above used, so the blend rises, and then every ordinary
  second-hand price measures far below "market" and earns a badge it has not
  earned. Inventing bargains is the one error this site cannot afford, and the
  failure is silent and sitewide.
- **When a condition string is ambiguous, class it NEW.** Open box, "New other
  (see details)" and refurbished all sell nearer new than used, but the
  deciding argument is the asymmetry: filing one as new nudges the new median
  down slightly, while filing it as used lifts the USED median, and a lifted
  used median is precisely what manufactures deals that do not exist. A null
  condition is the exception and stays used, since the retail feeds all set the
  field explicitly.
- **The classifier exists three times (JS, the deal-flagging UPDATE, and the
  search projections) and they must agree.** A divergence throws nothing; it
  just starts flagging listings against a median built from a population they
  were not part of. `tests/condition-class.test.ts` runs real condition strings
  through both the JS and the Postgres implementations and asserts they match.
- **A card's struck-through "was" price must come from the same class the deal
  was judged against.** Both search backends select the median matching each
  listing's own condition (`LISTING_MARKET_PRICE_SQL`); selecting
  `avg_used_price_cents` unconditionally would print the used median beside a
  new listing badged against the new one.

---

## 9. Idempotency and the price history table

- Every upsert is keyed on `(source, external_id)`. Feeds overlap by design and
  a re-run after a failure must be a no-op.
- Batches are **deduplicated in memory first**: Postgres rejects an
  `ON CONFLICT` statement that updates the same target row twice in one
  command, and feeds do repeat an item within a single file.
- **Price history is written only when a price or status actually moves.** The
  hourly snapshot touches most of the catalogue; without that filter the table
  would grow by the size of the catalogue per hour and the chart would be a
  flat line drawn a thousand times.
- Alert notifications are claimed by **inserting into `alert_matches` before
  sending**. A crash between insert and send loses one notification. The
  reverse order mails somebody the same guitar on every hourly run forever.

---

## 10. Verify before you merge

1. `npm run typecheck` and `npm test`. The suite includes integration tests
   against real Postgres; they need `DATABASE_URL` and they truncate tables, so
   never point them at production.
2. `npm run db:seed` then `npm run dev`, and actually look at the site. The
   seed deliberately includes cross-source duplicates and identifier-free rows
   so the resolver is exercised.
3. `curl /api/health`. It reports counts AND the age of the last successful run
   per job. A silently broken feed looks exactly like a quiet market, and only
   the age column tells them apart.
4. After a resolver change, reseed and check `canonical_gear` row count against
   the number of instruments in `scripts/seed.ts`. If they differ, the resolver
   is splitting or merging and the counts are the fastest way to see it.

---

## 11. Environment variables

| Var | Gates |
|---|---|
| `DATABASE_URL` | Everything. The only hard requirement. |
| `EBAY_FEED_BASE_URL` | Sandbox by default. Never change the default. |
| `EBAY_OAUTH_TOKEN` | eBay ingestion. Unset means the jobs skip with a logged reason. |
| `EBAY_AFFILIATE_CAMPAIGN_ID` | Populates `itemAffiliateWebUrl` in the feed AND builds fallback EPN links. Unset means eBay traffic is unmonetised. |
| `AWIN_PUBLISHER_ID` / `AWIN_REVERB_MERCHANT_ID` | Reverb deep links. Either missing produces null links, not broken ones. |
| `AWIN_REVERB_FEED_URL` | Reverb catalogue. Feed CONFIRMED to exist (Awin 67144, 100% approval); pending retrieval, not pending existence. The job no-ops until set. |
| `LINKCONNECTOR_SWEETWATER_FEED_URL` | Sweetwater catalogue. Unset is expected; the job no-ops. Never falls back to scraping. |
| `AWIN_GEAR4MUSIC_MERCHANT_ID` / `AWIN_GEAR4MUSIC_FEED_URL` | Gear4music catalogue and deep links. Same shape as the Reverb pair, independent ids. |
| `CJ_ZZOUNDS_FEED_URL` / `CJ_FULLCOMPASS_FEED_URL` / `CJ_PINEVILLEMUSIC_FEED_URL` | Three independent CJ Affiliate programmes. Each no-ops when unset. |
| `IMPACT_ANDERTONS_FTP_*` | Anderton's via Impact.com, ingested by `lib/ingestion/andertons-impact.ts`. Impact delivers catalogues by FTP drop (`products.impact.com`, one directory per advertiser), NOT over an HTTPS feed URL like Awin/CJ/LinkConnector, so this is a host/user/password/path quartet. `hasAndertonsFeed` gates on the credential pair, since host and path have real defaults. The password is a real credential, unlike most values in this table. Note the job belongs on the BullMQ worker, not a cron route: a serverless function cannot hold an FTP control connection plus passive data ports open. |
| `GOAFFPRO_*_REF_PARAM` / `GOAFFPRO_*_REF_CODE` | One pair per small independent Shopify/WooCommerce seller (Folkcraft, Acoustic Guitar, Jamstik, Jackson Audio, Eminence Digital, Haze Guitar, EART Guitar, Play With Authority, Pures Music, Squaver, Eason Music Store, Go Kalimba). Catalogue ingestion needs no credential at all; an unset code just means a null `affiliate_url` until the referral is confirmed. |
| `GROQ_API_KEY` / `GROQ_MODEL` | The Ask assistant (section 14). Unset means /api/ask 503s and the button never renders. The model default is overridable because Groq retires models often. |
| `TYPESENSE_*` | Search backend. Unset falls back to Postgres. |
| `REDIS_URL` | BullMQ queues and the shared rate-limit counter. Optional. |
| `CRON_SECRET` | Every `/api/cron/*` route. Unset = 503, wrong = 401. Load bearing: these burn the eBay call budget and send mail to the whole subscriber list. |
| `BETTER_AUTH_SECRET` | Accounts and alerts. Unset = auth routes 503, rest of site unaffected. |
| `RESEND_API_KEY` / `DISCORD_WEBHOOK_URL` | Alert delivery. Each no-ops with a warning. |
| `ADMIN_PASSCODE` | `/admin/operating-model`. Unset = nobody can sign in, ever. See section 12. |
| `INSTAGRAM_HANDLE` / `INSTAGRAM_POST_URLS` | Homepage and footer follow strip. Handle defaults to `stompbox.world`; unset post URLs render a plain follow callout instead of embeds. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" on sign-in/sign-up. Unset means email and password only. |

---

## 12. Admin: the operating-model business projection

`/admin/operating-model`, gated by `ADMIN_PASSCODE` (`lib/admin/gate.ts`): a
24-month affiliate revenue projection ported from the same engine built for
legal-leafmarket.com, adapted to one site instead of four.

- **The gate fails closed**, same rule as `CRON_SECRET`. No passcode
  configured means the sign-in page shows setup instructions instead of a
  form, never a page that merely hides numbers with CSS. The passcode signs
  an HMAC session cookie (`lib/admin/gate.ts`), so rotating it signs
  everyone out. Failed attempts are rate-limited per IP and compared in
  constant time. The whole `/admin` tree is `noindex, nofollow, nocache` and
  disallowed in `robots.txt`; it is never in `sitemap.xml` because the
  sitemap only ever lists routes it explicitly builds.
- **The math lives in `lib/admin/engine.ts`, unmodified from the sister
  sites' version.** An S-curve traffic fit through three session anchors,
  monthly seasonality, Weibull conversion/attribution ramps, and an
  actuals-driven re-anchoring step once real months close. Do not simplify
  this math without understanding why each piece exists; the docstring at
  the top of the file explains the reasoning.
- **Reference data (`lib/admin/reference-data.ts`) is Gear Avail-specific,
  not copied.** Two structural facts genuinely differ from the sister
  sites: this one can legally run paid ads (musical instruments are not a
  restricted ad category the way THC/hemp/nicotine are), and its
  `/gear`/`/deals` pages are generated FROM the ingested catalogue rather
  than hand-authored, so indexable page count already scales with real
  inventory. The merchant-by-merchant table uses real ingested catalogue
  counts and reflects which of the 11 live sources actually have a
  confirmed working referral link versus which are unconfirmed, pending, or
  paused, as of when it was written; update it as that status changes
  rather than leaving it to drift.
- **Every number on the page is a starting assumption, not a measurement.**
  This was written for a catalogue with no real traffic history yet.
  Nothing downstream of the assumptions panel is hard-coded, so entering
  real Vercel Analytics sessions and real earned commission in the monthly
  tables is what makes the projection reflect reality instead of a guess.

---

## 13. Artist rigs: curated on purpose, and why

`lib/rigs/data.ts` carries roughly two dozen documented artist pedalboards,
each with the pedals on it, what each pedal was doing, and the albums and
tracks the rig is documented on. `lib/rigs/index.ts` derives everything else,
including the reverse index that lets a gear page say which records a pedal is
on. This is the only genuinely unique content on the site and it powers
`/rigs`, `/rigs/[slug]`, the "Heard on" block on `/gear/[slug]`, and the
builder's rig loader.

**It is hand-written because there is no legitimate feed for it**, and that
follows the same rule as section 2 rather than being an exception to it.
Equipboard has by far the best database of this and added album- and
track-level attribution in February 2026, but they publish no API and scraping
them is precisely the conduct forbidden for Guitar Center and the Reverb API.
MusicBrainz would cover the records half legitimately and its core data is
open, except its web service is free for NON-COMMERCIAL use only and this site
runs on affiliate revenue, so wiring it up needs a commercial plan first. Both
remain open later. Neither was a reason to ship nothing now.

Two rules for editing the dataset:

- **Scope every rig to a documented era, and say so on the page.** Rigs change
  between tours and between takes. What is almost always known is that a pedal
  was on the board during those sessions or that tour, not that it is audible
  on a specific bar. The copy says "documented on" for exactly that reason.
- **Never imply endorsement.** Every page built from this file carries the line
  that nobody named is affiliated with Gear Avail. Monograms rather than
  photographs, deliberately: no likeness rights to navigate.

The reverse index (`creditsForGear`) matches on brand AND model, both loose,
with a three-character floor. Widening it is tempting and wrong for the same
reason `normalizeMpn()` rejects placeholders: a bad match prints a famous
record under the wrong pedal, on a page somebody is about to spend money from.
There are tests pinning the near misses ("Hamilton Beach Blender" must not
match Kevin Shields, "Boss DD" must not match anything).

---

## 14. Ask: the assistant queries the database, it does not remember it

`lib/ai/`, gated on `GROQ_API_KEY`, surfaced as the "Ask" button in the
masthead. Unset is a fully supported state: `/api/ask` answers 503 with a plain
reason and the button is never rendered, so an unconfigured deploy is missing
one feature rather than showing a broken one.

- **The model never writes SQL and never gets a connection.** It calls a fixed
  set of typed, allowlisted tools in `lib/ai/tools.ts`, each of which validates
  its arguments and calls the same functions the pages call. A general "run
  this query" tool would be three lines and would hand anyone who can type into
  a text box the ability to read the `user` table. Do not add one. If a
  question cannot be answered, the fix is another narrow tool.
- **Every tool is read-only.** Nothing writes a row, sends mail, or spends an
  eBay call, so a prompt injection carried in a listing title is bounded at
  "returns a wrong answer" rather than "mutates the site".
- **The prompt is mostly about what not to say**, because on a price
  comparison site an invented price is worse than no answer. It is instructed
  to report the "sample too small, no market price published" result verbatim
  rather than estimating around it, which is section 8's rule reaching through
  this door too.
- Answers carry the listings they came from AND a one-line trace of each lookup
  actually run, so a shopper can check the answer rather than trust it.
- `GROQ_MODEL` is overridable because Groq retires models often (kimi-k2 in
  March 2026, qwen3-32b and llama-4-scout in June 2026). When the default is
  retired in turn, set the env var rather than shipping a code change.


---

## 15. Regional serviceability: only show what a shopper can buy

`lib/regions.ts`. Anderton's ships only within the UK, and it is the biggest
catalogue on the site, so without this a shopper in Ohio searching for a
Victory preamp gets a page of prices they can never pay.

- **A store declares its own restriction**, as `shipsTo` on its `StoreProfile`.
  Absent means unrestricted, which is the honest default: most stores here ship
  broadly and we have no evidence otherwise, so we do not invent a limit.
- **Restricted stores are HIDDEN, not badged**, for shoppers they cannot reach.
  A badge on every fourth card still means someone scans, compares, gets
  interested and then loses.
- **But never silently.** The count and the store name are always stated, and
  `?ships=all` is always one click away. Hiding inventory without saying so on
  a site whose promise is showing everything is its own dishonesty.
- **An UNKNOWN region shows everything.** Geo-IP is a guess (VPNs, carrier
  routing, no header in development), and hiding the largest catalogue from a
  British shopper whose VPN exited in Amsterdam is worse than showing a clearly
  labelled listing they cannot order.
- **An explicit cookie choice beats the geo guess.** The expat and the VPN user
  are exactly who a geo lookup gets wrong.
- **Both search backends must filter identically.** `excludeSources` is applied
  in the Postgres WHERE clause and in the Typesense `filter_by`; a shopper
  seeing UK-only stock only when Typesense happens to be down would be a
  particularly confusing bug. It is also kept OUT of `allExcept()`, so a store
  that cannot deliver never appears in the source facet at all.


---

## 16. House rules inherited from the sister sites

- **No em dashes anywhere in copy.** Use a comma, colon, or parentheses.
- **Do not GET an Awin tracking link in testing** (section 5).
- **Do not broaden an exclusion regex or a placeholder list without checking
  live values first.** A broad pattern silently hides real inventory, and the
  diff looks harmless.
- Prices shown must be prices the shopper can actually get. The footer says
  feeds can go stale; that is a disclosure, not a licence to ship known-wrong
  numbers.
- Affiliate commission never affects ranking. Sorting is price, discount,
  recency or shuffle, and the footer says so.
- **Whether a merchant pays us is not a reason to delist them.** A merchant is
  listed if shoppers get a fair deal and a real delivery; payout is not an
  input to that decision. Delisting a good merchant for not paying is the same
  act as ranking by commission, just performed at the merchant level, and the
  footer's promise covers both. This cuts the other way too: a merchant who
  pays well but fails shoppers goes, and the reason recorded is the failure,
  never the money. The two cases look identical from outside, so write down
  which one it was.

## 17. Hard "do not" list

- Do NOT call the Reverb API for listings, or add a scraping fallback anywhere.
- Do NOT write Facebook Marketplace ingestion.
- Do NOT scrape Guitar Center or Sweetwater (or hit their frontend search
  indexes) as a substitute for a confirmed affiliate datafeed.
- Do NOT add a new data source without first confirming a legitimate feed or
  partner API exists for it. A retailer having a website is not a source.
- Do NOT treat "it's a Shopify store with `/products.json` public" as a
  blanket license. Check per merchant: is the endpoint actually enabled, is
  the merchant enrolled in an affiliate program that wants the traffic, and do
  their own terms say anything to the contrary.
- Do NOT change `EBAY_FEED_BASE_URL`'s sandbox default.
- Do NOT link the UI directly to `raw_url`; everything goes through `/go`.
- Do NOT let an `inferred*` field win over an explicit one.
- Do NOT unscope MPN or fuzzy matching from the brand.
- Do NOT publish a market price below `MIN_SAMPLE_SIZE`.
- Do NOT let the cron guard fail open.
- Do NOT parse the feed TSV by column position.
- Do NOT scrape Equipboard, or any other gear-attribution site, to fill
  `lib/rigs/data.ts`. It is hand-written for the same reason the Reverb API is
  off limits (section 13).
- Do NOT call the MusicBrainz web service from this site without a commercial
  plan. It is free for non-commercial use only and this site is commercial.
- Do NOT give the assistant a tool that takes SQL, a table name, or any free
  text that reaches a query builder uninterpreted (section 14).
- Do NOT let the assistant state a price, a store or a stock level that no
  tool in that conversation returned.
- Do NOT show a listing from a store that cannot ship to the shopper without
  saying so, and do NOT hide one without saying that either (section 15).
- Do NOT make the ingester aware of which brands pay commission. Filtering a
  feed down to the paying brands is ranking by payout at the row level.
- Do NOT bind the Impact catalogue by column position. It is brand-configured
  and the order is not stable; bind by header name and fail loudly.
- Do NOT define a colour only inside the light-theme block, or only outside it.
  Both themes resolve from the same token set, and prices and accent-coloured
  body text must use `--money` and `--accent-text` rather than `--sage` and
  `--copper`, which fail contrast on paper.
- Do NOT point the test suite at a database you care about; it truncates.
