import type { EffectType } from "@/lib/pedalboard/chain"

/**
 * Documented artist rigs, and the records they were played on.
 *
 * WHAT THIS IS. Editorial gear history: the same thing every guitar magazine,
 * rig-rundown video and gear reference has published for fifty years. It is
 * assembled from interviews, rig rundowns, live photography and liner notes.
 * It is not an endorsement, a partnership, or a claim that anyone here is
 * associated with Gear Avail, and every page built from it says so.
 *
 * WHY IT IS HAND-WRITTEN RATHER THAN INGESTED. There is no legitimate feed for
 * this. Equipboard has by far the best database of it and added album- and
 * track-level attribution in February 2026, but they have no public API and
 * scraping them is exactly the conduct CLAUDE.md section 17 forbids for
 * Guitar Center and the Reverb API. MusicBrainz would cover the records half
 * legitimately, except its web service is free for non-commercial use only and
 * this site runs on affiliate revenue, so using it would need a commercial
 * plan first. Both remain open later; neither is a reason to ship nothing now.
 * So: curated, in-repo, small, and honest about being curated.
 *
 * HOW ACCURATE IT IS. Rigs change constantly, between tours and between takes,
 * and a board photographed in 1994 is evidence about 1994. Everything here is
 * scoped to a documented era and the pages say "documented on" rather than
 * "used", because in almost every case what is actually known is that a pedal
 * was on the board during the sessions or the tour, not that it is audible on
 * a specific bar of a specific take. Where a specific track is genuinely well
 * established (the Whammy on "Killing in the Name", the Uni-Vibe on "Bridge of
 * Sighs") it is listed under that record. Where it is not, the record is listed
 * without the track.
 *
 * `brand` and `model` are what gets matched against the live catalogue. Most
 * will not match anything today: the feeds that are live carry small
 * independent makers, not Boss, MXR, EHX or Ibanez back catalogue. That is
 * expected and the UI says so plainly rather than implying a match exists.
 */

export type RigPedal = {
  brand: string
  model: string
  type: EffectType
  /** What it is doing on this board, in one line. */
  role: string
  /** The one pedal most identified with this player. At most one per rig. */
  signature?: boolean
  /** Set when the unit is rack gear or an amp-top box rather than a floor pedal. */
  notPedal?: boolean
}

export type RigRecord = {
  title: string
  kind: "album" | "single" | "ep" | "live"
  year: number
  /** Tracks where the rig is best documented. Empty when only the sessions are documented. */
  tracks: string[]
  note?: string
}

export type Rig = {
  slug: string
  name: string
  /** Band or project, as a listener would name it. */
  context: string
  genre: string
  /** The era this board is documented from, which is not the artist's whole career. */
  era: string
  decade: "1960s" | "1970s" | "1980s" | "1990s" | "2000s"
  blurb: string
  pedals: RigPedal[]
  records: RigRecord[]
}

