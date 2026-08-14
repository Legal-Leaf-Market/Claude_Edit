# CLAUDE.md - Operating guide for stompbox.world

Read this before editing. It is short because the site is small, and the things
in it are the decisions that look arbitrary until you know the reason.

Sister project to **Gear Avail** (the music gear aggregator), and it inherits
that project's house rules. The difference: Gear Avail ingests gated partner
feeds and its whole design is shaped by what those terms permit. This one has
no feeds, no database, no credentials and nothing for sale. It is a hand
written guide, statically built. Almost none of Gear Avail's legal machinery
applies here, and the temptation to port it in "for consistency" should be
resisted: there is nothing here for it to protect.

---

## 1. What this is

A guide to what guitar effects pedals actually do. Three ideas:

- **The circuit, not the adjective.** Soft clipping inside an op-amp's feedback
  loop and hard clipping to ground are different circuits that behave
  differently. Saying which one a pedal does is more useful than calling it
  warm, and it does not run out of vocabulary after four pedals.
- **Claims you can check.** Every entry's "what to listen for" is written so a
  reader holding the pedal can find out whether this site is right.
- **Order with reasons.** The chain page gives the conventional signal order and
  the reason behind every position, because a reason can be argued with.

Next.js 16 App Router, Tailwind 4, TypeScript. Every page is statically
prerendered. `npm install && npm run dev` is the whole setup.

```
app/
  globals.css        The design system. Read the comment blocks before editing
  layout.tsx         Fonts, theme init, header, footer
  page.tsx           Home: rack panel, three claims, six circuits, IG strip
  pedals/            Directory, and one page per circuit
  chain/             Signal chain order (server rendered) + the builder island
  about/
  icon.svg           Favicon: the flat build of the mark, literal hex
  robots.ts, sitemap.ts, not-found.tsx
components/
  brand/logo.tsx     Mark and wordmark, both drawn as paths
  ui/stomp.tsx       Stomp, StompLink, Knob: the button language
  chain-builder.tsx  The only stateful component on the site
  site-header.tsx, site-footer.tsx, theme-toggle.tsx
  instagram-strip.tsx, pedal-card.tsx, icons/instagram-glyph.tsx
lib/
  pedals.ts          THE dataset
  chain.ts           Slot order, ordering, notes. Pure, no React
  env.ts             Optional config only. Nothing throws
  theme.ts           Three states, dark is the default
  nav.ts, site.ts
tests/               Vitest. No services needed
```

---

## 2. The dataset is hand written, and that is the whole point

`lib/pedals.ts`. There is no feed for this and there will not be one. The
gear-attribution sites with the best databases publish no API, and scraping one
is exactly the conduct Gear Avail's rules forbid for Guitar Center and the
Reverb API. The file is small, checked, and grows by someone reading.

Three rules, all enforced by `tests/pedals.test.ts` rather than remembered:

- **No artist credits, ever.** This is the most tempting field to add and the
  most dangerous. Every pedal here has a famous name attached to it in
  somebody's memory, and a rig changes between tours and between takes, so
  "this pedal is on that record" is a claim needing a source. A wrong credit
  printed beside a circuit description reads as fact. A test asserts no artist
  field exists on any entry. If attribution is ever wanted, it needs its own
  dataset with real sourcing, not a string appended here.
- **Dates stay at decade level.** Prototypes, production runs, revisions and
  reissues all disagree about what year a pedal "is". A test rejects any
  four-digit year not written as a decade.
- **Every rendered field is filled.** A half written entry ships a page with an
  empty section, so the test floors the length of each one.

**Do not add a pedal you have not checked.** The site's only real asset is that
the circuit descriptions are right.

---

## 2a. The catalogue, and the rule that was lifted to allow it

This section used to say, flatly, that the site carried no database, no
affiliate link and no price, and that the absence of all three was what let an
entry say a pedal sounds thin. **The owner lifted that rule deliberately:** the
Gear Avail pedal catalogue is now published here, because stompbox.world is a
brand with an audience that came for pedals and sending all of them to a
different domain to find out what one costs was throwing that away.

It was lifted halfway, and the half that stayed is the point.

- **The catalogue is its own layer.** `lib/catalog.ts`, `components/catalog-card.tsx`,
  `/catalog`. Nothing in it touches `lib/pedals.ts`.
- **A circuit entry still carries no price, no merchant and no artist.**
  `tests/catalog.test.ts` asserts it, alongside the artist test that was
  already there. So the sentence that says a pedal sounds thin is still
  written by somebody with nothing riding on it, which was the actual thing
  worth protecting.
