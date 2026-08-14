/**
 * What each circuit does to a waveform, as drawable geometry.
 *
 * WHY THIS EXISTS. This site's whole argument is that naming the circuit beats
 * reaching for another adjective: soft clipping inside a feedback loop and hard
 * clipping to ground are different things that behave differently. Every page
 * made that argument in prose and showed nothing, which left the one claim the
 * site is built on as the one claim a reader could not see.
 *
 * WHY DRAWN RATHER THAN PHOTOGRAPHED. Two reasons, and the second is the real
 * one.
 *
 * The rights answer: product photography of pedals belongs to whoever shot it.
 * The catalogue route can show merchant photos because those arrive in a feed
 * published to partners for that purpose, and nothing on the guide side has any
 * such licence. Section 2 of the sister project's guide rejects scraping an
 * image off a storefront for exactly the reasons it rejects scraping a
 * catalogue.
 *
 * The better answer: a photograph of a Tube Screamer and a photograph of a RAT
 * tell a reader nothing about why they sound different. They are both a box
 * with three knobs. The difference is in what happens to the waveform, and that
 * is a thing you can draw. A photo would be decoration; this is the content.
 *
 * WHY GEOMETRY IN A PURE MODULE, NOT SVG IN A COMPONENT. Eleven hand-authored
 * SVGs would drift from each other on the second edit: a different baseline
 * here, a heavier stroke there, and the set stops reading as one system. So the
 * shapes are generated from one sampler on one grid, which makes them
 * consistent by construction and testable without a renderer. Same instinct as
 * the sister project drawing its wordmark as stroked polylines rather than
 * setting it in a font.
 *
 * NOTHING HERE IS A MEASUREMENT. These are illustrations of a described
 * behaviour, not scope traces of a specific unit, and the captions are written
 * to say so. A drawn curve claiming to be a measured one would be the same
 * dishonesty as publishing a market price from two listings.
 */

/** The drawing grid every figure shares. */
export const FIGURE = {
  width: 200,
  height: 100,
  /** Zero crossing. Everything swings around this. */
  baseline: 50,
  /** Full-scale swing before any circuit touches it. */
  amplitude: 34,
  /** Left and right insets, so a stroke never sits on the frame. */
  padX: 6,
  /** Zero for a magnitude, sat off the bottom edge by the same inset. */
  floor: 94,
} as const

/**
 * Every behaviour this site can draw.
 *
 * A CLOSED SET, ASSIGNED PER PEDAL FROM ITS OWN DESCRIPTION. Family is not
 * enough and the dataset proves it: a Tube Screamer and a RAT are both Drive,
 * and their entries say one rounds the peaks while the other squares them. So
 * the shape is chosen by reading the entry, the way every other field in
 * lib/pedals.ts is filled, and a test asserts every pedal has one and every one
 * of these has something to draw.
 */
export type FigureShape =
  | "soft-clip"
  | "hard-clip"
  | "stacked-clip"
  | "headroom"
  | "asymmetric-fuzz"
  | "octave-fold"
  | "resonant-sweep"
  | "envelope"
  | "phase-notch"
  | "wandering-delay"
  | "decaying-repeats"
  | "identical-repeats"

export type FigureTrace = {
  /** Polyline points in the shared grid, ready for an SVG `points` attribute. */
  points: [number, number][]
  /** How to weight it: the dry signal sits back, the result is what to look at. */
  role: "input" | "output" | "control"
  /** Named in the key beneath the figure, when a figure has more than one trace. */
  label?: string
}

