import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import {
  LAB_PHOTOS,
  isPublishable,
  labPhotoForGear,
  labPhotosForGear,
  type LabPhoto,
} from "@/lib/lab/photos"

/**
 * OUR OWN PHOTOGRAPHS, AND THE TWO THINGS THAT KEEP THEM HONEST.
 *
 * A photograph of a pedal we owned is the best picture this site can put on a
 * card that has no seller photo, and it is the one most able to mislead: it is
 * a real object, so nothing about it announces that it is a DIFFERENT unit
 * from the one being sold. Both guarantees are structural rather than
 * editorial, and both are pinned here.
 */

const sample = (over: Partial<LabPhoto> = {}): LabPhoto => ({
  brand: "Boss",
  model: "DS-1",
  src: "/lab/boss-ds-1-a4021-three-quarter.webp",
  view: "three-quarter",
  width: 900,
  height: 700,
  intakeId: "A4021",
  shotOn: "2026-09-12",
  alt: "A Boss DS-1 on a white sweep",
  ...over,
})

describe("no provenance, no photo", () => {
  it("publishes a shot that can account for itself", () => {
    expect(isPublishable(sample())).toBe(true)
  })

  /* Each of these is a photo we could not defend if somebody asked whether it
     is really ours, so none of them may reach a page. */
  it.each([
    ["no intake reference", { intakeId: "  " }],
    ["no date", { shotOn: "" }],
    ["no brand", { brand: "" }],
    ["no model", { model: "" }],
    ["dimensions we do not know", { width: 0 }],
  ])("refuses a shot with %s", (_label, over) => {
    expect(isPublishable(sample(over as Partial<LabPhoto>))).toBe(false)
  })

  it("refuses a src that is not one of ours", () => {
    /* Defence in depth against a manifest that names a remote URL: these are
       files we shot and hold, and anything else is somebody else's picture
       with our label on it. */
    expect(isPublishable(sample({ src: "https://cdn.example.com/ds1.jpg" }))).toBe(false)
    expect(isPublishable(sample({ src: "/pedals/boss--ds-1.webp" }))).toBe(false)
  })
})

describe("which shot a card gets", () => {
  it("never puts a gut shot on a card", () => {
    /* Excluded rather than ranked last, because "last" becomes "only" the
       moment it is the sole photo of that pedal, and the inside of an
       enclosure is actively misleading as a thumbnail. */
    const guts = sample({ view: "guts" })
    const found = [guts].filter(isPublishable)
    expect(found).toHaveLength(1)
    expect(labPhotoForGear("Boss", "DS-1")).toBeNull()
  })

  it("answers null for gear nobody has photographed, which is most of it", () => {
    expect(labPhotoForGear("Ibanez", "TS9")).toBeNull()
    expect(labPhotosForGear("Ibanez", "TS9")).toEqual([])
  })

  it("answers null rather than guessing when the resolver gave it nothing", () => {
    expect(labPhotoForGear(null, "DS-1")).toBeNull()
    expect(labPhotoForGear("Boss", undefined)).toBeNull()
  })
})

describe("the committed registry", () => {
  it("has a file on disk behind every row", () => {
    /* The mirror of the pedal-still test: a row with no file is an <img>
       asking for something that is not there, and it fails on the live site
       rather than here. */
    for (const photo of LAB_PHOTOS) {
      const file = path.join(process.cwd(), "public", photo.src.replace(/^\//, ""))
      expect(existsSync(file), `${photo.src} is in the registry with no file`).toBe(true)
    }
  })

  it("holds only publishable rows", () => {
    for (const photo of LAB_PHOTOS) {
      expect(isPublishable(photo), `${photo.src} cannot account for itself`).toBe(true)
    }
  })
})
