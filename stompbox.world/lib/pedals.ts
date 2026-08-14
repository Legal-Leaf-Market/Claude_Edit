import type { SlotId } from "./chain"
import type { FigureShape } from "./figures"

/**
 * The pedal dataset. Hand written, and deliberately so.
 *
 * WHY IT IS HAND WRITTEN. There is no feed for this. The gear-attribution
 * sites that hold the best databases publish no API, and scraping one is the
 * conduct this project will not do. So the file is small, checked, and grows
 * by someone reading rather than by a job running.
 *
 * WHAT IS DELIBERATELY ABSENT: ARTIST CREDITS. Every pedal here has a famous
 * name attached to it in somebody's memory, and that is exactly the problem. A
 * rig changes between tours and between takes, so "this pedal is on that
 * record" is a claim that needs a source, and a wrong credit published beside
 * a circuit description reads as fact. Attribution belongs in a dataset with
 * real sourcing behind it, not as a decorative field here. What this file
 * claims instead is what the circuit does, which is checkable by anyone
 * holding one.
 *
 * DATES ARE DECADE LEVEL ON PURPOSE. Production runs, prototypes, revisions
 * and re-issues all disagree about what year a pedal "is", and a precise year
 * printed here would be a false precision that nothing in this repo can back
 * up. "Late 1960s" is a claim this file can stand behind.
 */

export type Family = "Drive" | "Fuzz" | "Dynamics" | "Filter" | "Modulation" | "Time"

export type Pedal = {
  slug: string
  name: string
  maker: string
  family: Family
  /** Where it belongs in the signal chain. See lib/chain.ts. */
  slot: SlotId
  /**
   * Which drawn figure illustrates this circuit (lib/figures.ts).
   *
   * CHOSEN BY READING `circuit` BELOW, NOT BY FAMILY. Family is too coarse and
   * this dataset is the proof: a Tube Screamer and a RAT are both Drive, and
   * their own entries say one rounds the peaks inside a feedback loop while the
   * other shears them off against ground. Drawing them identically would
   * contradict the text printed directly under the picture.
   *
   * So it is filled the way every other field here is filled, by somebody
   * reading the entry, and a test asserts every pedal has one.
   */
  shape: FigureShape
  /** Decade level. Never a precise year, see the note above. */
  era: string
  /** One line, used on cards and in the meta description. */
  summary: string
  /** What the circuit is actually doing to the signal. */
  circuit: string
  /** What you can hear, described so it can be checked against the pedal. */
  listenFor: string
  controls: string[]
  /**
   * Buffered bypass. Matters because a buffer anywhere ahead of a pedal with
   * `wantsGuitarDirect` changes what that pedal hears.
   */
  buffered?: boolean
  /**
   * Low input impedance: it is designed to load the guitar's pickups directly
   * and behaves differently when anything is driving it.
   */
  wantsGuitarDirect?: boolean
  /** Digital circuits generally want more current than analog ones. */
  digital?: boolean
}