- **Two cards, on purpose.** `PedalCard` opens a circuit entry in this site's
  own voice. `CatalogCard` points at somebody else's stock and carries a price
  and an outbound arrow. If those ever start looking alike, the separation has
  failed even though the tests still pass.

**No credentials live here.** Gear Avail owns the database, the ingestion and
the definition of what a pedal is; this site reads `/api/catalog/pedals` over
HTTP and renders it. One connection string, one ingestion path, one taxonomy.
`GEAR_AVAIL_URL` points at the sister site and defaults to production.

**THE SLICE IS GEAR AVAIL'S `/used/effects-pedals` SHELF, model by model:**
every pedal with at least one LIVE listing behind it, most listed first. It was
not always. The endpoint used to publish every pedal row that had ever been
ingested, ordered by price sample size, and that sample deliberately counts
listings which ended in the last ninety days, so this site could open on pedals
whose listings had all gone, ranked above ones you could buy, under a heading
that said "most listed first". Both sites read one query now (Gear Avail's
`lib/catalog/live-models.ts`). If the catalogue here ever needs a different
population, the fix is over there, not a filter here.

**A price says which market it measures.** Gear Avail measures new and used
separately and falls back to the new median for gear only new retailers stock,
so the response carries `marketPriceClass` and the card prints "typical used"
or "typical new" from it. Printing a new median under the words "typical used"
is this site stating a fact its own source does not, which is house rule 6
broken by a label. A response with no class prints the number bare rather than
guessing, because an older or newer endpoint is a thing that happens when two
projects deploy independently.

**The floor is Gear Avail's `MIN_SAMPLE_SIZE`, sent in the response.** It was
hardcoded 3 here while the real floor was 5, and the page printed that 3 in the
sentence explaining why it withholds prices. Do not type the number in again.

**The page shows a slice and says so.** It renders 120 and links the rest to
Gear Avail rather than paginating a copy of somebody else's catalogue.

---

## 2b. The refresh hook, and the race it exists for

`app/api/revalidate/route.ts`, `lib/revalidate.ts`.

**THE TWO PROJECTS BUILD AT THE SAME TIME, AND THIS ONE READS THE OTHER.**
A commit that changes the endpoint over there and this page over here races
itself: this build fetches `gearavail.com/api/catalog/pedals` to prerender
`/catalog`, and if it wins the race it bakes in a response from the deployment
that is being replaced. That is not hypothetical. It happened on the change
that made the catalogue read the live shelf: `/catalog` shipped saying "81
pedals" and "at least 3 listings" from the old endpoint while the new one was
answering 48 and 5, and it read exactly like a deploy that had not worked.

It corrects itself in fifteen minutes, because that is what `revalidate` on the
page is for. This route closes the window. Vercel calls it when the aggregator's
production deployment succeeds, the cached fetch is dropped, and the next
request renders against the endpoint that is actually live.

- **The coupling still runs ONE WAY.** No code shipped to Gear Avail for this
  and none should. The caller is Vercel's own webhook, configured once in the
  dashboard, so that project still knows nothing about this one.
- **It fails CLOSED.** No secret configured means 503, and a bad signature
  means 401. An open route here would let anyone on the internet make this site
  rebuild a page on demand. Unset is still a supported state: it means the
  fifteen minute window is the only refresh, which is where the site was.
- **The secrets are not credentials for anything**, which is why they do not
  break the rule in section 8 against putting one in this project. That rule is
  about not giving this site a way INTO the sister site's data. These two
  strings only prove that an inbound request is genuine, and they open nothing.
- **A team webhook sees EVERY deployment on the account**, including this
  site's own and every preview build, so the route filters on event type,
  production target and project name. A webhook CAN be scoped to one project
  at creation, and should be, but the filter does not assume somebody did.
- **Three event names are accepted, not one.** `deployment.succeeded`,
  `deployment.ready` and `deployment.promoted` all mean the new code is the one
  serving traffic. Vercel's own examples use `deployment.ready` and its docs do
  not enumerate the list in one place, so pinning this to a single string would
  make the hook depend on a name nobody here has seen delivered. Acting twice
  is harmless: the second refresh drops a tag that is already dropped.
  `deployment.created` is deliberately NOT in the list, and must not be
  subscribed to either: it fires when the build starts, so the refresh would
  land while the old deployment is still answering and cache the stale
  catalogue a second time.
- **An unrecognised payload refreshes anyway.** Over-refreshing costs one page
  regeneration nobody can see; under-refreshing puts a stale catalogue back on
  the site looking like a broken deploy. The two are not equal, so a shape this
  code has never seen gets the benefit of the doubt.
