# STOMPBOX.md - Operating guide for stompbox.world

Read this before editing. It is short because the site is small, and the things
in it are the decisions that look arbitrary until you know the reason.

**THIS IS NO LONGER A SEPARATE PROJECT.** It was its own Vercel project, its own
`package.json` and its own `globals.css`, sitting in `stompbox.world/` inside
the Gear Avail repo and reading the pedal catalogue over HTTP. It is now part of
the aggregator's Next app, serving two domains from one deployment. Read section
20 of `CLAUDE.md` for the routing; the short version:

```
stompbox.world/pedals            the guide, standing alone
gearavail.com/stompbox/pedals    the same page, as a section of the aggregator
```

```
app/stompbox/          the routes             (was stompbox.world/app/)
components/stompbox/   the components         (was stompbox.world/components/)
lib/stompbox/          the dataset and engines (was stompbox.world/lib/)
lib/stompbox/host.ts   which of the two domains a request is for
tests/stompbox/        the tests, in the aggregator's vitest run
STOMPBOX.md            this file              (was stompbox.world/CLAUDE.md)
```

Still a sister project to **Gear Avail** (the music gear aggregator) in
everything that matters editorially, and it inherits that project's house rules.
The difference: Gear Avail ingests gated partner feeds and its whole design is
shaped by what those terms permit. This one has no feeds and nothing for sale.
It is a hand written guide. Almost none of Gear Avail's legal machinery applies
here, and the temptation to port it in "for consistency" should be resisted:
there is nothing here for it to protect.

**WHAT THE MERGE COST, AND IT IS THE ONE THING TO BE CAREFUL ABOUT.** This file
used to say, flatly, that no credential lived here, and it was true by
construction: a separate project with no connection string cannot reach a
database however badly it is written. Every credential the aggregator holds is
now in the same process as this code. The rule survives as a rule instead:
**nothing under `app/stompbox`, `components/stompbox` or `lib/stompbox` may
import ingestion, admin, affiliate, queue, auth, mail, cart or `lib/db`.**
`lib/stompbox/catalog.ts` is the single sanctioned crossing and
`tests/stompbox/boundary.test.ts` walks the tree and fails on anything else.
Do not weaken that test to make an import convenient. It is the whole of what
replaced a guarantee.

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

Next.js 16 App Router, Tailwind 4, TypeScript, in the aggregator's app.
`npm install && npm run dev` at the repo root is the whole setup, and
`stompbox.world` in `/etc/hosts` pointed at 127.0.0.1 is how you see the
standalone shape locally.

```
app/stompbox/
  layout.tsx         Standalone chrome vs embedded, and the canonical tag
  page.tsx           Home: rack panel, three claims, six circuits, IG strip
  pedals/            Directory, and one page per circuit
  chain/             Signal chain order (server rendered) + the builder island
  board/, catalog/, about/
  icon.svg           Favicon: the flat build of the mark, literal hex
  not-found.tsx
components/stompbox/
  logo.tsx           Mark and wordmark, both drawn as paths
  chain-builder.tsx  The only stateful component on the site
  circuit-figure.tsx Draws a figure. Server component, no animation
  citation.tsx       A quote plus its source. Renders nothing without one
  site-header.tsx, site-footer.tsx, pedal-card.tsx, catalog-card.tsx
lib/stompbox/
  pedals.ts          THE dataset
  host.ts            Which of the two domains a request is for (section 20, CLAUDE.md)
  figures.ts         Circuit figure geometry, one sampler, one grid (section 3a)
  voices.ts          Who may be quoted, and what a citation must carry (section 2d)
  chain.ts           Slot order, ordering, notes. Pure, no React
  catalog.ts         The ONE sanctioned read of the aggregator's data
  env.ts             Optional config only. Nothing throws
  nav.ts, site.ts, board.ts
tests/stompbox/      Vitest, in the root run. boundary.test.ts is the important one
```

**SHARED WITH THE AGGREGATOR RATHER THAN DUPLICATED**, and each of these was two
near-identical files before the merge: `app/globals.css` (one design system, see
section 5), `components/ui/stomp.tsx` (the button language), `lib/theme.ts`,
`components/theme-toggle.tsx`, `components/instagram-strip.tsx` and
`components/icons/instagram-glyph.tsx`. The aggregator's copy won in every case
because it was the superset. The one place a shared class still differs per site
is `.readouts`, scoped under `[data-site="stompbox"]`.