export type Figure = {
  shape: FigureShape
  /** Short label, used as the figure's own heading. */
  title: string
  /**
   * One sentence, always rendered. A diagram without a caption is decoration;
   * with one it is information, which is the same rule the family applies to
   * album covers sitting beside editorial writing.
   */
  caption: string
  traces: FigureTrace[]
  /**
   * Horizontal dashed lines, in grid units, where a circuit runs out of room.
   * Drawn only where clipping is the point: a rail on a chorus figure would be
   * a line that means nothing.
   */
  rails?: number[]
  /** Vertical axis meaning, for the figures that are not time against level. */
  xAxis?: string
  /**
   * Where zero sits.
   *
   * "middle" for anything that swings both ways, which is every waveform: a
   * signal has a negative half and hiding it would misdraw the thing.
   * "bottom" for a magnitude that cannot go negative, which is every response
   * curve and every envelope. Drawing those around a mid-line was the first
   * version of this file and it wasted half the frame while implying the curve
   * could dip below an axis it never crosses.
   */
  zero?: "middle" | "bottom"
}

/* -------------------------------------------------------------------------- */
/*  Samplers                                                                  */
/* -------------------------------------------------------------------------- */

const SAMPLES = 160

/** Sample a function of phase (0..1) across the drawing width. */
function trace(
  fn: (phase: number) => number,
  role: FigureTrace["role"],
  label?: string,
  zero: "middle" | "bottom" = "middle",
): FigureTrace {
  const points: [number, number][] = []
  const span = FIGURE.width - FIGURE.padX * 2

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const x = FIGURE.padX + t * span
    // Positive is up on screen, so the sample is always subtracted. A bottom
    // zero gets the whole frame to climb through rather than half of it.
    const y =
      zero === "bottom"
        ? FIGURE.floor - fn(t) * (FIGURE.floor - FIGURE.padX)
        : FIGURE.baseline - fn(t) * FIGURE.amplitude
    points.push([round(x), round(y)])
  }

  return { points, role, label }
}

/** Two decimals is plenty at this size and keeps the markup small. */
function round(n: number): number {
  return Math.round(n * 100) / 100
}

function sine(cycles: number, phase = 0): (t: number) => number {
  return (t) => Math.sin((t * cycles + phase) * Math.PI * 2)
}

/** Clamp to a symmetric limit. Hard clipping: the peak is sheared off flat. */
function clamp(fn: (t: number) => number, gain: number, limit: number): (t: number) => number {
  return (t) => Math.max(-limit, Math.min(limit, fn(t) * gain))
}

/**
 * Soft clipping: the transfer curve bends, so a peak is compressed rather than
 * cut. tanh is the standard stand-in for a diode pair in a feedback loop and is
 * the right shape for the same reason it is the right shape in a circuit
 * simulator: it saturates gradually instead of at a threshold.
 */
function saturate(fn: (t: number) => number, gain: number, limit = 1): (t: number) => number {
  const norm = Math.tanh(gain)
  return (t) => (Math.tanh(fn(t) * gain) / norm) * limit
}

/* -------------------------------------------------------------------------- */
/*  The figures                                                               */
/* -------------------------------------------------------------------------- */

const CYCLES = 2

/** The untouched signal, drawn behind most figures so there is something to compare against. */
const dry = () => trace(sine(CYCLES), "input", "In")