export const RIGS: Rig[] = [
  {
    slug: "jimi-hendrix",
    name: "Jimi Hendrix",
    context: "The Jimi Hendrix Experience",
    genre: "Psychedelic rock",
    era: "1966 to 1970",
    decade: "1960s",
    blurb:
      "Close to every effect a modern board takes for granted was, in 1967, four boxes Hendrix was using in public for the first time. The fuzz, the wah, the octave and the Uni-Vibe between them define what an electric guitar is allowed to sound like.",
    pedals: [
      {
        brand: "Dallas Arbiter",
        model: "Fuzz Face",
        type: "drive",
        role: "The core sound. Germanium early on, silicon later, and cleaning up almost entirely on the guitar's volume knob.",
        signature: true,
      },
      {
        brand: "Vox",
        model: "V846 Wah",
        type: "filter",
        role: "In front of the fuzz, where its sweep shapes what the fuzz gets rather than filtering the distortion after the fact.",
      },
      {
        brand: "Univox",
        model: "Uni-Vibe",
        type: "modulation",
        role: "A four-stage phase circuit built to fake a rotating speaker, which failed at that and became its own sound instead.",
      },
      {
        brand: "Roger Mayer",
        model: "Octavia",
        type: "pitch",
        role: "An octave-up fuzz built for him by Roger Mayer, and the ringing top end on the Purple Haze solo.",
      },
    ],
    records: [
      {
        title: "Are You Experienced",
        kind: "album",
        year: 1967,
        tracks: ["Purple Haze", "Foxy Lady", "Manic Depression"],
        note: "The Octavia arrives on the Purple Haze solo, which is the first time most listeners had heard an octave-up fuzz at all.",
      },
      {
        title: "Electric Ladyland",
        kind: "album",
        year: 1968,
        tracks: ["Voodoo Child (Slight Return)", "All Along the Watchtower"],
        note: "The wah on Voodoo Child is played as a rhythm instrument rather than a solo effect, which is most of why the intro is instantly recognisable.",
      },
      {
        title: "Band of Gypsys",
        kind: "live",
        year: 1970,
        tracks: ["Machine Gun"],
        note: "The Uni-Vibe is doing most of the work on Machine Gun.",
      },
    ],
  },

  {
    slug: "david-gilmour",
    name: "David Gilmour",
    context: "Pink Floyd",
    genre: "Progressive rock",
    era: "1971 to 1983",
    decade: "1970s",
    blurb:
      "The most copied board in the history of the instrument, and the one that proves ambience is a compositional choice rather than a coat of paint. Big Muff into a modulated, heavily delayed clean amp, with a compressor keeping every bent note singing.",
    pedals: [
      {
        brand: "Electro-Harmonix",
        model: "Big Muff Pi",
        type: "drive",
        role: "The lead voice. Thick, sustaining, and deliberately scooped, which is why it sits under a vocal instead of fighting it.",
        signature: true,
      },
      {
        brand: "MXR",
        model: "Dyna Comp",
        type: "compressor",
        role: "Evens out the picking so the long bends hold their level all the way through.",
      },
      {
        brand: "Electro-Harmonix",
        model: "Electric Mistress",
        type: "modulation",
        role: "A flanger run slow and shallow, adding movement without ever announcing itself as an effect.",
      },
      {
        brand: "Binson",
        model: "Echorec",
        type: "delay",
        role: "A magnetic-drum echo with multiple playback heads, and the reason the early repeats swirl rather than simply repeat.",
        notPedal: true,
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Used sparingly, mostly parked partway through the sweep as a fixed midrange filter.",
      },
    ],
    records: [
      {
        title: "The Dark Side of the Moon",
        kind: "album",
        year: 1973,
        tracks: ["Time", "Money"],
        note: "The Time solo is the Big Muff and the compressor doing exactly what they were put there for.",
      },
      {
        title: "Wish You Were Here",
        kind: "album",
        year: 1975,
        tracks: ["Shine On You Crazy Diamond"],
      },
      {
        title: "The Wall",
        kind: "album",
        year: 1979,
        tracks: ["Comfortably Numb", "Another Brick in the Wall, Part 2"],
        note: "Routinely voted the best guitar solo ever recorded, and it is four boxes and a lot of restraint.",
      },
    ],
  },

  {
    slug: "brian-may",
    name: "Brian May",
    context: "Queen",
    genre: "Rock",
    era: "1973 onward",
    decade: "1970s",
    blurb:
      "One treble booster, one AC30, and a guitar he built with his father out of a fireplace mantel. The whole orchestral guitar sound on those records comes from stacking that single voice, not from a big board.",
    pedals: [
      {
        brand: "Dallas",
        model: "Rangemaster Treble Booster",
        type: "drive",
        role: "Cuts the bass and slams the front of an AC30, which is what turns a naturally dark rig into that violin-like sustain.",
        signature: true,
      },
      {
        brand: "Foxx",
        model: "Foot Phaser",
        type: "modulation",
        role: "Occasional, and always subtle. The layered harmonies do most of the texturing work instead.",
      },
      {
        brand: "Echoplex",
        model: "EP-3",
        type: "delay",
        role: "Tape echo used for the timed, canon-style repeats rather than for ambience.",
        notPedal: true,
      },
    ],
    records: [
      {
        title: "Queen II",
        kind: "album",
        year: 1974,
        tracks: ["Father to Son", "The March of the Black Queen"],
      },
      {
        title: "A Night at the Opera",
        kind: "album",
        year: 1975,
        tracks: ["Bohemian Rhapsody", "Good Company"],
        note: "The Bohemian Rhapsody solo is one guitar and one booster, tracked to sound like several.",
      },
      {
        title: "News of the World",
        kind: "album",
        year: 1977,
        tracks: ["We Will Rock You"],
      },
    ],
  },

  {
    slug: "robin-trower",
    name: "Robin Trower",
    context: "Solo",
    genre: "Blues rock",
    era: "1973 to 1976",
    decade: "1970s",
    blurb:
      "The clearest demonstration on record of what a Uni-Vibe actually does. Trower runs it slow and deep under a fuzz, so the whole tone breathes rather than pulsing, and the songs are written around the effect rather than decorated by it.",
    pedals: [
      {
        brand: "Univox",
        model: "Uni-Vibe",
        type: "modulation",
        role: "Slow and deep, and effectively a permanent part of the tone rather than something switched on for a section.",
        signature: true,
      },
      {
        brand: "Dallas Arbiter",
        model: "Fuzz Face",
        type: "drive",
        role: "In front of the Uni-Vibe, so the modulation moves an already saturated signal.",
      },
      {
        brand: "Fulltone",
        model: "Deja Vibe",
        type: "modulation",
        role: "The modern rebuild of the same circuit, and what he has toured with since the originals became unmaintainable.",
      },
    ],
    records: [
      {
        title: "Bridge of Sighs",
        kind: "album",
        year: 1974,
        tracks: ["Bridge of Sighs", "Day of the Eagle", "Too Rolling Stoned"],
        note: "The title track is the reference recording for Uni-Vibe tone, full stop.",
      },
      {
        title: "For Earth Below",
        kind: "album",
        year: 1975,
        tracks: [],
      },
    ],
  },

  {
    slug: "eric-clapton",
    name: "Eric Clapton",
    context: "Cream",
    genre: "Blues rock",
    era: "1966 to 1968",
    decade: "1960s",
    blurb:
      "The Cream-era rig is almost nothing: a Les Paul, a cranked Marshall, and a wah used as a vocal effect rather than a funk rhythm tool. That restraint is exactly why the tone still gets chased.",
    pedals: [
      {
        brand: "Vox",
        model: "V846 Wah",
        type: "filter",
        role: "Played slowly and expressively, closer to a singer's phrasing than to a rhythmic effect.",
        signature: true,
      },
      {
        brand: "Dallas",
        model: "Rangemaster Treble Booster",
        type: "drive",
        role: "From the Bluesbreakers period, pushing the amp rather than generating distortion itself.",
      },
    ],
    records: [
      {
        title: "Disraeli Gears",
        kind: "album",
        year: 1967,
        tracks: ["Sunshine of Your Love", "Tales of Brave Ulysses"],
        note: "Tales of Brave Ulysses is one of the first widely heard wah performances on a rock record.",
      },
      {
        title: "Wheels of Fire",
        kind: "album",
        year: 1968,
        tracks: ["White Room"],
      },
    ],
  },

  {
    slug: "stevie-ray-vaughan",
    name: "Stevie Ray Vaughan",
    context: "Double Trouble",
    genre: "Blues",
    era: "1983 to 1990",
    decade: "1980s",
    blurb:
      "The definitive argument that an overdrive pedal is a volume control, not a distortion box. The Tube Screamer is barely breaking up on its own; it is there to hit an already loud Fender hard enough to make the amp do the work.",
    pedals: [
      {
        brand: "Ibanez",
        model: "TS808 Tube Screamer",
        type: "drive",
        role: "Level up, drive down. A clean boost into a loud amp, which is the opposite of how most people set one.",
        signature: true,
      },
      {
        brand: "Vox",
        model: "V846 Wah",
        type: "filter",
        role: "Front of the chain, used hard and rhythmically.",
      },
      {
        brand: "Univox",
        model: "Uni-Vibe",
        type: "modulation",
        role: "For the Hendrix material, and it never really left the board afterwards.",
      },
      {
        brand: "Tycobrahe",
        model: "Octavia",
        type: "pitch",
        role: "Octave-up fuzz, used in short bursts at the top of a solo.",
      },
    ],
    records: [
      {
        title: "Texas Flood",
        kind: "album",
        year: 1983,
        tracks: ["Pride and Joy", "Texas Flood", "Love Struck Baby"],
      },
      {
        title: "Couldn't Stand the Weather",
        kind: "album",
        year: 1984,
        tracks: ["Voodoo Child (Slight Return)", "Cold Shot", "Scuttle Buttin'"],
      },
      {
        title: "In Step",
        kind: "album",
        year: 1989,
        tracks: ["Crossfire", "Tightrope"],
      },
    ],
  },

  {
    slug: "eddie-van-halen",
    name: "Eddie Van Halen",
    context: "Van Halen",
    genre: "Hard rock",
    era: "1978 to 1984",
    decade: "1980s",
    blurb:
      "The brown sound is mostly a Marshall run through a Variac and a guitar he assembled himself, but the board is what people actually hear as the signature: a phaser sitting slow underneath everything and a flanger doing the descending sweep on Unchained.",
    pedals: [
      {
        brand: "MXR",
        model: "Phase 90",
        type: "modulation",
        role: "Left on, slow, and shallow. It adds chew and a moving midrange rather than an obvious swoosh.",
        signature: true,
      },
      {
        brand: "MXR",
        model: "Flanger",
        type: "modulation",
        role: "Set for the deep, slow sweep on Unchained and Ain't Talkin' 'bout Love.",
      },
      {
        brand: "Echoplex",
        model: "EP-3",
        type: "delay",
        role: "Used as much for the preamp colouration as for the echo itself.",
        notPedal: true,
      },
      {
        brand: "Univox",
        model: "EC-80 Echo",
        type: "delay",
        role: "The short slapback behind the Eruption tapping section.",
      },
    ],
    records: [
      {
        title: "Van Halen",
        kind: "album",
        year: 1978,
        tracks: ["Eruption", "Ain't Talkin' 'bout Love", "Runnin' with the Devil"],
        note: "MXR sells an official EVH signature Phase 90 built to this setting.",
      },
      {
        title: "Van Halen II",
        kind: "album",
        year: 1979,
        tracks: ["Dance the Night Away", "Spanish Fly"],
      },
      {
        title: "1984",
        kind: "album",
        year: 1984,
        tracks: ["Panama", "Hot for Teacher"],
      },
    ],
  },

  {
    slug: "randy-rhoads",
    name: "Randy Rhoads",
    context: "Ozzy Osbourne",
    genre: "Heavy metal",
    era: "1980 to 1982",
    decade: "1980s",
    blurb:
      "Classical phrasing over a cranked Marshall, and a board built for precision rather than texture. The Distortion+ tightens the amp instead of adding gain to it, which is what keeps the fast neoclassical runs articulate.",
    pedals: [
      {
        brand: "MXR",
        model: "Distortion+",
        type: "drive",
        role: "Simple hard clipping into an already loud Marshall, tight enough for the fast passages to stay separate.",
        signature: true,
      },
      {
        brand: "MXR",
        model: "Stereo Chorus",
        type: "modulation",
        role: "The wide, glassy cleans on the quieter sections.",
      },
      {
        brand: "MXR",
        model: "10-Band EQ",
        type: "eq",
        role: "A midrange lift for solos, which is a volume boost that also cuts through the mix.",
      },
      {
        brand: "Roland",
        model: "RE-201 Space Echo",
        type: "delay",
        role: "Tape echo for the long, atmospheric intros.",
        notPedal: true,
      },
    ],
    records: [
      {
        title: "Blizzard of Ozz",
        kind: "album",
        year: 1980,
        tracks: ["Crazy Train", "Mr. Crowley", "Revelation (Mother Earth)"],
      },
      {
        title: "Diary of a Madman",
        kind: "album",
        year: 1981,
        tracks: ["Over the Mountain", "Flying High Again"],
      },
    ],
  },

  {
    slug: "the-edge",
    name: "The Edge",
    context: "U2",
    genre: "Post-punk",
    era: "1983 onward",
    decade: "1980s",
    blurb:
      "The most influential use of delay by anyone, and the clearest case of an effect being part of the composition. The dotted-eighth repeat is not decoration on the Where the Streets Have No Name riff, it is half the notes in it.",
    pedals: [
      {
        brand: "Korg",
        model: "SDD-3000",
        type: "delay",
        role: "The rack delay behind the timed, rhythmic repeats, and its preamp is as much of the sound as the delay line.",
        signature: true,
        notPedal: true,
      },
      {
        brand: "Electro-Harmonix",
        model: "Deluxe Memory Man",
        type: "delay",
        role: "The warmer, modulated analogue repeats on the earlier records.",
      },
      {
        brand: "Boss",
        model: "CE-2 Chorus",
        type: "modulation",
        role: "Widening the clean tone so the delayed repeats sit in a bigger space.",
      },
      {
        brand: "Ibanez",
        model: "TS9 Tube Screamer",
        type: "drive",
        role: "A push into the amp rather than a distortion, keeping the chime intact.",
      },
    ],
    records: [
      {
        title: "War",
        kind: "album",
        year: 1983,
        tracks: ["Sunday Bloody Sunday", "New Year's Day"],
      },
      {
        title: "The Unforgettable Fire",
        kind: "album",
        year: 1984,
        tracks: ["Pride (In the Name of Love)", "Bad"],
      },
      {
        title: "The Joshua Tree",
        kind: "album",
        year: 1987,
        tracks: ["Where the Streets Have No Name", "With or Without You"],
        note: "The intro riff is a dotted-eighth delay locked to the tempo, which is why it cannot be played convincingly without one.",
      },
    ],
  },

  {
    slug: "prince",
    name: "Prince",
    context: "The Revolution",
    genre: "Funk rock",
    era: "1982 to 1987",
    decade: "1980s",
    blurb:
      "A Boss-heavy board used with unusual discipline. The flanger is on almost every clean rhythm part, which is what gives those records their metallic shimmer, and the distortion only appears when a solo needs it.",
    pedals: [
      {
        brand: "Boss",
        model: "BF-2 Flanger",
        type: "modulation",
        role: "The metallic swirl behind the clean funk rhythm parts, and the most identifiable single texture on the board.",
        signature: true,
      },
      {
        brand: "Boss",
        model: "DS-1 Distortion",
        type: "drive",
        role: "Solo gain, switched in rather than left on.",
      },
      {
        brand: "Boss",
        model: "CE-2 Chorus",
        type: "modulation",
        role: "For the wider, softer clean parts where the flanger would be too obvious.",
      },
      {
        brand: "Boss",
        model: "DD-2 Digital Delay",
        type: "delay",
        role: "Short, clean repeats, mixed low.",
      },
    ],
    records: [
      {
        title: "1999",
        kind: "album",
        year: 1982,
        tracks: ["Little Red Corvette", "1999"],
      },
      {
        title: "Purple Rain",
        kind: "album",
        year: 1984,
        tracks: ["Purple Rain", "When Doves Cry", "Let's Go Crazy"],
      },
      {
        title: "Sign o' the Times",
        kind: "album",
        year: 1987,
        tracks: ["Sign o' the Times", "U Got the Look"],
      },
    ],
  },

  {
    slug: "slash",
    name: "Slash",
    context: "Guns N' Roses",
    genre: "Hard rock",
    era: "1987 to 1993",
    decade: "1980s",
    blurb:
      "A Les Paul into a Marshall with almost nothing in between, which is the point. The wah is the only effect most listeners could name, and it is used as punctuation rather than as a texture.",
    pedals: [
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "On nearly every famous solo, played as a phrasing tool rather than swept continuously.",
        signature: true,
      },
      {
        brand: "MXR",
        model: "M134 Stereo Chorus",
        type: "modulation",
        role: "Widening the cleans on the ballads.",
      },
      {
        brand: "Boss",
        model: "DD-3 Digital Delay",
        type: "delay",
        role: "A short repeat behind solos, low enough that most listeners hear it as room rather than echo.",
      },
      {
        brand: "Boss",
        model: "GE-7 Equalizer",
        type: "eq",
        role: "A midrange push for solo boosts.",
      },
    ],
    records: [
      {
        title: "Appetite for Destruction",
        kind: "album",
        year: 1987,
        tracks: ["Sweet Child O' Mine", "Welcome to the Jungle", "Paradise City"],
      },
      {
        title: "Use Your Illusion I",
        kind: "album",
        year: 1991,
        tracks: ["November Rain"],
      },
    ],
  },

  {
    slug: "joe-satriani",
    name: "Joe Satriani",
    context: "Solo",
    genre: "Instrumental rock",
    era: "1987 onward",
    decade: "1980s",
    blurb:
      "Proof that a cheap orange distortion pedal is a legitimate main gain source. The DS-1 has been on the board for decades, and the smoothness people credit to expensive gear is mostly the compressor and the playing.",
    pedals: [
      {
        brand: "Boss",
        model: "DS-1 Distortion",
        type: "drive",
        role: "The primary gain for decades, responsive enough to hold up under fast legato.",
        signature: true,
      },
      {
        brand: "Boss",
        model: "CH-1 Super Chorus",
        type: "modulation",
        role: "Widening the lead tone so a single-tracked line sounds arranged.",
      },
      {
        brand: "Boss",
        model: "DD-2 Digital Delay",
        type: "delay",
        role: "Timed repeats behind the melodies, which are usually the second voice in the arrangement.",
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Often parked rather than swept, as a fixed midrange filter.",
      },
    ],
    records: [
      {
        title: "Surfing with the Alien",
        kind: "album",
        year: 1987,
        tracks: ["Surfing with the Alien", "Always with Me, Always with You", "Satch Boogie"],
      },
      {
        title: "Flying in a Blue Dream",
        kind: "album",
        year: 1989,
        tracks: ["Flying in a Blue Dream", "The Forgotten Part Two"],
      },
    ],
  },

  {
    slug: "kevin-shields",
    name: "Kevin Shields",
    context: "My Bloody Valentine",
    genre: "Shoegaze",
    era: "1988 to 1991",
    decade: "1990s",
    blurb:
      "The famous glide guitar is mostly a tremolo arm held while strumming, not a pedal, and being honest about that matters: no board will reproduce Loveless. What the board does supply is the harsh octave fuzz and the reverse reverb the arm is smeared across.",
    pedals: [
      {
        brand: "Fender",
        model: "Blender",
        type: "drive",
        role: "A harsh germanium octave fuzz, and the single most recognisable ingredient in the wall of sound.",
        signature: true,
      },
      {
        brand: "Yamaha",
        model: "SPX90",
        type: "reverb",
        role: "Reverse reverb and pitch shifting, which is where the backwards, seasick quality comes from.",
        notPedal: true,
      },
      {
        brand: "Ibanez",
        model: "TS9 Tube Screamer",
        type: "drive",
        role: "Stacked in front of the amp to thicken the rhythm layers before they are multi-tracked.",
      },
    ],
    records: [
      {
        title: "Isn't Anything",
        kind: "album",
        year: 1988,
        tracks: ["Feed Me With Your Kiss", "Soft as Snow (But Warm Inside)"],
      },
      {
        title: "Loveless",
        kind: "album",
        year: 1991,
        tracks: ["Only Shallow", "When You Sleep", "Soon"],
        note: "Most of what sounds like an effect here is the tremolo arm moved by hand during the strum, then layered.",
      },
    ],
  },

  {
    slug: "billy-corgan",
    name: "Billy Corgan",
    context: "The Smashing Pumpkins",
    genre: "Alternative rock",
    era: "1991 to 1996",
    decade: "1990s",
    blurb:
      "The Siamese Dream guitar sound is dozens of tracks of the same Big Muff, and specifically the op-amp version rather than the transistor one. Which variant of a Muff you have changes the record you can make with it, which is a good argument for reading the model line before buying.",
    pedals: [
      {
        brand: "Electro-Harmonix",
        model: "Op-Amp Big Muff",
        type: "drive",
        role: "The buzzing, brittle crunch that got multi-tracked into a wall. The op-amp variant, not the transistor one.",
        signature: true,
      },
      {
        brand: "Boss",
        model: "CE-2 Chorus",
        type: "modulation",
        role: "The watery cleans on the quiet sections, which is the whole dynamic those songs are built on.",
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Occasional, and usually parked.",
      },
    ],
    records: [
      {
        title: "Siamese Dream",
        kind: "album",
        year: 1993,
        tracks: ["Cherub Rock", "Today", "Rocket"],
      },
      {
        title: "Mellon Collie and the Infinite Sadness",
        kind: "album",
        year: 1995,
        tracks: ["Bullet with Butterfly Wings", "Zero", "1979"],
      },
    ],
  },

  {
    slug: "tom-morello",
    name: "Tom Morello",
    context: "Rage Against the Machine",
    genre: "Rap metal",
    era: "1992 to 2000",
    decade: "1990s",
    blurb:
      "A deliberately small board used in ways nobody intended. The Whammy set to two octaves up is a scratch effect and a siren rather than a pitch shifter, and the toggle-switch stutter needs no pedal at all.",
    pedals: [
      {
        brand: "DigiTech",
        model: "Whammy",
        type: "pitch",
        role: "Set to two octaves up, and played as a turntable rather than as a harmoniser.",
        signature: true,
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Usually parked in one position as a fixed filter, then swept hard for the solos.",
      },
      {
        brand: "Boss",
        model: "DD-3 Digital Delay",
        type: "delay",
        role: "Long repeats used as a rhythmic layer, most obviously on the Bulls on Parade intro.",
      },
      {
        brand: "MXR",
        model: "Phase 90",
        type: "modulation",
        role: "Adding movement to the clean, dry rhythm parts.",
      },
      {
        brand: "Ibanez",
        model: "DFL Flanger",
        type: "modulation",
        role: "The jet-engine sweeps on the noisier breakdowns.",
      },
    ],
    records: [
      {
        title: "Rage Against the Machine",
        kind: "album",
        year: 1992,
        tracks: ["Killing in the Name", "Bombtrack", "Bullet in the Head"],
      },
      {
        title: "Evil Empire",
        kind: "album",
        year: 1996,
        tracks: ["Bulls on Parade", "People of the Sun"],
        note: "The Bulls on Parade solo is the Whammy plus the pickup selector, and no conventional technique at all.",
      },
      {
        title: "The Battle of Los Angeles",
        kind: "album",
        year: 1999,
        tracks: ["Guerrilla Radio", "Sleep Now in the Fire"],
      },
    ],
  },

  {
    slug: "john-frusciante",
    name: "John Frusciante",
    context: "Red Hot Chili Peppers",
    genre: "Funk rock",
    era: "1991 to 2006",
    decade: "1990s",
    blurb:
      "A board organised around a wah with an unusually wide sweep and a chorus with a genuinely strange voicing. The clean parts are as effected as the loud ones, which is why the quiet sections never sound thin.",
    pedals: [
      {
        brand: "Ibanez",
        model: "WH10 Wah",
        type: "filter",
        role: "A plastic-chassis wah with a much wider sweep than a Cry Baby, and the sound of the funk solos.",
        signature: true,
      },
      {
        brand: "Boss",
        model: "DS-2 Turbo Distortion",
        type: "drive",
        role: "The aggressive mode for the loud choruses.",
      },
      {
        brand: "Electro-Harmonix",
        model: "Big Muff",
        type: "drive",
        role: "Thicker, more sustaining gain where the DS-2 would be too sharp.",
      },
      {
        brand: "Boss",
        model: "CE-1 Chorus Ensemble",
        type: "modulation",
        role: "The wide, slightly detuned cleans on the verses, and a large part of why they sit so far back in the mix.",
      },
    ],
    records: [
      {
        title: "Blood Sugar Sex Magik",
        kind: "album",
        year: 1991,
        tracks: ["Give It Away", "Under the Bridge", "Suck My Kiss"],
      },
      {
        title: "Californication",
        kind: "album",
        year: 1999,
        tracks: ["Scar Tissue", "Around the World", "Californication"],
      },
      {
        title: "By the Way",
        kind: "album",
        year: 2002,
        tracks: ["By the Way", "Can't Stop"],
      },
    ],
  },

  {
    slug: "jonny-greenwood",
    name: "Jonny Greenwood",
    context: "Radiohead",
    genre: "Alternative rock",
    era: "1993 to 2001",
    decade: "1990s",
    blurb:
      "A board built for interruption rather than for tone. The ShredMaster is on for a few bars at a time and off the rest, and the Whammy is used for texture and noise rather than for playing melodies.",
    pedals: [
      {
        brand: "Marshall",
        model: "ShredMaster",
        type: "drive",
        role: "A 90s high-gain box kicked in for the explosive sections and off again immediately.",
        signature: true,
      },
      {
        brand: "DigiTech",
        model: "Whammy",
        type: "pitch",
        role: "Used for noise, dive bombs and octave textures rather than as a harmoniser.",
      },
      {
        brand: "Demeter",
        model: "Tremulator",
        type: "modulation",
        role: "The stuttering tremolo on the quieter, more mechanical parts.",
      },
      {
        brand: "Electro-Harmonix",
        model: "Small Stone",
        type: "modulation",
        role: "A phaser used wide and slow, closer to a warble than a sweep.",
      },
    ],
    records: [
      {
        title: "Pablo Honey",
        kind: "album",
        year: 1993,
        tracks: ["Creep"],
        note: "The three dead-stop chugs before the chorus are the ShredMaster arriving and nothing else.",
      },
      {
        title: "The Bends",
        kind: "album",
        year: 1995,
        tracks: ["Just", "My Iron Lung", "Planet Telex"],
      },
      {
        title: "OK Computer",
        kind: "album",
        year: 1997,
        tracks: ["Paranoid Android", "Airbag", "Let Down"],
      },
    ],
  },

  {
    slug: "adam-jones",
    name: "Adam Jones",
    context: "Tool",
    genre: "Progressive metal",
    era: "1993 onward",
    decade: "1990s",
    blurb:
      "A board with one genuinely unusual box on it. The talk box routes the guitar through a tube into his mouth, so the vowel shapes come from his own vocal tract rather than from a filter circuit trying to imitate one.",
    pedals: [
      {
        brand: "Heil Sound",
        model: "Talk Box",
        type: "utility",
        role: "Guitar signal into a tube held in the mouth, shaped by his own vowels and picked up by a vocal mic.",
        signature: true,
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Slow and deliberate, usually under a riff rather than over a solo.",
      },
      {
        brand: "Boss",
        model: "DD-3 Digital Delay",
        type: "delay",
        role: "Long, precisely timed repeats that lock to the odd time signatures.",
      },
      {
        brand: "MXR",
        model: "Phase 90",
        type: "modulation",
        role: "Slow movement under the sustained, droning sections.",
      },
    ],
    records: [
      {
        title: "Undertow",
        kind: "album",
        year: 1993,
        tracks: ["Sober", "Prison Sex"],
      },
      {
        title: "Ænima",
        kind: "album",
        year: 1996,
        tracks: ["Stinkfist", "Forty Six & 2", "Ænema"],
      },
      {
        title: "Lateralus",
        kind: "album",
        year: 2001,
        tracks: ["Schism", "Parabola"],
      },
    ],
  },

  {
    slug: "trey-anastasio",
    name: "Trey Anastasio",
    context: "Phish",
    genre: "Jam rock",
    era: "1994 onward",
    decade: "1990s",
    blurb:
      "Two Tube Screamers back to back, which sounds like a mistake and is not. Stacking two moderate gain stages gives far more sustain and far less fizz than turning one of them up, and a jam band needs notes that hold.",
    pedals: [
      {
        brand: "Ibanez",
        model: "TS9 Tube Screamer",
        type: "drive",
        role: "Two of them in series, each set moderately, which is how the sustain gets that long without turning to mush.",
        signature: true,
      },
      {
        brand: "Ross",
        model: "Compressor",
        type: "compressor",
        role: "In front of the drives, evening out the picking over very long improvised passages.",
      },
      {
        brand: "Boss",
        model: "BF-2 Flanger",
        type: "modulation",
        role: "Wide sweeps on the more psychedelic sections.",
      },
      {
        brand: "Line 6",
        model: "DL4",
        type: "delay",
        role: "Looping and reverse, used to build a bed and then play over it.",
      },
    ],
    records: [
      {
        title: "A Live One",
        kind: "live",
        year: 1995,
        tracks: ["You Enjoy Myself", "Tweezer"],
      },
      {
        title: "Billy Breathes",
        kind: "album",
        year: 1996,
        tracks: ["Free", "Character Zero"],
      },
    ],
  },

  {
    slug: "jack-white",
    name: "Jack White",
    context: "The White Stripes",
    genre: "Garage rock",
    era: "2001 to 2007",
    decade: "2000s",
    blurb:
      "A board chosen for constraint. Cheap guitar, one huge fuzz, and an octave-down pedal doing the job a bass player would otherwise do, which is how two people made records that sound like four.",
    pedals: [
      {
        brand: "Electro-Harmonix",
        model: "Big Muff Pi",
        type: "drive",
        role: "The USA reissue, and effectively the band's second instrument.",
        signature: true,
      },
      {
        brand: "DigiTech",
        model: "Whammy WH-4",
        type: "pitch",
        role: "Set an octave down for the Seven Nation Army riff, which is a guitar and not a bass.",
      },
      {
        brand: "MXR",
        model: "Micro Amp",
        type: "drive",
        role: "A clean volume lift into the amp for solos.",
      },
      {
        brand: "Boss",
        model: "TU-2 Tuner",
        type: "tuner",
        role: "Front of the chain, and the mute for the dead stops.",
      },
    ],
    records: [
      {
        title: "White Blood Cells",
        kind: "album",
        year: 2001,
        tracks: ["Fell in Love with a Girl", "Dead Leaves and the Dirty Ground"],
      },
      {
        title: "Elephant",
        kind: "album",
        year: 2003,
        tracks: ["Seven Nation Army", "Ball and Biscuit"],
        note: "The Seven Nation Army riff is a semi-acoustic through the Whammy set an octave down. There is no bass on the record.",
      },
    ],
  },

  {
    slug: "matt-bellamy",
    name: "Matt Bellamy",
    context: "Muse",
    genre: "Alternative rock",
    era: "2001 onward",
    decade: "2000s",
    blurb:
      "The Fuzz Factory is mounted inside the guitar body, which turns an unstable, barely controllable fuzz into a playable instrument: the knobs are under his hand while he is still holding a chord.",
    pedals: [
      {
        brand: "Z.Vex",
        model: "Fuzz Factory",
        type: "drive",
        role: "Self-oscillating and deliberately unstable, and mounted into the guitar so the squeals can be steered live.",
        signature: true,
      },
      {
        brand: "DigiTech",
        model: "Whammy",
        type: "pitch",
        role: "Octave dives and the ascending runs on the bigger riffs.",
      },
      {
        brand: "Electro-Harmonix",
        model: "Micro Synth",
        type: "utility",
        role: "Synth-style filter sweeps from a guitar, which is most of why those records sound electronic.",
      },
      {
        brand: "Boss",
        model: "DD-3 Digital Delay",
        type: "delay",
        role: "Timed repeats under the arpeggiated sections.",
      },
    ],
    records: [
      {
        title: "Origin of Symmetry",
        kind: "album",
        year: 2001,
        tracks: ["Plug In Baby", "New Born", "Bliss"],
      },
      {
        title: "Absolution",
        kind: "album",
        year: 2003,
        tracks: ["Hysteria", "Stockholm Syndrome"],
      },
      {
        title: "Black Holes and Revelations",
        kind: "album",
        year: 2006,
        tracks: ["Knights of Cydonia", "Supermassive Black Hole"],
      },
    ],
  },

  {
    slug: "josh-homme",
    name: "Josh Homme",
    context: "Queens of the Stone Age",
    genre: "Desert rock",
    era: "2000 onward",
    decade: "2000s",
    blurb:
      "A midrange-forward board that ignores the usual advice to scoop the mids out of a heavy tone. Boosting a narrow band instead of cutting one is what gives those riffs their honk, and it is why they cut through on a small speaker.",
    pedals: [
      {
        brand: "Maestro",
        model: "Parametric Filter",
        type: "eq",
        role: "A vintage parametric boosting one narrow midrange band, which is the honky, nasal core of the sound.",
        signature: true,
      },
      {
        brand: "ProCo",
        model: "Rat",
        type: "drive",
        role: "Hard, gritty gain with plenty of midrange left in it.",
      },
      {
        brand: "MXR",
        model: "Micro Amp",
        type: "drive",
        role: "A clean push to make the amp work harder without changing its voicing.",
      },
      {
        brand: "Boss",
        model: "DD-3 Digital Delay",
        type: "delay",
        role: "Short slapback on the cleaner passages.",
      },
    ],
    records: [
      {
        title: "Rated R",
        kind: "album",
        year: 2000,
        tracks: ["The Lost Art of Keeping a Secret", "Feel Good Hit of the Summer"],
      },
      {
        title: "Songs for the Deaf",
        kind: "album",
        year: 2002,
        tracks: ["No One Knows", "Go with the Flow", "First It Giveth"],
      },
    ],
  },

  {
    slug: "omar-rodriguez-lopez",
    name: "Omar Rodríguez-López",
    context: "The Mars Volta",
    genre: "Progressive rock",
    era: "2003 onward",
    decade: "2000s",
    blurb:
      "A delay pedal used as a sound-design tool rather than an echo. Half-speed, reverse and looping are the point; the actual repeats are almost incidental, and most of what you hear is the pedal being abused in real time.",
    pedals: [
      {
        brand: "Line 6",
        model: "DL4",
        type: "delay",
        role: "Reverse, half-speed and looping, switched mid-phrase so the result is unrepeatable.",
        signature: true,
      },
      {
        brand: "Electro-Harmonix",
        model: "Micro Synth",
        type: "utility",
        role: "Filter sweeps and synth textures over the top of the chaos.",
      },
      {
        brand: "MXR",
        model: "Phase 90",
        type: "modulation",
        role: "Movement under the long, droning passages.",
      },
      {
        brand: "Dunlop",
        model: "Cry Baby",
        type: "filter",
        role: "Swept hard and fast, often into the loop rather than in front of it.",
      },
    ],
    records: [
      {
        title: "De-Loused in the Comatorium",
        kind: "album",
        year: 2003,
        tracks: ["Inertiatic ESP", "Roulette Dares (The Haunt Of)"],
      },
      {
        title: "Frances the Mute",
        kind: "album",
        year: 2005,
        tracks: ["L'Via L'Viaquez", "The Widow"],
      },
    ],
  },
]
