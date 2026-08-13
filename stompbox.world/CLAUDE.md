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

**House rule 2 governs the whole layer: nothing throws.** Gear Avail being
down, slow or shipping an unrecognised shape degrades this site to the guide it
already was, with the reason printed. It never becomes an error page. There are
tests for the 503, the network failure, the wrong shape and the malformed row.

**A market price appears only above `minSample` listings**, which the API
decides and this site prints as a reason when it is not met. An average of two
asking prices is two people guessing, and printing it as a market price is the
invented-measurement problem in section 3 wearing a currency symbol.

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
Ported from Gear Avail's, because it was built for exactly this subject.

A guitarist's visual world is grey: anodised aluminium, powder-coated steel,
amp chassis, flight cases. The warm metal in it is brass, and the only
saturated colour is the LED that says a pedal is engaged.

- **Metal is dark in BOTH themes and never tinted.** Skeuomorphism fails when
  it tries to be pretty. Real enclosures are drab, and the drabness is what
  lets the gold edge and the LED read at all. Surfaces flip between themes;
  buttons do not, and that is what stops the interface feeling like two
  interfaces.
- **Gold is an EDGE, never a fill.** One hairline border and one silkscreen
  line inside it, exactly as a pedal is printed. It is MUTED at rest and earned
  by `:hover` and by the one primary action per view, so a toolbar of eight
  buttons is not eight gold rings.
- **The LED is the only saturated colour** and means the same thing everywhere:
  this control is live, hovered, or on.
- **Travel is 2px**, so a press reads as a switch bottoming out rather than a
  box falling over.
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
- Do NOT tint the metal tokens or redefine them per theme.
- Do NOT define a colour only inside the light-theme block, or only outside it.
- Do NOT use `--brand-gold` or `--brand-led` for prose. Use `--accent-text` and
  `--money`.
- Do NOT put margin shorthand in a class that sits outside `@layer`.
- Do NOT add a price, a merchant or a buy link to `lib/pedals.ts`. The
  catalogue layer carries all three and the circuit guide carries none, which
  is what still lets an entry say a pedal sounds thin (section 2a).
- Do NOT add a database client or a credential to this project. The catalogue
  is read from the sister site over HTTP, and that is the whole reason this
  one is cheap to run and safe to hand to anyone.
- Do NOT let a catalogue failure become an error page.
- Do NOT make the chain notes block or auto-correct a layout.
