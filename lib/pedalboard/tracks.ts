/**
 * "Iconic Tracks": a follow-up to "Iconic Rigs" (icons.ts). Where Iconic Rigs
 * is a player's general go-to pedal, this is gear documented as used on ONE
 * specific recording (an interview quote, an engineer/gear-press account),
 * so it deliberately does not repeat an Iconic Rigs player's usual pedal.
 * Same disclaimer as Iconic Rigs applies: editorial gear history, not an
 * endorsement or partnership claim.
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

const RAW: Omit<TrackEntry, "hue">[] = []

export const TRACKS: TrackEntry[] = RAW.map((entry, i) => ({
  ...entry,
  hue: `hsl(${Math.round((i * 360) / RAW.length)}, 68%, 58%)`,
}))