const FIGURES: Record<FigureShape, Figure> = {
  "soft-clip": {
    shape: "soft-clip",
    title: "Soft clipping",
    caption:
      "Diodes inside the feedback loop bend the transfer curve, so a peak is squeezed flat gradually instead of being cut at a threshold. The corners stay rounded, which is what keeps it sounding like a pushed amp rather than a fuzz.",
    traces: [dry(), trace(saturate(sine(CYCLES), 3, 0.92), "output", "Out")],
    rails: [FIGURE.baseline - FIGURE.amplitude * 0.92, FIGURE.baseline + FIGURE.amplitude * 0.92],
  },

  "hard-clip": {
    shape: "hard-clip",
    title: "Hard clipping to ground",
    caption:
      "Diodes after the gain stage shunt anything above their threshold straight to ground, so the waveform is sheared off flat with a corner on it. Same idea as soft clipping, applied in a different place, and the corner is the audible difference.",
    traces: [dry(), trace(clamp(sine(CYCLES), 2.6, 0.72), "output", "Out")],
    rails: [FIGURE.baseline - FIGURE.amplitude * 0.72, FIGURE.baseline + FIGURE.amplitude * 0.72],
  },

  "stacked-clip": {
    shape: "stacked-clip",
    title: "Two clipping stages, one after the other",
    caption:
      "Each stage rounds the peaks the gentle way, and running a second one into the first takes what is left of the slope with it. Two soft stages end up nearer a square wave than one hard one, which is why this reads as a wall rather than an edge.",
    traces: [
      dry(),
      trace(saturate(saturate(sine(CYCLES), 3), 4, 0.88), "output", "Out"),
    ],
    rails: [FIGURE.baseline - FIGURE.amplitude * 0.88, FIGURE.baseline + FIGURE.amplitude * 0.88],
  },

  headroom: {
    shape: "headroom",
    title: "Room to swing",
    caption:
      "A charge pump lifts the internal supply, so the rails sit further apart than the battery alone would allow. The stage still clips, but because it is asked to rather than because it ran out of room, and the peaks stay intact until it is.",
    traces: [trace(saturate(sine(CYCLES), 1.4, 0.72), "output", "Out")],
    rails: [FIGURE.baseline - FIGURE.amplitude, FIGURE.baseline + FIGURE.amplitude],
  },

  "asymmetric-fuzz": {
    shape: "asymmetric-fuzz",
    title: "Asymmetric squaring",
    caption:
      "A directly coupled transistor pair does not treat the two halves of the wave alike, so one side squares off harder than the other. The asymmetry adds even harmonics, and the low input impedance means the guitar's own volume control moves the whole character.",
    traces: [
      dry(),
      trace((t) => {
        const raw = sine(CYCLES)(t) * 4
        // Unequal limits: this is the point of the figure, not a rounding slip.
        return Math.max(-0.55, Math.min(0.85, raw))
      }, "output", "Out"),
    ],
    rails: [FIGURE.baseline - FIGURE.amplitude * 0.85, FIGURE.baseline + FIGURE.amplitude * 0.55],
  },

  "octave-fold": {
    shape: "octave-fold",
    title: "Folding the wave up",
    caption:
      "A full-wave rectifier flips the negative half of the wave up onto the positive half. Two humps now appear where there was one cycle, which is a note an octave above the one you played, sitting on top of the fuzz.",
    traces: [
      dry(),
      trace((t) => Math.abs(sine(CYCLES)(t)) * 0.95 - 0.1, "output", "Out"),
    ],
  },

  "resonant-sweep": {
    shape: "resonant-sweep",
    title: "A resonant peak, moved by foot",
    caption:
      "An inductor and a variable resistor make a bandpass filter with enough resonance to have a real peak. Rocking the treadle slides that peak across the spectrum, and the three curves here are three treadle positions rather than three pedals.",
    xAxis: "frequency, low to high",
    zero: "bottom",
    traces: [
      trace(bandpass(0.24), "control", "Heel", "bottom"),
      trace(bandpass(0.5), "output", "Middle", "bottom"),
      trace(bandpass(0.78), "control", "Toe", "bottom"),
    ],
  },

  envelope: {
    shape: "envelope",
    title: "Dynamic range, narrowed",
    caption:
      "A detector watches the signal's own level and turns the gain down when it is loud. The attack is pulled in and the tail is held up, so the note keeps going where it would have faded, and the sustain everyone hears is really the quiet part getting louder.",
    zero: "bottom",
    traces: [
      // Picked, then gone: a plucked note losing almost everything in a second.
      trace((t) => Math.exp(-4.4 * t) * 0.94 + 0.02, "input", "Uncompressed", "bottom"),
      /*
       * The same note through the detector. The attack is pulled DOWN (the loud
       * part is what gets turned down) and the tail is held UP, so the two
       * curves cross. That crossing is the whole figure: without it this is two
       * parallel lines saying nothing.
       */
      trace((t) => 0.3 + Math.exp(-1.5 * t) * 0.34, "output", "Compressed", "bottom"),
    ],
  },

  "phase-notch": {
    shape: "phase-notch",
    title: "Notches, from cancellation",
    caption:
      "All-pass stages shift phase without touching level, and summing the shifted signal back against the dry one cancels wherever the two disagree. Four stages put two notches in the response, and the oscillator walks them up and down.",
    xAxis: "frequency, low to high",
    zero: "bottom",
    traces: [
      /*
       * Two positions of the same response rather than a response plus an
       * oscillator. The oscillator belonged to a different vertical axis
       * entirely, so drawing it in this frame made a picture that could not be
       * read; two curves show the notches moving, which is what it was there to
       * say.
       */
      trace((t) => 0.78 - notch(t, 0.26, 0.07) - notch(t, 0.62, 0.09), "control", "Sweep low", "bottom"),
      trace((t) => 0.78 - notch(t, 0.42, 0.07) - notch(t, 0.82, 0.09), "output", "Sweep high", "bottom"),
    ],
  },

  "wandering-delay": {
    shape: "wandering-delay",
    title: "A delay that will not sit still",
    caption:
      "A short delay is modulated so its time wanders, then mixed back against the dry signal. A moving delay is a moving pitch, so the two drift in and out of tune with each other, and the beating between them is the effect.",
    traces: [
      dry(),
      trace((t) => {
        // Phase pushed around by a slow oscillator: the delay time wandering.
        const wander = Math.sin(t * Math.PI * 2) * 0.22
        return Math.sin((t * CYCLES + wander) * Math.PI * 2) * 0.9
      }, "output", "Delayed"),
    ],
  },

  "decaying-repeats": {
    shape: "decaying-repeats",
    title: "Repeats that lose their top end",
    caption:
      "Each repeat is handed along a chain of capacitors, and every step costs a little treble and adds a little noise. So the repeats do not just get quieter, they get darker, which is why an analog delay sits under a part instead of competing with it.",
    traces: [
      trace(repeats(4, true), "output", "Out"),
    ],
  },

  "identical-repeats": {
    shape: "identical-repeats",
    title: "Repeats that come back unchanged",
    caption:
      "The signal is stored as numbers and played back as it went in. Nothing in the storage path removes high end, so the last repeat carries the same frequency content as the first, and the only thing that changes is how loud it is.",
    traces: [
      trace(repeats(4, false), "output", "Out"),
    ],
  },
}