**PAGES ARE NO LONGER STATICALLY PRERENDERED.** They were, as their own project.
The chrome, the canonical tag and the link prefix all depend on which domain
asked, so the subtree renders per request behind the CDN and each page's own
`revalidate`. A crawler gets fully server-rendered HTML either way.

---

## 2. The dataset is hand written, and that is the whole point

`lib/stompbox/pedals.ts`. There is no feed for this and there will not be one. The
gear-attribution sites with the best databases publish no API, and scraping one
is exactly the conduct Gear Avail's rules forbid for Guitar Center and the
Reverb API. The file is small, checked, and grows by someone reading.

Three rules, all enforced by `tests/stompbox/pedals.test.ts` rather than remembered:

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

- **The catalogue is its own layer.** `lib/stompbox/catalog.ts`, `components/stompbox/catalog-card.tsx`,
  `/catalog`. Nothing in it touches `lib/stompbox/pedals.ts`.
- **A circuit entry still carries no price, no merchant and no artist.**
  `tests/stompbox/catalog.test.ts` asserts it, alongside the artist test that was
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

## 2b. The race the refresh hook existed for, and why both are gone

`app/api/revalidate/route.ts` and `lib/revalidate.ts` were deleted by the merge.
The section they earned is kept, because the bug is worth remembering and
because it is the clearest single argument for why the two projects became one.

**THE TWO PROJECTS BUILT AT THE SAME TIME, AND THIS ONE READ THE OTHER.** A
commit that changed the endpoint over there and this page over here raced
itself: this build fetched `gearavail.com/api/catalog/pedals` to prerender
`/catalog`, and if it won the race it baked in a response from the deployment
being replaced. That is not hypothetical. It happened on the change that made
the catalogue read the live shelf: `/catalog` shipped saying "81 pedals" and "at
least 3 listings" from the old endpoint while the new one was answering 48 and
5, and it read exactly like a deploy that had not worked. Nothing in either
repository showed it.

It corrected itself in fifteen minutes, and a Vercel webhook calling
`/api/revalidate` on this site when the aggregator deployed closed the window
further. **One deployment cannot race itself**, so the fetch, its cache tag, the
route, the two webhook secrets and the fifteen minute self-healing window are
all gone. `lib/stompbox/catalog.ts` calls `liveModels()` in process.

**Somebody still has to delete the webhook and the old Vercel project.** Neither
lives in this repo, so nothing here can do it and nothing here will notice it
was not done.

---

## 2c. The board, and the seam between the two datasets

`/board`, `components/stompbox/board-builder.tsx`, `lib/stompbox/board.ts`. Put pedals on a
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

## 2d. Quoting builders, and the rule that makes it safe

`lib/stompbox/voices.ts` holds who may be quoted, `components/citation.tsx` renders one,
and `citations` on an entry in `lib/stompbox/pedals.ts` carries them.

**WHY THIS IS ALLOWED WHEN ARTIST CREDITS ARE NOT.** Section 2 forbids "this
pedal is on that record": a claim about a session nobody here witnessed, on a rig
that changed between takes. A builder explaining a circuit in public, on the
record, is a different kind of thing. It is primary source material about the
subject of the page. The dataset still carries no artist field and
`tests/stompbox/pedals.test.ts` still asserts it.

**NO QUOTE WITHOUT A CITATION A READER CAN OPEN.** The `Citation` type cannot be
satisfied without a speaker in the registry, the source it appeared in, a date and
an https URL, `citationProblems()` lists what is missing, and the renderer returns
NULL rather than printing words whose source is incomplete. A test asserts every
citation in the dataset is renderable.

This is stricter than anything else here for a reason. A circuit description can
be checked by picking up the pedal. An era is hedged to a decade on purpose. A
quote can only be trusted or traced, so if it cannot be traced it must not be
printed.

**VERBATIM OR FLAGGED.** A tightened paraphrase inside quotation marks is a
fabrication with a citation stapled to it, which is worse than an uncited
paraphrase because the citation buys it trust it has not earned. Set
`paraphrase: true` and the renderer drops the quotation marks, changes the label
to "Sourced, in our words" and tells the reader to check the source.

**ROLE IS PRINTED, AND IT IS NOT A COMPLIMENT.** A founder of a pedal company is
an expert and an interested party at once, sometimes about their own product and
sometimes about a competitor's. `role` says what they do so a reader can weigh the
words, `aboutOwnProduct` says so out loud where it applies, and a test rejects a
role that reads as praise rather than as a job. This matters because the reason a
circuit entry carries no price and no merchant (section 2a) is so that the
sentence calling a pedal thin is written by somebody with nothing riding on it.
A quote is the one place an interested voice enters, so it arrives labelled.

