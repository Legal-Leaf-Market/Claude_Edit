/**
 * "Iconic Rigs": a curated, well-documented list of players and the pedal
 * most associated with their sound, for the pedalboard builder's character
 * select. This is editorial gear history, the same kind of thing every gear
 * magazine and gear site publishes, not an endorsement or partnership claim,
 * and the page says so.
 *
 * `brand`/`model` are what gets searched against the live catalogue when a
 * shopper picks an icon (see components/pedalboard/icon-select.tsx). Most of
 * these will not currently match anything: the catalogue only carries what a
 * handful of live feeds actually stock, and none of the feeds live today
 * carry Ibanez, EHX, MXR, Boss, Dunlop or the rest of a legacy pedal brand's
 * catalogue. That is expected, not a bug, and the UI says so plainly rather
 * than pretending a match exists. As more feeds come online, matches appear
 * automatically since the lookup runs live, not from a snapshot taken now.
 */

export type IconEntry = {
  id: string
  name: string
  context: string
  brand: string
  model: string
  blurb: string
  /** Only set when a manufacturer's OWN official signature edition is well documented. */
  signatureNote?: string
  /** hsl() string for the character-select badge, spread evenly for visual variety. */
  hue: string
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const RAW: Omit<IconEntry, "hue">[] = [
  {
    id: "srv",
    name: "Stevie Ray Vaughan",
    context: "Blues",
    brand: "Ibanez",
    model: "Tube Screamer",
    blurb:
      "Ran it as a clean boost into a loud Fender amp, turning plain headroom into smooth, singing overdrive.",
  },
  {
    id: "morello",
    name: "Tom Morello",
    context: "Rage Against the Machine",
    brand: "DigiTech",
    model: "Whammy",
    blurb:
      "Pitch-shifted up to two octaves for the turntable-style scratches and siren solos on RATM records.",
  },
  {
    id: "evh",
    name: "Eddie Van Halen",
    context: "Van Halen",
    brand: "MXR",
    model: "Phase 90",
    blurb: "Left on a slow, subtle sweep to add chew and harmonic richness to the brown sound.",
    signatureNote: "MXR sells an official EVH signature Phase 90.",
  },
  {
    id: "shields",
    name: "Kevin Shields",
    context: "My Bloody Valentine",
    brand: "Fender",
    model: "Blender",
    blurb: "A harsh germanium octave fuzz that became a core ingredient in shoegaze's wall of sound.",
  },
  {
    id: "frusciante",
    name: "John Frusciante",
    context: "Red Hot Chili Peppers",
    brand: "Ibanez",
    model: "WH10",
    blurb: "A plastic-chassis wah with a huge sweep, all over the funk-rock solos on RHCP records.",
  },
  {
    id: "jackwhite",
    name: "Jack White",
    context: "The White Stripes",
    brand: "Electro-Harmonix",
    model: "Big Muff",
    blurb: "The USA reissue, driving the buzzing, sustain-heavy garage riffs on White Stripes records.",
  },
  {
    id: "rhoads",
    name: "Randy Rhoads",
    context: "Ozzy Osbourne",
    brand: "MXR",
    model: "Distortion+",
    blurb: "A simple hard-clipping stompbox into a cranked Marshall, tight enough for neoclassical metal.",
  },
  {
    id: "clapton",
    name: "Eric Clapton",
    context: "Cream",
    brand: "Vox",
    model: "V846",
    blurb: "Gave his Cream-era blues licks a vocal, crying quality, most famously on \"White Room.\"",
  },
  {
    id: "adamjones",
    name: "Adam Jones",
    context: "Tool",
    brand: "Heil Sound",
    model: "Talk Box",
    blurb: "Routes the guitar signal through a tube into his mouth to shape notes with his own vocal tract.",
  },
  {
    id: "bellamy",
    name: "Matt Bellamy",
    context: "Muse",
    brand: "Z.Vex",
    model: "Fuzz Factory",
    blurb: "An unstable, self-oscillating fuzz Bellamy mounted straight into the body of his Manson guitars.",
  },
  {
    id: "brianmay",
    name: "Brian May",
    context: "Queen",
    brand: "Dallas Rangemaster",
    model: "Treble Booster",
    blurb:
      "Cuts the bass and pushes a Vox AC30 into a rich, violin-like sustain. Endlessly cloned by boutique builders since.",
  },
  {
    id: "prince",
    name: "Prince",
    context: "Purple Rain era",
    brand: "Boss",
    model: "BF-2",
    blurb: "A staple on his Boss-heavy board, the metallic swirl behind his cleanest funk rhythm parts.",
  },
  {
    id: "trey",
    name: "Trey Anastasio",
    context: "Phish",
    brand: "Ibanez",
    model: "TS9",
    blurb: "Runs two of them back to back, stacking gain stages for the kind of sustain a Phish jam needs.",
  },
  {
    id: "omar",
    name: "Omar Rodriguez-Lopez",
    context: "The Mars Volta",
    brand: "Line 6",
    model: "DL4",
    blurb: "Used less for echo and mostly for reverse, half-speed looping, and glitch, building chaotic soundscapes.",
  },
  {
    id: "corgan",
    name: "Billy Corgan",
    context: "Smashing Pumpkins",
    brand: "Electro-Harmonix",
    model: "Op-Amp Big Muff",
    blurb: "The op-amp variant, not the transistor one, behind the buzzing, multi-tracked crunch on Siamese Dream.",
  },
  {
    id: "satriani",
    name: "Joe Satriani",
    context: "Solo",
    brand: "Boss",
    model: "DS-1",
    blurb: "His main gain source for decades, responsive and smooth enough for high-speed legato.",
  },
  {
    id: "trower",
    name: "Robin Trower",
    context: "Solo",
    brand: "Fulltone",
    model: "Deja Vibe",
    blurb: "A faithful modern take on the Uni-Vibe circuit, the dark, swirling tone behind his blues-rock.",
  },
  {
    id: "homme",
    name: "Josh Homme",
    context: "Queens of the Stone Age",
    brand: "Maestro",
    model: "Parameter EQ",
    blurb: "A vintage parametric filter boosting specific mid frequencies for that honky, desert-rock tone.",
  },
  {
    id: "greenwood",
    name: "Jonny Greenwood",
    context: "Radiohead",
    brand: "Marshall",
    model: "ShredMaster",
    blurb: "A 90s high-gain box behind the explosive guitar interruptions on \"Creep.\"",
  },
  {
    id: "slash",
    name: "Slash",
    context: "Guns N' Roses",
    brand: "Dunlop",
    model: "Cry Baby",
    blurb: "Deployed on nearly every iconic solo, most famously the vocal, climactic wah on \"Sweet Child O' Mine.\"",
  },
]

export const ICONS: IconEntry[] = RAW.map((entry, i) => ({
  ...entry,
  hue: `hsl(${Math.round((i * 360) / RAW.length)}, 68%, 58%)`,
}))

export function initialsFor(entry: IconEntry): string {
  return initialsOf(entry.name)
}
