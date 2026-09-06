import { describe, expect, it } from "vitest"
import {
  detectBrand,
  detectCategory,
  extractModel,
  gearSlug,
  parseGearFromTitle,
  slugify,
} from "@/lib/canonical/model-parse"

describe("detectBrand", () => {
  it("finds a brand anywhere in the title", () => {
    expect(detectBrand("Vintage 1978 Fender Stratocaster")).toBe("Fender")
    expect(detectBrand("MINT Boss DS-1 pedal")).toBe("Boss")
  })

  it("folds spelling variants onto one canonical brand", () => {
    expect(detectBrand("Squire Affinity Strat")).toBe("Squier")
    expect(detectBrand("EHX Big Muff Pi")).toBe("Electro-Harmonix")
    expect(detectBrand("PRS SE Custom 24")).toBe("Paul Reed Smith")
  })

  it("prefers the longest matching alias", () => {
    // "Music Man" must not be shortened, and "Ernie Ball Music Man" is the
    // same company under a longer name.
    expect(detectBrand("Ernie Ball Music Man StingRay")).toBe("Music Man")
  })

  it("respects word boundaries", () => {
    // A substring match would fire "Boss" on "Bossa" and "Dean" on "Deane".
    expect(detectBrand("Bossa nova songbook")).toBeNull()
    expect(detectBrand("Deanery hall organ")).toBeNull()
  })

  it("returns null rather than guessing on an unknown brand", () => {
    expect(detectBrand("Handmade luthier special guitar")).toBeNull()
  })
})

describe("detectCategory", () => {
  it("classifies the common shapes", () => {
    expect(detectCategory("Fender Player Stratocaster Electric Guitar")).toBe("Electric Guitars")
    expect(detectCategory("Martin D-28 Acoustic Guitar Dreadnought")).toBe("Acoustic Guitars")
    expect(detectCategory("Fender Precision Bass Guitar")).toBe("Bass Guitars")
    expect(detectCategory("Shure SM58 Dynamic Microphone")).toBe("Microphones")
    expect(detectCategory("Moog Subsequent 37 Analog Synth")).toBe("Synthesizers")
    expect(detectCategory("Zildjian A Custom 16 inch Crash Cymbal")).toBe("Drums & Percussion")
  })

  it("puts a bass amp under amplifiers, not bass guitars", () => {
    // Ordering matters: the amplifier pattern is checked before the bass one.
    expect(detectCategory("Ampeg SVT Classic Bass Amplifier Head")).toBe("Amplifiers")
  })

  it("recognises pedal names that can mean nothing else", () => {
    // Real Reverb titles. None of these say "pedal", and before these patterns
    // every one landed in "Other" and was therefore missing from
    // /used/effects-pedals entirely.
    expect(detectCategory("Ibanez TS9 Tube Screamer")).toBe("Effects Pedals")
    expect(detectCategory("Dunlop Cry Baby GCB95")).toBe("Effects Pedals")
    expect(detectCategory("Electro-Harmonix Big Muff Pi")).toBe("Effects Pedals")
    expect(detectCategory("Boss RC-500 Loop Station")).toBe("Effects Pedals")
    expect(detectCategory("Boss DS-1 Distortion")).toBe("Effects Pedals")
    expect(detectCategory("Xotic EP Booster")).toBe("Effects Pedals")
  })

  it("still refuses the titles that genuinely say nothing", () => {
    // The honest limit of a title parser, and the reason feed-category.ts
    // exists. There is no pattern that reads these as pedals without also
    // reading half the catalogue as pedals, so they stay "Other" here and are
    // classified from the merchant's own category instead.
    expect(detectCategory("Klon Centaur")).toBe("Other")
    expect(detectCategory("EarthQuaker Devices Plumes")).toBe("Other")
    expect(detectCategory("Wampler Tumnus Deluxe")).toBe("Other")
  })

  it("does not let a pedal word steal studio gear", () => {
    // "Compressor" is in no pedal pattern on purpose: it names a pedal and a
    // rack unit equally well, and stealing every outboard compressor to catch
    // one Keeley is the worse trade.
    expect(detectCategory("Universal Audio 1176LN Compressor")).toBe("Recording & Audio")
    expect(detectCategory("Focusrite Scarlett 2i2 Audio Interface")).toBe("Recording & Audio")
    // A distortion PEDAL is a pedal; a distortion-channel amp is still an amp,
    // because the amplifier pattern is checked first.
    expect(detectCategory("Marshall JCM800 Guitar Amplifier with distortion")).toBe("Amplifiers")
  })

  it("falls back to Other rather than guessing", () => {
    expect(detectCategory("Assorted studio bits")).toBe("Other")
  })
})

