import { describe, expect, it } from "vitest"
import { categoryFromFeed } from "@/lib/canonical/feed-category"
import { CATEGORIES } from "@/lib/categories"

/**
 * The merchant's own category, mapped onto ours.
 *
 * These are real taxonomy paths from the feeds this reads: Reverb and
 * Gear4music over Awin, the three CJ retailers, the eight Impact merchants,
 * Shopify product_type and the WooCommerce Store API's flat category list.
 */

describe("categoryFromFeed", () => {
  it("only ever answers with a category the rest of the site knows", () => {
    // A label that is not in CATEGORIES renders an empty /used/[category] page
    // while the listings sit there under a slightly different string.
    const paths = [
      "Effects and Pedals / Fuzz",
      "Amps / Bass Amps",
      "Pro Audio / Microphones / Condenser",
      "Parts / Pickups / Humbucker",
    ]
    for (const p of paths) expect(CATEGORIES).toContain(categoryFromFeed(p)!)
  })

  it("reads Reverb's own departments", () => {
    expect(categoryFromFeed("Effects and Pedals / Fuzz")).toBe("Effects Pedals")
    expect(categoryFromFeed("Effects and Pedals / Overdrive and Boost")).toBe("Effects Pedals")
    expect(categoryFromFeed("Electric Guitars / Solid Body")).toBe("Electric Guitars")
    expect(categoryFromFeed("Acoustic Guitars / Dreadnought")).toBe("Acoustic Guitars")
    expect(categoryFromFeed("Drums and Percussion / Cymbals / Ride")).toBe("Drums & Percussion")
    expect(categoryFromFeed("Folk Instruments / Banjos")).toBe("Folk & Traditional")
    expect(categoryFromFeed("DJ and Lighting / Turntables")).toBe("DJ Equipment")
  })

  it("takes the leaf when it is specific, and the parent when it is not", () => {
    // "Analog Synths" says synth on its own; "Delay" says nothing on its own
    // and has to be read as part of the department it sits in.
    expect(categoryFromFeed("Keyboards and Synths / Synths / Analog Synths")).toBe("Synthesizers")
    expect(categoryFromFeed("Effects and Pedals / Delay")).toBe("Effects Pedals")
    expect(categoryFromFeed("Effects and Pedals / Reverb")).toBe("Effects Pedals")
  })

  it("sends an ambiguous word to the department, not to a guess", () => {
    // The whole reason "compressor" is in no pattern. One of these is a pedal
    // and the other is a rack unit, and the word cannot tell them apart.
    expect(categoryFromFeed("Effects and Pedals / Compressors and Sustainers")).toBe("Effects Pedals")
    expect(categoryFromFeed("Pro Audio / Outboard Gear / Compressors")).toBe("Recording & Audio")
  })

  it("does not read a bass with four strings as a packet of strings", () => {
    // "String" is in the parts pattern, and this is how it would have gone
    // wrong: the parts sense is plural and never follows a digit.
    expect(categoryFromFeed("Bass Guitars / 4-String")).toBe("Bass Guitars")
    expect(categoryFromFeed("Electric Guitars / 12-String")).toBe("Electric Guitars")
    expect(categoryFromFeed("Accessories / Guitar Strings")).toBe("Parts & Accessories")
    expect(categoryFromFeed("Parts / Strings")).toBe("Parts & Accessories")
  })

  it("does not read a bass amp as a bass, or a headphone amp as an amp", () => {
    expect(categoryFromFeed("Amps / Bass Amps")).toBe("Amplifiers")
    expect(categoryFromFeed("Amps / Guitar Cabinets")).toBe("Amplifiers")
    expect(categoryFromFeed("Pro Audio / Headphone Amps")).toBe("Recording & Audio")
  })

  it("reads a part as a part even under an instrument department", () => {
    expect(categoryFromFeed("Electric Guitars / Parts")).toBe("Parts & Accessories")
    expect(categoryFromFeed("Accessories / Cases and Gig Bags")).toBe("Parts & Accessories")
  })

  it("accepts the separators feeds actually use", () => {
    expect(categoryFromFeed("Guitars > Electric Guitars > Solid Body")).toBe("Electric Guitars")
    expect(categoryFromFeed("Guitars | Guitar Effects Pedals")).toBe("Effects Pedals")
    expect(categoryFromFeed("Studio & Production > Audio Interfaces")).toBe("Recording & Audio")
  })

  it("reads a Shopify product_type, which is one word and no path", () => {
    expect(categoryFromFeed("Effects Pedal")).toBe("Effects Pedals")
    expect(categoryFromFeed("Acoustic Guitars")).toBe("Acoustic Guitars")
  })

  it("returns null rather than Other when it does not recognise the path", () => {
    // Null is what makes the title parse the fallback. Answering "Other" would
    // replace a guess with a worse guess, confidently.
    expect(categoryFromFeed("Software / Plugins")).toBeNull()
    expect(categoryFromFeed("Band and Orchestra")).toBeNull()
    expect(categoryFromFeed("Miscellaneous")).toBeNull()
    expect(categoryFromFeed("")).toBeNull()
    expect(categoryFromFeed(null)).toBeNull()
    expect(categoryFromFeed(undefined)).toBeNull()
  })

  it("never answers Other for anything", () => {
    const paths = ["Other", "Effects and Pedals", "Nonsense / Gibberish", "Software"]
    for (const p of paths) expect(categoryFromFeed(p)).not.toBe("Other")
  })
})
