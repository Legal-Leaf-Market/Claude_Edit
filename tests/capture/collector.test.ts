import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { captureSource } from "@/lib/capture/extract"
import { collectorSource, compactCollector } from "@/lib/capture/collector"

/**
 * THE SERIALISATION TRICK HAS ONE RULE, AND NOTHING ELSE ENFORCES IT.
 *
 * `captureSource` is turned into text with Function.prototype.toString() and
 * pasted into a `javascript:` URL, so it may reference nothing outside its own
 * body. Break that and the failure is the worst kind available: the bookmarklet
 * throws a ReferenceError on somebody else's website, where there is no console
 * anybody is watching, and it reads as "the bookmark is broken" rather than as
 * a bug with a name.
 *
 * The temptation is constant, because every helper in that function wants to be
 * lifted out and shared with the analyser.
 */

const SERIALISED = captureSource.toString()

/**
 * Code only: comments and string literals stripped.
 *
 * Without this the scan reads prose. "the Store API (/wp-json...)" in a comment
 * looked like a call to `API`, and the string "custom (dataLayer present)"
 * looked like a call to `custom`. Both were reported as undeclared references
 * in a function that is fine, which is the way a guard like this gets switched
 * off: two false alarms and somebody widens the allowlist until it catches
 * nothing.
 *
 * REGEX LITERALS ARE NOT STRIPPED, and that is deliberate rather than an
 * oversight. Telling a regex from a division in a plain scan is the classic
 * lexing trap, and a heuristic that got it wrong would quietly make this guard
 * permissive in exactly the place it is supposed to be strict. The cost is
 * that alternation containing a space before a bracket reads as a call:
 * `/verify you are (?:a )?human/` reported `are`. The fix is to word the
 * pattern around it, which costs nothing, rather than to loosen the scan.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
}

const CODE = codeOnly(SERIALISED)

describe("the extractor can survive being serialised", () => {
  it("declares everything it uses, or uses a browser global", () => {
    /*
     * An allowlist of browser globals rather than a parser, because the
     * alternative is shipping an AST dependency to guard one rule.
     */
    const BROWSER = new Set([
      "document",
      "window",
      "location",
      "navigator",
      "URL",
      "Array",
      "Object",
      "Number",
      "String",
      "Boolean",
      "Math",
      "JSON",
      "Date",
      "Set",
      "Map",
      "RegExp",
      "Error",
      "Blob",
      "console",
      "parseInt",
      "parseFloat",
      "isNaN",
      "encodeURIComponent",
      "decodeURIComponent",
      "setTimeout",
      "Promise",
    ])

    /* Every name declared inside the body: const/let/var/function, and params. */
    const declared = new Set<string>()
    for (const match of CODE.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) {
      declared.add(match[1])
    }
    for (const match of CODE.matchAll(/\(([^)]*)\)\s*(?:=>|\{)/g)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().split(/[:\s=]/)[0].replace(/^\.\.\./, "")
        if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
      }
    }

    const offenders = new Set<string>()
    for (const match of CODE.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = match[1]
      if (declared.has(name) || BROWSER.has(name)) continue
      if (["if", "for", "while", "switch", "catch", "return", "typeof", "function"].includes(name)) continue
      offenders.add(name)
    }

    expect(
      [...offenders],
      "These are called inside captureSource() but declared outside it. Serialised into a " +
        "bookmarklet they become ReferenceErrors on a stranger's website, silently. Move them " +
        "inside the function body.",
    ).toEqual([])
  })

  it("does not import anything", () => {
    expect(SERIALISED).not.toMatch(/\brequire\(|\bimport\s/)
  })
})

