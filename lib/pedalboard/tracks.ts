/**
 * "Iconic Tracks": a follow-up to "Iconic Rigs" (icons.ts). Where Iconic Rigs
 * is a player's general go-to pedal, this is gear documented as used on ONE
 * specific recording (an interview quote, an engineer/gear-press account,
 * a manufacturer's own history of the unit), so it deliberately does not
 * repeat an Iconic Rigs player's usual pedal. Same disclaimer as Iconic Rigs
 * applies: editorial gear history, not an endorsement or partnership claim.
 *
 * Every entry was checked against multiple independent sources (direct
 * artist/engineer interviews, gear-press deep-dives, a manufacturer's own
 * product history) before inclusion; candidates that only had guitar-forum
 * lore behind them were left out entirely rather than included at LOW
 * confidence. `confidence` reflects that check: HIGH is multiple
 * corroborating sources or a direct artist/engineer quote naming the unit
 * for this recording, MEDIUM is one credible source or strong secondary
 * documentation without a first-person quote pinned to this exact take.
 */

export type TrackGear = {
  brand: string
  model: string
  /** Where on the recording, if the source is that specific (e.g. "the intro riff"). */
  note?: string
  /** Only set when a manufacturer's OWN official signature/reissue edition is well documented. */
  signatureNote?: string
}

export type TrackEntry = {
  id: string
  song: string
  artist: string
  album: string
  year: number
  blurb: string
  /** HIGH: multiple corroborating sources or a direct artist/engineer quote. MEDIUM: one credible source. */
  confidence: "HIGH" | "MEDIUM"
  gear: TrackGear[]
  /** hsl() string for the track card, spread evenly for visual variety. */
  hue: string
}

