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

## Hotkeys, once the bookmarklet has been clicked on a tab

| Keys | Action |
|---|---|
| `Alt` `Shift` `I` | Send all three replies. The main binding. |
| `Alt` `Shift` `1` / `2` / `3` | Send just that one reply. |
| `Esc` | Hide the panel. |
| `Ctrl` `Shift` `I` | Also bound, but Chrome claims it for DevTools and normally intercepts it before the page sees it. Spare, not the one to reach for. |

A bookmarklet cannot arm itself, so it needs one click per tab. Nothing in a
bookmark can register a hotkey across tabs on its own; that would take an
extension.

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
```

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
