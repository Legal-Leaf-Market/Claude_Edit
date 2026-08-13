# @stomp_box_world: how to set the account up, and what to post

The Instagram account for stompbox.world. This file is the standing plan, and
`posts.md` beside it is the queue.

**Why this is written down rather than remembered.** The site's whole claim is
that its circuit descriptions are right and its adjectives are few, and a
social account is where that gets thrown away first: the format rewards
"warm creamy vintage tone" and punishes "diodes inside the feedback loop". So
the voice rules are here, and every caption in `posts.md` is already written to
them rather than left to be improvised at posting time.

---

## 1. What could not be checked, and what that means for this file

The old account at `instagram.com/stompbox.world` could not be read while this
was written: Instagram is blocked outbound from the environment this was
prepared in, and a web search for the handle surfaced other accounts entirely
(`@stompboxbook`, `@stompbox.in`, `@stompboxexhibit`) rather than that one.
`INSTAGRAM_POST_URLS` is unset in this repo, which is its expected state, so
there was no local record of what the old account posted either.

So nothing here is derived from the old account's grid. It is derived from the
site: `lib/pedals.ts`, `lib/chain.ts` and the voice rules in `CLAUDE.md`, which
is the same material the old account would have been drawing on. If the old
grid had a format that worked, that is worth folding in, and the person with
access is the only one who can say.

**Everything posted here is traceable to the dataset.** Each entry in
`posts.md` names the pedal slug or the chain slot it came from. That is the
rule that keeps the account honest at speed: a caption written from memory at
posting time is exactly how a wrong claim about a circuit gets published under
a brand whose only asset is being right about circuits.

---

## 2. Profile setup

| Field | Value |
|---|---|
| Username | `stomp_box_world` |
| Name (searchable, 30 chars) | `stompbox.world: pedal circuits` |
| Category | Education, not a shop. Nothing here is for sale from this account |
| Link | `https://stompbox.world/chain` |
| Profile photo | The mark, described in section 3 |
| Account type | Professional, Creator. Business gives shop features this account has no use for |

**Bio**, 127 characters:

```
What the circuit does, and where it goes.
Claims written so you can check them against the pedal in your hand.
```

Two things about the fields above are deliberate rather than tidy.

**The name field is not the username again.** It is indexed by Instagram's
search where the bio is not, so "pedal circuits" sitting in it is the whole
reason somebody searching for pedal explanations finds this account. Spending
those 30 characters on a second copy of the handle wastes the only searchable
text on the profile.

**The link points at `/chain`, not at the home page.** The chain page is the
most useful thing on the site to somebody arriving cold, it answers a question
they already have, and it is the page a saved post most often sends them
looking for. Point it at the home page and they land on a rack panel and have
to navigate. Change it per campaign when a run of posts is about one pedal.

### Highlights, three of them

- **Start here.** The manifesto post and the chain order post.
- **Circuits.** Every one-pedal post, in the order they were published.
- **What we will not say.** The trust post from section 5, on its own. It is
  the fastest answer to "why does this account not tell me what Hendrix used",
  and it will get asked.

---

## 3. The visual system, and the assets that already exist

Do not invent a look for this. The site has one, `app/globals.css` documents
why each part of it is the way it is, and section 5 of `CLAUDE.md` lists the
rules that keep it from going cheesy. All of them apply to a post.

**The profile photo is the mark from `components/brand/logo.tsx`**, the full
build rather than the flat favicon build in `app/icon.svg`. A profile photo
renders around 110px, which is large enough for the knobs and the inner
footswitch ring to give it something, and those are dropped from the favicon
only because they smudge at 16px.

Tokens, straight from `app/globals.css`, dark values because dark is the site's
default:

