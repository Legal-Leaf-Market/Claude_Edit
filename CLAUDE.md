# CLAUDE.md - Operating guide for Gear Avail

Read this fully before editing. Sister project to **Legal-Leaf Market**,
**Herbal Leaf Market** and **Nicotia Market**, and it inherits their house
rules (section 17). The difference: those sites scrape public storefront JSON
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
  sites use. **Every one of them is now a row in `lib/storefronts.ts`, not a
  module**: there were twelve near-identical `*-shopify.ts` files whose only
  real difference was a base URL, and adding a store meant editing sixteen
  files. Section 7's "never fork the logic", applied to merchants. Two fields
  on that row carry what used to be prose. `permission` records WHY we may read
  the catalogue and when somebody checked; `affiliate` records whether the
  traffic earns anything, and **is deliberately not an input to anything else**,
  because gating ingestion on payout is ranking by commission performed before
  a shopper sees a result. `/api/admin/storefront-probe`, surfaced as a button,
  is how a candidate gets checked without doing it by hand. Only for merchants confirmed to be enrolled in an affiliate
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
  catalogues on `products.impact.com`, one directory per advertiser. It has no
  Vercel cron entry, unlike every other feed here.

  The reason given for that was "a serverless function cannot hold an FTP
  control connection plus passive data ports open". That is WRONG as stated
  and is corrected here: a Vercel Node function runs on Lambda, Lambda permits
  arbitrary outbound TCP, and passive FTP is entirely outbound. The real
  limits are the 300 second function ceiling and the memory to buffer a 27k-row
  file, which are honest maybes rather than a flat no.

  So `/api/admin/ingest-andertons` exists to settle it by trying: admin-gated,
  POST only, `maxDuration = 300`. If it times out, the timeout is the answer
  and the BullMQ worker is genuinely required. Until somebody runs it, do not
  repeat either claim as settled.
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
  section 17 rule that commission never affects ranking and that payout is not
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
  have been the first ad on this site. That was a decision nobody had taken
  when this paragraph was written; it has since been taken for DistroKid and
  DistroKid only (section 19). It has still not been taken for Andertons, whose
  catalogue is ingested and therefore needs no banner.