describe("the collector the bookmarklet actually runs", () => {
  const { source, build } = collectorSource("https://gearavail.com")

  it("inlines the extractor rather than referencing it", () => {
    expect(source).toContain("captureSource")
    expect(source).not.toContain("%%CAPTURE%%")
  })

  it("leaves no placeholder unreplaced", () => {
    /*
     * A missed token is a syntax error in a program that only ever runs on
     * somebody else's site. Cheap to check, invisible otherwise.
     */
    expect(source).not.toMatch(/%%[A-Z]+%%/)
  })

  it("is valid JavaScript, which nothing else here would notice", () => {
    /*
     * PARSED, NOT RUN. `new Function` compiles the program and throws a
     * SyntaxError without executing a line of it, which is exactly the check
     * worth having: this code's only runtime is somebody else's website, where
     * a syntax error is an alert box at best and silence at worst, and where
     * no test and no log of ours will ever see it.
     *
     * A stray backtick, an unescaped quote in the panel markup, or a
     * placeholder replaced with something containing a `}` all land here.
     */
    expect(() => new Function(source)).not.toThrow()
  })

  it("fits in a bookmarks bar, for the browsers that still can", () => {
    /*
     * A CANARY THAT ALREADY FIRED ONCE, AND THE PAGE CHANGED RATHER THAN THE
     * NUMBER.
     *
     * A self-contained bookmarklet carries the whole program in its URL. Adding
     * the iframe reader took it past 64KB, which is roughly where Safari stops
     * accepting one, so the install page no longer claims Safari will take it
     * and points there at the snippet instead. Chrome, Edge and Firefox are
     * content with URLs far longer than this.
     *
     * The ceiling here is deliberately not "whatever it currently is". It is
     * the point past which even Chrome starts to be a question, and reaching
     * it should mean the same conversation again rather than another bump.
     */
    const url = "javascript:" + encodeURIComponent(`(function(){${source}})();`)
    expect(url.length).toBeLessThan(120_000)
  })

  it("stamps a build that moves when the source does", () => {
    expect(build).toMatch(/^[0-9a-f]{8}$/)
    expect(source).toContain(`var BUILD = "${build}"`)
  })

  it("carries no credential", () => {
    /*
     * This file is served publicly, because a bookmarklet on a merchant's page
     * has to be able to fetch it. The passcode is typed into the panel at
     * capture time and used for one request; nothing about it may ever be
     * baked in here.
     */
    expect(source).not.toMatch(/ADMIN_PASSCODE\s*[:=]\s*["'][^"']+["']/)
    expect(source).toContain('type="password"')
  })

  it("posts to the ingest route, with the token in a header", () => {
    expect(source).toContain("/api/capture/ingest")
    expect(source).toContain("x-ga-admin-token")
  })

  it("keeps all three ways of getting a capture home", () => {
    /*
     * Direct send, relay tab, clipboard. Each covers a different refusal, and
     * dropping one strands exactly the shops that needed that one.
     */
    expect(source).toContain("ga-send")
    expect(source).toContain("ga-relay-ready")
    expect(source).toContain("ga-copy")
  })

  it("asks the operator to confirm the merchant rather than guessing silently", () => {
    /*
     * Filing a capture under the wrong merchant is found by a shopper rather
     * than by us, so the guess goes in an editable field and is never just
     * applied.
     */
    expect(source).toContain("ga-key")
    expect(source).toContain("guessKey")
  })
})

describe("backslashes survive the template literal", () => {
  const { source } = collectorSource("https://gearavail.com")

  /*
   * A BUG THAT SHIPPED, AND THE WHOLE CLASS IT BELONGS TO.
   *
   * The operator half of the collector lives in a TypeScript template literal,
   * and a template literal EATS an unrecognised escape: `\d` written there
   * emits a bare `d`. So `/^\d+$/` was served to browsers as `/^d+$/`, a
   * regex that matches a run of the letter d and therefore never matched a
   * page number.
   *
   * The consequence was exactly the silent kind. The crawl's fallback for
   * numbered pagination could not fire, so on any site without a rel=next
   * link it stopped after page one and reported success. Found by reading the
   * DEPLOYED file, not by any test here, because every test asserted on
   * substrings that happened not to include a backslash.
   *
   * Rather than pin the one regex, this checks the rule: inside that template
   * literal every backslash must be doubled.
   */
  const file = readFileSync(new URL("../../lib/capture/collector.ts", import.meta.url), "utf-8")
  const literal = file.slice(
    file.indexOf("const OPERATOR_SOURCE = `") + "const OPERATOR_SOURCE = `".length,
    file.indexOf("\n`\n", file.indexOf("const OPERATOR_SOURCE = `")),
  )

  it("has no lone backslash in the operator source", () => {
    /* Every `\\` is fine; a single `\` before anything else is the bug. */
    const lone = [...literal.matchAll(/(?<!\\)\\(?!\\)(.)/g)].map((m) => `\\${m[1]}`)
    expect(
      [...new Set(lone)],
      "A single backslash inside this template literal is consumed by TypeScript and never reaches " +
        "the browser. Double it. This is how /^\\d+$/ shipped as /^d+$/ and silently broke the " +
        "crawl's pagination fallback.",
    ).toEqual([])
  })

  it("emits the page-number pattern intact", () => {
    /* The specific one that broke, pinned so a regression is named. */
    expect(source).toContain("/^\\d+$/.test(v)")
    expect(source, "the escape was eaten again").not.toContain("/^d+$/")
  })

  it("emits the hostname patterns intact", () => {
    expect(source).toContain("/^www\\./")
  })
})