- **The tag matters as much as the path.** `revalidatePath` alone would
  re-render the page against a fetch that is still inside its own fifteen
  minute window, which changes nothing. The fetch carries `CATALOG_TAG` and
  the route drops both.
- **Next 16 wants a cacheLife profile as `revalidateTag`'s second argument**,
  and it decides how long the old entry may still be served. A profile like
  `"max"` would permit precisely the stale read this route exists to prevent,
  so it passes `{ expire: 0 }`. `updateTag` is the documented way to say
  "immediately" and it throws in a route handler by design.
- **The two calls live in `lib/revalidate.ts` rather than in the route**,
  because `next/cache` is an external package that vitest cannot mock and that
  throws an invariant when called outside a request. A first-party seam is what
  makes the route testable at all.

Setting the webhook up is a one-time dashboard step and it is written out in
`.env.example`. Nothing here works until `VERCEL_WEBHOOK_SECRET` is set on this
project, and nothing here breaks while it is not.

**House rule 2 governs the whole layer: nothing throws.** Gear Avail being
down, slow or shipping an unrecognised shape degrades this site to the guide it
already was, with the reason printed. It never becomes an error page. There are
tests for the 503, the network failure, the wrong shape and the malformed row.

**A market price appears only above `minSample` listings**, which the API
decides and this site prints as a reason when it is not met. An average of two
asking prices is two people guessing, and printing it as a market price is the
invented-measurement problem in section 3 wearing a currency symbol.

---

## 2c. The board, and the seam between the two datasets

`/board`, `components/board-builder.tsx`, `lib/board.ts`. Put pedals on a
pedalboard, see the conventional signal order, stomp them on and off, send the
result as a link.

**IT IS A SEPARATE PAGE FROM `/chain`, and they are not redundant.** `/chain`
is the argument: eleven slots, each with the reason it sits where it does,
server rendered and indexable, and it is what somebody arriving from a search
should land on. `/board` is the toy built on top of that argument. Keeping them
apart is what stops the explanation being buried under an interface.

**TWO SOURCES SIT ON THE SAME BOARD AND THEY ARE NOT EQUAL.** A guide entry is
a circuit somebody here has read. A catalogue row is a product name and a photo
from a shop's feed with an effect type inferred from that name by the sister
site. `circuitKnown` carries that difference into `chainNotes`, and it is the
most important field in the whole feature:

- **An absent flag means two different things depending on where it came
  from.** On a guide entry, no `buffered` means "checked, and it is not". On a
  catalogue row it means "nobody knows". Reading the second like the first is
  how this site would start claiming a Belcat has true bypass on the strength
  of a product name. There is a test for exactly that.
- **Silence is not a clean bill of health**, so a board holding undocumented
  pedals gets a note saying which ones were not checked. A board of catalogue
  rows would otherwise collect no warnings and look like it had passed
  something.

**`slotForCatalogType` RETURNS NULL, AND THAT IS A FEATURE.** The sister site
infers twelve effect types; this guide documents eleven slots, and they are not
the same eleven. A looper conventionally goes last or in the amp's loop and
this chain ends at reverb. "Utility" covers a gate, an ABY, a DI and a buffer,
which belong in four different places, and the type cannot tell them apart. So
those two get no slot, are not offered in the parts bin, and the page says how
many were left out and why. `pitch` is the one approximation and it is a stated
one. Do not fill these in to make the bin look fuller.

**No price, no merchant and no link goes onto a board.** A layout toy that
quotes a price is a shop, which is the separation section 2a exists to keep. A
test asserts a board item carries none of the three.

**The board lives in the URL, read from `window.location` rather than
`useSearchParams`.** The hook opts the whole route into dynamic rendering
unless it is wrapped in Suspense, and this page is otherwise static. The cost
is that a shared board is not in the server-rendered HTML, which is the right
trade: the indexable content is the explanation and the parts bin, not one
visitor's board. `decodeBoard` is totally permissive for the same reason stale
links are everywhere else here, and a mangled one opens a shorter board.

**The enclosure is the one literal place in the design system.** Everywhere
else a control is *like* a piece of gear; here the thing being drawn actually
is a die-cast box. The LED rule matters more here than anywhere: lit means in
the signal, dark means bypassed, and nothing else in that CSS block may be
saturated. A bypassed pedal keeps its shape and loses its light, because it is
still on your board.

---

## 3. No invented measurements

Straight from Gear Avail's section 8, and it applies here in one specific
place. The chain notes tell you to check your power budget and deliberately
print no current figures, because the honest number is the one on your own
pedal rather than one guessed here. `tests/chain.test.ts` asserts no milliamp
figure appears in that note.