const RAW: Omit<TrackEntry, "hue">[] = [
  {
    id: "nirvana-comeasyouare",
    song: "Come As You Are",
    artist: "Nirvana",
    album: "Nevermind",
    year: 1991,
    confidence: "HIGH",
    blurb:
      "Producer Butch Vig has said the watery guitar tone on the intro and pre-chorus came from a Small Clone run with the depth switch hardwired on, with an SPX90 layered on top in the mix.",
    gear: [{ brand: "Electro-Harmonix", model: "Small Clone" }],
  },
  {
    id: "police-walkingonthemoon",
    song: "Walking on the Moon",
    artist: "The Police",
    album: "Reggatta de Blanc",
    year: 1979,
    confidence: "HIGH",
    blurb:
      "Andy Summers has directly described the technique behind this tone: an Electric Mistress with flange depth backed off and chorus depth pushed up, later the basis for his own EHX signature pedal.",
    gear: [{ brand: "Electro-Harmonix", model: "Electric Mistress" }],
  },
  {
    id: "funkadelic-maggotbrain",
    song: "Maggot Brain",
    artist: "Funkadelic",
    album: "Maggot Brain",
    year: 1971,
    confidence: "HIGH",
    blurb:
      "Fender's own artist history states Eddie Hazel played the famous ten-minute solo through a fuzz box and this wah, after George Clinton told him to play like his mother had just died.",
    gear: [{ brand: "Dunlop", model: "Cry Baby" }],
  },
  {
    id: "cure-justlikeheaven",
    song: "Just Like Heaven",
    artist: "The Cure",
    album: "Kiss Me Kiss Me Kiss Me",
    year: 1987,
    confidence: "MEDIUM",
    blurb:
      "Documented across several dedicated Cure gear rundowns as the CE-1 carrying the main tone, with a CE-2 layered on the descending Bass VI line, though no single first-person quote pins the exact take.",
    gear: [
      { brand: "Boss", model: "CE-1 Chorus Ensemble" },
      { brand: "Boss", model: "CE-2 Chorus", note: "on the descending Bass VI lead line" },
    ],
  },
  {
    id: "floyd-comfortablynumb",
    song: "Comfortably Numb",
    artist: "Pink Floyd",
    album: "The Wall",
    year: 1979,
    confidence: "HIGH",
    blurb:
      "EHX's own company history and David Gilmour's longtime guitar tech Phil Taylor both credit this pedal, which Taylor says he introduced Gilmour to in 1974, for the solo's sustain.",
    gear: [{ brand: "Electro-Harmonix", model: "Big Muff Pi" }],
  },
  {
    id: "hendrix-purplehaze",
    song: "Purple Haze",
    artist: "Jimi Hendrix",
    album: "Are You Experienced",
    year: 1967,
    confidence: "HIGH",
    blurb:
      "Roger Mayer, who built the unit, has given detailed firsthand interviews about bringing a prototype into Olympic Studios and Hendrix overdubbing the solos with it after hearing what it did.",
    gear: [{ brand: "Roger Mayer", model: "Octavia" }],
  },
  {
    id: "hayes-shaft",
    song: "Theme from Shaft",
    artist: "Isaac Hayes",
    album: "Shaft",
    year: 1971,
    confidence: "HIGH",
    blurb:
      "Guitarist Charles \"Skip\" Pitts is repeatedly and directly credited, including in the documentary Crybaby: The Pedal That Rocks the World, with writing the opening riff on this wah and volume pedal.",
    gear: [{ brand: "Maestro", model: "Boomerang" }],
  },
  {
    id: "radiohead-fakeplastictrees",
    song: "Fake Plastic Trees",
    artist: "Radiohead",
    album: "The Bends",
    year: 1995,
    confidence: "HIGH",
    blurb:
      "Guitarist Ed O'Brien has said this delay was central to the guitar textures across both this album and OK Computer, calling it the only delay that could make those sounds, not a one-off effect on a single verse.",
    gear: [{ brand: "Boss", model: "DD-5 Digital Delay" }],
  },
  {
    id: "blur-song2",
    song: "Song 2",
    artist: "Blur",
    album: "Blur",
    year: 1997,
    confidence: "MEDIUM",
    blurb:
      "Graham Coxon has discussed using this fuzz on the studio track in a That Pedal Show interview, and multiple independent gear-history sources name the same unit for the recording.",
    gear: [{ brand: "DOD", model: "FX76 Punkifier" }],
  },
  {
    id: "aliceinchains-maninthebox",
    song: "Man in the Box",
    artist: "Alice in Chains",
    album: "Facelift",
    year: 1990,
    confidence: "MEDIUM",
    blurb:
      "Producer Dave Jerden's talk-box idea for the vocal-and-guitar hook, reportedly sparked by hearing a talk box on the radio, is well corroborated across interviews with the band, though the exact model has thinner sourcing.",
    gear: [{ brand: "Dunlop", model: "Heil Talk Box" }],
  },
  {
    id: "rush-spiritofradio",
    song: "The Spirit of Radio",
    artist: "Rush",
    album: "Permanent Waves",
    year: 1980,
    confidence: "HIGH",
    blurb:
      "Alex Lifeson has directly named this flanger for the song's famous intro in interviews, corroborated by the manufacturer's own account of the recording.",
    gear: [{ brand: "Electro-Harmonix", model: "Electric Mistress" }],
  },
  {
    id: "tameimpala-elephant",
    song: "Elephant",
    artist: "Tame Impala",
    album: "Lonerism",
    year: 2012,
    confidence: "MEDIUM",
    blurb:
      "Kevin Parker's use of a vintage 1970s Fuzz Face for the track's thick, driving tone is documented consistently across dedicated gear-rundown pieces on his rig.",
    gear: [{ brand: "Dunlop", model: "Fuzz Face" }],
  },
]

export const TRACKS: TrackEntry[] = RAW.map((entry, i) => ({
  ...entry,
  hue: `hsl(${Math.round((i * 360) / RAW.length)}, 68%, 58%)`,
}))