export const PEDALS: Pedal[] = [
  {
    slug: "tube-screamer",
    name: "Tube Screamer",
    maker: "Ibanez",
    family: "Drive",
    slot: "drive",
    shape: "soft-clip",
    era: "Late 1970s",
    summary: "Soft clipping and a midrange lift, built to push an amp that is already working.",
    circuit:
      "A pair of silicon diodes sits inside the feedback loop of an op-amp gain stage, so the signal is rounded off gradually rather than squared. A high-pass filter ahead of that stage keeps bass out of the clipping, and the recovery stage lifts a band in the 700 to 900 Hz region.",
    listenFor:
      "The low end staying tight while everything else thickens, and a pronounced middle that pushes a note forward in a mix. With the drive low and the level high it barely distorts on its own: it is making the amp do the work.",
    controls: ["Drive", "Tone", "Level"],
  },
  {
    slug: "rat",
    name: "RAT",
    maker: "ProCo",
    family: "Drive",
    slot: "drive",
    shape: "hard-clip",
    era: "Around the turn of the 1980s",
    summary: "Hard clipping to ground, and a tone control that runs backwards.",
    circuit:
      "An op-amp gain stage with a very large available gain, followed by silicon diodes clipping to ground. Clipping after the stage rather than inside its feedback loop squares the waveform off far more abruptly than a Tube Screamer does.",
    listenFor:
      "A flatter, harder edge than a soft-clipping drive, and a lot more gain on tap at the top of the dial. The Filter control is a reversed tone: turning it up rolls treble off, which catches out everyone who meets one for the first time.",
    controls: ["Distortion", "Filter", "Volume"],
  },
  {
    slug: "ds-1",
    name: "DS-1",
    maker: "Boss",
    family: "Drive",
    slot: "drive",
    shape: "hard-clip",
    era: "Late 1970s",
    summary: "A transistor boost into hard clipping, bright and unsubtle.",
    circuit:
      "A transistor gain stage feeds an op-amp stage, and the result is clipped hard to ground by diodes. The tone control is a single sweep between a dark low-pass and a bright high-pass rather than a stack, which is why the two ends sound so different from each other.",
    listenFor:
      "A brighter and more brittle edge than most drives, with a scooped quality in the middle of the tone sweep. It sounds thin on its own into a clean amp and comes alive in front of one that is already breaking up.",
    controls: ["Tone", "Level", "Dist"],
  },
  {
    slug: "klon-centaur",
    name: "Centaur",
    maker: "Klon",
    family: "Drive",
    slot: "drive",
    shape: "headroom",
    era: "Mid 1990s",
    summary: "A drive with headroom, because it runs its rails well above the battery.",
    circuit:
      "An internal charge pump takes the 9V supply and generates a much higher internal voltage for the circuit to swing against, so the stage clips because it is asked to rather than because it ran out of room. The clean signal is blended back in alongside the driven one rather than replaced by it.",
    listenFor:
      "The amp's own character surviving underneath the gain, and a treble lift that opens the top end rather than adding fizz. Because the blend keeps a clean path, the note attack stays intact where a fully clipped drive would smear it.",
    controls: ["Gain", "Treble", "Output"],
    buffered: true,
  },
  {
    slug: "fuzz-face",
    name: "Fuzz Face",
    maker: "Dallas Arbiter",
    family: "Fuzz",
    slot: "fuzz",
    shape: "asymmetric-fuzz",
    era: "Mid 1960s",
    summary: "Two transistors that want to be plugged straight into the guitar.",
    circuit:
      "Two transistors in a directly coupled pair, germanium in the earliest versions and silicon later. The input impedance is very low by modern standards, which means the circuit loads the guitar's pickups rather than politely reading them, and that loading is part of the sound.",
    listenFor:
      "How much it changes when you roll the guitar volume down: it should thin out and clean up almost to the point of being a boost. If it does not do that, something ahead of it is driving it. See the chain notes on buffers.",
    controls: ["Volume", "Fuzz"],
    wantsGuitarDirect: true,
  },
  {
    slug: "big-muff",
    name: "Big Muff Pi",
    maker: "Electro-Harmonix",
    family: "Fuzz",
    slot: "fuzz",
    shape: "stacked-clip",
    era: "Late 1960s",
    summary: "Two cascaded clipping stages and a tone stack that scoops the middle.",
    circuit:
      "Four transistor stages: an input buffer, two identical clipping stages with diodes in their feedback loops, then a tone stack and a recovery stage. The tone stack blends between a low-pass and a high-pass, so the middle of the control's travel takes the midrange out rather than leaving it flat.",
    listenFor:
      "Very long sustain and a wall-like thickness, with a hole in the middle of the frequency range. That hole is why it can sound enormous alone and then vanish underneath a band, and why players so often set the tone away from the centre.",
    controls: ["Volume", "Tone", "Sustain"],
  },
  {
    slug: "octavia",
    name: "Octavia",
    maker: "Roger Mayer",
    family: "Fuzz",
    slot: "fuzz",
    shape: "octave-fold",
    era: "Late 1960s",
    summary: "A fuzz with a ringing octave above the note, produced by rectification.",
    circuit:
      "A fuzz stage feeds a transformer and a full-wave rectifier, which folds the negative half of the waveform up onto the positive half. Folding the wave that way doubles its frequency, so an octave above the played note appears out of the signal itself rather than from a pitch tracker.",
    listenFor:
      "A clear bell-like octave on single notes high on the neck, and complete chaos on chords. The chaos is not a fault: the rectifier has no way to separate two notes, so intervals turn into clangorous noise, which is what the pedal is for.",
    controls: ["Volume", "Drive"],
    wantsGuitarDirect: true,
  },
  {
    slug: "cry-baby",
    name: "Cry Baby",
    maker: "Dunlop",
    family: "Filter",
    slot: "filter",
    shape: "resonant-sweep",
    era: "Late 1960s",
    summary: "An inductor-based bandpass filter with the treadle sweeping its centre.",
    circuit:
      "An inductor and a variable resistor form a resonant bandpass filter. Rocking the treadle moves the centre frequency across roughly the 400 Hz to 2 kHz range, with enough resonance at the peak that the filter is heard as a shape rather than as an EQ change.",
    listenFor:
      "A vowel sound, because that sweep is close to what a mouth does to a formant. Left parked at one position it stops being an effect and becomes a fixed midrange voice, which is the less obvious half of what it is good for.",
    controls: ["Treadle"],
  },
  {
    slug: "dyna-comp",
    name: "Dyna Comp",
    maker: "MXR",
    family: "Dynamics",
    slot: "dynamics",
    shape: "envelope",
    era: "Mid 1970s",
    summary: "An OTA compressor that flattens the attack and pushes the tail up.",
    circuit:
      "An operational transconductance amplifier whose gain is driven by a detector watching the signal's own level. Loud passages are turned down and the quiet tail of a note is turned up, so the dynamic range is squeezed into a narrower band.",
    listenFor:
      "Notes that all arrive at the same volume however hard you pick, and a tail that hangs on longer than it should. Turn it up far enough and you can hear the gain moving between notes, along with the noise floor rising with it.",
    controls: ["Output", "Sensitivity"],
  },
  {
    slug: "phase-90",
    name: "Phase 90",
    maker: "MXR",
    family: "Modulation",
    slot: "modulation",
    shape: "phase-notch",
    era: "Mid 1970s",
    summary: "Four all-pass stages sweeping two notches, and exactly one knob.",
    circuit:
      "Four all-pass filter stages shift phase without changing level, and the shifted signal is summed back with the dry one. Where the two cancel, a notch appears, and four stages give two of them. A low-frequency oscillator moves the stages, so the notches sweep.",
    listenFor:
      "A narrow, dry swirl rather than a liquid one, because there is no resonance feeding back into the sweep. One control means it is voiced rather than adjustable, which is a large part of why it is so recognisable.",
    controls: ["Speed"],
  },
  {
    slug: "small-stone",
    name: "Small Stone",
    maker: "Electro-Harmonix",
    family: "Modulation",
    slot: "modulation",
    shape: "phase-notch",
    era: "Mid 1970s",
    summary: "A phaser with a resonance switch, wider and more vocal than a plain sweep.",
    circuit:
      "The same all-pass and summing arrangement as any phaser, with a Color switch that feeds part of the output back into the filter chain. That feedback sharpens the notches, so the cancellation is deeper and the sweep is heard as a moving peak as much as a moving hole.",
    listenFor:
      "With Color off, a broad and watery movement. With it on, something much more pronounced and nasal that draws attention to itself. The difference between the two settings is larger than the difference between most phasers.",
    controls: ["Rate", "Color switch"],
  },
  {
    slug: "uni-vibe",
    name: "Uni-Vibe",
    maker: "Univox",
    family: "Modulation",
    slot: "modulation",
    shape: "phase-notch",
    era: "Late 1960s",
    summary: "A lamp and photocells driving four deliberately mismatched phase stages.",
    circuit:
      "Four phase-shift stages, but the parts are not matched to each other and the modulation comes from an incandescent lamp shining on photocells rather than from a clean oscillator. The lamp's own thermal lag makes the sweep uneven, so it is neither a symmetrical phaser nor an even tremolo.",
    listenFor:
      "A throb that is heavier on one side of its cycle than the other. It was built to imitate a rotating speaker cabinet and does not really manage it, and failing at that is precisely how it became its own sound.",
    controls: ["Speed", "Intensity", "Chorus and vibrato switch"],
  },
  {
    slug: "ce-1",
    name: "CE-1 Chorus Ensemble",
    maker: "Boss",
    family: "Modulation",
    slot: "modulation",
    shape: "wandering-delay",
    era: "Mid 1970s",
    summary: "The chorus circuit out of a Roland amplifier, put on the floor.",
    circuit:
      "A bucket-brigade delay line, modulated by a low-frequency oscillator so the delay time wanders, mixed back against the untouched dry signal. A moving delay is a moving pitch, so what you hear is the wobbling copy beating against the steady original.",
    listenFor:
      "Two of you, slightly out of tune with each other, rather than an effect sitting on top of one of you. The vibrato mode drops the dry signal entirely, at which point the pitch movement stops being a shimmer and becomes the whole sound.",
    controls: ["Intensity", "Rate", "Depth", "Chorus and vibrato switch"],
  },
  {
    slug: "deluxe-memory-man",
    name: "Deluxe Memory Man",
    maker: "Electro-Harmonix",
    family: "Time",
    slot: "delay",
    shape: "decaying-repeats",
    era: "Late 1970s",
    summary: "Bucket-brigade delay whose repeats get darker every time round.",
    circuit:
      "The signal is handed along a chain of capacitors, one step per clock tick, which is what stores it. Every step loses a little high end and adds a little noise, so each repeat comes back darker and softer than the one before it. A modulation stage wobbles the delay time as well.",
    listenFor:
      "Repeats that sink into the background instead of stacking up in front of you, which is why a long analog delay stays usable under a busy part. Change the delay time while it is running and the pitch of whatever is still in the line slides.",
    controls: ["Blend", "Feedback", "Delay", "Chorus and vibrato"],
  },
  {
    slug: "dd-2",
    name: "DD-2",
    maker: "Boss",
    family: "Time",
    slot: "delay",
    shape: "identical-repeats",
    era: "Early 1980s",
    summary: "The first compact digital delay: repeats that keep their treble.",
    circuit:
      "The signal is sampled, stored as numbers and played back unchanged. Nothing in the storage path removes high end, so the tenth repeat carries the same frequency content as the first, which is the exact opposite of what a bucket-brigade line does.",
    listenFor:
      "Repeats that stay bright and stay present, right up until they run out of level. That clarity is a virtue for rhythmic parts and a liability under a busy mix, which is the whole reason people keep an analog delay as well.",
    controls: ["Effect level", "Feedback", "Delay time", "Mode"],
    digital: true,
  },
]

export const PEDAL_BY_SLUG: Record<string, Pedal> = Object.fromEntries(
  PEDALS.map((pedal) => [pedal.slug, pedal]),
)

export function pedalBySlug(slug: string): Pedal | undefined {
  return PEDAL_BY_SLUG[slug]
}

/** Display order for the directory, grouped the way a board is laid out. */
export const FAMILY_ORDER: Family[] = [
  "Filter",
  "Dynamics",
  "Fuzz",
  "Drive",
  "Modulation",
  "Time",
]

export function pedalsByFamily(): { family: Family; pedals: Pedal[] }[] {
  return FAMILY_ORDER.map((family) => ({
    family,
    pedals: PEDALS.filter((pedal) => pedal.family === family),
  })).filter((group) => group.pedals.length > 0)
}