If real, sourced figures are ever added, they go in a field with a source
beside them. A number typed from memory into a spec-shaped slot is worse than
no number, because it looks like a measurement.

---

## 4. The chain engine is a convention, not a rule engine

`lib/chain.ts`. Pure TypeScript, no React, which is what makes it testable and
reusable.

- **Notes are notes, never errors.** Nothing blocks a layout or "fixes" it.
  Every arrangement the notes mention is something a real board does on
  purpose, so the job is to say what the trade is, not to overrule it.
- **Ordering is stable within a slot.** Which of two overdrives goes first is a
  taste decision this file has no business making, so it keeps the caller's
  order and says so in a note.
- **Unknown slugs are dropped, not thrown on.** A stale link should render a
  shorter board, not a crash.
- **Verb agreement is tested.** The notes are assembled from fragments, so
  every count-dependent verb ("both sit" against "all sit", "loads" against
  "load") is a place the prose can break. There are tests pinning the singular
  and plural forms, because broken English on a page whose whole claim is
  careful writing costs more than a bug would.

---

## 5. The design system, and the rules that keep it from going cheesy

`app/globals.css`, `components/brand/logo.tsx`, `components/ui/stomp.tsx`.
Originally ported from Gear Avail's, and no longer the same palette.

**ROYAL BLUE AND BRASS, and this section used to say the opposite.** It argued
that a guitarist's visual world is grey (anodised aluminium, powder-coated
steel, flight cases) and that metal must never be tinted. That was a real
argument, not drift, and the owner overruled it deliberately: the Instagram
account is built on a jewel blue, the account is the front door for most people
who will ever see this brand, and a site that does not match its own feed looks
like somebody else's site. **So "it used to be grey" is not a reason to change
any of this back.** The reason is on the record here and in the header of
`globals.css`.

Almost nothing else moved, because none of the rest depended on the hue:

- **Metal is now BLUE, is the same value in both themes, and is BRIGHTER than
  the dark ground rather than darker.** A candy blue enclosure with a brass
  silkscreen is a real pedal, so this is if anything more literal than the grey
  was. The half of the old rule that survived is the important half: an
  enclosure is the same object whatever it is standing on, so surfaces flip
  between themes and buttons do not, which is what stops the interface feeling
  like two interfaces.
- **Skeuomorphism still fails when it tries to be pretty.** The blue is deep and
  saturated rather than bright and candy-coated, for the same reason the grey
  was drab: the gold edge and the LED have to stay the things that read.
- **Gold is an EDGE, never a fill.** One hairline border and one silkscreen
  line inside it, exactly as a pedal is printed. It is MUTED at rest and earned
  by `:hover` and by the one primary action per view, so a toolbar of eight
  buttons is not eight gold rings.
- **The LED is the only saturated colour** and means the same thing everywhere:
  this control is live, hovered, or on.
- **Travel is 2px**, so a press reads as a switch bottoming out rather than a
  box falling over.
- **The theme switch is a Les Paul toggle (`.lp`), and it CYCLES.** It was a
  blade-style selector: three icon buttons in a pill with a chrome cap sliding
  between them. The drawing changed because a Les Paul toggle is the switch
  people picture when they picture a guitar switch, and it has exactly three
  detents for exactly three theme states. The behaviour changed for a better
  reason: you flip a toggle, you do not pick a position on it. Committing to
  that turned three cramped 26x24 targets into one 54x50 control, and with
  three states the furthest any theme can be is two flips. The accessible name
  says where the lever is and where the next flip goes, so nothing is hidden
  behind the metaphor. The cream switch tip is a MATERIAL, like the chrome, not
  `--brand-gold` being used as a fill.
- **Nothing spins, bounces or glows at idle.** A rack of gear at rest is still.
- **Two tokens are contrast-critical.** Bright gold is about 1.8:1 on white and
  bright green about 1.9:1, both far under the 4.5:1 body text needs. Anything
  printing accent-coloured prose uses `--money` and `--accent-text`, never
  `--brand-gold` or `--brand-led`, or it reads in one theme and vanishes in the
  other.
- **Dark is the default, and "system" is stored rather than implied.** Absence
  of a stored preference means dark, so clearing the key would silently turn
  "follow my OS" into "dark". `lib/theme.ts` writes all three states.

**The control classes sit OUTSIDE `@layer`, which means they beat every
Tailwind utility.** That is right for their material properties and it is a
trap for spacing: a `margin` in one of those rules silently swallows an `mt-*`
on the element. `.readouts` had exactly that bug and the collapsed layout is in
the git history. Do not put margin shorthand in a control class.