**NAMES ARE CHECKED BEFORE THEY GO IN THE REGISTRY.** A wrong name over a real
quote misattributes somebody's words in public, which is worse than having no
quote. Where a name is not confirmed against the company's own site or the
person's own channel, it stays out until it is.

**AND THE QUOTES THEMSELVES ARE NEVER WRITTEN HERE.** Not summarised from memory,
not reconstructed from the gist of a video. They are transcribed from the source
by a person who watched or read it, with the URL beside them. There is no
automated path either: Gear Avail's guide records that YouTube's caption download
only works for videos you own and that every transcript library gets around that
by hitting an internal endpoint, which is the same conduct section 2 rejects for
catalogues.

---

## 3. No invented measurements

Straight from Gear Avail's section 8, and it applies here in one specific
place. The chain notes tell you to check your power budget and deliberately
print no current figures, because the honest number is the one on your own
pedal rather than one guessed here. `tests/stompbox/chain.test.ts` asserts no milliamp
figure appears in that note.

If real, sourced figures are ever added, they go in a field with a source
beside them. A number typed from memory into a spec-shaped slot is worse than
no number, because it looks like a measurement.

---

## 3a. The figures, and why they are drawn rather than photographed

`lib/stompbox/figures.ts` generates the geometry, `components/stompbox/circuit-figure.tsx` draws
it, and `shape` on each entry in `lib/stompbox/pedals.ts` says which figure belongs to
which circuit.

**WHY THE SITE NEEDED THEM.** Every page argued that naming the circuit beats
reaching for another adjective, and then showed nothing. The one claim the site
is built on was the one claim a reader could not see. The catalogue route had
merchant photographs and the guide, which is the actual content, had type and
more type.

**WHY DRAWN.** Two reasons and the second is the real one. The rights answer is
that product photography belongs to whoever shot it: the catalogue may show
merchant images because those arrive in a feed published to partners for that
purpose, and nothing on the guide side has any such licence, so pulling a JPEG
off a storefront is the same act section 2 rejects for a catalogue. The better
answer is that a photo of a Tube Screamer and a photo of a RAT tell a reader
nothing, because they are both a box with three knobs. The difference is what
happens to the waveform, and that is drawable. A photo would have been
decoration; this is the content.

**SHAPE IS CHOSEN BY READING THE ENTRY, NEVER FROM FAMILY.** This is the rule
most likely to be "simplified" later, and the dataset is what forbids it: a Tube
Screamer and a RAT are both `family: "Drive"`, and their own `circuit` text says
one rounds the peaks inside a feedback loop while the other shears them off
against ground. Keying the picture off family would print the same drawing above
two paragraphs that contradict it. `tests/stompbox/figures.test.ts` pins that pair, and
pins the analog against the digital delay for the same reason.

**GEOMETRY IN A PURE MODULE, NOT SVG IN A COMPONENT.** Twelve hand-authored
SVGs drift on the second edit: a different baseline here, a heavier stroke
there, and the set stops reading as one system. One sampler on one grid makes
them consistent by construction and testable with no renderer, which is the same
instinct as the wordmark being stroked polylines rather than a font.

**ZERO GOES WHERE ZERO IS.** A waveform swings both ways and is drawn around the
middle. A magnitude cannot go negative, so a response curve or an envelope is
drawn from the floor. The first version drew everything around a mid-line, which
wasted half the frame and implied a curve could dip below an axis it never
crosses. A test asserts every `zero: "bottom"` figure stays above its own floor.

**RAILS MEAN SOMETHING.** Dashed horizontal lines appear only on the figures
where running out of room is the subject, so a rail is never decoration. A test
pins exactly which shapes have them.

**NOTHING HERE IS A MEASUREMENT**, which is section 3 reaching into the pictures.
Every captioned figure says on itself that it illustrates the description rather
than tracing a specific unit. A curve that looked measured while being drawn
would be the same dishonesty as a guessed current draw.

---

## 4. The chain engine is a convention, not a rule engine

`lib/stompbox/chain.ts`. Pure TypeScript, no React, which is what makes it
testable and reusable.