/**
 * A resonant bandpass response with its peak at `centre` (0..1 across the
 * drawing width). Drawn as a curve rather than a spike: a wah has real Q but it
 * is not a brick wall, and a spike would overstate it.
 */
function bandpass(centre: number): (t: number) => number {
  return (t) => {
    const q = 0.11
    const peak = Math.exp(-((t - centre) ** 2) / (2 * q * q))
    // The residual is deliberate: a resonant bandpass passes something either
    // side of its peak rather than nulling, and a curve sitting flat on the axis
    // would claim otherwise. Small enough not to read as a gap.
    return 0.05 + peak * 0.82
  }
}

/** One notch in a response curve: a dip, not a cut to silence. */
function notch(t: number, centre: number, width: number): number {
  return Math.exp(-((t - centre) ** 2) / (2 * width * width)) * 0.66
}

/**
 * An impulse and its repeats.
 *
 * `dulls` is the whole point of having two delay figures: the analog line loses
 * high end on every pass, so its repeats are drawn with fewer, softer wiggles,
 * while the digital one keeps the same wiggle count and only loses height.
 */
function repeats(count: number, dulls: boolean): (t: number) => number {
  return (t) => {
    let value = 0
    for (let i = 0; i < count; i++) {
      const at = 0.08 + i * 0.23
      const level = 0.95 * Math.pow(0.58, i)
      // Ringing inside each burst: the "frequency content" of that repeat.
      const cycles = dulls ? 7 - i * 1.5 : 7
      const spread = 0.045
      const env = Math.exp(-((t - at) ** 2) / (2 * spread * spread))
      value += env * level * Math.sin((t - at) * Math.PI * 2 * Math.max(cycles, 1) * 4)
    }
    return value
  }
}

export function figureFor(shape: FigureShape): Figure {
  return FIGURES[shape]
}

export const FIGURE_SHAPES = Object.keys(FIGURES) as FigureShape[]