| Use | Token | Hex |
|---|---|---|
| Background | `--bg` | `#2a3136` |
| Enclosure face | `--metal` | `#232a2f` |
| Enclosure shadow | `--metal-lo` | `#171c20` |
| Enclosure highlight | `--metal-hi` | `#3d454c` |
| Brass edge | `--brand-gold` | `#ffc233` |
| LED | `--brand-led` | `#24e07a` |
| Body text | `--text` | `#f2f5f7` |
| Secondary text | `--dim` | `#aab4bd` |
| Accent prose | `--accent-text` | `#ffd06b` |

The rules that carry over, and each one is load bearing rather than taste:

- **Gold is an edge, never a fill.** One hairline border and one silkscreen
  line inside it, exactly as a pedal is printed. A slide with a gold background
  is off brand in a way that is instantly visible next to the site.
- **Metal stays dark and is never tinted.** Real enclosures are drab, and the
  drabness is what lets the brass edge and the LED read at all.
- **The LED green is the only saturated colour**, and it means the same thing
  everywhere: this is live, this is the answer, this is the thing to notice.
- **Accent prose uses `--accent-text` (`#ffd06b`), not `--brand-gold`.** Bright
  gold is about 1.8:1 on white. Any slide with a light background that sets a
  line in `#ffc233` has body text nobody can read, and it will look fine on the
  phone you made it on.
- **Nothing spins, bounces or glows.** A rack of gear at rest is still. This
  rules out most of what the format's templates do by default.

**Format.** 1080x1350, the 4:5 portrait, because it takes the most vertical
space in a feed. Carousels for anything with a mechanism in it, since the
mechanism needs a second slide. Body text no smaller than 32px at that size or
it is unreadable at the size a feed actually renders.

**Fill alt text on every post.** It is a field Instagram gives you and most
accounts leave to the automatic description. Every post in `posts.md` has one
written. Skipping it on a site that argues in `CLAUDE.md` against putting the
pedalboard planner in a canvas because a canvas has no screen reader would be
inconsistent in a way somebody will notice.

---

## 4. The caption formula

Four parts, in this order, and it is the same shape as a pedal page on the
site.

1. **A hook that is a claim, not an adjective.** "Turning this knob up rolls
   treble off" stops a scroll. "The legendary RAT distortion" does not, and it
   also says nothing.
2. **The mechanism, two or three sentences.** What the circuit does to the
   signal. This is the part no competing account is writing.
3. **"Check it yourself", and something specific to do.** A reader holding the
   pedal has to be able to find out whether the post is right. This is the
   site's second claim and it is what makes a caption worth saving.
4. **Where the rest is.** The site, plainly. No "link in bio, comment TONE for
   the guide".

Length: 120 to 180 words. Long enough for the mechanism, short enough to read.

**No em dashes**, in a caption or anywhere else. House rule, inherited from the
sister sites, enforced by `tests/house-style.test.ts` across the source tree
including this folder. Use a comma, a colon or parentheses.

### Hashtags

A standing set, plus one or two per post. Ten or so, in the first comment or at
the end of the caption, either is fine and neither matters much.

```
#guitarpedals #effectspedals #pedalboard #guitargear #stompbox
#guitartone #guitareffects #knowyourgear #signalchain #pedalnerd
```

**Never tag a manufacturer's account.** Not on a post about their pedal, not as
a courtesy. The site's footer states that product and company names belong to
their owners and that the site speaks for none of them, and a tag on a post
saying a DS-1 sounds thin into a clean amp reads as either an endorsement or a
complaint made to their face. Name the pedal in the copy, which is what the
site does.

---

## 5. The five pillars, and what not to post

**1. One pedal, one circuit.** The backbone, and fifteen posts are already in
`posts.md` because the dataset has fifteen entries. Four slides: the claim, the
circuit, what to listen for, how to check it.

**2. Order, with the reason.** The eleven slots in `lib/chain.ts`. The chain
order post is the single most saveable thing this account can publish, because
it answers a question every player has had and most answers to it online are a
list with no reasons attached.

**3. The thing that catches everyone out.** A testable surprise, and the
highest performing format here by some distance. The RAT's reversed Filter, a
buffer in front of a fuzz, why a Big Muff disappears under a band. Every one of
these is in the dataset already.

