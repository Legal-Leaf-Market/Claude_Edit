import { midiToFrequency, type Midi } from "@/lib/chords/pitch"

/**
 * A PLUCKED STRING, MADE OF TWO OSCILLATORS AND AN ENVELOPE.
 *
 * Kept from the uploaded studio, which got this part right: a sawtooth and a
 * triangle slightly detuned, through a lowpass that closes as the note decays,
 * is a decent guitar for a page that is teaching harmony rather than selling
 * a sample library. Nothing is downloaded and nothing is licensed.
 *
 * WHAT CHANGED. It is created lazily and only on a real gesture, because a
 * browser will refuse an AudioContext otherwise and the old version's "Audio
 * Ready" label was printed whether or not the context had actually started.
 * Voices are counted and old ones are released, so holding an arrow key does
 * not build a bank of oscillators that never stop. And it is disposable, so a
 * React component can unmount without leaving a context running.
 */

export class PluckSynth {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private voices = 0

  /** True once the browser has actually given us a running context. */
  get ready(): boolean {
    return this.context?.state === "running"
  }

  /**
   * Start, or resume after the browser suspended us.
   *
   * MUST BE CALLED FROM A GESTURE. Every browser blocks audio until a user has
   * done something, and the failure is silent: the context exists, it is
   * "suspended", and nothing plays. So this returns whether it worked rather
   * than assuming.
   */
  async start(): Promise<boolean> {
    if (typeof window === "undefined") return false

    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return false
      this.context = new Ctor()
      this.master = this.context.createGain()
      this.master.gain.value = 0.32
      this.master.connect(this.context.destination)
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume()
      } catch {
        return false
      }
    }

    return this.context.state === "running"
  }

  /** Release everything. A component that unmounts must call this. */
  dispose(): void {
    void this.context?.close()
    this.context = null
    this.master = null
    this.voices = 0
  }

  /**
   * One note.
   *
   * `velocity` falls across a strum so the low strings do not swamp the top,
   * which is roughly what a pick does.
   */
  pluck(midi: Midi, delay = 0, duration = 2.2, velocity = 0.9): void {
    if (!this.context || !this.master || this.context.state !== "running") return

    /* A ceiling on simultaneous voices. Holding an arrow key through a
       progression otherwise stacks strums until the output clips. */
    if (this.voices > 48) return

    const now = this.context.currentTime + delay
    const frequency = midiToFrequency(midi)

    const gain = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    const body = this.context.createOscillator()
    const shimmer = this.context.createOscillator()

    body.type = "sawtooth"
    shimmer.type = "triangle"
    body.frequency.setValueAtTime(frequency, now)
    /* Two cents apart: enough to thicken, not enough to sound out of tune. */
    shimmer.frequency.setValueAtTime(frequency * 1.002, now)

    filter.type = "lowpass"
    filter.frequency.setValueAtTime(frequency * 4.5, now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, frequency * 1.2), now + duration)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(velocity * 0.4, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * 0.13), now + 0.18)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    body.connect(filter)
    shimmer.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)

    this.voices += 1
    const release = () => {
      this.voices = Math.max(0, this.voices - 1)
      gain.disconnect()
      filter.disconnect()
    }
    body.onended = release

    body.start(now)
    shimmer.start(now)
    body.stop(now + duration + 0.1)
    shimmer.stop(now + duration + 0.1)
  }

  /**
   * A chord, played the way a hand plays it: bottom string first, a few
   * milliseconds apart. Simultaneous notes sound like an organ.
   */
  strum(notes: Midi[], spreadMs = 32): void {
    notes.forEach((note, index) => {
      this.pluck(note, (index * spreadMs) / 1000, 2.4, 0.92 - index * 0.045)
    })
  }
}