**THIS FILE'S SLOT ORDER IS CANONICAL FOR THE WHOLE REPO, and it was not
always.** The aggregator has its own chain module (`lib/pedalboard/chain.ts`)
which the rig builder uses, and while the two lived in separate projects they
drifted exactly where nobody was looking: a volume pedal sat after reverb there
and before modulation here, a compressor was "dynamics" here and "compressor"
there, fuzz had no slot of its own there at all, and a noise gate was filed as a
"utility", whose documented position is "depends entirely on the job it is
doing". Two sites, one repo, one brand, giving different answers to the question
both of them claim to answer with a reason.

The owner ruled this file canonical, on the grounds that this is the site whose
whole premise is being right about circuits. The planner adopted this order and
kept the three types this file has no opinion on (pitch, looper, utility).
`tests/stompbox/chain-agreement.test.ts` holds the two in step and asserts on
RELATIVE order rather than on ranks, because the planner spaces its ranks by ten
to leave room for insertions.

**The two files stay separate on purpose.** This one is editorial: eleven slots,
each with a paragraph arguing for its position. That one is a planner: current
draw, an enclosure colour, a keyword table for guessing a type off a feed title.
Merging them would force this file to carry milliamps and that one to carry
prose. What must not differ is the order.

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

**ROYAL BLUE AND WHITE CHROME, and this section has now been overruled twice.** It argued
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
- **THE EDGE IS CHROME (`--chrome`), AND IT IS WHITE.** It was brass. The
  account is white line art on a blue glow with no gold in it, so the site
  followed. The token was RENAMED rather than repointed: a property called
  `--brand-gold` holding `#ffffff` is a lie that outlives whoever wrote it, and
  there were only 39 call sites to move.
- **`--chrome` is white in BOTH themes, and `--chrome-dk` is the on-paper
  variant.** Chrome outlines metal and metal is dark in both themes, so a white
  edge is right on paper too. Only two accent edges land on the page itself
  rather than on a control, the focus ring and `.pill`, and those take
  `--chrome-dk`, which is pale steel on the dark ground and navy on paper.
- **BRASS SURVIVES IN EXACTLY ONE PLACE: `--signal`.** `components/stompbox/circuit-figure.tsx`
  draws the output trace with it. Chrome and signal were one colour until the
  slide system split them, and the reason holds here: a frame and a signal path
  in the same colour stop telling you which line is the guitar. Frames are
  chrome; the signal is the only gold thing in a drawing.
- **Chrome is an EDGE, never a fill.** One hairline border and one silkscreen
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
  `--chrome` being used as a fill.
- **The things you SET are hardware too.** A checkbox is an indicator LED
  (`.led-check`), a `<select>` is the plate a rotary switch is mounted on
  (`.rotary`), and a text field is routed INTO the panel (`.plate`). Each keeps
  its native element and is only repainted with `appearance: none`, so the
  keyboard, the mobile picker and the screen reader are untouched. `.rotary` is
  a plate rather than a drawn knob on purpose: the element opens the platform's
  own menu, and a knob you cannot turn is a worse control than an honest plate.
  Its ink is fixed rather than `var(--text)`, because the plate is metal and the
  metal tokens do not flip between themes.
- **Nothing spins, bounces or glows at idle.** A rack of gear at rest is still.
- **Two tokens are contrast-critical.** Bright gold is about 1.8:1 on white and
  bright green about 1.9:1, both far under the 4.5:1 body text needs. Anything
  printing accent-coloured prose uses `--money` and `--accent-text`, never
  `--chrome` or `--brand-led`, or it reads in one theme and vanishes in the
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
  or parentheses. `tests/stompbox/house-style.test.ts` enforces this across the whole
  source tree and builds the forbidden character from its code point, so the
  test cannot exempt itself.
- **Never imply endorsement.** The footer states that product and company names
  belong to their owners and that this site speaks for none of them. Every page
  is built on top of that promise.
- **Do not state a fact the dataset cannot back up.**

---

## 7. Verify before you merge

Run from the repo root now, not from a subdirectory, and the suite is the
aggregator's: the guide's tests are `tests/stompbox/` inside it.

1. `npm run typecheck` and `npm test`. The full run includes the aggregator's
   integration tests, which need `DATABASE_URL` and truncate tables, so never
   point them at production. `npx vitest run tests/stompbox` is the guide's own
   slice and needs nothing.
2. `npm run build`.
3. `npm run start` and actually look at the site, in BOTH themes. Most of what
   this design system gets wrong is invisible to tests: contrast, an accent
   used as a fill, a control that collapsed because a class outside `@layer`
   beat a utility.
