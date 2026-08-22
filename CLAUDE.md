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
  stompbox/               THE GUIDE. /stompbox/* here, / on stompbox.world (section 20)
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
  ingestion/ebay-feed.ts    Transport + TSV parsing (section 3)
  ingestion/ebay-ingest.ts  The three eBay jobs
  ingestion/reverb-awin.ts  Awin feed only. Never the Reverb API (section 2)
  ingestion/andertons-impact.ts  Impact FTP drop, header-bound. Worker only
  ingestion/impact-catalogue.ts  ONE reader for all eight Impact merchants
  ingestion/impact-merchants.ts  The merchant registry. Carries no commission
  partners.ts               Focus-page partners and their pasted tracked links
  ingestion/upsert.ts       Idempotent writes, price history, run bookkeeping
  canonical/resolve.ts      Four-tier entity resolution (section 4)
  canonical/model-parse.ts  Brand/model/category from keyword-soup titles
  catalog/live-models.ts    ONE definition of what a category has in stock (section 20)
  pedalboard/chain.ts       The planner's chain. Its ORDER is the guide's (section 20)
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

| `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN` | Impact's partner REST API (`api.impact.com/Mediapartners/{sid}/Catalogs/{id}/Items`, HTTP Basic, JSON, paginated), which is the OTHER way into Anderton's and the ONLY way into the other seven merchants. Both credentials are on Impact's API settings page and both are shared by every advertiser on the account. **Prefer this over the FTP block where it works**: ordinary HTTPS with no control connection or passive ports, and a slice is a page rather than a re-download of the whole catalogue per chunk. |
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
room below, where physics and sound would actually earn it.

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
  blanket license. Check per merchant: is the endpoint actually enabled, is
  the merchant enrolled in an affiliate program that wants the traffic, and do
  their own terms say anything to the contrary.
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
- Do NOT let a model claim to be the actual product. A measured one says what
  its shape tells you, a derived one says plainly that it is not this pedal,
  and the photograph beside it is the real one.
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
- Do NOT point the test suite at a database you care about; it truncates.

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

**THE DOMAIN HAS MOVED. THE OLD PROJECT HAS NOT BEEN DELETED, and it is now
failing a build on every push.** Checked against Vercel on 22 Aug 2026:
`stompbox.world` and `www.stompbox.world` are aliases on the `musictime`
deployment, and the `stompbox-world` project holds nothing but its two
generated `.vercel.app` names, so deleting it cannot take the guide down.

What it is still doing is worse than nothing. It stays linked to this
repository, so every push to any branch fires a build there, and every one of
them dies in about two seconds on:

```
The specified Root Directory "stompbox.world" does not exist.
```

That directory was what the merge removed. So the project is burning a build
per push and putting a red check beside every commit, for a deployment nobody
can reach. Delete it in the Vercel dashboard (Settings, then Delete Project);
nothing in this repo can, and no tool the agent has can either. The webhook
that pointed at its `/api/revalidate` should go with it.

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