- **Seven more Impact merchants, approved August 2026, all through the same
  catalogue API**: **American Musical Supply**, **Musician's Friend**, **Native
  Instruments**, **Fender**, **Universal Audio**, **Donner Music** and **Plugin
  Alliance**. The merchant is DATA (`lib/ingestion/impact-merchants.ts`) and
  `lib/ingestion/impact-catalogue.ts` is the one reader; Anderton's module keeps
  its FTP transport and delegates the rest. Eight near-identical parsers would
  have been section 7's "never fork the logic" broken eight ways.
  **Each needs a catalogue id, and it is never guessed.** `IMPACT_*_CATALOG_ID`
  is unset by default and the job no-ops until it is set. Anderton's 30480 could
  be defaulted because somebody read it off the platform; a wrong id does not
  fail safely, it either 404s or returns ANOTHER advertiser's products under this
  merchant's name. `/api/admin/impact` with `{"mode":"list"}`, surfaced as a
  button, reads the real ids off the account.
  **A PROGRAMME ID IS NOT A CATALOGUE ID, and this is the likeliest way to get
  the previous paragraph wrong.** The Impact marketplace export lists one number
  per brand (AMS 47665, Musician's Friend 14291, Native Instruments 29910,
  Fender 33985, Universal Audio 39245, Donner 43895, Plugin Alliance 30401) and
  it identifies the PROGRAMME, the thing a publisher applies to. Anderton's is
  the proof that the two schemes are unrelated: catalogue 30480, campaign 43829.
  Those programme ids live in `impact-merchants.ts` as `programId`, nothing in
  the ingestion path reads them, and their whole job is letting the admin list
  say which returned catalogue belongs to which merchant. A test forbids either
  id standing in for the other.
  **An approval is not a catalogue.** Impact grants a tracked link and a
  commission; whether a brand publishes a product catalogue to partners is a
  separate fact, and some of these may never have one. Unset is a fully
  supported state, exactly as Sweetwater's has always been.
  **Their commission runs 2% (Fender) to 15% (Donner), and the registry does not
  know it.** Same rule as Anderton's named brand list: a payout-aware registry
  is one `sort()` from preferring the merchants that pay, which is ranking by
  commission before a shopper sees a single result. A test asserts the word
  never appears in that file.
  **Two of the seven declare a `shipsTo` and five do not.** American Musical
  Supply and Musician's Friend are confirmed US only and say so, which means a
  British shopper now loses two of the largest catalogues here and Anderton's is
  hidden from an American one: the restriction cuts both ways and the notice
  and the `?ships=all` escape hatch matter more than they did with one
  restricted store. The other five are unconfirmed, and section 15's default is
  that absent means unrestricted precisely so a guess cannot hide real
  inventory. Confirm a merchant's actual policy before adding one.

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
  go/partner/[slug]/        Same, for the two partners with no listings (section 19)
  partners/                 Martinic Audio and DistroKid. NOT the catalogue (section 19)
  rigs/                     Artist rigs, and the records each is documented on
  pedalboard/               The rig builder (chain check, power, live pricing)
  alerts/, sign-in/, sign-up/
  chord-teacher/            Guitar harmony, all computed (section 22)
  stompbox/               THE GUIDE. /stompbox/* here, / on stompbox.world (section 20)
  stompbox/buymyboard/    PUBLIC. A seller prices their own gear (section 26)
  stompbox/outreach/      OURS. Price their lot, write the messages (section 26)
  render-bench/[slug]/      The offline renderer's subject. 404s unless RENDER_BENCH=1
  api/
    health                  Freshness and config, read this first when confused
    ask                     The Groq assistant. 503s when unconfigured
    alerts                  Saved alert CRUD
    auth/[...all]           Better Auth
    cron/*                  Ingest per source, refresh-deals, weekly-digest.
                            All fail closed on CRON_SECRET
    catalog/pedals          The pedal shelf, published (section 20)
middleware.ts             Rewrites the stompbox.world host onto /stompbox (section 20)
lib/
  stompbox/host.ts          WHICH SITE a request is for. Every host difference
  stompbox/                 The guide's dataset, chain, catalogue projection
  env.ts                    Every integration exposes isConfigured; nothing throws
  nav.ts                    THE nav tree. Header, mobile sheet and footer all read it
  theme.ts                  Light/dark/system, and the no-flash init script
  rigs/                     Curated artist rigs and the reverse index (section 13)
  ai/                       Groq client + the allowlisted DB tools (section 14)
  pedalboard/chain.ts       Signal-chain order rules and power estimates
  regions.ts                Who can buy from which store (section 15)
  chords/                   Harmony: qualities, keys, voicing search (section 22)
  board/pedal-models.ts     THE 88 MEASURED PEDALS, in millimetres (section 16)
  board/pedal-render.ts     Which committed still belongs to which pedal
  ingestion/ebay-feed.ts    Transport + TSV parsing (section 3)
  ingestion/ebay-ingest.ts  The three eBay jobs
  ingestion/reverb-awin.ts  Awin feed only. Never the Reverb API (section 2)
  storefronts.ts            THE STOREFRONT REGISTRY. A store is one row here
  ingestion/storefront-merchants.ts  The half that runs them. One reader, two platforms
  ingestion/storefront-probe.ts  Does this shop want to be read? (section 2)
  ingestion/andertons-impact.ts  Impact FTP drop, header-bound. Worker only
  ingestion/impact-catalogue.ts  ONE reader for all eight Impact merchants
  ingestion/impact-merchants.ts  The merchant registry. Carries no commission
  partners.ts               Focus-page partners and their pasted tracked links
  ingestion/upsert.ts       Idempotent writes, price history, run bookkeeping
  canonical/resolve.ts      Four-tier entity resolution (section 4)
  canonical/model-parse.ts  Brand/model/category from keyword-soup titles
  canonical/feed-category.ts  The merchant's own category, mapped (section 4)
  catalog/live-models.ts    ONE definition of what a category has in stock (section 20)
  pedalboard/chain.ts       The planner's chain. Its ORDER is the guide's (section 20)
  deals/pricing.ts          Rolling median, deal threshold
  search/                   Typesense with a real Postgres fallback (section 6)
  queue/                    BullMQ; the OTHER way to run ingestion (section 7)
public/pedals/              The 88 stills. Generated, committed, never hand-drawn
scripts/                    migrate, seed, worker, run-ingest, reindex,
                            render-pedal-models (section 16)
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
- **OUR OWN SHOP IS THE ONE THING THE REVERB API IS FOR, and that is not a
  loophole.** The rule above bans it for building the CATALOGUE, and the reason
  it gives is the carve-out: the API is scoped to managing *your own* shop. So
  `lib/reverb/shop.ts` reads Dean's Boutique, our own shop, to show our own
  listings on our own site, which is the single use it was published for. The
  distance from ingestion is structural rather than a promise: nothing it
  returns ever reaches `marketplace_listings`, a median, or a deal badge, and
  `tests/reverb-shop.test.ts` asserts the module holds no database import, no
  upsert and no write of any kind. Section 24 explains why that matters: our
  own stock inside the median means setting a price and also computing the
  market price that judges it. Do not delete that module on a fast read of the
  rule above, and do not widen it to any shop that is not ours.
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

**CATEGORY IS NOT RESOLVED THE SAME WAY, AND THE ORDER IS THE OTHER WAY ROUND
FROM IDENTITY.** Identity trusts the title last, because a title is keyword
soup. Category used to trust it FIRST, and only, through `detectCategory()`.
Measured against twenty-five real Reverb pedal titles that put twenty-two of
them in "Other", and filed a Keeley Compressor Plus under Recording & Audio.
A pedal in "Other" is not on `/used/effects-pedals`, so it is not in
`liveModels()`, so it is not on the guide's shelf either, and nothing throws.

Meanwhile every feed reader here had declared an alias for the merchant's own
category column since the day it was written, and not one of them stored the
value. Reverb publishes "Effects and Pedals / Fuzz" beside the title we were
guessing from. So `marketplace_listings.feed_category` holds it verbatim,
`lib/canonical/feed-category.ts` maps it onto our own vocabulary, and the title
parse is the fallback. Same rule as section 3's `inferredBrand`: an explicit
field beats an inferred one.

Three things about that mapper are load bearing:

- **It returns null, never "Other".** Null means "nothing here we recognise"
  and hands the decision back to the title. Answering "Other" would replace a
  guess with a worse guess, confidently, on every unmapped taxonomy.
- **It reads the LAST path segment first, then each parent.** Merchant
  taxonomies run general to specific, so the leaf carries the most information
  and the department is the safety net.
- **Genuinely ambiguous words are in NO pattern at all.** "Compressor",
  "reverb", "delay", "EQ" and "preamp" name a pedal and a rack unit equally
  well, so they match nothing and the parent segment decides: "Effects and
  Pedals / Compressors" resolves on the department, and "Pro Audio / Outboard
  Gear / Compressors" on its own. Adding `compressor` to the pedal pattern to
  win the first would silently take the second with it.

**eBay is deliberately not wired into this.** Its feed gives a numeric
`categoryId` rather than a name, and turning that into a category means the
Taxonomy API and a lookup table nobody has built. A number in that column would
map to nothing and only look like coverage.

**And a stated category may upgrade gear stuck on "Other", one way only.** The
canonical row is created by whichever listing arrives first; if that was an
eBay row with an unhelpful title, every later Reverb listing resolves onto it
and would leave it in "Other" forever. `enrichGear` treats "Other" as empty for
exactly this, and only a mapped FEED category is allowed through: a title guess
can never overwrite a category a merchant stated.

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
- **`/go/partner/[slug]` is the third route out, and the only one with no
  listing behind it.** The two focus-page partners (section 19) have no
  catalogue rows, so there is no listing id to redirect from. Everything else
  about it is deliberately identical to `/go`: the click is logged first and
  never blocks the shopper, the destination clears the same allowlist, and the
  redirect is a 302 with `no-store`. Its click rows carry a null `listing_id`,
  which is what tells partner traffic apart from marketplace traffic later.
- **A page that supplies commerce must supply it for everything the shopper can
  reach, not just for what the URL arrived with.** `/pedalboard` priced only the
  pedals already in the `?b=` parameter, so a pedal PICKED OUT in the builder
  had no price, no store and no `/go` link, and the panel said "not listed"
  about a pedal that was in stock. Arriving from a shared link worked and using
  the builder did not, which is exactly backwards, and nothing failed: the money
  path was simply absent. It now prices the whole picker catalogue server-side
  in one query and hands it over as a prop, which is also the only fix available
  given the builder is forbidden to fetch (section 20).
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
- **B-STOCK IS IN THAT GROUP TOO, as of the Reverb wiring, and it was not
  before.** It is factory stock with a cosmetic blemish sold by a dealer, which
  is the open-box case wearing a different word, so the asymmetry above applies
  to it unchanged. The reason it had to move rather than stay a judgement call:
  `reverb-awin.ts` normalises "B-Stock" to "Refurbished" before storing it, so
  a Reverb row was already being classed NEW while the identical words arriving
  from any other feed were classed used. One vocabulary, two answers, and
  nothing anywhere failed. Both halves of the classifier now carry it, and the
  spaced spelling too.
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
   Note that `npm run build` now MIGRATES FIRST (`db:migrate:deploy`), so a
   local build applies pending migrations to whatever `DATABASE_URL` points
   at. It skips silently when that is unset.
2. `npm run db:seed` then `npm run dev`, and actually look at the site. The
   seed deliberately includes cross-source duplicates and identifier-free rows
   so the resolver is exercised.
3. `curl /api/health`. It reports counts AND the age of the last successful run
   per job. A silently broken feed looks exactly like a quiet market, and only
   the age column tells them apart.
4. After a resolver change, reseed and check `canonical_gear` row count against
   the number of instruments in `scripts/seed.ts`. If they differ, the resolver
   is splitting or merging and the counts are the fastest way to see it.

**MERGE PULL REQUESTS WITH A MERGE COMMIT, NEVER A SQUASH.** This is a workflow
rule rather than a taste in history, and it cost three cycles to learn.

Work here happens on ONE long-lived branch that is reused across many changes.
A squash merge rewrites that branch's commits into a single new commit on
`main` with no parent link back to them, so the moment it lands the branch and
`main` share no history at all. The next pull request off the same branch then
re-proposes the ENTIRE tree as new work: GitHub reported `mergeable_state:
dirty` and 291 changed files for a diff that was genuinely eleven, and every
file the two sides had both touched came up as an add/add conflict. It happened
three times in a row before anybody named the cause.

The recovery, if it happens again: verify `main`'s tree is identical to the
branch's pre-merge commit (`git diff --stat <that commit> origin/main` must be
empty), merge `origin/main` back into the branch, resolve every conflict to the
branch side, and confirm the tree did not move. That is safe ONLY because the
squash means the two sides hold the same content; do not reach for it as a
general conflict strategy.

A merge commit keeps the parent link, the branch stays a true ancestor of
`main`, and the next pull request is clean without any of the above. The repo's
own default merge method should be set to match, but the setting is not the
mechanism: whoever calls the merge picks the method, so pick `merge`.

---

## 11. Environment variables

**Every string value is trimmed on read, and a whitespace-only value counts as
unset** (`str()` in `lib/env.ts`). This is not tidiness. A leading space pasted
into `IMPACT_ANDERTONS_FTP_HOST` sent DNS a hostname containing a space, which
failed `ENOTFOUND` and read for a while like an outage, because the offending
character is invisible everywhere the value is printed. Nothing this file reads
has meaningful edge whitespace, credentials included: a password whose first
character is a space cannot be told apart from a paste accident from inside the
process, and the accident is far likelier.

| Var | Gates |
|---|---|
| `DATABASE_URL` | Everything. The only hard requirement, and it is needed AT BUILD TIME as well as at runtime, because the build migrates before it compiles. Unset at build time skips migrations rather than failing, so a preview deploy with no database still ships. |
| `EBAY_FEED_BASE_URL` | Sandbox by default. Never change the default. |
| `EBAY_OAUTH_TOKEN` | eBay ingestion. Unset means the jobs skip with a logged reason. |
| `EBAY_AFFILIATE_CAMPAIGN_ID` | Populates `itemAffiliateWebUrl` in the feed AND builds fallback EPN links. Unset means eBay traffic is unmonetised. |
| `AWIN_PUBLISHER_ID` / `AWIN_REVERB_MERCHANT_ID` | Reverb deep links. Either missing produces null links, not broken ones. |
| `AWIN_REVERB_FEED_URL` | Reverb catalogue. Feed CONFIRMED to exist (Awin 67144, 100% approval); pending retrieval, not pending existence. The job no-ops until set. |
| `LINKCONNECTOR_SWEETWATER_FEED_URL` | Sweetwater catalogue. Unset is expected; the job no-ops. Never falls back to scraping. |
| `AWIN_GEAR4MUSIC_MERCHANT_ID` / `AWIN_GEAR4MUSIC_FEED_URL` | Gear4music catalogue and deep links. Same shape as the Reverb pair, independent ids. |
| `CJ_ZZOUNDS_FEED_URL` / `CJ_FULLCOMPASS_FEED_URL` / `CJ_PINEVILLEMUSIC_FEED_URL` | Three independent CJ Affiliate programmes. Each no-ops when unset. |
| `IMPACT_ANDERTONS_FTP_*` | Anderton's via Impact.com, ingested by `lib/ingestion/andertons-impact.ts`. Impact delivers catalogues by FTP drop, NOT over an HTTPS feed URL like Awin/CJ/LinkConnector, so this is a host/user/password/path quartet. `hasAndertonsFeed` gates on the credential pair, since host and path have defaults. **The credentials are a dedicated pair Impact mails on request** ("Email Product Catalog FTP Username and Password", needs Technical Settings permission), not the Impact account login, and **the host comes from the platform's own "Download via FTP" panel** rather than from this file: `products.impact.com` is the default here but is documented on the brand UPLOAD side, so treat it as a starting guess. See the FTP note below the table. |
| `GOAFFPRO_*_REF_PARAM` / `GOAFFPRO_*_REF_CODE` | One pair per small independent Shopify/WooCommerce seller (Folkcraft, Acoustic Guitar, Jamstik, Jackson Audio, Eminence Digital, Haze Guitar, EART Guitar, Play With Authority, Pures Music, Squaver, Eason Music Store, Go Kalimba). Catalogue ingestion needs no credential at all; an unset code just means a null `affiliate_url` until the referral is confirmed. |
| `REVERB_SHOP_TOKEN` / `REVERB_SHOP_SLUG` | Dean's Boutique, OUR OWN Reverb shop, read by `lib/reverb/shop.ts` and served as public JSON by `/api/reverb/shop`. This is not the exception to section 2 that it looks like: see the note under that section. The token is a Personal Access Token from the shop's own API settings and belongs in the deployment, never in this repository. The slug is not a secret and defaults to `deans-boutique-505`. Unset is fully supported and the section simply does not render. |
| `GROQ_API_KEY` / `GROQ_MODEL` | The Ask assistant (section 14). Unset means /api/ask 503s and the button never renders. The model default is overridable because Groq retires models often. |
| `TYPESENSE_*` | Search backend. Unset falls back to Postgres. |
| `REDIS_URL` | BullMQ queues and the shared rate-limit counter. Optional. |
| `CRON_SECRET` | Every `/api/cron/*` route. Unset = 503, wrong = 401. Load bearing: these burn the eBay call budget and send mail to the whole subscriber list. |
| `BETTER_AUTH_SECRET` | Accounts and alerts. Unset = auth routes 503, rest of site unaffected. |
| `RESEND_API_KEY` / `DISCORD_WEBHOOK_URL` | Alert delivery. Each no-ops with a warning. |
| `ADMIN_PASSCODE` | `/admin/operating-model`. Unset = nobody can sign in, ever. See section 12. |
| `INSTAGRAM_HANDLE` / `INSTAGRAM_POST_URLS` | Homepage and footer follow strip. Handle defaults to `stomp_box_world`, which is a DIFFERENT account from `stompbox.world`: the older grid matched the domain, this is the one being populated, and they read alike enough to get merged by anyone tidying up. Unset post URLs render a plain follow callout instead of embeds. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" on sign-in/sign-up. Unset means email and password only. |
| `NEXT_PUBLIC_STOMPBOX_URL` | Canonical origin of the GUIDE (section 20), defaulting to `https://stompbox.world`. **Renamed out of `NEXT_PUBLIC_SITE_URL` deliberately**: with one deployment serving two domains, "the site URL" is ambiguous and pointing it at gearavail.com is the obvious thing to do to a variable with that name. That would repoint every canonical tag on the guide at the aggregator, and nothing would fail. `SITE_URL` is the aggregator's origin and is a different variable. |
| `NEXT_PUBLIC_STOMPBOX_HOST` | One extra Host that serves the STANDALONE guide rather than the aggregator. `stompbox.world` and `www.stompbox.world` are always recognised; this exists so a Vercel preview URL can be pointed at the standalone shape without editing `lib/stompbox/host.ts`. Unset is normal. |
| `GEAR_AVAIL_URL` | Origin the guide uses for absolute links back into the catalogue. The guide is served on a different domain, so `/gear/[slug]` cannot be relative there. Falls back to `SITE_URL`, then to production. |
| `YOUTUBE_API_KEY` | Anderton's TV metadata and comments, via the YouTube Data API v3. The reasoning, including why transcripts are off limits, is in the `youtube` block of `lib/env.ts`. Unset means the reader no-ops. |
| `RENDER_BENCH` | `/render-bench/[slug]`, the harness `scripts/render-pedal-models.ts` photographs to produce the committed pedal stills. Unset is the expected state everywhere, including locally: the route 404s until it is `1`. It is the one canvas that mounts outside the pick-it-up dialog, so it fails closed like `CRON_SECRET` rather than relying on nothing linking to it (section 16). |

| `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN` | Impact's partner REST API (`api.impact.com/Mediapartners/{sid}/Catalogs/{id}/Items`, HTTP Basic, JSON, paginated), which is the OTHER way into Anderton's and the ONLY way into the other seven merchants. Both credentials are on Impact's API settings page and both are shared by every advertiser on the account. **Prefer this over the FTP block where it works**: ordinary HTTPS with no control connection or passive ports, and a slice is a page rather than a re-download of the whole catalogue per chunk. **It does NOT work for Anderton's**, and that is settled rather than suspected: see the note below the table. |
| `IMPACT_ANDERTONS_CATALOG_ID` | Defaults to 30480 (campaign 43829, 27,052 products) because somebody read it off the platform and it is not a secret. |
| `IMPACT_AMERICANMUSICAL_CATALOG_ID`, `IMPACT_MUSICIANSFRIEND_CATALOG_ID`, `IMPACT_NATIVEINSTRUMENTS_CATALOG_ID`, `IMPACT_FENDER_CATALOG_ID`, `IMPACT_UNIVERSALAUDIO_CATALOG_ID`, `IMPACT_DONNER_CATALOG_ID`, `IMPACT_PLUGINALLIANCE_CATALOG_ID` | One per Impact merchant, ALL UNSET BY DEFAULT AND NEVER GUESSED. A wrong id does not fail safely: it either 404s or returns another advertiser's products under this merchant's name, which poisons the store page and every median built from it. Read the real ones with `{"mode":"list"}` on `/api/admin/impact`, surfaced as a button. Unset means that merchant's job no-ops, same as Sweetwater. |
| `IMPACT_MARTINIC_LINK` / `IMPACT_DISTROKID_LINK` | Whole tracked links, pasted from Impact's "create your links" step, for the two focus-page partners (section 19). Never built here: an Impact deep link needs `/c/<publisherId>/<campaignId>/<adId>`. A value that is not on an Impact tracking host is IGNORED with a warning rather than used, and unset means the page links to the merchant's own site untracked. |

**Two transports and eight merchants, ONE normaliser.**
`normalizeImpactRecords()` in `lib/ingestion/impact-catalogue.ts` is shared by
all of them: the FTP drop arrives as delimited text and the API as JSON objects,
but from binding down they are the same thing, a list of records whose field
names are the brand's choice rather than the network's, and a merchant differs
only by catalogue id, currency and country. This is section 7's "never fork the
logic" applied to transports and to merchants rather than to triggers. Do not
let the API path grow its own parser, and do not write a per-merchant module:
add a row to `lib/ingestion/impact-merchants.ts` instead.

**Impact's API is a legitimate partner channel, not a workaround** for the FTP
server being awkward. It is their published Mediapartners API, authenticated
with our own account credentials, serving the catalogues these brands publish
to partners for this purpose. That is a different thing entirely from the frontend
Algolia index rejected for Guitar Center (section 2).

**Check the schema before the first pull.** `{"mode":"peek"}` on
`/api/admin/impact`, surfaced as a button, reads one page, writes
nothing, and lists every field name found beside the ones the alias table
bound. This is the header-row rule made self-service: the FTP parser earned its
bindings from a real header row somebody pasted in, and the API earns its own
without a round trip. **The output that matters is a field PRESENT BUT
UNBOUND**, which is exactly how a column silently arrives null on every row.
That check has already earned itself once: `originalUrl` carried only the
spaced spelling, so Impact's CamelCase `OriginalUrl` bound to nothing and
`rawUrl` fell back to the TRACKED url on every row. Nothing throws and no row
is skipped; the only symptom is `/go` handing out affiliate links where the
merchant's own page belongs. Header matching collapses spaces and underscores
but cannot split `OriginalUrl` into two words, so both spellings have to be in
the table.

**ANDERTON'S CANNOT BE READ THROUGH THE IMPACT API, AND THAT IS THE
ADVERTISER'S SETTING RATHER THAN OUR CONFIGURATION.** Asked for catalogue 30480
the API answers, verbatim:

```
400 Bad Request
{"Status":"ERROR","Message":"The requested catalog has not been made available
 via API by the Advertiser."}
```

Three things fall out of that one line, and each had been an open question.
The credentials are FINE: Impact checks the Basic pair first, so a 400 rather
than a 401 clears them. The catalogue id 30480 is RIGHT: a wrong one is a 404,
and this reply names the catalogue it will not serve. And the page size was
never the problem, which is worth recording because it was the obvious suspect
and it was wrong.

So the FTP drop is not merely the older path for this merchant, it is the ONLY
path, and the question section 1 leaves open (whether a serverless function can
hold the connection) is the question that actually matters for Anderton's.

`ingestImpactCatalogue` records this as SKIPPED rather than failed, next to the
merchants whose catalogue id is simply unset, because it is the same shape of
thing: nothing here is misconfigured, no retry helps, and the fix is a setting
in somebody else's account. It ran as a 500 every three hours for two weeks
before anybody could see why, which is the whole argument for the change.

**Do not assume the other seven are API-enabled either.** Each advertiser makes
that choice separately, so a catalogue id read off the account is necessary and
not sufficient: the id can be right and the answer still be this.

**Debugging the Anderton's FTP pull.** Two admin buttons, both behind
`ADMIN_PASSCODE`. "Pull the Anderton's catalogue" does the work; "Diagnose the
Anderton's connection" (`/api/admin/probe-ftp`) opens a socket to ports 21, 990
and 22, records what the server says about itself, and quits **without sending
a username or password on any of them**. An SSH banner on 22 would mean the
drop is SFTP and `basic-ftp` is the wrong library outright, rather than the
right library with a wrong option.

`explainFtpFailure()` in `lib/ingestion/ftp-probe.ts` routes a failure to the
thing worth changing, and the reply CODE is what it reads rather than the
prose: Impact's "431 Service is unavailable" reads like an outage while 431 is
RFC 2228's security range, returned to `AUTH TLS` before any credential is
sent. **Never add a silent fallback to plaintext FTP** when TLS is refused.
That puts a real credential in clear on the public internet, and it is a
decision to take deliberately if at all, not one to bury in a `catch` block.
The same instinct as the Reverb API having no fallback path (section 2).

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

**The MusicBrainz position was stated too broadly and is corrected here.** Its
WEB SERVICE is free for non-commercial use only, and this site is commercial,
so that service must never sit on the runtime path. Its DATA is a different
thing: MusicBrainz core data, release-group identifiers included, is CC0. So
`scripts/fetch-album-covers.ts` resolves those identifiers ONCE, offline, at
one request a second with a real user agent, and commits them; the site then
serves covers from coverartarchive.org, which the Internet Archive hosts and
which carries no such restriction. Nothing queries MusicBrainz at runtime. At
any real scale the answer is the CC0 database dumps or a commercial plan, not
a faster loop.

IMAGERY, and what each source does and does not permit:

- **Artist photographs: Wikimedia Commons only** (`lib/rigs/photos.ts`).
  Everything hosted there is freely licensed and the licence is machine
  readable, which is what makes it usable commercially without asking anybody.
  Press and agency photographs are not, which is why monograms were chosen
  first and remain the fallback. Two rules are enforced in code rather than by
  convention: NO ATTRIBUTION, NO IMAGE (`isRenderable` gates it, and the
  component falls back to the monogram), and NonCommercial and NoDerivatives
  licences are rejected however free they look, because this site earns
  affiliate revenue.
- **Album covers: the Cover Art Archive** (`lib/rigs/covers.ts`), at the 250px
  thumbnail. The Archive grants no rights in the artwork and the covers remain
  their rights holders'; a thumbnail beside editorial writing about which
  pedals made that record is ordinary music-publication practice and a fair
  dealing argument, not a settled fact. So covers stay small, always captioned
  with the record they depict, and are never used decoratively away from
  writing about that record.
- **Both datasets are MACHINE-COPIED, never typed.** Every credit comes out of
  Commons' own `extmetadata` and every MBID out of MusicBrainz, written by the
  scripts. Hand-editing an attribution is how a wrong credit gets published,
  and a hand-typed MBID is 36 characters nobody can check by eye that silently
  shows a different album's artwork.

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
- **Two of the seven Impact merchants added in August 2026 carry one and five
  do not**, and both halves of that are this rule being followed. American
  Musical Supply and Musician's Friend are confirmed US only, so they declare
  it. The five brand stores are unconfirmed either way, and a guessed
  restriction hides real inventory from real shoppers, so they stay
  unrestricted until somebody checks.
- **The restriction is no longer one-directional, and that changes what this
  costs.** With Anderton's alone, hiding only ever affected non-UK shoppers.
  Now a British shopper loses the two biggest US retailers and an American one
  loses Anderton's, so the "we hid N listings from X" notice and the one-click
  `?ships=all` are load bearing for most of the audience rather than a minority
  of it. Do not quietly drop either, and do not add a third restricted store
  without confirming its policy first.
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

## 16. The design system: stompbox.world's, worn by the aggregator

`app/globals.css`, `components/brand/logo.tsx`, `components/ui/stomp.tsx`.

**This site has now left two palettes behind, and both exits were the owner's
call.** globals.css began as a port of nicotiamarket.com's tokens (the hemp
family's golds and sages), which made a gear shop look like a hemp marketplace
with new photos. The first redesign replaced that with a neutral graphite scale
and a brass edge, on the argument that a guitarist's visual world is grey and
the warm metal in it is brass. That argument was real, and the owner overruled
it deliberately in August 2026: stompbox.world is the brand with the audience,
its Instagram account is the front door for most people who will ever see
either site, and the aggregator now wears that design rather than its own. So
neither "match the hemp sites" nor "the old comments say grey and brass" is a
reason to change any of this; the reasons are on the record here and in
`STOMPBOX.md` section 5.

**THE TWO FILES NOW DESCRIBE ONE SYSTEM BECAUSE THERE IS ONE STYLESHEET.** They
described one system by agreement before, in two `globals.css` files that had to
be kept in step by hand. The merge (section 20) collapsed them, and the notable
thing is how little there was to reconcile: every token was already identical,
value for value, and of the twenty-one shared component classes exactly one
differed behaviourally. That one is `.readouts`, which the guide caps at the
prose measure because its hero is left aligned and the aggregator does not
because its hero is not, and it is kept per-site under `[data-site="stompbox"]`
rather than resolved, because both are right about their own page. Everything
else that looked like a difference was a reworded comment.

**What the system is:**

- a deep royal blue scale, six steps, dark by default
- chrome (`--chrome`, WHITE) as the EDGE, and almost never a fill
- one bright green (`--brand-led`), reserved for things that are lit
- royal blue metal (`--metal-*`), the same value in both themes, BRIGHTER
  than the dark ground so the enclosure reads as the lit object in the room
- a blocky display face (Chakra Petch) because the account's wordmark is
  heavy angular capitals; the serif pair is gone entirely, not parked

**Token names were made honest when the values moved.** `--brand-gold` became
`--chrome` (a gold token holding white is a lie that outlives its author), and
the stale warm aliases (`--gold`, `--copper`, `--amber`, `--tweed`, `--steel`)
were renamed at their call sites rather than repointed. Only the names that
are still true survive as aliases: `--cream` is the text colour and `--deal`
is the money colour.

**BRASS SURVIVES IN EXACTLY ONE PLACE: `--signal`,** the market-price trace in
`components/price-history-chart.tsx` (via `--chart-signal`, which swaps to the
darkened brass on paper). The sister site's circuit figures made the same
chrome-versus-signal split for the same reason: a frame and a signal path in
one colour stop telling you which line is the data. Do not paint a second
thing gold, and do not paint the trace chrome.

**`--chrome` is white in BOTH themes, and `--chrome-dk` is the on-paper
variant.** Chrome outlines metal, and metal is dark in both themes, so a white
edge is right on paper too. An accent edge that lands on the PAGE rather than
on a control (the focus ring, `.pill`, the navlink underline, a card's hover
border) takes `--chrome-dk`: pale steel on the dark ground, navy on paper. A
white border on white paper is not an accent, it is nothing.

**Dark is the default, and that is a product decision rather than a technical
one.** Cut-out product photography separates on the navy plate, and the chrome
edge and LED green only carry against a dark ground. Someone whose laptop is in
light mode still gets the site as designed. "system" survives as a state you
can choose, which means it has to be STORED: absence now means dark, so
clearing the key would silently turn "follow my OS" into "dark".

**The metal tokens do not change between themes.** An enclosure is the same
object whatever it is standing on, and controls that keep their material across
themes are what stop the interface feeling like two interfaces. Surfaces flip;
buttons do not. Tinting the metal is no longer forbidden, because the owner
tinted it; redefining it per theme still is.

**Every control is a piece of gear.** Buttons are stompbox faces (`.stomp`),
icon buttons are knurled knobs (`.knob`), and the theme switch is a Les Paul
toggle (`.lp`) that CYCLES, because you flip a toggle rather than pick a
position on one: three states means the furthest any theme can be is two
flips, and one 54x50 target beats three cramped segments.

**That covers the things you PRESS. Three more cover the things you SET**, and
they were added because a rounded grey pill beside a machined footswitch is
exactly what gives away that the gear is a costume. A checkbox is an indicator
LED (`.led-check`): the meaning already matched, since an LED means "this is
on" and so does a ticked filter. A `<select>` is the plate a rotary switch is
mounted on (`.rotary`), NOT a fake knob, because the element opens the
platform's own picker and a knob you cannot actually turn is a worse control
than an honest plate with a real menu behind it. A text field is routed INTO
the panel (`.plate`), which is what an input jack or a display window on a
pedal is, with the caret in LED green because the caret is the live thing.

**Every one of them keeps its native element.** `appearance: none` repaints a
real `<input>` and a real `<select>`; it does not replace them with divs. The
keyboard, focus, the mobile picker and the screen reader all still work because
they are still the same controls, and `:focus-visible` keeps its own outline
rather than inheriting the resting look.

**`.rotary`'s ink is a fixed `#f2f5f8`, not `var(--text)`, and that is the
metal rule biting.** The plate is metal, metal is the same in both themes on
purpose, so ink that flipped with the theme would put near-black lettering on a
dark blue plate on paper. `.stomp` fixes its `--stomp-ink` for the same reason.
`.led-check` and `.plate` DO carry a light-theme half: an unlit LED is dark on
any panel so only its bezel changes, and a hole cut in pale paper is pale.

The rules that keep the vocabulary off the cheese, and they are load bearing
rather than taste:

- the blue is deep and saturated rather than candy-coated; the drab ground is
  what lets the chrome edge and the LED read at all
- chrome is an edge, never a fill: one hairline border and one silkscreen line
  inside it, exactly as a pedal is printed
- the LED is the only saturated colour and means the same thing everywhere
- travel is 2px, so it reads as a switch bottoming out
- nothing spins, bounces or glows at idle. A rack of gear at rest is still
- chrome is MUTED at rest and earned by `:hover` and by the one primary action
  per view. A toolbar of eight buttons must not be eight white rings

**The mark is drawn, not typeset, and it is now the enclosure with the fork on
its face.** The bare fork-in-a-ring could not survive the move to chrome: white
line art on the light theme's paper is invisible, and an enclosure gives the
print a metal plate to sit on in both themes, which is the same reason the
sister site's mark is a box. The header and the favicon are one drawing now
(`GearAvailMark` resolves tokens, `app/icon.svg` is the literal-hex build), so
the tab and the masthead read as one identity. The guitar-faced enclosure
survives as `GearAvailEnclosureMark` for the board builder, where the subject
genuinely is a stompbox; its print is silkscreen ink, which is why a filled
chrome graphic is allowed there when chrome-as-fill is banned in the interface.
The letterforms are stroked polylines with mitred joins on a 100-unit cap
height, so the wordmark needs no font, renders identically everywhere and
survives being inlined into a favicon.

**Every draft that was thrown away failed in the same direction: clever
geometry becomes an accident at tab size.** Chamfering the enclosure into an
octagon read as a road sign. Two deep notches either side of a neck, for a
double cutaway, produced unmistakably a cat (a guitar's shoulders sit HIGH and
the cutaway is a shallow scoop, not a V). Two knobs above a footswitch read as
two eyes above a mouth. A fork and a switch drawn as two separate small marks
both dissolved, which is why the fork's stem runs down into the switch: one
graphic, one weight, and a heavier stroke than looks right at 96px. Draw the
candidates at 16, 20, 32 and 96 on light AND dark browser chrome before
committing one. Every failure above was invisible at the size it was drawn.

**The sister site ships this same enclosure silhouette, in the same blue.**
Two projects in one repo must not put the same picture in two tabs, and colour
no longer separates them, so the GRAPHIC does: Gear Avail's face carries the
fork, stompbox.world's is a bare footswitch. `tests/favicon.test.ts` pins
exactly that difference; if the fork ever leaves this icon or arrives on
theirs, the two tabs collapse into one picture.

**Two tokens are contrast-critical and are not interchangeable with the brand
hues.** Pure white is 1:1 on white and bright green about 1.9:1, both far
under the 4.5:1 a price or a sentence needs. Anything printing a price or
accent-coloured body text uses `--money` and `--accent-text`, never `--chrome`
or `--sage`, or it reads in one theme and vanishes in the other.

**THE PEDAL YOU CAN PICK UP IS A REAL THREE.JS SCENE.**
`components/board/pedal-viewer-3d.tsx`, driven by
`lib/board/pedal-models.ts`. It replaced a version built from divs in
`preserve-3d`, which was a genuine solid and still read as a diagram: a
painted gradient cannot do a specular highlight travelling across a curved
knob, and that highlight is most of what makes an object look real. The old
one is DELETED rather than kept beside the new one, because two renderers for
one concept is section 7's rule broken and the dead one is the one that
drifts.

**WHY NOT A GAME ENGINE, given the owner offered.** The canvas has to sit in a
dialog on a page whose DOM board, `/go` links, indexability and screen-reader
path all survive untouched. three.js is about 150KB and mounts inside the
existing React tree; Godot would ship tens of megabytes of WASM and its own
export pipeline for the same job. Godot stays reserved for the separate rig
room, and as of August 2026 that room EXISTS: `godot/rig-room` is a real Godot
project with a first-person player, a reach raycast and an inspection mode, and
`tools/verify.tscn` walks the whole loop and photographs it. See section 23.

**THE CANVAS EXISTS ONLY INSIDE THE DIALOG, and that is what keeps section
16's four guarantees.** The row of pedals is real DOM buttons, the outbound
link is an anchor, and the renderer is behind a `dynamic(..., { ssr: false })`
so a shopper who never picks a pedal up never downloads it.

**THE NAMED PEDALS ARE MEASURED; EVERYTHING ELSE IS DERIVED AND SAYS SO.**
`lib/board/pedal-models.ts` carries one hand-authored entry per pedal worth
modelling, in millimetres off the real thing. A Boss compact is the reason the
file exists: it is not a 1590B with different paint but its own casting, 73mm
wide, with the knobs on a raised rear shelf and a HINGED TREAD PLATE over the
front two thirds, held by a thumbscrew at the toe. It also has no round
footswitch at all, because the plate is the switch. Get that wrong and no
guitarist believes the picture. Anything with no entry falls back to the
slot-derived generic through `genericModel()`, which goes through the same
renderer and states in its own words that it is not this pedal.

**THE SILKSCREEN IS SET IN THE SITE'S OWN TYPE, NEVER A REDRAWN LOGO.** Naming
the product is what a parts list does and what every merchant photograph on
this site already does; reproducing a brand's mark as artwork is a different
act, and only one of the two is needed to say which pedal this is.

**A TEXTURE HAS TO KNOW WHICH FACE IT IS FOR.** The decal is mapped over the
plane it is painted on, not over the pedal: the first pass mapped a DS-1's
full 129mm and painted the result onto its 52mm rear shelf, so every legend
arrived squashed into a third of its width. The same constants size the plane
and the mapping (`DECAL_W`, `DECAL_D`) so the two cannot disagree, and they
are short of the edges because the shell's corners are rounded and a
full-size square plane pokes its corners out as four bright tabs.

**AND IT HAS TO KNOW THAT FACE IS NOT SQUARE.** The canvas is square and almost
no face is, so the two axes carry different millimetres per pixel and unscaled
type comes out stretched. On a roughly square top the error is a few percent
and passes for a font choice, which is why it survived the fix above. The wah
is where it showed: its printed heel is 88mm across and 40mm deep, so a glyph
drawn at 9mm tall came out 2.2 times too wide and "CRY BABY" ran off both edges
of the plate it was printed on. Height is already right, because the font size
comes from the depth mapping; only the horizontal is corrected, by exactly the
ratio between the two mappings.

**THE RENDER IS A PORTRAIT, NOT A RULER.** Every pedal is scaled to fill the
same frame (`FIT`), because a fixed camera framed for a 129mm DS-1 loses a
254mm wah off both ends and shrinks a 42mm micro to a chip. The CSS viewer this
replaced sized itself to the enclosure and the three.js one silently did not,
which shipped a Cry Baby cropped out of its own dialog. The real millimetres
are still printed under the canvas, which is where a shopper reads how big the
thing actually is.

**THE WEDGE IS THE FOURTH BODY STYLE, AND IT EXISTS BECAUSE A TUNER IS THE ONE
PEDAL WHOSE JOB IS TO BE READ.** A Korg Pitchblack X has a sloped top so the
display faces the player rather than the ceiling; drawn as a box it is an
unmarked black rectangle. It is built from a side profile extruded across the
width rather than from a rotated box, and the ramp carries its own screen and
footswitch, the way the treadle carries its plate: the numbers stay in the
model, the branch that knows the geometry places them. **Watch the extruder's
frame.** `rotateY(+PI/2)` maps a point to `(z, y, -x)`, which REVERSES the depth
axis: the first build came out tall at the front, pointing its display at the
wall, with the decal floating off the body. `-PI/2` keeps front forward and
mirrors the width instead, which a symmetrical extrusion cannot notice.

**ITS DISPLAY STAYS DARK, and this is where a specification was declined rather
than followed.** An asset plan for this model asked for an emissive readout
showing a note letter and a tuning bar. That is the one thing the rule above
forbids: what a tuner reads depends on what you are playing, and drawing a
needle is inventing a measurement in the same way a market price under
`MIN_SAMPLE_SIZE` is. The wedge alone says "tuner".

**AND THE RENDERER'S "HAS THIS PICTURE CHANGED" CHECK WAS WRONG BY A FACTOR OF
THREE, WHICH THE WEDGE FOUND.** `looksTheSame` skipped rewriting a still when
two images were within an average channel difference of 1.5, a number chosen on
the assumption that a software rasteriser drifts between runs. Measured, it does
not drift at all: two runs of an unchanged model are BIT IDENTICAL, and a real
edit (a display a quarter smaller, moved 4mm) scores only 0.52. So the tolerance
sat above the signal and a genuine change was reported as "unchanged" with the
old file left on disk. It is 0.05 now, an order of magnitude clear of both
numbers, and the measurements are in the file so the next person changes it with
evidence rather than with an assumption.

**EVERY BODY STYLE NEEDS A BRANCH IN THE VIEWER, AND A STYLE WITH NO BRANCH
FAILS SILENTLY.** `boss-compact`, `treadle` and `round` all exist because the
shape is the whole point: a wah is a chassis with two cheeks and a plate that
rocks between them, and a Fuzz Face is a lathed dome that is not a box in any
direction. When the three.js viewer replaced the CSS one, `treadle` had no
branch and fell through to the box, so a Cry Baby shipped to production as a
rectangle and nothing errored. `tests/board/pedal-models.test.ts` now fails a
`treadle` style with no treadle geometry behind it.

**A MATCH TABLE IS A CLAIM ABOUT A SPECIFIC PRODUCT, so it follows the same
narrowing rule as `matchGuideEntry` and `creditsForGear`.** A loose pattern here
does not miss, it MISATTRIBUTES: it prints one pedal's name on another pedal's
body, confidently, on a page somebody is about to spend money from. Every one of
these was live before it was a test. `micro` under MXR caught a Micro Amp and
drew it as a Phase 90. `tube screamer` caught the Mini, a different enclosure
entirely. `big muff` caught the Nano. `chorus` under Boss caught a CE-1, which is
a mains-powered wedge rather than the compact casting. And `dd-?[23]` gave a DD-2
the DD-3's silkscreen.

Where a casting genuinely IS shared and only the print differs, the answer is a
SECOND ENTRY spread from the first (`BOSS_DD2`, `PROCO_RAT2`), never a wider
pattern: a pattern loose enough to catch both has to print one of them wrong.
Where the shape is shared but the finish is unverified, as with a TS808, the
honest generic is the right answer until somebody checks. A test walks the guide
dataset and the picker catalogue and asserts the printed legend is a substring
of what the dataset calls the pedal, so the next DD-2 is caught without anybody
having to think of the pair in advance.

**A MODEL CARRIES A LIST OF FOOTSWITCHES, NOT ONE.** It used to be a single
switch or null, which is true of the pedals modelled first and false of most of
what people buy now: a Strymon compact has two, a Boss 200 has two, a DL4 has
four. A field that holds one does not fail when a second is needed; it draws a
two-switch pedal with one switch. Two more pieces of hardware exist for the
same reason: a `toggles` list, because the boutique answer to "this pedal does
two things" is a bat lever rather than a knob and drawing one as a small knob
says the mode is a sweep, and an optional `screen`, which is a dark window with
NOTHING written in it, because what a tuner reads depends on what you are
playing and drawing a plausible needle is inventing a measurement.

**A FADER AND A STACKED KNOB ARE HARDWARE, NOT A KNOB DRAWN DIFFERENTLY.** A
graphic EQ is eight faders and a Boss high-gain pedal is five controls on three
holes, and both exist for one reason: the face is 73mm wide, so a circuit
wanting more controls than that will hold in a row gets DIFFERENT hardware
rather than smaller knobs. Seven knobs in a row is seven knobs in a row; seven
caps at different heights is a curve you can read across a room, which is the
whole point of a GE-7. A stacked pair drawn as one knob quietly deletes a
control the pedal has. A fader's footprint in the clearance test is its whole
SLOT rather than its cap, because print across a slot is print across a hole.

**A TALL CONTROL HIDES PRINT BEHIND IT, and that is geometry rather than
taste.** The camera sits 27 degrees above the deck, so a part standing h off the
face hides about 2h of shelf behind itself: a 10mm toggle buries a label 20mm
back, in plan nowhere near it. Three separate models were fixed by eye for this
before anybody wrote the rule down, so the clearance test is asymmetric now and
takes the factor from the camera position rather than from a guess. It is also
why every knob label on every real pedal here is printed in FRONT of its knob,
and why the Strymon's second row of knobs is offset in x rather than moved
forward: there is not 20mm of clear shelf to find on a 114mm pedal.

**THE DIMENSIONS ARE NOT TYPED HERE ANY MORE; THEY COME FROM THE PLANNER'S OWN
ENCLOSURE TABLE.** Most pedals are built in a standard box, and
`lib/pedalboard/catalog/enclosures.ts` already names and measures every one of
them with a provenance marker per figure, because the layout engine needs it.
`enc()` in the model file reads that table, so a pedal is the same size in the
plan and in the picture of it. Only a pedal with no standard box (a Klon, a
Fuzz Face, a Deluxe Memory Man) still carries hand-measured numbers.

**AND THE CROSS-CHECK COVERS PEDALS WITH NO STANDARD BOX TOO.** A Whammy, a
DL4 and a PolyTune have no Hammond number, so `enc()` has nothing to read, but
the catalogue still measures them because the layout engine has to place them.
`catalogDims()` reads those, which means no pedal's size is asserted in only
one file. Widening that check is what caught the RAT: hand-typed here as 124 x
92 with a note explaining why it is wider than it is deep, against ProCo's own
89 x 114, which is the other way round. The note was a confident paragraph
about a shape the pedal does not have.

Where NEITHER file has a measurement, the answer is still one number rather
than two: the Deluxe Memory Man's figures are marked `estimate` in the
catalogue and this file now reads them, so a real measurement corrects one
place.

That is not tidiness: **the two tables had already drifted, and the drift was
the Big Muff and the Small Stone exchanged.** Hand-typed, the Big Muff came out
89mm wide and the Small Stone 145. The famous board hog rendered as the narrow
one and nothing failed, because nothing was comparing the files. A test compares
them now, and exempts exactly one figure: a treadle's HEIGHT, because the table
means the whole pedal standing at rest and the model means the chassis the plate
rocks on. The footprint is held either way.

**A FAMILY IS ONE CASTING IN A COLOUR, so it is a factory rather than thirteen
copies.** `bossCompact()` and `mxrCompact()` take the paint, the controls and
the print, and derive everything else; `knobRow()` lays a row out from the count
so the pitch cannot collide, which is the arithmetic the knob-overlap test was
written for after the first hand-typed row rendered as one lump.

**PRINT COLLIDING WITH PRINT IS INVISIBLE TO A GEOMETRY TEST**, because nothing
intersects: two bits of type land on the same square millimetre of the decal and
the canvas draws them over each other. "BIG MUFF PI" went straight through the
word TONE, and the Small Stone's indicator LED sat in the middle of RATE. Both
are held now, legend against knob label and LED against every piece of print,
and the LED case matters because a solid over a decal is not a collision any
geometry check can see.

**THE TYPE IS CENTRED ON ITS z (`textBaseline = "middle"`), and it was not.** On
the canvas default a legend hangs above its z by three quarters of its cap
height rather than straddling it, so every number in the model file meant
something 3mm behind where it read. Centring it is what lets the clearance test
do arithmetic on the same numbers the file states.

**THE BOSS SHELF DECAL IS INSET AT THE BACK AND FLUSH AT THE FRONT.** The back
edge is the casting's rounded corner and needs the standoff; the front edge is
the straight step the tread plate hinges against, and the plate covers it.
Insetting both equally cost 2.5mm at the only end short of room, which is what
ran "SUPER CHORUS" off the front of the plate it was printed on. The plane and
the texture mapping are built from the same two numbers so they cannot disagree.

**A MODEL NOTHING CAN REACH IS WORSE THAN NO MODEL, because it looks like
coverage.** Every entry is written for a real product, so every entry has to be
findable from the name that product goes by in one of the two datasets, and a
test walks the table asserting it. Two had already failed that silently. The
Walrus Slö's pattern ended in `\b`, and JavaScript's word boundary is ASCII
only, so there is no boundary after the "ö" in "Slö Reverb" and the model
matched nothing at all. The Hall of Fame Mini was one of the first three
written and had never been reachable, because the planner's catalogue does not
carry that product; the fix there was adding the pedal, not deleting the model.

**Match the maker string the DATASET uses, not the one that sounds right.** The
Fuzz Face's brand pattern was anchored on `arbiter` while both datasets say
"Dallas Arbiter", so the one round pedal on the site matched nothing at all and
quietly rendered as a box. Checking the match table against the real data is
what found it; reading the model file could not have.

**AN EMPTY BOARD IS A SHELF, NOT A SENTENCE.** `/pedalboard` opened as a dashed
rectangle reading "Empty board. Add a pedal", on the page that is meant to sell
the whole tool, with the one thing this project owns outright, eighty-eight
pedals measured in millimetres and now photographed, two clicks away behind a
picker nobody opens on arrival. The empty state is the pedals now: ONE PER SLOT,
in signal order, so the first thing the page says is that it understands the
order. Only modelled pedals, because a shelf of the honest generic would be a
shelf of identical boxes. It derives from the catalogue prop and the guide
dataset like the picker does, so it works unchanged on both domains and fetches
nothing (section 18).

**THE SEARCH GRID WAS THE ONE PLACE IGNORING THE RULE ABOUT GREEN.** Every
listing card carried a hand-rolled full-width `--sage` gradient for the way out
and a second full-width bar under it for the cart, so sixteen listings meant
thirty-two bars, half of them the site's only saturated colour, on the least
important element on the page. That is the opposite of what this section says:
the LED means "this is lit", and full chrome is earned by hover and by the ONE
primary action per view. The card now uses `.stomp`, which is the system's own
control, and the cart is a `.knob` beside it, because going out to the shop is
the action and adding to a cart is not. The gear page's per-listing rows got the
same treatment for the same reason: twenty green gradients competing with the
twenty prices next to them.

**A SECTION HEADING IS PRINTED, NOT JUST BOLD.** `.section-head` runs a hairline
out from the title to the right edge, which is what a silkscreened panel does to
tie a legend to the control it labels. The home page was eight bands of content
whose headings were all the same 20px of bold display type, so nothing started
and nothing ended. (Watch the ordering: the rule is an `::after`, so it is the
last CHILD but not the last ELEMENT child, and a `:last-child` rule to push the
"see all" link past it grabbed the `<h2>` on any heading with no link and shipped
two titles right-aligned.)

**`.tile` IS WHAT MAKES A GRID OF LABELS READ AS THINGS YOU CAN PRESS.** A sheen
along the top edge and a lift under the pointer, which is the same light this
whole system uses: from above, on metal, coming up to meet your hand. Thirty
category, store and community boxes at one elevation in one colour is most of
what made the home page read as a spreadsheet.

**AND BELOW THE MEASURED MODEL THERE IS THE CATEGORY, DRAWN.** Most of the
catalogue is guitars, amps, synths and cymbals that nobody has modelled, and
those cards fell through to a broken-image glyph. `.silhouette` puts a large
soft `CategoryIcon` in the category's own accent behind the category's name: it
says a true and specific thing about the listing without claiming to be a
picture of the unit. Quiet on purpose, because it must not compete with the
cards beside it that do have a real photograph.

**THE MODELS ARE PHOTOGRAPHED OFFLINE, AND THAT IS WHAT PUT THEM ON THE
SITE.** Eighty-eight measured pedals existed for months and almost nobody saw
one, because the only way in was a hover-only icon on a rig you had to load
first. Meanwhile every listing with no usable photo rendered as a grey
rectangle with a broken-image glyph, which on `/used/effects-pedals` was every
card on the page. `scripts/render-pedal-models.ts` drives a headless browser
over `/render-bench/<slug>`, screenshots the SAME viewer the dialog mounts, and
commits the stills to `public/pedals`; `lib/board/pedal-render.ts` hands one to
a card when the seller gave us nothing and `modelFor` recognises the pedal.

**It does not breach the no-canvas rule, and the reason is worth stating rather
than assuming.** What ships is a WebP in an `<img>`, so the page is still
indexable, tabbable, screen-reader reachable and still carries `/go`, which is
the whole of what that rule protects. The bench is the one place a canvas
mounts outside the dialog, it fails closed on `RENDER_BENCH=1` the way
`CRON_SECRET` and `ADMIN_PASSCODE` do, and nothing links to it.

**One renderer, still.** The stills are photographs OF the dialog's pedal, not a
second drawing of it. A scene assembled node-side would have been easier and
would have drifted, and the way that drift announces itself is not an error: it
is a card whose picture slowly stops matching the object you pick up.

**And the card says it is a drawing.** `ModelledRender` prints "Illustration" at
any size the type is legible, and the alt text says it at every size. A render
silently standing in for a photograph is a claim about what arrives in the
post: this colour, this clean, this complete, with these knobs still on it. The
model knows the shape and knows nothing else, which is the same honesty as
`p3d-truth` in the inspector and as refusing a market price under
`MIN_SAMPLE_SIZE`.

**EVERY CONTROL FOR A PEDAL ON THE BOARD LIVES INSIDE ITS CARD, because
`preserve-3d` decides what a pointer can hit.** Swap and pick-up were a row
floated under the enclosure by the builder, and they were not clickable at all:
`.deck-row` carries `rotateX(13deg)`, so the pedals are hit-tested against their
PROJECTED geometry while a plain absolutely-positioned row is hit-tested against
its flat layout box, and the neighbouring pedal's projection sat on top of it.
`document.elementFromPoint` returned the sibling wrapper. Nothing errored, no
test failed, and the only way into the 3D viewer on this site simply did not
respond to a pointer. The remove button had always worked because it was inside
the card. They are all inside it now, and MUTED AT REST RATHER THAN HIDDEN:
opacity 0 until hover meant they did not exist on a touch screen and nobody
found them on a desktop either.

**THE FIRST RIG-ROOM ASSET IS A REAL MESH ON DISK, AND IT IS NOT THE SITE'S
PEDAL.** `scripts/gear-3d/ds1.py` builds a BOSS DS-1 in headless Blender and
exports it straight into `godot/rig-room/assets/`; `ds1-decals.mjs` rasterises
its print.
That is a different job from `lib/board/pedal-models.ts`, which describes
eighty-eight pedals in numbers and lets ONE renderer draw them all, and the two
must not be confused for each other: a hand-authored mesh per pedal is exactly
the fork section 7 forbids at eighty-eight, and exactly what a single hero
object for the rig room is worth. Nothing on the site loads this file yet.

**NOTHING IS TRACED FROM SOMEBODY ELSE'S MODEL.** The brief pointed at a free
CGTrader mesh; it is authored from the published external dimensions instead,
so the asset is ours and there is no licence to check. Same rule section 13
applies to imagery, for the same reason.

**AND IT IS INSPECTED IN A NEUTRAL VIEWER, NOT IN THE TOOL THAT MADE IT.**
`scripts/gear-3d/validate-glb.mjs` loads the exported GLB in three.js under
studio light and photographs the nine angles the brief names, because Blender's
preview reads the SCENE and ships the EXPORT, and the two disagree silently. It
also asserts what is genuinely a number: the bounding box against the published
millimetres, that the model sits ON the floor, and that the named interaction
nodes (`PEDAL_TREADLE`, `CONTROL_*`, `SOCKET_*`, `LED_CHECK`) survived. Every
one of those caught something the eye had already passed over. The bounding box
was 85mm on a 73mm pedal because two side decals faced backward with their
short axis across the body; the model stood 1.2mm through the floor; the tread
plate had been built at HALF its stated size since the file was written, and
its rest angle lifted the toe off the deck instead of laying it on. None of
those threw, and the picture looked plausible with all four in it.

**Godot is on the table for one thing only.** A separate 3D "rig room" (cables
that hang, footswitches you stomp, knobs you hear) is a legitimate toy and a
shareable. The planner itself stays in the DOM: it is indexable, and
programmatic SEO is this site's growth model; the outbound money path is
`/go/[listingId]` in the DOM; the layout, power and cable engines are
TypeScript shared with the server so the assistant can build a rig; and a
canvas has no DOM, so no screen reader. Do not port the planner into a game
engine.

---

## 17. House rules inherited from the sister sites

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

## 18. Hard "do not" list

- Do NOT call the Reverb API for listings, or add a scraping fallback anywhere.
- Do NOT write Facebook Marketplace ingestion.
- Do NOT scrape Guitar Center or Sweetwater (or hit their frontend search
  indexes) as a substitute for a confirmed affiliate datafeed.
- Do NOT add a new data source without first confirming a legitimate feed or
  partner API exists for it. A retailer having a website is not a source.
- Do NOT treat "it's a Shopify store with `/products.json` public" as a
  blanket license. Check per merchant, and check it with
  `/api/admin/storefront-probe` rather than by eye: does the store publish an
  agents.md sanctioning read-only catalogue access, does robots.txt refuse it,
  and does the endpoint answer. Paste the findings into the row's
  `permission.note`. An endpoint answering is not a permission; everything
  section 2 rejects would also have answered.
- Do NOT gate INGESTION on whether a store pays us. Permission decides whether
  a store is read; enrollment decides only whether `affiliate_url` is a real
  link or null. Merging them makes the catalogue a shopper searches the subset
  of the world that pays, which is ranking by commission performed one step
  earlier, and `lib/stores.ts` already had to unlearn the same mistake for the
  /shop pages. It cuts the other way too: a store that pays well but publishes
  no permission is still not readable.
- Do NOT add a second `explicit-decision` row to `lib/storefronts.ts` by
  copying Squaver's. That basis is one store's call about one store, recorded
  precisely so it does not become precedent, and a test pins the list to it.
- Do NOT write a per-store ingestion module. A storefront is a row in
  `lib/storefronts.ts` and there is one reader per platform; twelve modules is
  section 7 broken twelve ways, and it cost sixteen edit sites per new store.
- Do NOT change `EBAY_FEED_BASE_URL`'s sandbox default.
- Do NOT link the UI directly to `raw_url`; everything goes through `/go`.
- Do NOT let `next.config.mjs`'s `images.remotePatterns` decide whether a photo
  appears. It listed eBay and Reverb only while the entire live catalogue sits
  on `cdn.shopify.com`, so the optimizer answered 400 for every product shot and
  the board drew its "no photo" enclosure for every pedal on it, silently. The
  hosts are correct now, but a list that has to grow per merchant is the wrong
  thing to depend on: user-facing images go through a plain `<img>`
  (`components/listing-image.tsx`, `components/board/pedal-photo.tsx`) with the
  already-failed ref check, and the optimizer is a bonus.
- Do NOT let an `inferred*` field win over an explicit one.
- Do NOT classify a listing's category from its title when the feed states one.
  The title is the fallback, and on a peer marketplace it is wrong far more
  often than it is right (section 4).
- Do NOT make `categoryFromFeed()` return "Other". Null is what hands an
  unrecognised taxonomy back to the title parse; "Other" would overwrite it
  with a worse answer and look decisive doing it.
- Do NOT add an ambiguous word to a category pattern to win one case.
  "compressor", "reverb" and "delay" name a pedal and a rack unit equally well;
  they belong in no pattern, so the parent segment decides.
- Do NOT put a brand in a category pattern. Line 6 and Universal Audio each
  sell pedals, amps and interfaces under one name, so a brand rule files an
  interface as a pedal with total confidence.
- Do NOT let a title guess overwrite a category a merchant stated. The "Other"
  upgrade in `enrichGear` is one-directional on purpose.
- Do NOT unscope MPN or fuzzy matching from the brand.
- Do NOT publish a market price below `MIN_SAMPLE_SIZE`.
- Do NOT let the cron guard fail open.
- Do NOT ship a migration and the code that reads its new columns without
  checking the deploy applies it. `next build` does not migrate on its own,
  which is why `build` runs `db:migrate:deploy` first (section 10).
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
- Do NOT treat an Impact catalogue id as proof the API will serve it. The
  advertiser enables API delivery separately, and Anderton's has not: the id is
  correct and the answer is still a 400 saying so (section 11).
- Do NOT let a merchant-side configuration state be recorded as a failed run.
  It is a warning nobody can clear and a cron burned on something that cannot
  succeed; `skipped` with the reason is the honest status.
- Do NOT guess an Impact catalogue id, or default one that has not been read
  off the account. A wrong id returns another advertiser's products under this
  merchant's name, which is worse than a 404 because nothing fails (section 1).
- Do NOT put a programme id from the Impact marketplace export into an
  `IMPACT_*_CATALOG_ID`. They are different numbering schemes and Anderton's
  proves it: catalogue 30480, campaign 43829. The export id belongs in
  `programId`, which nothing ingesting ever reads.
- Do NOT write a per-merchant Impact ingestion module. The merchant is a row in
  `lib/ingestion/impact-merchants.ts` and there is one reader; eight parsers is
  section 7 broken eight ways.
- Do NOT put software or a service in the catalogue. No condition, no stock and
  no second seller means no market price, and publishing one anyway is section
  8's cardinal error. It gets a focus page (section 19).
- Do NOT remove the "Partner" label from a banner, or place one inside a result
  set. The label and the placement are what keep it compatible with the
  footer's promise (section 19).
- Do NOT add a banner for a third partner. Two labelled placements for one
  merchant is a decision that was taken; a general ad slot is not.
- Do NOT define a colour only inside the light-theme block, or only outside
  it. Both themes resolve from the same token set, and prices and
  accent-coloured body text must use `--money` and `--accent-text` rather than
  `--chrome` and `--sage`, which fail contrast on paper (section 16).
- Do NOT revert the palette to graphite and brass because an old comment says
  grey, and do NOT restore the hemp family's warm palette either. The royal
  blue is the owner's decision, it matches the account both sites hang off,
  and section 16 records it.
- Do NOT redefine the metal tokens per theme. They are royal blue in both, and
  an enclosure being the same object on any surface is what the rule protects.
  Tinting them is no longer forbidden, because the owner tinted them.
- Do NOT fill anything with `--chrome`. It is an edge colour, and at rest it
  is muted; full chrome is earned by hover and by the one primary action. The
  one exception is silkscreen ink inside a drawn mark (section 16).
- Do NOT use `--chrome` for an accent edge that sits on the PAGE rather than
  on metal. White on paper is not an accent, it is nothing. Use `--chrome-dk`.
- Do NOT paint the price-history trace in `--chrome`, and do NOT paint a
  second thing in `--signal`. The trace is the last brass on the site, and
  brass stays meaningful only while it means "the signal" (section 16).
- Do NOT reintroduce Fraunces or Cormorant Garamond. The display face is
  blocky (Chakra Petch) because the account's wordmark is, and the serif pair
  belongs to the hemp sites.
- Do NOT re-create a warm alias (`--gold`, `--copper`, `--amber`) pointing at
  a cool value, or any token whose name contradicts what it holds. Rename at
  the call sites instead, the way the move to blue did.
- Do NOT port the pedalboard planner into a game engine. It has to stay
  indexable, keep `/go` in the DOM, share the TypeScript engines with the
  server, and be reachable by a screen reader (section 16). CSS 3D on real
  DOM elements is fine and keeps all four, and the board uses it: a canvas
  keeps none of them.
- Do NOT reintroduce a second pedal renderer. There is one, in three.js, and
  it serves both the measured models and the derived generic; the CSS
  `preserve-3d` version was deleted for exactly this reason (section 16).
- Do NOT render a canvas anywhere but inside the pick-it-up dialog. The board
  itself is DOM buttons and an anchor, which is what keeps the page indexable,
  tabbable, screen-reader reachable and able to carry `/go`.
- Do NOT guess a pedal's dimensions into `lib/board/pedal-models.ts`. It is
  worth having only because it is measurements; an eyeballed entry is the
  generic with extra steps, and the generic is already honest about itself.
- Do NOT draw a brand's logo on a model. The product name in the site's own
  type says which pedal it is; a redrawn mark is a different act.
- Do NOT leave a model in the table that neither dataset can reach. It reads
  as coverage and renders for nobody; either the pattern is wrong or the
  product belongs in the planner's catalogue.
- Do NOT end a model pattern in `\b` after a non-ASCII letter. JavaScript's
  word boundary is ASCII only, so `\bslö\b` matches nothing at all.
- Do NOT widen a pattern in `lib/board/pedal-models.ts` to catch a sibling
  product. A loose pattern here does not miss, it prints one pedal's name on
  another pedal's body. Where the casting really is shared and only the print
  differs, add a second entry spread from the first (`BOSS_DD2`, `PROCO_RAT2`);
  where the finish is unverified, let the honest generic take it.
- Do NOT set a tolerance in `looksTheSame` from a guess about rasteriser noise.
  The floor is zero, a real edit scores about 0.5, and the first guess of 1.5
  silently kept a stale still on disk (section 16).
- Do NOT add a `style` to a pedal model without adding its branch to the body
  switch in `components/board/pedal-viewer-3d.tsx`. A style with no branch does
  not error, it silently renders as a box, which is how a Cry Baby shipped as a
  rectangle.
- Do NOT hand-type a dimension into `lib/board/pedal-models.ts` for a pedal
  that has a standard enclosure. Use `enc()`, which reads the planner's own
  measured table: typing them is what put the Big Muff and the Small Stone in
  each other's boxes, and a test now holds the two files together.
- Do NOT write a per-pedal entry longhand for a family that shares a casting.
  `bossCompact()` and `mxrCompact()` exist so a new colour is the paint, the
  controls and the print, and `knobRow()` derives a row that cannot collide.
- Do NOT put a knob, a toggle or an indicator less than about twice its own
  height behind another control's label. It will not overlap in plan and it
  will bury the print in the render, which is the one thing a reader sees.
- Do NOT write anything inside a modelled screen. An unlit window is the
  honest state and is what the pedal looks like unplugged.
- Do NOT draw a fader as a small knob or a dual-concentric pair as one knob.
  Both are what the pedal uses because a row of knobs will not fit, and both
  are how it is recognised: a GE-7 is its eight caps and nothing else.
- Do NOT set a modelled fader anywhere but flat unless the maker ships it that
  way. A curve here is somebody's EQ setting presented as the product's, which
  is the same class of invention as a guessed dimension.
- Do NOT let a model claim to be the actual product. A measured one says what
  its shape tells you, a derived one says plainly that it is not this pedal,
  and the photograph beside it is the real one.
- Do NOT put a saturated green bar on a repeated element. The LED is for
  things that are lit and full chrome is earned by ONE primary action per view;
  a grid of cards gets `.stomp`, and the secondary action gets a `.knob`.
- Do NOT reach for `:last-child` inside `.section-head`. The rule is an
  `::after`, so `:last-child` matches the `<h2>` whenever there is no link.
- Do NOT hand-write a second scene to produce the pedal stills. They are
  screenshots of the real viewer through `/render-bench`, and a node-side scene
  is section 7 broken in the one place where the drift is a picture rather than
  an error (section 16).
- Do NOT open the render bench in production. It is the one canvas outside the
  dialog and it fails closed on `RENDER_BENCH=1`; "nobody links to it" is not a
  control.
- Do NOT show a render without saying it is one. `ModelledRender` carries the
  label and the alt text; swapping the `src` on an `<img>` instead makes a
  drawing look like a photograph of the unit being sold.
- Do NOT reach for a render by matching the listing TITLE. It goes through the
  resolved `canonical_gear` brand and model, so it inherits the resolver's
  judgement; a title reading "DS-1 bundle w/ cables" is not a picture of a DS-1.
- Do NOT commit a still with no model behind it, or a model with no still. A
  test walks both directions: an orphan file reads as coverage, and a missing
  one is an `<img>` asking for a file that is not there.
- Do NOT put a pedal's controls outside its enclosure. `.deck-row` is a
  `preserve-3d` surface, so anything outside the card is hit-tested against a
  flat box the neighbouring pedal's projection covers, and the control silently
  stops responding (section 16).
- Do NOT put the board's `perspective` on `.deck`. `.deck` is the horizontal
  scroller, and any overflow other than visible makes an element a grouping
  element, which forces `transform-style: flat` and silently collapses every
  3D child into the plane. The camera lives on `.deck-stage` inside it.
- Do NOT let `components/board` or `lib/board` fetch anything. It is ONE
  builder mounted on both domains, and commerce reaches it as a prop from
  whichever page rendered it: `/pedalboard` passes prices and `/go` links,
  `/stompbox/board` passes none. `tests/stompbox/boundary.test.ts` walks that
  tree for the same reason it walks the guide's.
- Do NOT widen `matchGuideEntry()` in `lib/board/model.ts`. It is brand-scoped,
  whole-word and floored at three characters, and a looser match prints a
  confident paragraph about the WRONG circuit on a page somebody is about to
  spend money from. Same rule, and the same reason, as `creditsForGear`.
- Do NOT answer "what is in stock in this category" with a second query. There
  is one, `liveModels()`, and the last time two existed the published shelf
  stocked itself with sold-out gear (section 20).
- Do NOT publish a per-listing price, a merchant name or a deep link through
  `/api/catalog/pedals`. The medians are ours; the feed rows are not.
- Do NOT blend the new and used medians into one unlabelled number on the way
  out of this site. Send both, and say which one the headline is.
- Do NOT import ingestion, admin, affiliate, queue, auth, mail, cart or
  `lib/db` from anywhere under `app/stompbox`, `components/stompbox` or
  `lib/stompbox`. `lib/stompbox/catalog.ts` is the one sanctioned crossing, and
  `tests/stompbox/boundary.test.ts` is all that stands where a separate Vercel
  project with no credentials used to (section 20).
- Do NOT republish a per-listing price, a merchant name or a deep link on the
  guide. It is still a second domain, and a function call redistributes a feed
  row exactly as much as an HTTP response did (section 20).
- Do NOT let the guide's signal-chain order and the planner's drift apart. They
  are two files for a real reason (one carries prose, the other milliamps and a
  keyword table) and `tests/stompbox/chain-agreement.test.ts` holds their ORDER
  identical. The guide is canonical; a volume pedal goes before modulation.
- Do NOT reach for one gain type when a rule means "the gain". Fuzz and drive
  are separate slots because their positions differ, and `GAIN_TYPES` exists
  because splitting them silently stopped the planner flagging a delay running
  into a Big Muff.
- Do NOT set `NEXT_PUBLIC_STOMPBOX_URL` to gearavail.com. It is the guide's
  canonical origin, the aggregator's is `SITE_URL`, and the variable was
  renamed out of `NEXT_PUBLIC_SITE_URL` precisely because one deployment
  serving two domains makes "the site URL" ambiguous (section 20).
- Do NOT list `gearavail.com/stompbox/*` in the sitemap. Those pages declare
  stompbox.world as canonical, and a sitemap is a list of URLs asking to be
  indexed (section 20).
- Do NOT squash-merge a pull request. Work here reuses one long-lived branch,
  and a squash leaves it sharing no history with `main`, so the next pull
  request re-proposes the whole tree and conflicts on every file both sides
  touched. Merge commits, every time (section 10).
- Do NOT store a chord as fret numbers in `lib/chords`. A stored grip is a
  chord in one key and one tuning, and it is what made every other bug in the
  studio this was ported from possible (section 22).
- Do NOT let the modulation planner emit a chain it has not verified. A route
  that does not exist for a key pair gets the reason, not four plausible
  chords.
- Do NOT let a reharmonisation change a label without changing the notes. Each
  one returns a chord or refuses with a reason; the voicing search does the
  rest.
- Do NOT measure voice leading as fret deltas on the same string. It skips
  every string muted at either end and it describes the hand rather than the
  ear (section 22).
- Do NOT spread the fretboard's four interval hues to anything else. They are
  meaning on a diagram, bounded to the dots and their legend, and every dot
  prints its degree too.
- Do NOT hand-author a mesh for a pedal that `lib/board/pedal-models.ts`
  already describes. There is one renderer for the eighty-eight and one
  hand-built hero asset for the rig room, and a per-pedal GLB is section 7
  broken once per pedal (section 16).
- Do NOT judge an exported GLB in Blender's viewport. It reads the scene rather
  than the file, so it shows geometry the exporter dropped and normals that are
  only right because Blender knew which side you meant. Run
  `scripts/gear-3d/validate-glb.mjs` and look at the nine angles.
- Do NOT commit the GLB validation renders. They are diagnostics of a build
  artefact, they regenerate in seconds, and a folder of them beside
  `public/pedals` reads as though the site served them.
- Do NOT port the pedalboard planner into `godot/rig-room`. The four reasons in
  section 16 are unchanged by the rig room existing (section 23).
- Do NOT import anything under `godot/` from `app/`, `lib/` or `components/`,
  or the catalogue from `godot/`. They share built assets and nothing else.
- Do NOT write a per-product script in the rig room. A gear asset is a GLB with
  the node naming convention, a `.tres`, and a line in `world/room.gd`.
- Do NOT keep a second copy of a GLB. `scripts/gear-3d/` exports into the Godot
  project and nowhere else; a copy nobody rebuilds goes stale without erroring.
- Do NOT judge a model without turning it over. The underside z-fought for a
  whole session because every validation angle looked at the top (section 23).
- Do NOT hand-model a pedal for the rig room that `lib/board/pedal-models.ts`
  already describes. It exports from the same renderer the website draws with,
  and a second mesh of the same pedal is the fork section 7 forbids.
- Do NOT export a pedal without flattening its materials to plain PBR, and do
  NOT let Godot store an imported asset's materials in external files. Either
  one renders the pedal white, in the engine only, silently (section 23).
- Do NOT seed a generated texture from anything but a constant. The stills are
  compared pixel by pixel, so a random seed rewrites all eighty-eight on every
  run and the diff stops meaning anything (section 23).
- Do NOT add a map to a pedal material without adding it to the flattener in
  `lib/board/export-glb.ts`. A dropped map does not error: the export reports
  the file unchanged and the pedal ships flat.
- Do NOT show one of our own bench photographs without saying it is a different
  unit. It is a real object, so nothing about it announces that it is not the
  item for sale, which is the same claim a silent render makes (section 24).
- Do NOT hand-write a row into `lib/lab/photos.ts`. The importer writes them;
  a mistyped intake id files one pedal's photo under another and nothing fails.
- Do NOT publish a manufacturer's serial number alongside a lab photo. Our own
  intake reference identifies the unit for us and means nothing to anybody else.
- Do NOT put our own inventory in the comparison grid, or badge it, without the
  four guarantees in section 24. Preferring the listing we earn most from is
  ranking by payout, and our own price inside the median is marking our own
  homework.
- Do NOT add rating, review or testimonial markup to any page. There are no
  reviews on this site, a test scans for the vocabulary, and fabricated
  reputation markup is a manual action against the whole domain (section 25).
- Do NOT emit a `Product` node for gear with no live offer, and do NOT type a
  hostname into structured data. Origins come from the deployment.
- Do NOT put a single `priceCurrency` over rows that hold several. The
  aggregate must describe one currency and count only those offers.
- Do NOT point the test suite at a database you care about; it truncates.
- Do NOT turn a capture into a `marketplace_listings` row because the capture
  exists. Reading a page you are on is research; republishing a catalogue is
  redistribution, and section 2 decides that separately on a feed or a
  published permission. The two tables are separate so it cannot happen by
  accident (section 21).
- Do NOT make `captureSource()` reference anything outside its own body. It is
  serialised into a bookmarklet, so an outer reference becomes a ReferenceError
  on a stranger's website with no console anybody will read.
- Do NOT commit a copy of the collector beside the typed source. It is
  generated per request so the loader, the self-contained bookmarklet and the
  console paste cannot disagree; a committed copy is the one that goes stale.
- Do NOT crawl a shop running bot management without the operator saying so
  twice. Reading the page they loaded is research; walking the rest at machine
  cadence from inside their session is what that product is built to catch, and
  it is their session it flags (section 21).
- Do NOT widen the challenge-page check beyond the title. A pedal called
  "Access Denied Fuzz" flagged an ordinary category page the first time, and a
  false positive here stops work on a merchant who never objected.
- Do NOT read a crawled page in the frame without scrolling it. A lazy grid
  renders nothing for a viewport nobody moved, and the symptom is a crawl that
  works on page one and returns zero forever after (section 21).
- Do NOT drop any of the three ways a capture gets home. Direct POST, relay
  tab, clipboard: each covers a different refusal, and removing one strands
  exactly the shops that needed it.
- Do NOT store an empty capture. One row per page URL means an empty one
  REPLACES a good earlier capture of that page, which is how running the
  bookmarklet too early destroys work silently.
- Do NOT promote a capture for a merchant with no row in `PROMOTION_RULES`.
  Capturing a page says nothing about the right to republish it, and the row is
  where the reason, the decider and the date live (section 21).
- Do NOT promote a captured row without a shelf life. A capture cannot learn
  that something sold, so `endsAt` is what stops it sitting on the site getting
  quietly wronger.
- Do NOT hand-build an Impact or CJ deep link to make promoted listings earn.
  A null `affiliate_url` and a clean direct link is the correct outcome; the
  fix is connecting the feed, which carries the real ones.
- Do NOT drop the `cap-` prefix from a promoted external id. It is the only
  thing that tells a captured row from a feed row, and without it one product
  is listed twice at one store and counted twice in its median.

---

## 19. The two focus-page partners, and the first ad on this site

`lib/partners.ts`, `/partners`, `/partners/[slug]`, `/go/partner/[slug]`.

**Martinic Audio and DistroKid are Impact merchants that are deliberately NOT
in the catalogue.** Everything in `marketplace_listings` exists to be compared:
a price against a median, a condition against its own class, one shop's stock
against another's. Martinic sells software instruments, and DistroKid sells a
distribution subscription rather than a product at all. Neither has a used
market, a condition, a second seller or a stock level, so a median over either
would be a number with nothing behind it, which is precisely the invention
section 8 exists to prevent. They would also sit in the search grid, where a
shopper filtering for gear under $200 with local pickup would be handed a
plugin licence.

So each gets a hand-written page, and each page STATES ON ITSELF why it carries
no price comparison. That is the same instinct as a gear page printing "sample
too small to publish a market price" rather than estimating one.

**The DistroKid banner is the first ad on this site, and it was an explicit
product decision.** Section 1 records that the Andertons vanity link had no home
here because putting it on a page "would be the first ad on this site, which is
a product decision nobody has taken". It has been taken now, narrowly, and the
footer's promise still holds because of what that promise actually says:
commission never affects RANKING, and payout is not why a merchant is listed or
delisted. A labelled banner touches neither. Four things keep it that way and
none of them is decoration:

- **It says what it is.** "Partner, we earn from this link" is on the banner
  itself, not only in the footer. An unlabelled placement dressed as a result
  is what would break the promise; one a shopper identifies in half a second
  does not.
- **It is never inside a result set.** Between sections only. Never in search,
  never on a gear page, never displacing a listing.
- **It goes through `/go/partner`**, so the click is recorded and the
  destination clears the same allowlist as every other outbound link.
- **It is visually quieter than the content around it**, per section 16: chrome
  is an edge, muted at rest, and a banner is not the one primary action on any
  page it appears on.

Martinic has no banner. One merchant with two labelled placements is a
decision; a general ad slot is a different site.

**Links are pasted, never built.** `IMPACT_MARTINIC_LINK` and
`IMPACT_DISTROKID_LINK` hold whole tracked links from Impact's own "create your
links" step. There is still no `buildImpactUrl()` anywhere, for the reason
section 1 gives. A configured value that is not on an Impact tracking host is
IGNORED with a warning rather than used, and unset means the page links to the
merchant's own site untracked. Earning nothing beats routing a shopper through
a tracker that credits nobody, which is the rule every network here follows.

---

## 20. stompbox.world: one deployment, two domains

**THE TWO SITES ARE ONE NEXT APP NOW.** They were two Vercel projects building
from this one repo (`musictime` and `stompbox-world`), and the guide read the
pedal shelf from `/api/catalog/pedals` over HTTP because it held no database
client and no credential. That is over. One app serves both domains:

```
middleware.ts             stompbox.world/:path*  ->  /stompbox/:path*
lib/stompbox/host.ts      THE host rules. Every difference is decided here
app/stompbox/             the guide. /stompbox/* on Gear Avail, / on its own domain
app/stompbox/layout.tsx   standalone chrome vs embedded, and the canonical
lib/stompbox/             the dataset, the chain, the catalogue projection
components/stompbox/      the guide's own components
```

The guide keeps its domain and its identity; Gear Avail carries the same pages
as a section under `/stompbox`. **A rewrite, not a redirect**, so the reader on
stompbox.world sees `stompbox.world/pedals` and never the prefix.

**THE CANONICAL IS ALWAYS stompbox.world, ON BOTH HOSTS.** The same pages at two
URLs is duplicate content unless one is named as home, and the guide is the
brand with the audience the whole design follows (section 16). So
`gearavail.com/stompbox/*` is a labelled mirror that declares where the original
lives, and it is deliberately **not** in this site's sitemap: a sitemap asks for
URLs to be indexed, and asking for a page that then points elsewhere is asking
twice for one page. It is reachable from the nav, which is how it should be
found.

**WHAT THE MERGE DELETED, and it is the reason it happened.** This section used
to end with a warning that a deploy of this project could ship stale numbers on
the other domain with nothing in this repository showing it: both projects built
from the same commit at the same time, the guide prerendered its catalogue page
by fetching this project's endpoint during its build, and a commit touching both
raced itself and baked in a response from the deployment being replaced. That
shipped once and read like a failed deploy rather than a cache. **One deployment
cannot race itself.** The fetch, its cache tag, `stompbox.world/api/revalidate`
and the Vercel webhook that called it are all gone. `lib/stompbox/catalog.ts`
calls `liveModels()` in process.

**THE DOMAIN HAS MOVED AND THE OLD PROJECT IS GONE.** For a while after the
merge the dead `stompbox-world` project stayed linked to this repository, so
every push to any branch fired a build there that died in about two seconds on
a root directory the merge had removed. It burned a build per push and put a
red check beside every commit, for a deployment nobody could reach. It was
deleted on 4 Sep 2026, along with the webhook that pointed at its
`/api/revalidate`.

`stompbox.world` and `www.stompbox.world` are aliases on the `musictime`
deployment and always were, which is why deleting the other project could not
take the guide down. **There is now exactly one Vercel project building this
repository.** If a second one ever appears, this is the failure it causes, and
it announces itself as a red check rather than as anything a test can catch.

**WHAT THE CREDENTIAL BOUNDARY BECAME, and it is a real downgrade.** The guide
could not reach the database because it had no connection string. That was
physics, and `stompbox.world/CLAUDE.md` stated it as a flat fact. Every
credential in this process is now in reach of every module in it, so the
boundary is a rule instead: nothing under `app/stompbox`, `components/stompbox`
or `lib/stompbox` may import ingestion, admin, affiliate, queue, auth, mail,
cart or `lib/db`. **`lib/stompbox/catalog.ts` is the ONE sanctioned crossing**
and `tests/stompbox/boundary.test.ts` walks the tree and fails on any other.
That test is the whole of what replaced a guarantee, so do not weaken it to make
an import convenient: project the data through the catalogue module the way the
pedal shelf is projected.

**`/used/effects-pedals` IS THE DEFINITION.** That page joins `canonical_gear`
to ACTIVE listings, so a model with nothing live in it is simply not on it. The
old endpoint ran its own SELECT over `canonical_gear` alone and ordered by
`price_sample_size`, so it published models whose listings had all ended and
ranked them ABOVE models a shopper could buy: the price sample deliberately
counts listings that ended inside the last 90 days (section 8), which is right
for measuring a market and wrong for stocking a shelf, so the staler a model was
the higher it sorted, under a heading that said "most listed first". Everything
reads `liveModels()` now and the join is the definition: no active listing, no
row. Section 7's "never fork the logic", applied to a query.

**The order is live listing count**, which is what both pages claim it is.

**New and used stay separate**, each with its own sample size, plus
`marketPriceClass` naming which market the headline measures. The old response
was `COALESCE(avg_used, avg_new)` gated on the USED sample size, which is section
8 broken twice in one line: it withheld the price of every new-only pedal, and
anything it did publish arrived labelled "typical used" whether or not it was.
The used-first rule lives in `headlineMarket()` and is called, not restated.

**`minSample` is `MIN_SAMPLE_SIZE`, never a number typed into a route.** It read
3 while the real floor was 5, and the guide printed that 3 in a sentence
explaining its own honesty policy.

**THE REDISTRIBUTION RULE SURVIVES THE MERGE UNCHANGED, and this is the one most
likely to be undone by accident now.** `liveModels()` returns the cheapest live
asking price because this site's own pages print it; the projection in
`lib/stompbox/catalog.ts` drops it, along with merchant names and deep links.
The reason was never the transport: those carry partner terms that differ per
feed, **stompbox.world is still a second domain**, and serving them there is the
same act whether they arrive over a socket or a function call. A spread of the
model into the row would silently reintroduce every one of them, which is why
the test asserts on the KEYS rather than on one field. The medians are our own
aggregate and are ours to publish. A reader who wants to buy is sent to
`/gear/[slug]`, where attribution and click accounting already work.

**`/api/catalog/pedals` is kept.** Nothing in this repo reads it any more, but it
is a published endpoint on a live domain and deleting it breaks whatever else
learned to call it. It answers from the same `liveModels()`.

**No region filter on the guide, deliberately.** Section 15 hides stores that
cannot ship to a given shopper, from a geo guess or a cookie. The guide prints
medians rather than listings and has no store to hide, so there is nothing to
filter; section 15 already defines an UNKNOWN region as showing everything. The
filtering happens when the shopper arrives at a Gear Avail listing.

**Nothing on the guide may throw.** A failed catalogue query degrades to the
guide it already was and prints the reason. A bare error reads as "the site is
down", which is the wrong thing to go looking at when the real cause is a query
that no longer matches the schema, and that confusion has already cost a day
once.

**READING THE HOST MAKES THE GUIDE'S PAGES DYNAMIC.** They were statically
prerendered as their own project. The chrome, the canonical and the link prefix
all depend on which domain asked, so the subtree renders per request and leans
on the CDN and each page's own `revalidate` instead. The alternative was two
copies of every route file, one per chrome, and a duplicated route tree is a far
more expensive thing to keep honest than a cache miss. Crawlers get fully
server-rendered HTML either way, so nothing about the SEO argument in section 16
changes.


---

## 23. The rig room: a Godot game, not a second website

`godot/rig-room`, and its own README carries the operating detail. What belongs
here is why it is a separate program and what must not leak between them.

**THE PLANNER IS NOT MOVING INTO IT.** Section 16's four reasons stand
unchanged: `/pedalboard` is indexable and programmatic SEO is this site's growth
model, the money path is `/go/[listingId]` as a real anchor in the DOM, the
layout and power engines are TypeScript shared with the server, and a canvas has
no DOM so no screen reader. The rig room is the thing an engine was always
reserved FOR: picking gear up, turning it over, stomping a switch, and
eventually cables that hang.

**IT SHARES ASSETS WITH THE WEBSITE AND NO CODE.** `scripts/gear-3d/` builds the
GLBs and exports them into the Godot project, which is their only consumer;
there is deliberately no copy under `public/`, because the copy nobody rebuilds
is the one that silently stops being the pedal you edited. Nothing in `app/`,
`lib/` or `components/` reads anything under `godot/`, and nothing under
`godot/` reads the catalogue.

**A GEAR ASSET IS TWO FILES AND ONE LINE, NEVER A SCRIPT.**
`gear/gear_rig.gd` reads a naming convention off the exported mesh:
`CONTROL_<NAME>` becomes a knob, `PEDAL_TREADLE` a footswitch, `LED_<NAME>` an
indicator, `SOCKET_*` a cable point. Nothing in `systems/` knows the word
"pedal", so the first amplifier needs a GLB and a `.tres` and no code. A script
per product is section 7's fork, and it is worse here than on the web side
because it also has to be kept in step with an art pipeline somebody else edits.

**THE HARNESS IS THE POINT, AND IT HAS ALREADY PAID.**
`tools/verify.tscn` walks the player in, picks the pedal up, turns it over,
zooms, works a knob, stomps the switch, checks the lamp followed, drops it, and
asserts it landed back where it started, photographing every step. Turning the
pedal over is what found the GLB's underside z-fighting: the casting's bottom
face and the bottom plate were coplanar across the whole footprint, and nine
fixed validation angles in three.js never looked at the bottom of the pedal. An
inspection mode is a renderer that goes wherever it likes, which is exactly why
it finds what a camera list cannot.

**THE ROOM IS STOCKED FROM THE WEBSITE'S OWN RENDERER, NOT FROM BLENDER.**
`scripts/gear-3d/export-models-glb.mjs` drives the same `/render-bench/<slug>`
the still photographer drives and hands the pedal to three.js's GLTFExporter,
so a measured model becomes a picture for the site and a mesh for the game out
of ONE description and ONE renderer. Eighty-nine pedals export; twelve are
committed and placed, because a knurled knob is two dozen small meshes and all
eighty-nine is 60MB. The viewer names its parts (`CONTROL_<LABEL>`,
`PEDAL_FOOTSWITCH_<n>`, `PEDAL_TREADLE`, `LED_<n>`), so an exported TS9 arrives
in the game with DRIVE, TONE, LEVEL, a lamp and a switch already bound and no
per-product script anywhere.

**glTF IS METRES AND THE VIEWER IS NOT.** `SCENE_UNITS_PER_MM` is 0.01 so a
pedal is not a speck under a default camera, and the exporter divides by that
constant rather than by a 10 somebody typed. Exported raw, a DS-1 measured
770 x 1326mm: it does not error, and on its own it looks like a coffee table.

**AND TWO THINGS MADE TWELVE PEDALS ARRIVE WHITE, NEITHER OF WHICH LOGGED
ANYTHING.** The export carried `KHR_materials_clearcoat`, because the viewer
paints bodies with a physical material; the file was correct and three.js read
it back as a green TS9 with its legends on. Godot drew it white. The export now
flattens to plain PBR, which is what a game asset should be anyway. That was
only half of it: Godot's scene importer defaults to `materials/storage=1` and
`keep_on_reimport=true`, so it writes one `.material` file per material beside
the asset and then REFUSES to overwrite them, and the first import wins
forever. The committed `.import` files set both the other way, which is why
they are committed at all. A generated asset must never have its materials
stored in a file nobody regenerates.

**THE ENCLOSURES ARE POWDER COATED NOW, AND THE SETTING IS MEASURED RATHER
THAN CHOSEN.** `lib/board/surface.ts` builds one 128px tileable normal map from
seeded value noise, shared by every body on the site and in the game. Three
properties are load bearing. It is DETERMINISTIC, because the committed stills
are compared at a tolerance of 0.05 against a renderer whose noise floor is
zero, and a texture seeded from `Math.random` would rewrite all eighty-eight
files on every run. It is SMALL, because every exported GLB embeds its own copy
of the maps its materials use. And it is BUILT ONCE, because eighty-eight
pedals are all the same paint process.

**THE AMPLITUDE IS THE WHOLE JOB, and the first pass ignored the warning in its
own comment.** At normalScale 0.5 with a repeat of 6, a TS9 came out looking
like hammered paint: not a break-up of the highlight but a crocodile skin,
which is a worse lie than the flat green it replaced. Powder coat is a texture
you FEEL. What works is a low amplitude with a fine repeat (0.16 at 16), where
the grain sits at the edge of visible and does its work by disturbing a
reflection rather than by being seen.

**AND A FLATTENER THAT DROPS A MAP REPORTS SUCCESS.** `exportPedalGlb` copies
materials down to plain PBR, and the first version copied `color` and `map` and
nothing else. The day the normal map arrived, the exporter wrote eighty-nine
files, reported every one of them UNCHANGED, and every one was silently flat.
It copies the whole set now, so the next map to arrive travels with it.

**GODOT 3.5 IS A CONSTRAINT, NOT A CHOICE.** Godot 4 is the right target. No
Godot 4 binary was reachable from the build environment, and unverified GDScript
for an engine that cannot be launched is the failure this project keeps having.
The README carries the porting table. Do not "upgrade" the project by rewriting
it untested.

**AND THE ENGINE WAS NEVER THE VARIABLE.** Godot renders meshes; it does not
author them. It loads the same GLB Blender built and three.js already
photographed, and it independently measured the same 77.4 x 58.9 x 131.7 mm,
which is a useful cross-check and not a new capability. What an engine buys is
everything after the mesh exists. What makes a pedal look real is the ASSET:
geometry, then PBR texture maps, which the DS-1 does not have yet.


---

## 25. Structured data: markup is a claim

`lib/seo/structured-data.ts`, `components/json-ld.tsx`.

**EVERY CLAIM IN THE MARKUP HAS TO BE ONE THE PAGE ITSELF MAKES.** That is
section 8's rule aimed at a crawler instead of a shopper: the site refuses to
publish a market price under `MIN_SAMPLE_SIZE` because a number with nothing
behind it is worse than none, and marking up an offer that does not exist is
the same act. Google agrees, and the penalty is a manual action against the
whole domain rather than one page.

**NOTHING HERE CLAIMS A REPUTATION.** No star ratings, no testimonials, none of
that vocabulary at all, and a test scans the module for it rather than trusting
the intention. This site collects no opinions from anybody. Adding star markup
is the single most common piece of SEO advice for a comparison site and it wins
a rich result, which is exactly why it is tempting and exactly why it is
fabricating evidence.

**THE BUILDERS RETURN NULL, AND THAT IS THE COMMON ANSWER.** A canonical row
with no live listing gets no `Product` node, because a Product with no offer is
a page telling a crawler it sells something it does not. `JsonLdScript` takes
the nulls, so no call site has to remember.

**ONE CURRENCY PER `AggregateOffer`, AND THE PREVIOUS VERSION GOT THIS WRONG.**
It hardcoded "USD" over whatever was in the rows. This catalogue is genuinely
multi-currency (Anderton's in GBP, five Gear4music storefronts), so one British
listing under an American one made the low price a number in the wrong money.
The majority currency wins and the count reflects only those offers, so the
figures and the count always describe the same set. It also took the highest
price as the last row, which is only true while the query happens to sort by
price ascending.

**CONDITION IS STATED ONLY WHEN IT IS TRUE OF EVERY OFFER.** New and used are
two markets; a page holding both claims neither rather than the one that reads
better.

**ORIGINS COME FROM THE DEPLOYMENT.** Two hand-rolled blocks existed before
this and already disagreed: one built URLs from `SITE_URL`, the other had the
production hostname typed in, so preview deploys emitted markup pointing at the
live site. A test scans every page carrying markup for a literal hostname.

**A RIG IS AN `Article`, AND THE ARTIST IS ITS SUBJECT, NEVER ITS AUTHOR.**
Section 13 is careful these pages never imply endorsement, and structured data
naming a musician as author of a page about gear is exactly that implication.


---

## 24. Our own photographs, and the inventory question behind them

`lib/lab/photos.ts`, `components/lab-photo.tsx`, `scripts/import-lab-photos.ts`.

**GEAR PASSES THROUGH OUR HANDS, SO WE CAN PHOTOGRAPH IT.** Every listing with
no seller photo falls back to a measured render, which is honest and is still a
drawing; on `/used/effects-pedals` that was most of the page. A shot of the
real object beats a drawing on every axis and carries no licence question at
all, because we owned the pedal and took the picture. The order is now:

    the seller's own photo    it is the unit being bought
    OUR photograph            a real pedal, but a DIFFERENT unit
    the measured render       a drawing, and it says so
    the category silhouette   a true thing about the kind of gear

**IT IS LABELLED, FOR THE REASON THE RENDER IS.** Ours is a real object, so
nothing about it announces that it is not the unit in the listing, and a
shopper who assumes otherwise has been misled about what arrives in the post.
`LabPhotoImage` prints "Our photo, another unit" and the alt text says it at
every size.

**NO PROVENANCE, NO PHOTO.** `isPublishable` gates on the intake reference and
the date, structurally, the way `isRenderable` gates on attribution in section
13. And the rows are MACHINE-WRITTEN by the importer, never typed: filing a
DS-1 shot under a DS-2 shows the wrong pedal confidently, on a page somebody is
about to spend money from, with nothing failing anywhere.

**THE INTAKE ID IS OURS, NOT THE MANUFACTURER'S SERIAL.** A serial identifies a
real object that will have an owner after us, and publishing one beside
"photographed at our HQ" says more than a picture needs to.

**AND THE PART THAT IS NOT BUILT: OUR OWN STOCK IN THE COMPARISON GRID.** The
operating brief proposes routing shoppers to inventory we hold, with a badge no
other merchant can earn. That is a legitimate model and it is NOT what this
site currently is: section 1 says we never take an order and never hold stock,
and the footer promises commission never affects ranking. Our own listing pays
100% margin against a competitor's 3%, so a preference for it is ranking by
payout at its most extreme, and a badge inside a result set is exactly what
section 19 refused for the DistroKid banner.

There is also a arithmetic problem that would not announce itself. If our units
land in `marketplace_listings` they enter the MEDIAN that judges deals, so we
would be setting a price and also computing the market price that badges it
(section 8). Four things make it honest, and none is optional: our listings are
excluded from every median, they take no ranking preference, the badge says on
itself that we are the seller, and the footer's promise is rewritten to match.
Do not build it without all four.


---

## 21. The collector: capturing a catalogue from a page you are already on

`/collect`, `/gear-collector.js`, `lib/capture/`, `product_captures`.

**PORTED FROM `legal-leafmarket.com/coldwater-collect`, AND THE AWKWARD PARTS
ARE THE POINT.** That tool has been in operator use long enough to have paid for
every strange thing in this one. A first attempt at this is a bookmarklet that
reads the DOM and POSTs it, and that version fails on precisely the shops worth
capturing, silently, in four different ways. This is the reusable pattern for
every site in this family, so the lessons are written down rather than
rediscovered.

**WHAT IT IS.** A person browses a merchant's site in their own browser, as a
visitor, and clicks a bookmark. It reads the products out of the page already
rendered in front of them. **No request is made to the merchant at all** and
nothing is crawled: the page was fetched because a human asked for it. That is a
different act from a scraper, which is a program that visits pages on its own,
at machine speed, without a person.

**WHAT IT IS FOR: KNOWING WHAT IS THERE BEFORE BUILDING ANYTHING.** Deciding
whether to chase a merchant, build a category, or model a product needs to rest
on what they actually stock, at what prices, under which brands. Guessing that
from a homepage is how a week goes into a category with forty products in it.

**AND WHERE THE LINE IS, because the tool does not enforce it.** Reading a page
you are on is research. Republishing that catalogue as public listings is
redistribution, governed by the merchant's own terms, and nothing about how the
bytes were obtained changes that answer. Section 2 still decides what may become
a `marketplace_listings` row. The capture lands in `product_captures`, a
different table, so publishing cannot happen by accident while doing research.

**CAPTURE EVERYTHING. FILTER NEVER.** The design rule, and it comes from a real
cost: a partial pull gets analysed, a conclusion gets drawn, and then the
missing rows turn out to have changed the answer and the work is done twice. So
the extractor keeps what it found in full, raw source objects and per-card HTML
included, and `payload` stores the lot. Whittling is `lib/capture/analyse.ts`'s
job, downstream, where it can be redone without re-browsing forty pages.

**SAY WHAT THE CAPTURE DID NOT SEE.** A capture holding 24 of 1,180 products
looks exactly like a small catalogue. So `coverage` reports the total the page
claimed, the pagination it found, and whether the grid was lazy-loaded, and the
analysis calls a partial pull a SAMPLE in words. A known gap is worth far more
than a clean-looking number.

**A SHOP CAN TELL YOU IT DOES NOT WANT THIS, AND THE COLLECTOR NOW LISTENS.**
Musician's Friend runs Akamai Bot Manager: a DevTools trace of `/effects` shows
`akam-sw.js` plus a run of POSTs to obfuscated paths under one constant prefix,
which is sensor data going back for scoring. A general debugger looked at that
and called it a harmless fire-and-forget beacon, safe to ignore. It is right
about the request and wrong about what it means here, and the distinction is
the one this section is built on:

- **Reading the page in front of you is unaffected.** A person loaded it, in
  their own browser, having passed whatever was asked. That is research and it
  stays research.
- **Walking pages 2..N from inside that session is a different act.** It is
  precisely what bot management exists to catch, it does not fail politely (it
  serves challenge pages this reader captures as empty categories), and the
  session and address it flags belong to the OPERATOR rather than to us.

So `captureSource()` names the wall from what is already in the document,
cookies and script paths, never by probing, and the crawl asks once before
walking a shop that has one. A second press goes ahead, because the person at
the keyboard is the one who knows whether there is an arrangement with that
merchant and a bookmarklet cannot.

**AND THE INTERSTITIAL CHECK READS THE TITLE ONLY**, which a test earned rather
than a guess. Reading the phrase out of the body as well looked obviously
better and immediately flagged an ordinary category page holding a pedal called
"Access Denied Fuzz". The false positive is the expensive direction: it stops
an operator working a merchant who never objected, on evidence that is a
product name.

**THE LEGITIMATE PATH FOR THESE THREE IS NOT THE COLLECTOR AT ALL.** Musician's
Friend, American Musical Supply and Anderton's are approved Impact merchants
(section 1). A capture is for deciding whether a merchant is worth chasing; the
catalogue itself comes from the feed, which is why the feed exists.

**THE FOUR LESSONS, each one already paid for:**

- **A bookmarklet is exempt from CSP. What it loads is not.** The obvious build
  injects `<script src>`, which a strict `script-src` refuses, and the refusal
  is SILENT because a blocked script fires no error event. So there are two
  bookmarklets: a loader, and a SELF-CONTAINED one carrying the whole program in
  its URL, which has nothing left to refuse. Under both there is console paste,
  which nothing can block.
- **A self-contained bookmarklet is a snapshot, and a stale one lies.** Once
  dragged it never updates. On the sister site a shop was reported broken months
  after the fix, from a bookmark that predated it: a stale reader does not throw,
  it returns a SMALLER catalogue that looks entirely plausible. So the collector
  carries a BUILD stamp, prints it in its panel, and `/collect` prints the
  current one. The two differing is the whole diagnostic. It is a hash of the
  source, never a hand-typed version: a number somebody has to remember to bump
  stops moving on the day it matters.
- **`connect-src` can block the send after a successful read.** All the work
  done, nothing delivered. The answer is a route CSP does not govern: opening a
  tab is a NAVIGATION, so the collector opens `/collect?receive=1` and hands the
  capture over with postMessage, and from there the POST is same-origin. Both
  ends pin the origin.
- **A HIDDEN FRAME HAS TO BE SCROLLED, and page one hides that from you.** The
  crawl read later pages in an off-screen iframe and captured nothing from any
  of them, which read as the frame being refused and was not. Page one is the
  tab the OPERATOR already scrolled, because the panel tells them to; nobody
  scrolls an iframe, so every later page was captured as an empty skeleton with
  its placeholders still in it. The frame now walks down in screen-sized steps
  and reports how many it took. Measured against a fixture whose second page
  fills on scroll: 6 products before, 15 after. **And the first fix changed
  nothing**, which is the part worth remembering: it scrolled only when the
  document was taller than the frame, and a page whose grid has not arrived is
  short BECAUSE the grid has not arrived, so a document that cannot scroll gets
  nudged instead.
- **What is in the DOM is all it can see.** A lazy grid has to be scrolled to
  the bottom first, and a menu in a cross-origin iframe cannot be read at all,
  which is the same-origin policy working correctly rather than a bug to route
  around. Open that frame in its own tab instead. The panel says both in words.

**ONE EXTRACTOR, SERIALISED.** `captureSource()` in `lib/capture/extract.ts` is
read with `Function.prototype.toString()` and pasted into the bookmarklet, so it
may close over NOTHING: no imports, no module constants, no helpers beside it.
`tests/capture/collector.test.ts` enforces that, parses the assembled program
with `new Function` so a syntax error cannot reach a stranger's website, and
checks the URL still fits a bookmarks bar. The sister site's collector is a
committed 180KB file beside the source it duplicates; ours is generated per
request from the typed source, so the loader, the inline build and the console
paste are the same program by construction.

**The collector route is public and carries no credential.** It has to be
fetchable from a merchant's page. The admin passcode is typed into the panel at
capture time, used for one request, and never stored: never in the bookmarklet
URL, which lives in a bookmarks bar in plain sight forever.

**An empty capture is REFUSED, not stored.** One row per page URL, so storing an
empty one would REPLACE a good earlier capture with nothing. Running the
bookmarklet before the grid finished rendering is the exact way this tool could
otherwise destroy work.

**PROMOTION: WHEN A CAPTURE MAY BECOME A LISTING.** `lib/capture/promote.ts`,
`/api/admin/capture/promote`, surfaced as a panel. This is the step the rest of
the pipeline deliberately does not take, and every guard on it exists because
the same act done carelessly is the one that gets a letter rather than a bug.

**Four gates, none optional.** A merchant needs a row in `PROMOTION_RULES`
recording WHY, who decided and when: capturing a page says nothing whatever
about the right to republish it, and the whole risk is somebody assuming
otherwise because the data is sitting right there. The listings must land under
a `Source` the schema already knows, so a shop nobody has decided about has
nowhere to go structurally. A row with no parsed price is skipped rather than
guessed at. And every promoted row gets a shelf life.

**`affiliate-agreement` is the strong basis and the only one in use.** An
approved affiliate is a partner the merchant WANTS sending traffic to their
products, so displaying their catalogue behind our link is the purpose of the
arrangement and the feed is the delivery mechanism rather than the permission
itself. That is a materially different position from a merchant we have no
relationship with, and it is exactly why Guitar Center is not in that table and
cannot be put in it by capturing their pages.

**CAPTURED LISTINGS EXPIRE, and that is the honest shape of the data rather
than a limitation.** Every feed re-runs and learns what sold; a capture is a
photograph taken once with no way to discover that an item went out of stock an
hour later. So `endsAt = capturedAt + staleAfterDays` and `expirePastEndDate`
retires it. Re-capturing pushes the date out, which makes keeping a merchant
live a repeated explicit act rather than something that decays invisibly.

**MOST PROMOTED LISTINGS EARN NOTHING, AND EVERY SURFACE SAYS SO.** Impact
deep links need `/c/<publisherId>/<campaignId>/<adId>` and CJ ships a pre-built
`BUY_URL` per row; a captured page carries neither, and this repo never
hand-builds one. So those rows store a null `affiliate_url` and `/go` sends the
shopper to the merchant's own page. That is the right trade (section 5: a
tracker crediting nobody is worse than a clean direct link; section 17: payout
is not why a merchant is listed), and it is also the strongest argument there
is for connecting the feed. A rule declaring a buildable link with no builder
wired up THROWS rather than returning null, because a silent null there means
every listing earns nothing and nothing fails.

**Off-site links are dropped at promotion time**, against the same allowlist
`/go` uses. A retailer's category page carries sponsored placements and partner
links in markup that looks exactly like a product card, and promoting one puts
a stranger's URL in the catalogue under this merchant's name.

**The `cap-` prefix is load bearing.** Feed rows key on the merchant's own
product id and captured rows on the URL path, so the two never collide and one
product would be listed twice at one store and counted twice in its median.
`clearPromotedListings()` sweeps them, and the intended sequence is explicit:
when a feed starts working for a source, clear its captured rows. It expires
them rather than deleting, so the prices they recorded stay in the history.

---

## 22. The chord teacher: everything on it is computed

`/chord-teacher`, `lib/chords/`, `components/chord-teacher/`. A guitar harmony
workbench: what a chord is made of, where it sits on the neck, what moves when
one chord becomes the next, and how to get from one key to another.

**PORTED FROM A SINGLE-FILE STUDIO, AND THE PORT IS THE POINT.** The original
was 1,400 lines of Tailwind CDN and vanilla JS with a real Web Audio pluck
synth, genuinely good explanatory prose, and one structural decision that made
most of it untrue: **every chord was six hand-typed fret numbers.** From that
one decision:

- A chord nobody had typed did not exist.
- Every grip was a standard-tuning grip, so choosing DADGAD silently showed the
  wrong notes under the right names.
- The "altered dominant" button rewrote the chord's NAME and FORMULA and left
  the frets alone, so the panel read 7#9b13 while the guitar played a plain
  dominant seventh.
- The "shell voicing" button did arithmetic on fret NUMBERS (`frets[1] - 1`,
  `frets[1] + 1`) with no idea what note it landed on, and wrote the result
  back over the stored grip, so the toggle could never be undone.
- "Tritone sub" always produced Db7(#11), whatever chord you pressed it on.
  Correct for a G7 and wrong for the other eleven.

**AND THE MODULATION PLANNER READ NEITHER KEY DROPDOWN.** Two selects, five
strategies, a paragraph of explanation, and every strategy returned the same
four hard-coded grips with the chosen key names pasted over the labels. The
prose asserted that Am7 is the vi of the source key and the ii of the target.
That is true for C to G and false for every other pair the dropdowns offered,
silently, in a confident voice, on a page somebody is learning from. **This is
section 8's cardinal error in a different currency**: inventing a market price
and inventing a pivot chord are the same act.

**SO NOTHING IS STORED. `lib/chords/voicing.ts` SEARCHES THE NECK.** A chord is
a root and an interval set; a voicing is found by sliding a four-fret window
along the fretboard, taking the chord's notes plus open strings plus a mute per
string, and keeping what a hand can hold: span, finger count with a barre
counted once, no more than one inner mute, root in the bass unless asked
otherwise, and every non-optional degree present. That is a few thousand
combinations, and it fixes all four bugs above at once. A shell is expressed as
DEGREES and searched for, so it is exactly root, third and seventh and it
toggles back. `dom7alt` has no perfect fifth in its interval set, because the
altered scale does not, so "alter it" genuinely changes the notes.

**THE TUNING SELECTOR NOW WORKS,** which is the clearest proof the rewrite was
structural rather than cosmetic: there was never a stored grip to be wrong.

**A PIVOT IS COMPUTED, AND WHEN THERE ISN'T ONE THE PANEL SAYS SO.**
`lib/chords/modulation.ts` asks each key what it calls a chord and keeps the
ones both keys can name. C to G finds Am7 (vi7 / ii7); Eb to Bb finds Cm7. C to
F# finds nothing at all, because those keys share two notes and not one
diatonic seventh chord, and the honest answer there is to say which route DOES
work rather than to draw four plausible chords. Same for a chromatic mediant
between keys that are not a third apart, and a common-tone move between tonic
chords with no common tone.

**VOICE LEADING IS MEASURED BETWEEN PITCHES, NOT BETWEEN FRET NUMBERS.** The
original compared frets on the same string, which skipped any string muted at
either end (usually the biggest event in the change) and described what the
HAND did while calling it what the ear hears. Both are computed now and both
are named: `voiceMoves` matches pitches to pitches by cheapest assignment,
`fingerMoves` is the per-string story, and the prose is derived from the numbers
rather than typed beside them.

**Four hues on the fretboard are a bounded exception to section 16.** Root,
third, fifth and seventh have to be separable at a glance on a diagram with
twenty dots on it, and that is meaning rather than mood. It is bounded: the
hues appear on the dots and in the legend that explains them and nowhere else,
every dot PRINTS its degree as well, and the rest of the page is the site's own
blue.

**Keyboard handling is scoped to the panel.** The original bound the arrow keys
to `window`, so a reader scrolling the page changed the chord under them and
space played a chord instead of scrolling. Every playable position is a real
`<button>`; positions NOT in the chord are not focusable, because forty tab
stops per string is an obstacle rather than access.

**It sells nothing and links out nowhere**, which is fine: section 17's promise
is that payout is not why something is here.


---

## 26. The two trade-in tools, and the one rate card between them

`app/stompbox/buymyboard/`, `app/stompbox/outreach/`. Two pages serving the
two ends of the same transaction: somebody selling us their pedals.

| | what it is | indexed |
|---|---|---|
| `/buymyboard` | the PUBLIC quote page. A seller adds pedals, picks a condition per item, and sees cash, store credit and consignment side by side, then copies a summary to send us. | yes |
| `/outreach` | the tool WE work from. Paste a Marketplace listing, it parses the lot, prices it, and writes the three Messenger messages. | **no** |

**THE URL BELONGS TO THE SELLER, WHICH IS WHY THEY SWAPPED.** "Buy my board"
is what a seller says, and it spent its first day serving the operator tool.
Anybody following that link expecting to sell us something would have landed
on our own sales scripts, which reads as a mistake rather than as a private
page. `/outreach` describes itself.

**ONE RATE CARD, AND A TEST HOLDS THE TWO TOGETHER.** The message quotes
60 / 80 / 90 (cash, half now, max payout: the owner's numbers as of
2026-09-05, down from 65 / 75 / 90) and the public page quotes cash 60, store
credit 75, consignment 90. Cash and consignment are the same two numbers on
both, and `tests/stompbox/buymyboard.test.ts` READS them out of both documents
and compares, rather than carrying a third copy that can drift on its own. The
middle tier is the one deliberate difference: store credit is a thing only the
site can offer, and the message's middle tier is half-now consignment, so the
two share a column and not a number. The history is why the test exists: the
public page briefly quoted 60 / cash plus 20% / 80-85 while the message quoted
65 / 75 / 90, so anyone who got a message and then visited the site was shown
a WORSE number on the site than the one they had been sent, and nothing failed
because nothing was comparing them. The store credit line is DERIVED from the
two rates rather than stating a bump, because a hardcoded "20% more than cash"
is how the number on the card and the number in the arithmetic quietly stop
agreeing; the page's meta description and the pre-script placeholder state no
percentage for the same reason.

**THE SETUP MESSAGE LEADS WITH THE STORE (owner directive, 2026-09-05).** A
seller on Marketplace does not care that we sell on Reverb; "we are opening a
physical store and buying stock for it" is the reason to answer. Every setup
variant opens on the brick and mortar location, names the next purchasing
round as later this month, and asks for a deal on whatever is still unsold at
the end of this month or the start of next. THE MESSAGE NEVER SAYS WHERE WE
SELL (owner, same day, said twice): we are the middleman, one person on
Messenger, and a seller has no reason to know where our listings live. The
marketplace name still appears in the offers, but only as the price book
("what these are going for on Reverb right now", "after Reverb fees"):
sellers already treat Reverb as the blue book, and that we price from it is
all they need to know about our pricing or our model. No store credit, no trade or
bundle line: both wait for the automated outreach that grows off the site and
Instagram, and until then a seller who wants a bundle can ask. THOSE TWO MONTH NAMES COME FROM
THE CLOCK (`monthNames()`), not from the copy: "the end of September" is right
for one month and then quietly wrong, and the tool is used for longer than
that. The three offer blocks are the owner's short form: cash today, in line
with most shops; half now, with the pedals staying put and a prepaid label per
sale; max payout as the same seat with nothing up front, plus the owner's sales
caveat (2026-09-05): we can set max payout up TODAY, building the listings off
the seller's own post and asking for pics or details as needed, closing on
the trust line: we get that it's a lot of trust in us, but if the model
interests you, we're down. (A "big but" with emojis was tried first and
pulled the same day as a little too much.) The unpriced
steer line is the owner's closer, "Less up front, more overall. Totally your call."

**THE VOICE IS ONE DUDE MESSAGING ANOTHER (owner, 2026-09-05).** The sellers
are rockers on Marketplace and so is the person writing to them, and a
business pitch is the one thing that reads wrong in that thread. So the
message scaffold (openers, setups, heads, offer blocks, steer, closes) is
written the way he talks: contractions on purpose, "man" and "sick board"
allowed, nothing that sounds like a brochure. The gear notes were already in
that register. What does not loosen: the three percentages, "after fees",
half up front, the prepaid label and USPS flat rate box, and the month names
from the clock. Casual is the voice, not the terms.

**NEITHER PAGE MAY QUOTE A NUMBER IT DOES NOT HAVE.** This is section 8 aimed
at a seller instead of a shopper, and it is the rule the whole thing rests on.
The pedal table carries a book price for a clean example of about eighty
pedals and DELIBERATELY carries none for another thirty, because a Big Muff is
sixty dollars or nine hundred depending which one it is and an average is
wrong for both. Those come back as "we will price this by hand", are EXCLUDED
from the total rather than counted as zero, and are named in the summary. On
`/outreach` there is a second guard: figures reach the message only after
somebody ticks the box saying they checked the comps, because an unverified
seed quoted at a seller is a number nobody stands behind.

**BOTH ARE ONE HTML DOCUMENT SERVED BY A ROUTE HANDLER, NOT A PAGE.** Each has
its own head, stylesheet and script, and a page would wrap it in the guide's
layout, chrome and canonical tag. Each is also handed out as a file that runs
off a laptop with no server, so the document is embedded as a literal rather
than ported to a component: two copies of a page this size is section 7's fork
with the drift hidden inside sales copy rather than inside an error.

**WHICH MAKES THE ESCAPING THE RISK, AND IT IS TESTED.** A swallowed backtick
in an 80KB template literal does not throw. It truncates the document or eats
a closing tag, and the page renders as half a form on a live domain with
nothing in any log. The tests assert SHAPE rather than copy: opened and
closed, balanced tags, the controls the page is useless without, and the three
payout rates.

**THE LISTING PARSER REFUSES TO INVENT A PRICE.** A dollar sign wins outright,
a separator then a number wins, and a bare trailing number is taken ONLY when
the word in front of it is not the kind a model number follows. That is why
"Boss DS-1 45" reads as $45 and "MXR Phase 90" does not read as $90. Anything
from that third rule is shown in amber, because it is the one class of number
nobody typed and nobody confirmed. Asking price and market value are separate
columns and must stay that way: a seller asks high, and merging them inflates
every offer computed downstream.

**AND THE PARSER'S DASHES ARE ESCAPED, NOT TYPED.** `tests/stompbox/
house-style.test.ts` forbids a literal em dash anywhere in the guide's source
and the parser has to match one, because sellers type them. The character
classes carry `–` and `—`, so the regex still matches and the rule
still holds. Do not exempt the file instead.

**A CALL TO ACTION MAY NOT POINT AT NOTHING.** With no Messenger handle
configured, `/buymyboard`'s button becomes a copy action and relabels itself.
A dead CTA on a live public page is worse than an honest one.
