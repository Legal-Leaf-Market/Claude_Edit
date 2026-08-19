# The slide system

Builds the images for the queue in `../posts.md`. 85 slides across 24 posts, at
1080x1350, plus a 1080x1080 profile photo.

```
node build.mjs      html/, one 1080x1350 page per slide, and sheet.html
node render.mjs     png/, the files you upload
node gallery.mjs    gallery.html, every slide beside its caption
node avatar.mjs     avatar.png, the profile photo
```

No npm dependency is added for any of it. The site is a static build over a
hand written dataset and it stays that way, so this drives whatever Chromium is
already on the machine and crops with Node's built in zlib. Set `CHROME=` to
point at a browser if it cannot find one.

| File | What it is |
|---|---|
| `tokens.mjs` | Colours, type scale, canvas, and the stylesheet every slide shares |
| `diagrams.mjs` | The drawings. The only genuinely valuable file here |
| `slides.mjs` | Every slide of every post, as data |
| `build.mjs` | Slide data plus tokens to HTML |
| `render.mjs` | HTML to PNG, with the calibration and the crop |
| `gallery.mjs` | The posting tool: slides beside captions, with a copy button |
| `avatar.mjs` | The profile photo |
| `fonts/` | Jost and Fraunces, latin subsets, SIL Open Font License |

**The PNGs are committed.** They are the artefact somebody uploads, and
regenerating them needs Node and a Chromium, so a person with a phone and a
browser should not have to.

---

## What this system is, next to the site's

It is the site's design system at feed scale, not a second one. What changes is
the type scale, because a slide gets about one second and a page gets a reader,
and the canvas, which is fixed rather than fluid.

**The palette is ROYAL BLUE, and the site followed the slides rather than the
other way round.** Both started on the graphite and brass ported from Gear
Avail. The owner chose a jewel blue for the account, picked `royal` from three
candidates rendered side by side, and asked for the website to match, so
`app/globals.css` moved too and section 5 of the project's `CLAUDE.md` records
why. A candy blue enclosure with a brass silkscreen is a real pedal, so this is
if anything more literal than the grey was.

`tokens.mjs` keeps every palette rather than deleting the old one:

| Name | What it is |
|---|---|
| `royal` | The account and the site. Deep indigo plate on a near-black navy ground |
| `sapphire` | A truer mid blue. The first attempt, kept as a reference point |
| `electric` | Brightest and most saturated. Rejected: the brass edge starts competing with the ground and dim labels lose legibility at feed size |
| `graphite` | The original grey. Kept so a slide can still be made to match a page from before the change |

```
PALETTE=graphite node build.mjs && PALETTE=graphite node render.mjs
```

The knob tokens are deliberately identical in every palette. A knob is a dark
object on any enclosure colour, real blue pedals have black knobs, and a blue
knob on a blue plate loses its edge entirely.

Everything section 5 of the project's `CLAUDE.md` says still holds, and holds
for the same reasons:

- **Metal stays dark and untinted.** The plate every slide sits on is the
  enclosure gradient, light at the top and dark at the bottom.
- **Gold is an edge.** One hairline border and one silkscreen line inside it,
  exactly as a pedal is printed. Nothing is filled with it.
- **The LED is the only saturated colour**, and inside a figure it means one
  thing: this is the bit the slide is about. A figure with two green things has
  no point, which is the same failure as a toolbar of eight gold rings.
- **Nothing spins, bounces or glows.** A rack of gear at rest is still.

### The one rule that is deliberately not carried over

`globals.css` forbids `--brand-gold` and `--brand-led` for prose, and this
system uses both for kickers, tags and figure labels.

**That rule exists because of the light theme, and there is no light theme
here.** Bright gold is about 1.8:1 on the site's paper, which is why a page has
to reach for `--accent-text` instead. Every slide is dark by construction, and
measured against the plate colour (`#232a2f`) the two brand hues come out at
**9.0:1** for gold and **8.3:1** for the LED, both comfortably past the 4.5:1
that body text needs. The reason for the rule does not reach this far, so the
rule does not either. It still applies to anything on the site.

`avatar.mjs` breaks one more thing on purpose: the profile photo has no outer
plate or border. A profile photo is cropped to a circle, and a hairline
rectangle inside a circle reads as a mistake rather than as a pedal.

---

## The drawing language

`diagrams.mjs` is why the account is worth following. Nobody in this niche draws
the circuit, and the site's whole claim is the circuit rather than the adjective.

| Role | Colour | Weight |
|---|---|---|
| Structure: boxes, axes, ground symbols | `--line-strong` | 1.5px to 2px |
| The signal path, and only that | `--brand-gold` | 3px |
| The one thing the slide is about | `--brand-led` | 3.5px |
| Noise, and a thing going wrong | `--red` | 2.4px |

Sixteen primitives cover all 24 posts: clipping topologies, knobs, pedal-block
chains, four kinds of frequency curve, delay repeats, voltage rails,
rectification, a compression envelope, a lamp driving mismatched stages, a
mixer, and a room.

---

## Three things that failed quietly, and are now guarded

All three are worth knowing about before editing, because none of them produced
an error the first time.

**SVG text does not wrap.** Four slides rendered with half a sentence sliced off
the side, and it is invisible in the source because the string looks fine.
`label()` now estimates its width and throws, and it caught two more the moment
it existed. When it fires, move the sentence into the slide's `body`, where CSS
wraps it, and leave the figure a short tag.

**Chromium's viewport is shorter than the window you ask for.** Asking for
1080x1350 gave a 1263px viewport, so the page scrolled and the capture stitched a
shifted composite with the bottom of the plate missing. `render.mjs` probes the
viewport and adds the difference back, then crops, because a screenshot is
always the window height. `--headless=new` behaves identically, so switching
modes is not a fix.

**Fonts can lose the race.** Without `--virtual-time-budget` the screenshot can
fire before the base64 font is parsed, and slides come out set in Georgia, which
looks close enough to correct to ship by accident.

---

## Editing

Copy lives in two places on purpose: `../posts.md` is the human-facing queue
with captions and alt text, and `slides.mjs` is the data the images are built
from. `tests/instagram-slides.test.ts` pins them together (same ids, same
titles, slide counts matching each `Format:` line), because a post gaining a
fifth slide in the plan while the renderer emits four is otherwise silent.

The em dash rule covers `.mjs` as well as `.md`, since the slide copy lives in
one and the captions in the other.

After changing anything: `node build.mjs && node render.mjs`, then open
`gallery.html` and look at it. Most of what this system gets wrong is invisible
to a test.