**The mark is drawn, not typeset.** A die-cast enclosure with a brass
silkscreen edge, an LED, two knobs and a footswitch. The letterforms are
stroked polylines with mitred joins on a 100-unit cap height, so the wordmark
needs no font and survives being inlined into a favicon. The knobs and the
inner footswitch ring are drawn at low opacity so they give the mark something
at 200px and vanish rather than muddy it at 16px.

**Do not print an instrument on the enclosure face.** It was considered and
rejected twice over: a guitar inside a box inside a border collapses into a
smudge at favicon size, and it narrows the subject to guitar players when a
pedal is equally a bass, keys and studio object.

---

## 6. House rules inherited from the sister sites

- **No em dashes anywhere.** Copy, comments, all of it. Use a comma, a colon,
  or parentheses. `tests/house-style.test.ts` enforces this across the whole
  source tree and builds the forbidden character from its code point, so the
  test cannot exempt itself.
- **Never imply endorsement.** The footer states that product and company names
  belong to their owners and that this site speaks for none of them. Every page
  is built on top of that promise.
- **Do not state a fact the dataset cannot back up.**

---

## 7. Verify before you merge

1. `npm run typecheck` and `npm test`. No database, no services, no fixtures to
   set up.
2. `npm run build`, which prerenders every page and will surface a bad
   `generateStaticParams` or a broken metadata export that tests will not.
3. `npm run start` and actually look at the site, in BOTH themes. Most of what
   this design system gets wrong is invisible to tests: contrast, an accent
   used as a fill, a control that collapsed because a class outside `@layer`
   beat a utility.

---

## 8. Hard "do not" list

- Do NOT add an artist attribution field to `lib/pedals.ts`.
- Do NOT print a precise year in the `era` field.
- Do NOT publish a current draw, or any other measurement, that is not sourced.
- Do NOT scrape a gear-attribution site to grow the dataset.
- Do NOT use an em dash.
- Do NOT fill anything with `--brand-gold`. It is an edge colour, muted at rest.
- Do NOT redefine the metal tokens per theme. They are royal blue in both, and
  an enclosure being the same object on any surface is what the rule protects.
  Tinting them is no longer forbidden, because the owner tinted them (section 5).
- Do NOT revert the palette to graphite because an old comment says grey. The
  blue is a decision, it matches the Instagram account, and section 5 records it.
- Do NOT define a colour only inside the light-theme block, or only outside it.
- Do NOT use `--brand-gold` or `--brand-led` for prose. Use `--accent-text` and
  `--money`.
- Do NOT put margin shorthand in a class that sits outside `@layer`.
- Do NOT add a price, a merchant or a buy link to `lib/pedals.ts`. The
  catalogue layer carries all three and the circuit guide carries none, which
  is what still lets an entry say a pedal sounds thin (section 2a).
- Do NOT let a catalogue row borrow a guide entry's authority. `circuitKnown`
  is false for a reason and an absent flag on one is not the same fact as an
  absent flag on the other (section 2c).
- Do NOT give `slotForCatalogType` a fallback slot to make the parts bin
  fuller. Returning null for a looper or a utility box is the honest answer.
- Do NOT put a price on the board. A layout toy that quotes one is a shop.
- Do NOT add a remote image host without naming it in `next.config.mjs`. The
  URLs arrive over HTTP from another service, and an open pattern turns the
  image optimizer into a proxy for fetching anything.
- Do NOT add a database client or a credential to this project. The catalogue
  is read from the sister site over HTTP, and that is the whole reason this
  one is cheap to run and safe to hand to anyone. The refresh hook's two
  secrets are not an exception to this: they only verify an inbound request
  and they reach nothing (section 2b).
- Do NOT let `/api/revalidate` fail open. Unconfigured means 503, not "allow".
- Do NOT ship code to Gear Avail for the refresh hook. The caller is Vercel's
  webhook, and the sister site knowing nothing about this one is the point.
- Do NOT let a catalogue failure become an error page.
- Do NOT label a market price "used" without checking `marketPriceClass`. New
  and used are two markets over there and the response says which one it sent.
- Do NOT hardcode the sample floor. It arrives as `minSample` in the response.
- Do NOT filter or re-sort the catalogue here to change which pedals appear.
  The population is Gear Avail's `/used/effects-pedals` shelf, and a second
  opinion about it on this domain is how the two drifted the first time.
- Do NOT make the chain notes block or auto-correct a layout.