describe("the crawl scrolls the page it is reading", () => {
  const { source } = collectorSource("https://gearavail.com")

  /*
   * A BUG THAT WAS REPRODUCED, MEASURED AND FIXED, and the numbers are here so
   * a future edit that quietly drops the scroll is caught by name.
   *
   * Reported as a crawl that reads the first page and returns zero for every
   * page after it. The asymmetry was the clue: page one is the tab the OPERATOR
   * already had open and had scrolled, because the panel tells them to. Later
   * pages are read in a hidden iframe that nobody scrolls, so a lazy grid never
   * fired and every one of them was captured as an empty skeleton.
   *
   * Against a fixture whose second page fills its grid only on a scroll event,
   * driven in real Chromium:
   *
   *   before  Done: 3 page(s), 6 products      (page one only)
   *   after   Done: 4 page(s), 15 products     (page one, plus page two's nine)
   *
   * The first attempt at the fix changed nothing, and that is worth keeping
   * too: it scrolled only when the document was taller than the frame, and a
   * page whose grid has not arrived is SHORT precisely because the grid has not
   * arrived. Hence the nudge for a document that cannot scroll at all.
   */
  it("walks the framed document down instead of reading it where it landed", () => {
    expect(source).toContain("scrollTo")
    expect(source, "the frame viewport and the scroll maths must share one number").toContain(
      "FRAME_H",
    )
  })

  it("still provokes a page too short to scroll", () => {
    expect(source).toContain("dispatchEvent")
  })

  it("reports how far it scrolled, so an empty page can be diagnosed", () => {
    /* "frame rendered but found no products" and "frame refused" need
       completely different fixes, and the count is what separates a grid that
       was given every chance from one that never got looked at. */
    expect(source).toContain("frameScrolls")
    expect(source).toContain("scrolls")
  })
})

describe("the compact build that actually goes in a bookmark", () => {
  /*
   * A NORMAL BOOKMARKLET IS A FEW HUNDRED BYTES. This one was FIFTY THOUSAND
   * characters, a fifth of it the commentary in the source being shipped into
   * somebody's bookmarks bar, and it was reported as bookmarks that simply
   * never fired. Browsers are unreliable with URLs that long and unreliable in
   * the worst way: no error, just a bookmark that stores wrong.
   */
  const { source } = collectorSource("https://www.gearavail.com")
  const compact = compactCollector(source)

  it("is still valid JavaScript", () => {
    /* The only thing that matters. A minifier that breaks the program produces
       a failure on a stranger's website with nothing to read. */
    expect(() => new Function(compact)).not.toThrow()
  })

  it("is meaningfully smaller", () => {
    expect(compact.length).toBeLessThan(source.length * 0.8)
  })

  it("keeps every part of the program", () => {
    for (const marker of [
      "var BUILD",
      "ga-crawl",
      "ga-diag",
      "ga-relay-ready",
      "readViaFrame",
      "/api/capture/ingest",
    ]) {
      expect(compact, `compacting lost ${marker}`).toContain(marker)
    }
  })

  it("does not reach inside strings", () => {
    /*
     * THE FAILURE MODE THAT MATTERS. A naive comment stripper eats the "//" in
     * "https://..." and the program dies. This one only removes block comments
     * that START a line, so it can never touch mid-line content, and the origin
     * baked into the source is the proof.
     */
    expect(compact).toContain("https://www.gearavail.com")
    expect(compact).toContain("/^\\d+$/.test(v)")
  })

  it("leaves the served default fully commented", () => {
    /* The snippet copy is the one people read. Only the bookmark is stripped.
       The marker has to be a comment INSIDE the emitted program: the module's
       own docstring never reaches the browser at all. */
    expect(source).toContain("A GUESS, SHOWN IN AN EDITABLE FIELD")
    expect(compact).not.toContain("A GUESS, SHOWN IN AN EDITABLE FIELD")
  })
})
