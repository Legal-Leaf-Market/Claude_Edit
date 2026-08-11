import { describe, expect, it } from "vitest"
import {
  creditLine,
  isRenderable,
  licenceIsAcceptable,
  photoForRig,
  PHOTOS,
  type ArtistPhoto,
} from "@/lib/rigs/photos"
import { RIGS } from "@/lib/rigs/data"
import { coverFor, coverUrl, COVERS, isValidMbid, releaseGroupUrl } from "@/lib/rigs/covers"

/**
 * Artist photographs from Wikimedia Commons.
 *
 * These tests are almost entirely about licence compliance, because that is
 * the only thing here that can go legally wrong. A missing photo is a
 * monogram; a photo with the wrong credit, or a photo under a licence this
 * site cannot use, is a licence violation on a commercial page.
 */

function photo(overrides: Partial<ArtistPhoto> = {}): ArtistPhoto {
  return {
    rigSlug: "test-rig",
    file: "File:Example.jpg",
    url: "https://upload.wikimedia.org/example.jpg",
    width: 800,
    height: 600,
    author: "Jane Photographer",
    licence: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0", publicDomain: false },
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    fetchedAt: "2026-08-11",
    ...overrides,
  }
}

describe("licenceIsAcceptable", () => {
  it("accepts the free licences this site can actually use", () => {
    for (const name of ["CC0", "CC BY 4.0", "CC BY-SA 3.0", "Public domain", "PD-old"]) {
      expect(licenceIsAcceptable(name), name).toBe(true)
    }
  })

  /**
   * The rejection that matters most. NonCommercial looks free, reads free in a
   * hurry, and is unusable here: this site runs on affiliate revenue. A
   * NoDerivatives image cannot be cropped or resized either.
   */
  it("rejects NonCommercial and NoDerivatives however free they look", () => {
    for (const name of [
      "CC BY-NC 4.0",
      "CC BY-NC-SA 3.0",
      "CC BY-ND 4.0",
      "CC BY-NC-ND 4.0",
      "Noncommercial use only",
    ]) {
      expect(licenceIsAcceptable(name), name).toBe(false)
    }
  })

  it("rejects anything it does not recognise, rather than assuming", () => {
    for (const name of ["", "   ", "All rights reserved", "Fair use", "Unknown"]) {
      expect(licenceIsAcceptable(name), JSON.stringify(name)).toBe(false)
    }
  })
})

describe("isRenderable", () => {
  it("accepts a complete entry", () => {
    expect(isRenderable(photo())).toBe(true)
  })

  /**
   * Rule 1 made structural: no attribution, no image. An entry missing an
   * author under a licence that requires one never displays, so the fallback
   * is a monogram rather than an uncredited photograph.
   */
  it("refuses a photo it cannot credit", () => {
    expect(isRenderable(photo({ author: "" }))).toBe(false)
    expect(isRenderable(photo({ author: "   " }))).toBe(false)
  })

  it("allows a public domain photo with no named author", () => {
    expect(
      isRenderable(
        photo({
          author: "",
          licence: { name: "Public domain", url: "https://example.org/pd", publicDomain: true },
        }),
      ),
    ).toBe(true)
  })

  it("refuses an entry with no licence or no source to link to", () => {
    expect(isRenderable(photo({ licence: { name: "", url: "", publicDomain: false } }))).toBe(false)
    expect(isRenderable(photo({ sourceUrl: "" }))).toBe(false)
    expect(isRenderable(photo({ url: "" }))).toBe(false)
  })
})

describe("creditLine", () => {
  it("names the photographer, the licence and Commons", () => {
    expect(creditLine(photo())).toBe("Jane Photographer, CC BY-SA 4.0, via Wikimedia Commons")
  })

  it("drops the empty author on a public domain image rather than printing a gap", () => {
    const line = creditLine(
      photo({ author: "", licence: { name: "CC0", url: "https://example.org", publicDomain: true } }),
    )
    expect(line).toBe("CC0, via Wikimedia Commons")
    expect(line).not.toMatch(/^,|,\s*,/)
  })
})

describe("the registry", () => {
  /**
   * Empty is the correct state until somebody runs the fetch script. Commons
   * was unreachable from the environment this was built in, and inventing
   * filenames and credits would have produced exactly the confident wrong
   * attribution the whole design prevents.
   */
  it("renders monograms when it holds nothing", () => {
    expect(photoForRig("jimi-hendrix")).toBeNull()
    expect(photoForRig("nope")).toBeNull()
  })

  it("only ever points at rigs that exist", () => {
    const slugs = new Set(RIGS.map((r) => r.slug))
    for (const p of PHOTOS) {
      expect(slugs, `${p.rigSlug} is not a rig`).toContain(p.rigSlug)
    }
  })

  /**
   * Whatever the script writes has to survive the same checks. This is what
   * catches a bad entry after a future run, when this file is no longer empty.
   */
  it("holds only entries that are complete and usably licensed", () => {
    for (const p of PHOTOS) {
      expect(isRenderable(p), `${p.rigSlug} is missing attribution`).toBe(true)
      expect(licenceIsAcceptable(p.licence.name), `${p.rigSlug}: ${p.licence.name}`).toBe(true)
      expect(p.url, `${p.rigSlug}`).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
      expect(p.sourceUrl, `${p.rigSlug}`).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    }
  })

  it("has one photo per rig at most", () => {
    const slugs = PHOTOS.map((p) => p.rigSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

/* -------------------------------------------------------------------------- */

describe("album covers", () => {
  it("only accepts a real MBID, since a wrong one shows the wrong artwork", () => {
    expect(isValidMbid("f2e5f2cd-9a3b-4b26-9bfa-cb0eb0eb0eb0")).toBe(true)
    expect(isValidMbid("  f2e5f2cd-9a3b-4b26-9bfa-cb0eb0eb0eb0  ")).toBe(true)
    for (const bad of ["", "not-a-uuid", "12345", "f2e5f2cd9a3b4b269bfacb0eb0eb0eb0"]) {
      expect(isValidMbid(bad), JSON.stringify(bad)).toBe(false)
    }
  })

  it("is empty until the script runs, so nothing renders a guessed cover", () => {
    expect(coverFor("jimi-hendrix", "Are You Experienced")).toBeNull()
  })

  it("builds a thumbnail URL rather than storing one that would rot", () => {
    const cover = {
      rigSlug: "x",
      record: "Y",
      releaseGroupMbid: "f2e5f2cd-9a3b-4b26-9bfa-cb0eb0eb0eb0",
      fetchedAt: "2026-08-11",
    }
    // 250px on purpose: it is what the page needs, and a thumbnail is far
    // easier to defend than a full resolution scan of the artwork.
    expect(coverUrl(cover)).toBe(
      "https://coverartarchive.org/release-group/f2e5f2cd-9a3b-4b26-9bfa-cb0eb0eb0eb0/front-250",
    )
    expect(releaseGroupUrl(cover)).toMatch(/^https:\/\/musicbrainz\.org\/release-group\//)
  })

  it("holds only valid MBIDs pointing at rigs that exist", () => {
    const slugs = new Set(RIGS.map((r) => r.slug))
    for (const c of COVERS) {
      expect(isValidMbid(c.releaseGroupMbid), `${c.rigSlug}/${c.record}`).toBe(true)
      expect(slugs, `${c.rigSlug} is not a rig`).toContain(c.rigSlug)
    }
  })
})