describe("extractModel", () => {
  it("drops the brand and keeps the model", () => {
    expect(extractModel("Fender Player Stratocaster Electric Guitar", "Fender")).toBe(
      "Player Stratocaster",
    )
  })

  it("strips condition, shipping and shouting", () => {
    expect(
      extractModel("Gibson Les Paul Standard MINT CONDITION FREE SHIPPING L@@K", "Gibson"),
    ).toBe("Les Paul Standard")
  })

  it("strips country-of-manufacture tags", () => {
    expect(extractModel("Fender Stratocaster MIJ Made In Japan", "Fender")).toBe("Stratocaster")
  })

  it("strips finish and colour words", () => {
    expect(extractModel("Gibson Les Paul Standard Tobacco Burst", "Gibson")).toBe(
      "Les Paul Standard",
    )
  })

  it("strips years", () => {
    // A year belongs to the listing, not to the canonical model row.
    expect(extractModel("1978 Fender Stratocaster", "Fender")).toBe("Stratocaster")
  })

  it("drops the bundle tail at the first stopword", () => {
    // "DS-1 Distortion" is the actual model name, so it stays; everything from
    // "with" onwards is what the seller threw in the box.
    expect(extractModel("Boss DS-1 Distortion with original box", "Boss")).toBe("DS-1 Distortion")
  })

  it("keeps alphanumeric model designators intact", () => {
    expect(extractModel("Shure SM58 Microphone", "Shure")).toBe("SM58")
    expect(extractModel("Roland Juno-106 Synthesizer", "Roland")).toBe("Juno-106")
  })

  it("returns empty when nothing model-like survives", () => {
    expect(extractModel("Fender Electric Guitar Used Free Shipping", "Fender")).toBe("")
  })

  it("returns empty for a title with no letters left", () => {
    expect(extractModel("Fender 12345 2020", "Fender")).toBe("")
  })
})

describe("parseGearFromTitle", () => {
  it("prefers the marketplace brand field over the title", () => {
    // The feed's own brand column beats anything we can read out of keyword soup.
    const parsed = parseGearFromTitle("Vintage Strat style guitar", "Fender")
    expect(parsed.brand).toBe("Fender")
  })

  it("falls back to the title when no brand field is supplied", () => {
    const parsed = parseGearFromTitle("Ibanez Tube Screamer TS9", null)
    expect(parsed.brand).toBe("Ibanez")
    expect(parsed.model).toBe("Tube Screamer TS9")
  })

  it("produces a category alongside brand and model", () => {
    const parsed = parseGearFromTitle("Yamaha P-125 Digital Piano", "Yamaha")
    expect(parsed.category).toBe("Keyboards & Pianos")
  })
})

describe("slugs", () => {
  it("slugifies punctuation and accents", () => {
    expect(slugify("Höfner 500/1 Violin Bass")).toBe("hofner-500-1-violin-bass")
    expect(slugify("D'Addario EXL110")).toBe("d-addario-exl110")
  })

  it("expands ampersands so two brands do not collide", () => {
    expect(slugify("Hughes & Kettner")).toBe("hughes-and-kettner")
  })

  it("builds a gear slug from brand and model", () => {
    expect(gearSlug("Fender", "Player Stratocaster")).toBe("fender-player-stratocaster")
  })

  it("never returns an empty slug", () => {
    expect(gearSlug("", "")).toBe("gear")
  })
})
