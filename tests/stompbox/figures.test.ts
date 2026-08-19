import { describe, expect, it } from "vitest"
import { FIGURE, FIGURE_SHAPES, figureFor, type FigureShape } from "@/lib/stompbox/figures"
import { PEDALS } from "@/lib/stompbox/pedals"

/**
 * The drawn circuit figures.
 *
 * These are the site's only pictures, and they are generated rather than
 * hand-authored, so the things worth pinning are the ones a renderer would not
 * complain about: a shape with nothing to draw, a curve that leaves the frame,
 * a caption that says nothing, and a set of figures that has quietly stopped
 * distinguishing the circuits it exists to distinguish.
 */

describe("every pedal has something to draw", () => {
  it("assigns a shape to every entry in the dataset", () => {
    for (const pedal of PEDALS) {
      expect(pedal.shape, pedal.slug).toBeTruthy()
      expect(FIGURE_SHAPES, pedal.slug).toContain(pedal.shape)
    }
  })

  it("has a figure for every shape in the union, so none renders blank", () => {
    for (const shape of FIGURE_SHAPES) {
      const figure = figureFor(shape)
      expect(figure, shape).toBeTruthy()
      expect(figure.traces.length, shape).toBeGreaterThan(0)
    }
  })

  /**
   * THE ONE THAT MATTERS MOST. The whole argument of this site is that family is
   * too coarse a description: a Tube Screamer and a RAT are both Drive and their
   * own entries say they do different things to the waveform. If those two ever
   * draw the same picture, the figures have started contradicting the prose
   * printed underneath them.
   */
  it("draws soft clipping and hard clipping differently, inside the same family", () => {
    const ts = PEDALS.find((p) => p.slug === "tube-screamer")
    const rat = PEDALS.find((p) => p.slug === "rat")

    expect(ts?.family).toBe("Drive")
    expect(rat?.family).toBe(ts?.family)
    expect(ts?.shape).not.toBe(rat?.shape)
  })

  /**
   * Same test, for the site's other load-bearing distinction: a bucket-brigade
   * line loses high end on every pass and a digital one does not, which is the
   * reason both delays are in the dataset at all.
   */
  it("draws the analog and digital delays differently", () => {
    const analog = PEDALS.find((p) => p.slug === "deluxe-memory-man")
    const digital = PEDALS.find((p) => p.slug === "dd-2")

    expect(analog?.family).toBe("Time")
    expect(digital?.family).toBe(analog?.family)
    expect(analog?.shape).not.toBe(digital?.shape)
  })
})

describe("the geometry stays inside the frame", () => {
  it("keeps every point on the drawing grid", () => {
    for (const shape of FIGURE_SHAPES) {
      const figure = figureFor(shape)
      for (const trace of figure.traces) {
        for (const [x, y] of trace.points) {
          expect(Number.isFinite(x), shape).toBe(true)
          expect(Number.isFinite(y), shape).toBe(true)
          expect(x, shape).toBeGreaterThanOrEqual(0)
          expect(x, shape).toBeLessThanOrEqual(FIGURE.width)
          // A stroke leaving the top or bottom is clipped by the viewBox and
          // reads as a drawing bug rather than as a loud signal.
          expect(y, `${shape} y`).toBeGreaterThanOrEqual(0)
          expect(y, `${shape} y`).toBeLessThanOrEqual(FIGURE.height)
        }
      }
    }
  })

  it("samples densely enough that a curve reads as a curve", () => {
    for (const shape of FIGURE_SHAPES) {
      for (const trace of figureFor(shape).traces) {
        expect(trace.points.length, shape).toBeGreaterThan(60)
      }
    }
  })

  /**
   * A magnitude cannot go negative, so a response curve or an envelope is drawn
   * from the floor. Getting this wrong wastes half the frame and implies the
   * curve could dip below an axis it never crosses, which is how the first
   * version of these looked.
   */
  it("draws every magnitude figure above its own zero", () => {
    for (const shape of FIGURE_SHAPES) {
      const figure = figureFor(shape)
      if (figure.zero !== "bottom") continue
      for (const trace of figure.traces) {
        for (const [, y] of trace.points) {
          expect(y, shape).toBeLessThanOrEqual(FIGURE.floor + 0.5)
        }
      }
    }
  })

  /** Rails mean "this is where it runs out of room". A figure without clipping must not have one. */
  it("puts rails only on the figures where clipping is the subject", () => {
    const clipping: FigureShape[] = [
      "soft-clip",
      "hard-clip",
      "stacked-clip",
      "headroom",
      "asymmetric-fuzz",
    ]
    for (const shape of FIGURE_SHAPES) {
      const hasRails = Boolean(figureFor(shape).rails?.length)
      expect(hasRails, shape).toBe(clipping.includes(shape))
    }
  })
})

describe("every figure says what it is", () => {
  it("carries a title and a caption long enough to be a sentence", () => {
    for (const shape of FIGURE_SHAPES) {
      const figure = figureFor(shape)
      expect(figure.title.length, shape).toBeGreaterThan(4)
      expect(figure.caption.length, shape).toBeGreaterThan(80)
      expect(figure.caption.trim().endsWith("."), shape).toBe(true)
    }
  })

  /**
   * The captions describe circuits, and this site's dataset rule is that no
   * entry names a player. A figure caption is the newest place for one to sneak
   * in, so it is checked the same way lib/pedals.ts is.
   */
  it("names no artist in any caption", () => {
    /*
     * FULL NAMES, NOT BARE SURNAMES, and that is a correction rather than
     * caution. The first version of this pattern listed "edge", "may" and
     * "page", and it failed instantly on the phrase "a wall rather than an
     * edge". Those are ordinary English words, so matching them alone flags
     * honest prose while catching nothing a caption would actually say, which
     * is the same near-miss problem the sister project's credit index has to
     * defend against with a three-character floor and a two-field match.
     */
    const names =
      /jimi hendrix|david gilmour|brian may|john frusciante|kurt cobain|kevin shields|jimmy page|eric clapton|van halen|the edge/i
    for (const shape of FIGURE_SHAPES) {
      expect(figureFor(shape).caption, shape).not.toMatch(names)
    }
  })

  /** Prices belong to the catalogue layer, never to the guide. */
  it("quotes no price in any caption", () => {
    for (const shape of FIGURE_SHAPES) {
      expect(figureFor(shape).caption, shape).not.toMatch(/[$£€]\d/)
    }
  })

  /** A figure with more than one trace needs them named, or the key is a mystery. */
  it("labels every trace when a figure has more than one", () => {
    for (const shape of FIGURE_SHAPES) {
      const traces = figureFor(shape).traces
      if (traces.length < 2) continue
      for (const trace of traces) {
        expect(trace.label, `${shape} trace`).toBeTruthy()
      }
    }
  })

  /** An axis that is not time has to say so, since every other figure is time. */
  it("names the horizontal axis on the frequency figures", () => {
    for (const shape of ["resonant-sweep", "phase-notch"] as FigureShape[]) {
      expect(figureFor(shape).xAxis, shape).toMatch(/frequency/i)
    }
  })
})
