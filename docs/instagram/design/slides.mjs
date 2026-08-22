/**
 * Every slide of every post, as data.
 *
 * The prose here is the same prose as the matching entry in ../posts.md, which
 * is a duplication and therefore a place two files can drift apart. That is
 * what tests/instagram-slides.test.ts is for: it asserts that every post id in
 * posts.md exists here, that the counts agree with each "Format:" line, and
 * that no post is described in one file and missing from the other. The same
 * instinct as the condition classifier existing three times in the sister
 * project and a test pinning them together.
 *
 * SLIDE KINDS
 *   mark       The mark, and one line. Used once, for the manifesto.
 *   statement  A hook, vertically centred, nothing else. Stops a scroll.
 *   mechanism  Kicker, then body. What the circuit does, no figure needed.
 *   figure     Kicker, a diagram, then body. The format that carries this account.
 *   compare    Two labelled panes. For "these are two different things".
 *   order      The numbered chain, optionally with one slot lit.
 *   closer     The takeaway. LED kicker, short line, and it ends the carousel.
 */

import * as d from "./diagrams.mjs"

/** The chain, from lib/chain.ts. Guitar and amp are ends rather than pedals. */
export const CHAIN = [
  { name: "Guitar", end: true },
  { name: "Tuner" },
  { name: "Wah and filter" },
  { name: "Compressor" },
  { name: "Fuzz" },
  { name: "Overdrive and distortion" },
  { name: "EQ and boost" },
  { name: "Noise gate" },
  { name: "Volume pedal" },
  { name: "Modulation" },
  { name: "Delay" },
  { name: "Reverb" },
  { name: "Amp", end: true },
]