4. **LOOK AT BOTH HOSTS.** Half of what the merge introduced is invisible on
   one of them. The quickest check without touching DNS:

   ```
   curl -s -H "Host: stompbox.world" localhost:3000/pedals
   curl -s -H "Host: gearavail.com"  localhost:3000/stompbox/pedals
   ```

   The first must carry no Gear Avail masthead, no Impact tracking tag and no
   `/stompbox` prefix on any link. The second must carry all three of the
   aggregator's header, footer and tag, and every internal link prefixed. Both
   must name `https://stompbox.world/...` as the canonical.

---

## 8. Hard "do not" list

- Do NOT import ingestion, admin, affiliate, queue, auth, mail, cart or
  `lib/db` from anywhere in the guide's tree. `lib/stompbox/catalog.ts` is the
  one sanctioned crossing and `tests/stompbox/boundary.test.ts` enforces it.
  That test is what stands where a separate project with no credentials used to.
- Do NOT print a per-listing price, a merchant name or a deep link on the guide.
  This is still a second domain and a function call redistributes a feed row
  exactly as much as an HTTP response did (section 2a).
- Do NOT change this file's slot order without changing the aggregator's
  planner to match. They are held together by
  `tests/stompbox/chain-agreement.test.ts` (section 4), and they drifted badly
  the last time nothing did.
- Do NOT hard-code an internal link as `/pedals` or as `/stompbox/pedals`. Both
  are right on exactly one of the two domains. Use `sbHref(base, "/pedals")`,
  with `base` from `stompboxBase()`.
- Do NOT set `NEXT_PUBLIC_STOMPBOX_URL` to gearavail.com. It is this site's
  canonical origin; the aggregator's is `SITE_URL`, a different variable.
- Do NOT add an artist attribution field to `lib/stompbox/pedals.ts`.
- Do NOT write a quote. Ever. Transcribe it from the source with the URL beside
  it, or leave the field empty. Words invented for a named living person are a
  fabrication that reads exactly like a sourced quote (section 2d).
- Do NOT put a paraphrase in quotation marks. Set `paraphrase: true` instead.
- Do NOT add a voice to `lib/stompbox/voices.ts` whose name and role have not been checked
  against their own site or channel.
- Do NOT drop `role` from a rendered citation, or soften it into praise. It is
  what lets a reader weigh an interested expert's words (section 2d).
- Do NOT scrape a transcript to source a quote. The caption API only covers
  videos you own and the libraries that get around it hit an internal endpoint.
- Do NOT print a precise year in the `era` field.
- Do NOT publish a current draw, or any other measurement, that is not sourced.
- Do NOT key a circuit figure off `family`. Two Drive pedals in this dataset do
  opposite things to the waveform and their entries say so, so the figure is
  chosen by reading the entry (section 3a).
- Do NOT let a figure claim to be measured. Every captioned one says it
  illustrates the description, and that line stays.
- Do NOT add a photograph to the guide side. The catalogue's images come from a
  feed published for that purpose; the guide has no such licence and its
  pictures are drawn (section 3a).
- Do NOT scrape a gear-attribution site to grow the dataset.
- Do NOT use an em dash.
- Do NOT fill anything with `--chrome`. It is an edge colour, muted at rest.
- Do NOT use `--chrome` for an accent edge that sits on the PAGE rather than on
  metal. White on paper is not an accent, it is nothing. Use `--chrome-dk`.
- Do NOT paint a circuit figure's output trace in `--chrome`. That is what
  `--signal` is for, and it is the last brass on the site.
- Do NOT reintroduce Fraunces. The display face is blocky (Chakra Petch) because
  the account's wordmark is, and the serif is no longer requested at all.
- Do NOT redefine the metal tokens per theme. They are royal blue in both, and
  an enclosure being the same object on any surface is what the rule protects.
  Tinting them is no longer forbidden, because the owner tinted them (section 5).
- Do NOT revert the palette to graphite because an old comment says grey. The
  blue is a decision, it matches the Instagram account, and section 5 records it.
- Do NOT define a colour only inside the light-theme block, or only outside it.
- Do NOT use `--chrome` or `--brand-led` for prose. Use `--accent-text` and
  `--money`.
- Do NOT put margin shorthand in a class that sits outside `@layer`.
- Do NOT add a price, a merchant or a buy link to `lib/stompbox/pedals.ts`. The
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
