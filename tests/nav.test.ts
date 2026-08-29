import { describe, expect, it } from "vitest"
import { currentSectionId, footerColumns, NAV_SECTIONS, NAV_UTILITY } from "@/lib/nav"
import { BOARDS } from "@/lib/boards"
import { indexableCategories } from "@/lib/categories"
import { PARTNERS } from "@/lib/partners"
import { RIGS } from "@/lib/rigs"
import { STATIC_ROUTES as STOMPBOX_NAV_ROUTES } from "@/lib/stompbox/nav"
import { SORT_OPTIONS } from "@/lib/search/types"
import { STORES } from "@/lib/stores"

/**
 * The navigation tree.
 *
 * These exist because of a specific, repeated failure on this site: the header
 * and the footer were hand-listed separately, so /pedalboard was in one and
 * not the other, and three category links 404ed for a while after a slug
 * rename because the homepage hardcoded "keyboards-pianos" while slugify()
 * produces "keyboards-and-pianos". Deriving everything from lib/nav.ts fixes
 * the structural half; these tests cover the half a type system cannot, namely
 * that the strings point at routes that exist.
 *
 * The routes are checked against the same source of truth the pages generate
 * from (indexableCategories, STORES, BOARDS, RIGS), not against a second
 * hardcoded list, because a second hardcoded list is the original bug.
 */

/** Every path the app can serve, derived rather than transcribed. */
const STATIC_ROUTES = new Set([
  "/",
  "/search",
  "/shop",
  "/feed",
  "/cart",
  "/alerts",
  "/pedalboard",
  "/chord-teacher",
  "/rigs",
  "/sign-in",
  "/sign-up",
  "/list-your-shop",
  "/partners",
  "/flip-match",
  "/unsubscribe",
])

/*
 * The guide's routes, as the aggregator addresses them.
 *
 * Derived from the guide's own nav tree rather than typed out again, which is
 * the same rule this file exists to enforce one level down: `lib/stompbox/nav.ts`
 * is THE list on stompbox.world, and every route it names is served here under
 * `/stompbox` by the host rewrite in middleware.ts. A page added there and
 * linked to from the aggregator's mega menu therefore cannot 404 here without
 * this set noticing.
 */
const STOMPBOX_ROUTES = new Set(
  STOMPBOX_NAV_ROUTES.map((route) => (route === "/" ? "/stompbox" : `/stompbox${route}`)),
)

function isKnownRoute(href: string): boolean {
  const path = href.split("?")[0].split("#")[0]
  if (STATIC_ROUTES.has(path)) return true
  if (STOMPBOX_ROUTES.has(path)) return true
  if (indexableCategories().some((c) => path === `/used/${c.slug}`)) return true
  if (STORES.some((s) => path === `/shop/${s.slug}`)) return true
  if (BOARDS.some((b) => path === `/boards/${b.slug}`)) return true
  if (RIGS.some((r) => path === `/rigs/${r.slug}`)) return true
  if (PARTNERS.some((p) => path === `/partners/${p.slug}`)) return true
  return false
}

function allNavLinks(): string[] {
  const links: string[] = []
  for (const section of NAV_SECTIONS) {
    links.push(section.href)
    if (section.feature) links.push(section.feature.href)
    for (const column of section.columns) {
      for (const link of column.links) links.push(link.href)
      if (column.more) links.push(column.more.href)
    }
  }
  for (const item of NAV_UTILITY) links.push(item.href)
  for (const column of footerColumns()) {
    for (const link of column.links) links.push(link.href)
  }
  return links
}