export const POSTS = [
  {
    id: "01",
    title: "The circuit, not the adjective",
    slides: [{ kind: "mark", hook: "The circuit, not the adjective." }],
  },

  {
    id: "02",
    title: "Two drives, two different circuits",
    slides: [
      { kind: "statement", hook: "Both are called overdrive. They are not the same circuit." },
      {
        kind: "figure",
        kicker: "Soft clipping",
        fig: () => d.clipping("soft"),
        body: "Diodes sit inside the op-amp's feedback loop, so the signal is rounded off gradually rather than squared. A high-pass filter ahead of the stage keeps bass out of the clipping.",
      },
      {
        kind: "figure",
        kicker: "Hard clipping",
        fig: () => d.clipping("hard"),
        body: "A stage with a very large available gain, then diodes clipping to ground after it. Clipping after the stage rather than inside its feedback loop squares the waveform off far more abruptly.",
      },
      {
        kind: "compare",
        kicker: "What to listen for",
        panes: [
          { label: "Soft", body: "The low end staying tight while everything else thickens, and a pronounced middle that pushes the note forward." },
          { label: "Hard", body: "A flatter, harder edge, and a great deal more gain available at the top of the dial." },
        ],
      },
    ],
  },

  {
    id: "03",
    title: "The knob that runs backwards",
    slides: [
      { kind: "statement", hook: "Turn this one up and the treble goes away." },
      {
        kind: "figure",
        kicker: "A reversed tone control",
        fig: () => d.reversedKnob(),
        body: "The RAT's Filter is wired backwards. Every other tone knob on your board does the opposite.",
      },
      { kind: "closer", hook: "So a RAT on 10 across the board is the darkest it gets, not the brightest." },
    ],
  },

  {
    id: "04",
    title: "The order, and the reason for every position",
    slides: [
      { kind: "order", kicker: "In signal order", lit: null },
      {
        kind: "figure",
        kicker: "Wah early",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Wah", lit: true }, { name: "Drive" }, { name: "Amp", end: true }]),
        body: "So it shapes the plain guitar, and the drive after it responds to that shape. Put a wah after a distortion and the sweep sounds flatter, because the distortion already flattened the dynamics the filter would have moved through.",
      },
      {
        kind: "figure",
        kicker: "Drive before delay",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Drive", lit: true }, { name: "Delay" }, { name: "Amp", end: true }]),
        body: "Distorting a signal and then delaying it keeps the repeats clean. Delaying a signal and then distorting it drives the repeats and the dry note together into one smear.",
      },
      {
        kind: "figure",
        kicker: "Gate after the gain",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Drive", noise: 15 }, { name: "Gate", lit: true }, { name: "Amp", end: true }]),
        body: "Because the gain is what made the noise. A gate in front of a high-gain drive closes on a quiet signal and then hands the silence to something with enormous gain, which amplifies the hiss it was meant to remove.",
      },
      {
        kind: "figure",
        kicker: "Reverb last",
        fig: () => d.room(false),
        body: "Because it is the room. A delay into a reverb puts each repeat in the same space. A reverb into a delay repeats the room itself, which does not happen acoustically.",
      },
      { kind: "closer", hook: "A convention, not a law. Every position has a reason, and a reason is a thing you can argue with." },
    ],
  },

  {
    id: "05",
    title: "A buffer in front of a fuzz",
    slides: [
      { kind: "statement", hook: "Your fuzz sounds thin and will not clean up. Check what is in front of it." },
      {
        kind: "mechanism",
        kicker: "Very low input impedance",
        body: "A vintage-style fuzz is built to load your pickups directly rather than politely read them, and that loading is part of the sound.",
        body2: "Put anything with a buffered output ahead of it and the fuzz is hearing the buffer instead of the guitar. A buffer runs whether the pedal is engaged or not.",
      },
      {
        kind: "figure",
        kicker: "The test",
        fig: () => d.guitarVolume(),
        body: "If it stays thick and even when you roll back, something ahead of it is driving it.",
      },
      {
        kind: "figure",
        kicker: "The fix",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Fuzz", lit: true }, { name: "Buffered drive" }, { name: "Delay" }, { name: "Amp", end: true }], { caption: "fuzz first, and the interaction survives" }),
        body: "Keeping the fuzz first is what preserves it.",
      },
    ],
  },

  {
    id: "06",
    title: "Why a Big Muff disappears under a band",
    slides: [
      { kind: "statement", hook: "It sounds enormous alone and vanishes with the band. That is the tone stack." },
      {
        kind: "figure",
        kicker: "A scoop, not a flat middle",
        fig: () => d.midScoop(),
        body: "The tone stack blends between a low-pass and a high-pass, so the middle of the control's travel takes the midrange out rather than leaving it flat.",
      },
      {
        kind: "mechanism",
        kicker: "Why that matters",
        body: "Alone, you hear the size. In a mix, you hear the hole, because the hole is exactly where everything else already is.",
        body2: "The sustain and the wall-like thickness come from two cascaded clipping stages, each with diodes in its feedback loop. Those are not the part that vanishes.",
      },
      { kind: "closer", hook: "Which is why so many players set the Tone well off centre and never go back." },
    ],
  },

  {
    id: "07",
    title: "Two delays, and the repeats tell you which",
    slides: [
      { kind: "statement", hook: "Analog and digital delay are not two qualities of the same thing." },
      {
        kind: "figure",
        kicker: "Bucket brigade",
        fig: () => d.repeats(true),
        body: "The signal is handed along a chain of capacitors, one step per clock tick. Every step loses a little high end, so each repeat comes back darker than the one before it.",
      },
      {
        kind: "figure",
        kicker: "Digital",
        fig: () => d.repeats(false),
        body: "The signal is sampled, stored as numbers and played back unchanged. Nothing in the storage path removes high end.",
      },
      { kind: "closer", hook: "One sinks into the background. One stays in front of you. Which is why boards carry both." },
    ],
  },

  {
    id: "08",
    title: "A drive with room to swing",
    slides: [
      { kind: "statement", hook: "It runs on 9V and clips against a great deal more than 9V." },
      {
        kind: "figure",
        kicker: "The charge pump",
        fig: () => d.rails(),
        body: "An internal charge pump generates a much higher voltage for the circuit to swing against, so the stage clips because it is asked to rather than because it ran out of room.",
      },
      {
        kind: "mechanism",
        kicker: "And the blend",
        body: "The clean signal is kept alongside the driven one rather than replaced by it, so the note attack stays intact where a fully clipped drive would smear it.",
        body2: "Running out of room is what most of the harshness in a cheap drive actually is.",
      },
      { kind: "closer", hook: "Note for the rest of your board: it has a buffered output. See the fuzz post." },
    ],
  },

  {
    id: "09",
    title: "What this account will not tell you",
    slides: [
      { kind: "statement", hook: "Three things you will never read here." },
      {
        kind: "mechanism",
        kicker: "Who used it",
        body: "A rig changes between tours and between takes, so a pedal being on a record is a claim that needs a source.",
        body2: "A wrong credit printed beside a circuit description gets read as a fact about the circuit.",
      },
      {
        kind: "mechanism",
        kicker: "The exact year",
        body: "Prototypes, production runs, revisions and reissues all disagree about what year a pedal is.",
        body2: "So: late 1960s, mid 1970s. Decade level, every time.",
      },
      {
        kind: "mechanism",
        kicker: "A figure we have not measured",
        body: "The honest current draw is the one printed on your own pedal.",
        body2: "A number typed from memory into a spec-shaped slot is worse than no number, because it looks like a measurement.",
      },
    ],
  },

  {
    id: "10",
    title: "An octave out of the waveform itself",
    slides: [
      { kind: "statement", hook: "No pitch tracker. No octave circuit. The octave comes out of the wave." },
      {
        kind: "figure",
        kicker: "Full-wave rectification",
        fig: () => d.rectify(),
        body: "A fuzz stage feeds a transformer and a rectifier, which folds the negative half of the waveform up onto the positive half. Fold a wave that way and you have doubled its frequency.",
      },
      {
        kind: "mechanism",
        kicker: "And why chords fall apart",
        body: "A clear bell-like octave on a single note high on the neck, and clangorous noise on a chord.",
        body2: "The rectifier has no way to separate two notes, so it folds the whole mess at once. The chaos is not a fault, it is what the pedal is for.",
      },
      { kind: "closer", hook: "Also worth knowing: it wants the guitar direct, like a Fuzz Face." },
    ],
  },

  {
    id: "11",
    title: "A wah that is not moving",
    slides: [
      { kind: "statement", hook: "Stop rocking it. Park it." },
      {
        kind: "figure",
        kicker: "A resonant bandpass",
        fig: () => d.bandpassSweep(),
        body: "An inductor and a variable resistor make the filter. The treadle moves its centre, with enough resonance at the peak to be heard as a shape rather than an EQ change.",
      },
      { kind: "closer", hook: "It sounds like a voice because that sweep is close to what a mouth does to a formant." },
    ],
  },

  {
    id: "12",
    title: "Drive then delay, or delay then drive",
    slides: [
      { kind: "statement", hook: "Drive into delay, or delay into drive. Both work. They are not the same." },
      {
        kind: "compareChain",
        kicker: "What changes",
        chains: {
          a: { label: "Drive first", blocks: [{ name: "Guitar", end: true }, { name: "Drive", lit: true }, { name: "Delay" }, { name: "Amp", end: true }], caption: "repeats stay separate and clean" },
          b: { label: "Delay first", blocks: [{ name: "Guitar", end: true }, { name: "Delay" }, { name: "Drive", lit: true }, { name: "Amp", end: true }], caption: "the note and its repeats clip together" },
        },
      },
      { kind: "closer", hook: "The convention is drive first. The other way is a real sound that records use on purpose." },
    ],
  },

  {
    id: "13",
    title: "One knob, because it is voiced",
    slides: [
      { kind: "statement", hook: "Four filter stages. Two notches. One knob." },
      {
        kind: "figure",
        kicker: "Cancellation, not a sweep",
        fig: () => d.notches(false),
        body: "Four all-pass stages shift phase without changing level, and the shifted signal is summed back with the dry one. Where the two cancel, a notch appears. Four stages give two of them.",
      },
      {
        kind: "figure",
        kicker: "And one control",
        fig: () => d.knobRow([{ at: 12, name: "SPEED", lit: true }]),
        body: "A low-frequency oscillator moves the stages, so the notches sweep. Nothing feeds back into that sweep, which is why it is a narrow dry swirl rather than a liquid one.",
      },
      { kind: "closer", hook: "A pedal with six controls has a thousand voices and no signature. This one has a signature." },
    ],
  },

  {
    id: "14",
    title: "Two phasers, one switch between them",
    slides: [
      { kind: "statement", hook: "The same arrangement as any phaser. One switch changes what it is." },
      {
        kind: "mechanism",
        kicker: "The Color switch",
        body: "It feeds part of the output back into the filter chain.",
        body2: "Feedback sharpens the notches, so the cancellation goes deeper and you hear a moving peak as much as a moving hole.",
      },
      {
        kind: "figure",
        kicker: "What that does",
        fig: () => d.notches(true),
        body: "Off, broad and watery. On, pronounced and nasal, the sort of sound that draws attention to itself rather than sitting under a mix.",
      },
      { kind: "closer", hook: "A bigger difference than the one between most phasers. One feedback path." },
    ],
  },

  {
    id: "15",
    title: "The pedal that failed and became a sound",
    slides: [
      { kind: "statement", hook: "It was built to imitate a rotating speaker cabinet. It does not manage it." },
      {
        kind: "figure",
        kicker: "A lamp, not an oscillator",
        fig: () => d.lampVibe(),
        body: "Four phase-shift stages whose parts are not matched to each other, modulated by an incandescent lamp shining on photocells.",
      },
      {
        kind: "mechanism",
        kicker: "Why it is uneven",
        body: "A lamp has thermal lag. It does not brighten and dim the instant the drive signal says to.",
        body2: "So it is neither a symmetrical phaser nor an even tremolo, and you hear a throb heavier on one side of its cycle than the other.",
      },
      { kind: "closer", hook: "Failing at the imitation is the entire reason anybody wants one." },
    ],
  },

  {
    id: "16",
    title: "Chorus and vibrato are one circuit with the dry signal removed",
    slides: [
      { kind: "statement", hook: "Chorus and vibrato are the same circuit. One of them keeps the dry signal." },
      {
        kind: "figure",
        kicker: "Chorus",
        fig: () => d.mixer(false),
        body: "A bucket-brigade delay line, modulated so the delay time wanders, mixed back against the untouched dry signal. A moving delay is a moving pitch.",
      },
      {
        kind: "figure",
        kicker: "Vibrato",
        fig: () => d.mixer(true),
        body: "The switch does not add a circuit. It removes the dry signal, and the pitch movement stops being a shimmer and becomes the whole sound.",
      },
      { kind: "closer", hook: "Two of you slightly out of tune, or one of you moving. That is the only difference." },
    ],
  },

  {
    id: "17",
    title: "It sounds thin because you are testing it wrong",
    slides: [
      { kind: "statement", hook: "Every DS-1 verdict was formed in a shop, into a clean amp, on its own." },
      {
        kind: "mechanism",
        kicker: "The circuit",
        body: "A transistor gain stage into an op-amp stage, clipped hard to ground by diodes. Bright and unsubtle, and honest about it.",
        body2: "It sounds thin into a clean amp and comes alive in front of one that is already breaking up. Those are two different tests.",
      },
      {
        kind: "figure",
        kicker: "One control, two filters",
        fig: () => d.toneSweep(),
        body: "The tone control is a single sweep between a dark low-pass and a bright high-pass rather than a stack, which is why the two ends sound so unlike each other.",
      },
      { kind: "closer", hook: "Try it both ways before you sell it." },
    ],
  },

  {
    id: "18",
    title: "Drive down, level up",
    slides: [
      {
        kind: "figure",
        kicker: "The setting it is actually for",
        fig: () => d.knobRow([{ at: 8, name: "DRIVE", lit: true }, { at: 12, name: "TONE" }, { at: 4, name: "LEVEL", lit: true }]),
        body: "Drive nearly off, Level well up. Like that it barely distorts on its own.",
      },
      {
        kind: "mechanism",
        kicker: "What it contributes",
        body: "A level increase and a shape. A high-pass sits ahead of the clipping so bass stays out of it, and the recovery stage lifts a band around 700 to 900 Hz.",
        body2: "Tight low end, pronounced middle, and the note pushed forward rather than made bigger in every direction.",
      },
      { kind: "closer", hook: "Into a clean amp it sounds like almost nothing. Into an amp on the edge it is the whole point." },
    ],
  },

  {
    id: "19",
    title: "Your gate is amplifying the hiss",
    slides: [
      { kind: "statement", hook: "A noise gate in front of your high-gain drive is making the problem worse." },
      {
        kind: "compareChain",
        kicker: "Where the noise comes from",
        chains: {
          a: { label: "Gate first", blocks: [{ name: "Guitar", end: true }, { name: "Gate", lit: true }, { name: "Drive", noise: 16 }, { name: "Amp", end: true }], caption: "gating a signal that is not noisy yet" },
          b: { label: "Gate after", blocks: [{ name: "Guitar", end: true }, { name: "Drive", noise: 16 }, { name: "Gate", lit: true }, { name: "Amp", end: true }], caption: "gating the thing that made the noise" },
        },
      },
      { kind: "closer", hook: "It is one cable, and fewer boards get it right than you would expect." },
    ],
  },

  {
    id: "20",
    title: "It turns the loud part down and the tail up",
    slides: [
      { kind: "statement", hook: "A compressor is not a volume control. It is a volume control that watches you." },
      {
        kind: "mechanism",
        kicker: "An OTA and a detector",
        body: "An operational transconductance amplifier whose gain is driven by a detector watching the signal's own level.",
        body2: "Loud gets turned down, quiet gets turned up, and the range between them narrows.",
      },
      {
        kind: "figure",
        kicker: "What you hear",
        fig: () => d.envelope(),
        body: "Notes that all arrive at the same volume however hard you pick, and a tail that hangs on longer than the string is really giving you.",
      },
      { kind: "closer", hook: "It lifts whatever is quiet, and it cannot tell a decaying note from hiss." },
    ],
  },

  {
    id: "21",
    title: "Where the compressor goes is a real choice",
    slides: [
      { kind: "statement", hook: "Compressor before the gain, or after it. Boards genuinely do both." },
      {
        kind: "compareChain",
        kicker: "Neither is wrong",
        chains: {
          a: { label: "Before", blocks: [{ name: "Guitar", end: true }, { name: "Comp", lit: true }, { name: "Drive" }, { name: "Amp", end: true }], caption: "same response to a light touch and a hard one" },
          b: { label: "After", blocks: [{ name: "Guitar", end: true }, { name: "Drive" }, { name: "Comp", lit: true }, { name: "Amp", end: true }], caption: "the drive responds to your picking, then gets squeezed" },
        },
      },
      { kind: "closer", hook: "A reason lets you decide. A rule only lets you comply." },
    ],
  },

  {
    id: "22",
    title: "A volume pedal is three different pedals",
    slides: [
      { kind: "statement", hook: "Same pedal. Three positions. Three different jobs." },
      {
        kind: "figure",
        kicker: "Before the drive",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Volume", lit: true }, { name: "Drive" }, { name: "Delay" }, { name: "Amp", end: true }]),
        body: "It changes how hard the drive is pushed, so backing off cleans the gain up as well as reducing the level. A foot-operated gain control.",
      },
      {
        kind: "figure",
        kicker: "After the drive",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Drive" }, { name: "Volume", lit: true }, { name: "Delay" }, { name: "Amp", end: true }]),
        body: "It fades your level and leaves whatever is already in the delay to ring out. This is the swell everybody wants and cannot work out how to get.",
      },
      {
        kind: "figure",
        kicker: "At the very end",
        fig: () => d.chainBlocks([{ name: "Guitar", end: true }, { name: "Drive" }, { name: "Delay" }, { name: "Volume", lit: true }, { name: "Amp", end: true }]),
        body: "A master mute, full stop. Fine, if that is the job.",
      },
    ],
  },

  {
    id: "23",
    title: "The one pedal whose job gets easier the earlier it is",
    slides: [{ kind: "order", kicker: "First, and not for tone", lit: "Tuner" }],
  },

  {
    id: "24",
    title: "Reverb is last because it is the room",
    slides: [
      { kind: "statement", hook: "Reverb goes last because it is the room, and a room is the last thing that happens to a sound." },
      {
        kind: "figure",
        kicker: "Delay into reverb",
        fig: () => d.room(false),
        body: "Every repeat placed in the same space. In the world, the note exists and then the space responds to it.",
      },
      {
        kind: "figure",
        kicker: "Reverb into delay",
        fig: () => d.room(true),
        body: "Each echo arrives carrying its own copy of the room. Still a convention rather than a rule, and reversing it deliberately is a legitimate and quite unusual sound.",
      },
    ],
  },
]

export const SLIDE_COUNT = POSTS.reduce((n, p) => n + p.slides.length, 0)