**4. Two circuits, one word.** Soft clipping against hard clipping. A
bucket-brigade delay against a digital one. A phaser against a Uni-Vibe.
Chorus against vibrato. The format that best carries the account's whole
argument, since it only works if you talk about circuits.

**5. What this account will not tell you.** Run this rarely, twice a year at
most. It is the trust post and it converts, but a brand that talks about its
own integrity more often than about pedals has become an account about itself.

### What not to post, and these are not preferences

- **No artist credits. Ever.** Not "the fuzz on that record", not a photo of a
  famous board with the pedals named. `lib/pedals.ts` has no artist field and
  `tests/pedals.test.ts` asserts it stays that way, for the reason that a rig
  changes between tours and between takes, so "this pedal is on that record" is
  a claim needing a source, and a wrong credit published beside a circuit
  description reads as fact. The format will push hard for this: artist rig
  posts are the best performing content in the whole pedal niche. It is still
  the one line not to cross, and the "what we will not say" highlight exists to
  answer for it.
- **No precise years.** Decade level, the way the `era` field is. Prototypes,
  production runs, revisions and reissues all disagree about what year a pedal
  "is", and a caption saying 1979 will get corrected in the comments correctly.
- **No current draw, and no measurement without a source.** The chain notes
  deliberately print no milliamp figures, and a test asserts it, because the
  honest number is the one on the reader's own pedal. A number typed from
  memory into a spec-shaped slot is worse than no number, since it looks like a
  measurement.
- **No prices.** The catalogue on the site carries prices and the circuit guide
  carries none, and that separation is what still lets an entry say a pedal
  sounds thin. An account that posts a price is on the wrong side of it.
- **No clone accusations, and no naming a pedal a rip off.** The dataset
  describes circuits. Two pedals sharing a topology is a fact about the
  topology and can be said as one.

---

## 6. Cadence, and the first nine

Three posts a week is the plan, which makes the twenty four in `posts.md` about
eight weeks. Two a week is fine and twelve weeks of queue is better than eight
weeks of queue and a scramble.

**The first nine are ordered on purpose, and the order is not the pedal
order.** A profile visited for the first time renders as a three wide grid, so
posts one through nine are the account's whole first impression and they need
to cover the range rather than nine drives in a row. `posts.md` is in
publishing order for exactly that reason.

Post 1 is the manifesto, post 4 is the chain order, and posts 2, 3 and 5 are
the surprises. That front loads the two most saveable formats while the account
has no followers to save them, which is the right way round: a post that gets
saved keeps working months later, and the grid is what a visitor from a search
result judges.

---

## 7. Once the account has posts, wire it into the site

Two things, both one line, and neither should happen before there is something
to point at.

**The follow strip.** `components/instagram-strip.tsx` renders up to three
post embeds on the home page and falls back to a plain follow callout when
none are configured. Fill it once three posts are up:

```
INSTAGRAM_POST_URLS=https://www.instagram.com/p/AAAA/,https://www.instagram.com/p/BBBB/,https://www.instagram.com/p/CCCC/
```

Only real `instagram.com` `/p/`, `/reel/` or `/tv/` permalinks survive
`instagramPermalinks()` in `lib/env.ts`. Anything else is dropped and the
section degrades to the callout rather than rendering an empty grey box, so a
bad paste looks unconfigured rather than broken. Three is the right number
because the grid is `lg:grid-cols-3`.

**The handle.** `INSTAGRAM_HANDLE` still defaults to `stompbox.world`, which is
what the footer and the strip link to. Whether that default moves to
`stomp_box_world` depends on something this file cannot answer, which is
whether the old account stays up. Pointing the site at an account with nothing
on it is worse than pointing it at the old one, so the switch waits until the
new grid has content:

```
INSTAGRAM_HANDLE=stomp_box_world
```

Nothing in the code needs changing for either. Both are already environment
variables, and both are optional, which is the shape every integration in
`lib/env.ts` uses.