describe("NAV_SECTIONS", () => {
  it("has unique section ids, used as React keys and open/closed state", () => {
    const ids = NAV_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every section a real page behind its label, never a dead toggle", () => {
    for (const section of NAV_SECTIONS) {
      expect(isKnownRoute(section.href), `${section.label} -> ${section.href}`).toBe(true)
    }
  })

  it("keeps every panel to a scannable number of columns", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.columns.length).toBeGreaterThanOrEqual(1)
      expect(section.columns.length).toBeLessThanOrEqual(4)
      for (const column of section.columns) {
        expect(column.links.length).toBeGreaterThan(0)
      }
    }
  })

  it("points every link in the whole tree at a route that exists", () => {
    for (const href of allNavLinks()) {
      expect(isKnownRoute(href), `nav link "${href}" does not resolve to a known route`).toBe(true)
    }
  })

  /**
   * Query strings in the nav are a second way to 404 quietly: `sort=deals`
   * would silently fall back rather than error, so a shopper clicking "Below
   * market" would get an ordinary search and never know.
   */
  it("only uses sort values the search layer actually accepts", () => {
    const valid = new Set(SORT_OPTIONS.map((o) => o.value))
    for (const href of allNavLinks()) {
      const query = href.split("?")[1]
      if (!query) continue
      const sort = new URLSearchParams(query).get("sort")
      if (sort) expect(valid.has(sort as never), `"${href}" uses sort=${sort}`).toBe(true)
    }
  })

  it("only filters rigs by a decade the dataset has", () => {
    const decades = new Set(RIGS.map((r) => r.decade))
    for (const href of allNavLinks()) {
      const query = href.split("?")[1]
      if (!query) continue
      const decade = new URLSearchParams(query).get("decade")
      if (decade) expect(decades.has(decade as never), `"${href}" uses decade=${decade}`).toBe(true)
    }
  })

  it("uses no em dashes in any nav copy", () => {
    const prose = NAV_SECTIONS.flatMap((s) => [
      s.label,
      s.feature?.body ?? "",
      ...s.columns.flatMap((c) => [c.title, ...c.links.map((l) => `${l.label} ${l.hint ?? ""}`)]),
    ]).join(" ")
    expect(prose).not.toMatch(/—|–/)
  })
})

describe("currentSectionId", () => {
  it("marks the section owning a path", () => {
    expect(currentSectionId("/search")).toBe("shop")
    expect(currentSectionId("/used/electric-guitars")).toBe("shop")
    expect(currentSectionId("/gear/some-pedal")).toBe("shop")
    expect(currentSectionId("/shop/jackson-audio")).toBe("shop")
    expect(currentSectionId("/rigs")).toBe("rigs")
    expect(currentSectionId("/rigs/david-gilmour")).toBe("rigs")
    expect(currentSectionId("/pedalboard")).toBe("build")
    expect(currentSectionId("/boards/flip-match")).toBe("community")
    expect(currentSectionId("/feed")).toBe("community")
  })

  it("returns null for a page no section owns", () => {
    expect(currentSectionId("/")).toBeNull()
    expect(currentSectionId("/sign-in")).toBeNull()
    expect(currentSectionId("/cart")).toBeNull()
  })

  /**
   * Prefix matching has to respect segment boundaries. "/feedback" starts with
   * "/feed" as a string but is a different page, and highlighting Community
   * for it would be a small lie in the one place the nav is meant to be
   * telling the truth about where you are.
   */
  it("does not match a path that merely starts with a section prefix", () => {
    expect(currentSectionId("/feedback")).toBeNull()
    expect(currentSectionId("/searching")).toBeNull()
    expect(currentSectionId("/rigsomething")).toBeNull()
  })
})

describe("footerColumns", () => {
  it("gives every column a title and links", () => {
    for (const column of footerColumns()) {
      expect(column.title.trim()).not.toBe("")
      expect(column.links.length).toBeGreaterThan(0)
    }
  })

  it("lists every community board, since the footer is the exhaustive one", () => {
    const community = footerColumns().find((c) => c.title === "Community")
    expect(community).toBeDefined()
    for (const board of BOARDS) {
      expect(community?.links.some((l) => l.href === `/boards/${board.slug}`)).toBe(true)
    }
  })
})
