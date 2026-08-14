# stompbox.world

A plain guide to guitar effects pedals: what each circuit actually does to your
signal, what you can hear as a result, and what order to put them in.

Nothing here is for sale, and the circuit guide carries no price, no merchant
and no affiliate link, which is what lets an entry say a pedal sounds thin into
a clean amp.

`/catalog` is the one place a price appears, and it is a separate layer: the
live pedal shelf from the sister site Gear Avail, read over HTTP from
`/api/catalog/pedals` and rendered here. It holds no database client and no
credential, and it never touches `lib/pedals.ts`. See CLAUDE.md section 2a.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. There is nothing else to configure: no
database, no API key, no credential. `.env.example` documents the three
optional variables, and the site runs correctly with none of them set.

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest, no external services needed
npm run build       # static build, every page prerendered
```

## What is here

| Route | What it is |
|---|---|
| `/` | The rack panel, the three claims the site makes, six circuits to start on, and the Instagram strip |
| `/pedals` | The full directory, grouped in signal order rather than alphabetically |
| `/pedals/[slug]` | One circuit: what it does, what to listen for, where it goes, its controls |
| `/chain` | The conventional signal chain with the reason for every position, plus a builder |
| `/catalog` | Gear Avail's live pedal shelf, most listed first, with the typical price where there is one |
| `/about` | What the site is, how entries are written, and what it deliberately does not do |

Every page is statically prerendered. The dataset is a TypeScript file, so a
content change is a code change and there is nothing to revalidate. `/catalog`
is the exception: it revalidates every fifteen minutes, because its contents
come from the sister site's ingestion rather than from this repository.

## Deployment

Deployed to Vercel as the **`stompbox-world`** project, which is a separate
project from the aggregator's `musictime` even though both are currently linked
to the same repository. The separation is done with a **root directory** of
`stompbox.world`, so Vercel builds this folder as if it were the whole repo:
its own `package.json`, its own lockfile, its own build.

`vercel.json` carries one setting worth explaining, since JSON cannot hold a
comment. Two projects on one repository means **every push to `main` triggers
both builds**, including pushes that touch only the aggregator. The
`ignoreCommand` is Vercel's ignored-build-step hook and it runs from this
directory:

```
git diff --quiet HEAD^ HEAD ./
```

`git diff --quiet` exits 0 when nothing changed, which is the code that tells
Vercel to **skip** the build, and 1 when something did, which tells it to
build. So a commit that only touches the aggregator no longer rebuilds this
site. If `HEAD^` does not exist the command errors instead of exiting 0, and a
non-zero exit means build, so the failure mode is a wasted build rather than a
silently skipped deploy.

This whole arrangement exists because the project is parked in the aggregator's
repository while it waits for one of its own. Moving it out removes the root
directory, the `ignoreCommand` and the `stompbox.world` entry in the parent's
`tsconfig.json` exclude list, all at once. See **Moving it out** below.

## Moving it out

Nothing in this directory refers to its parent. It has its own `package.json`,
`tsconfig.json`, `.gitignore` and lockfile, and `next.config.mjs` pins
`outputFileTracingRoot` so Next does not infer an outer checkout.

```bash
cp -r stompbox.world /path/to/new-checkout && cd /path/to/new-checkout
git init && git add . && git commit -m "Initial commit"
git remote add origin git@github.com:OWNER/stompbox.world.git
git push -u origin main
```

Then point the Vercel project at the new repository and clear its root
directory. Once that is done, delete this directory from the aggregator's
repository rather than leaving two copies to drift apart.

## The shape of the code

```
app/
  globals.css        The design system. Read the comment blocks before editing
  layout.tsx         Fonts, theme init script, header and footer
  page.tsx           Home
  pedals/            Directory and per-pedal pages
  chain/             Signal chain order, and the builder island
  about/
  icon.svg           The favicon: the flat build of the mark
  robots.ts, sitemap.ts
components/
  brand/logo.tsx     The mark and the wordmark, both drawn as paths
  ui/stomp.tsx       Stomp, StompLink and Knob: the button language
  chain-builder.tsx  The only stateful component on the site
  site-header.tsx, site-footer.tsx, theme-toggle.tsx
  instagram-strip.tsx, pedal-card.tsx
lib/
  pedals.ts          THE dataset. Hand written, see the header comment
  chain.ts           Slot order, ordering and the notes engine. Pure, no React
  env.ts             Optional config, trimmed, nothing throws
  theme.ts           Three states, dark is the default
  nav.ts             THE nav tree. Header, footer and sitemap all read it
tests/               Vitest. Runs with no services
```

## The rules worth knowing before editing

These are the decisions that look arbitrary until you know why.

**No em dashes, anywhere.** Copy, comments, all of it. Use a comma, a colon or
parentheses. `tests/house-style.test.ts` enforces it across the whole source
tree, and builds the forbidden character from its code point so the test cannot
exempt itself.

**Gold is an edge, never a fill.** The palette is a neutral graphite scale, one
saturated brass gold used as a hairline border, and one bright LED green
reserved for things that are lit. Filling anything with `--brand-gold` breaks
it. Gold is muted at rest and earned by `:hover` and by the one primary action
per view, so a toolbar of eight buttons is not eight gold rings.

**The metal tokens never change between themes and are never tinted.** A pedal
enclosure is a dark object whatever it is standing on. Surfaces flip between
light and dark; buttons do not, and that is what stops the interface feeling
like two interfaces.

**Two tokens are contrast-critical.** Bright gold is about 1.8:1 on white and
bright green about 1.9:1, both far under the 4.5:1 body text needs. Anything
printing accent-coloured prose uses `--money` and `--accent-text`, never
`--brand-gold` or `--brand-led`, or it reads in one theme and vanishes in the
other.

**Dark is the default, and "system" is stored rather than implied.** Absence of
a stored preference means dark, so clearing the key would silently turn "follow
my OS" into "dark". `lib/theme.ts` writes all three states.

**The dataset states no artist credits, on purpose.** Rigs change between tours
and between takes, so "this pedal is on that record" needs a source, and a
wrong credit beside a circuit description reads as fact. A test asserts no
artist field exists, which is what stops one being added casually.

**Dates are decade level.** Prototypes, production runs, revisions and reissues
disagree about what year a pedal "is". A test rejects any four-digit year that
is not written as a decade.

**No invented measurements.** The chain notes tell you to check your power
budget and deliberately do not print current figures, because the honest number
is the one on your own pedal rather than one guessed here. A test asserts no
milliamp figure appears in that note.

**Nothing animates at idle.** A rack of gear at rest is still. Travel on a
button press is 2px, so it reads as a switch bottoming out.

## Design system

The look is a rack of gear rather than a web app: a genuinely neutral graphite
scale, brass as an edge, and one LED green. Buttons are stompbox faces
(`.stomp`), icon controls are knurled knobs (`.knob`), the theme switch is a
three-way pickup selector (`.pickup`), and the hero is a 19-inch rack panel
(`.rack`). The mark is a die-cast enclosure with an LED and a footswitch, drawn
as SVG paths so it needs no font and survives being inlined into a favicon.

`app/globals.css` carries the reasoning in comment blocks at the top of each
section. Read those before changing a colour.
