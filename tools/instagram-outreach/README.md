# Instagram new-follower outreach helper

An operator utility, not part of the Gear Avail app. Nothing here is imported by
`app/` or `lib/`, nothing runs in CI, and deleting the folder has no effect on
the site. It lives in the repo only so it survives a container being reclaimed.

## What it is

`new-followers.html` is a single self-contained page you open from disk in
Chrome. It does two things:

1. Opens one Instagram DM tab per new follower, in batches, from a list read off
   phone screenshots of the followers list.
2. Builds a bookmarklet that types three saved replies into whichever DM thread
   the tab is showing and sends them, on a click or a hotkey.

There is no build step and no dependency. Open the file, edit the replies, drag
the blue button to the bookmarks bar.

## Two touches, not a blast

- **Intro**: the three replies, on first contact. `Alt` `Shift` `I`.
- **Newsletter**: one message about a week later carrying that week's pick.
  `Alt` `Shift` `N`.

The launcher keeps a contact ledger in its own localStorage (a different origin
from instagram.com, so the in-page panel cannot see it, which is why this page is
the system of record). Per handle it holds first contact, newsletter sent, and
muted. "Select who is due" ticks only accounts that qualify for the current
campaign, capped per session. Muted is absolute: excluded from every selection and
every batch, in both campaigns, and clearing contact history never un-mutes anyone.

## The weekly pick and its product card

The message is mostly a URL, because the URL carries the information. Use the
`/p/<id>` share route added in `site-patch/`: it server renders the product's own
Open Graph tags so Instagram shows a real product card with the photo, name and
price. Every other URL on the site yields the same generic card, because the site
is static HTML with client-rendered products and preview crawlers do not run
JavaScript. See `site-patch/README.md`.

## Workflow

1. Open `new-followers.html` in Chrome and tick who you want.
2. Click "Queue DM tabs". That click opens the first tab and queues the rest.
3. Advance with <kbd>O</kbd> or "Open next tab", one tab per press. To get ten
   per click, allow pop-ups for the page once and use "Open batch" (see below).
4. In each tab: click the bookmarklet, press `Alt` `Shift` `I`, close the tab.
   Installing the userscript instead removes that per-tab click.

### How a tab becomes a thread

`ig.me/m/<handle>` is a mobile app deep link and does not open a thread on desktop
web, and Instagram has no URL that accepts a recipient. So each tab lands on
`/direct/new/#ll=<handle>`, and the injected panel fills the recipient in: it types
the handle into the search box (via the native value setter, since React owns that
input), waits for results, and clicks the row that matches.

**Exact match or refuse.** A row only counts when one of its whole text tokens
equals the handle. A fuzzy pick would open a thread with a stranger and then send
them three messages, which is far worse than doing nothing, so a near miss stops
with a specific reason and selects nobody. `test-recipient.mjs` pins that with a
directory full of prefix matches and no exact one.

Instagram's router drops the hash after boot, so the handle is read once at arm
time and stashed in `sessionStorage`, which is per tab and therefore exactly one
recipient per tab.

The selectors for the picker are written against Instagram's current shape with
fallbacks, but unlike everything else here they have not been run against the live
site. Check the first one by hand: the panel says "Armed for @handle", and it
should open that thread and no other.

### Why only one tab opens per click

Measured in Chromium, both facts drive the queue code:

- **Chrome allows exactly one `window.open` per user gesture.** Five calls in one
  click handler open one tab; the other four are blocked. A ten-per-click batch
  only works once the page is allowed to show pop-ups (click the blocked-pop-ups
  icon in the address bar and allow it), which the "Open batch" button explains
  in place.
- **Passing `noopener` makes `window.open` return `null` even on success**, per
  spec. The first version used it, so blocked-versus-opened was indistinguishable:
  every item was counted as opened and dropped from the queue, losing nine of
  every ten. It is omitted now, and a blocked item stays at the head of the queue.

A keydown is also a user gesture, which is why <kbd>O</kbd> opens one tab per
press and works with no Chrome setting changed.

## Hotkeys, once the bookmarklet has been clicked on a tab

| Keys | Action |
|---|---|
| `Alt` `Shift` `I` | Send all three replies. The main binding. |
| `Alt` `Shift` `1` / `2` / `3` | Send just that one reply. |
| `Esc` | Hide the panel. |
| `Ctrl` `Shift` `I` | Also bound, but Chrome claims it for DevTools and normally intercepts it before the page sees it. Spare, not the one to reach for. |

A bookmarklet cannot arm itself, so it needs one click per tab. Nothing in a
bookmark can register a hotkey across tabs on its own.

To drop that per-tab click, use "Download as userscript" and load the result in
Violentmonkey or Tampermonkey. Same code from the same source block, wrapped in a
userscript header matched to `/direct/*`, so it arms itself on every DM page and
each tab becomes hotkey then `Ctrl` `W`.

## Two things worth knowing before using it

- Firing the same three messages at dozens of accounts in one sitting is the
  pattern Instagram's spam heuristics look for, and the usual result is a
  temporary messaging block. Pace it and vary the wording.
- Scripted sending is against Instagram's terms, which prohibit automated
  interaction with the service. The account carries that risk.

## Why the insertion code looks over-engineered

Instagram's composer keeps its own model and renders that model into the
contenteditable, so writing to the DOM proves nothing: text can sit on screen
while the model stays empty, and Enter then posts a blank message. Measured in
Chrome, `document.execCommand('insertText')` fires only `input` and never
`beforeinput`, while real typing fires both, so a beforeinput-driven editor
ignores it completely. The first version of this tool sent three blank messages
in the test for exactly that reason.

So insertion cascades through the routes that go via the editor's own model
first (a `paste` event carrying a `DataTransfer`, then a cancelable
`beforeinput`), confirming each attempt before trying the next, and falls back
to `execCommand` only as a last resort. If no route registers and no live Send
control appears, it refuses to press Enter and says so, rather than posting
blanks.

## Tests

```
npm i playwright        # the browser is already on the image, do not run playwright install
node tools/instagram-outreach/test/test-bookmarklet.mjs
node tools/instagram-outreach/test/test-tab-queue.mjs
```

`test-tab-queue.mjs` drives the launcher with Chrome's pop-up blocker left on,
which is what a normal profile does. It checks that the queueing click opens
exactly one tab, that "Open batch" opens what Chrome allows and leaves the
blocked remainder queued rather than dropping it, that <kbd>O</kbd> advances one
per press but types normally inside a textarea, that truncated handles become
searches rather than 404 profile URLs, and that with pop-ups allowed a batch
opens in a single click.

`test/mock-dm.html` stands in for a DM thread in two editor styles: `?mode=model`
mimics the Lexical-style, model-owning editor Instagram actually uses, and
`?mode=dom` mimics a naive editor that reads the DOM on `input`. The suite checks
that all three replies arrive intact and in order in both, that no blank message
is ever posted, that the single-reply hotkey sends only its own reply, and that
an unreachable or absent composer produces a reported refusal with no Enter
keypress.

If Chromium is not found, pass the on-image path:
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (already pinned in the
test).

## The follower list

Read by eye off 8 phone screenshots, newest first. 68 accounts: 57 with an exact
handle, 11 where the screenshot truncated the handle or cut it off, which link to
Instagram search instead of a profile URL that would 404. One row between
`bigamoni` and `cloudyvibes881` may have fallen in a gap between two
screenshots. Re-screenshot with narrower overlap if the list needs to be exact.
