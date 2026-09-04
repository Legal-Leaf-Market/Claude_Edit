import * as THREE from "three"

/**
 * POWDER COAT, AS A SURFACE RATHER THAN A COLOUR.
 *
 * `bodyMaterial` already describes a pedal as paint over a casting with a thin
 * gloss on top, and until now all three of those were one flat number. A real
 * enclosure is not flat: powder coat is sprayed and cured, so it has a fine
 * orange-peel texture that catches a moving highlight and breaks it up. That
 * break-up is most of the difference between "a green box" and "a painted
 * metal object", and it costs one small texture.
 *
 * THREE THINGS MAKE THIS SAFE TO PUT ON EVERY PEDAL.
 *
 * It is DETERMINISTIC. The committed stills are compared pixel by pixel with a
 * tolerance of 0.05, measured against a renderer whose noise floor is zero. A
 * texture seeded from Math.random would rewrite all eighty-eight files on
 * every run, and the diff would stop meaning anything, which is exactly how
 * nobody notices the run that DID change a pedal. The generator below takes a
 * seed and nothing else.
 *
 * It is SMALL AND TILEABLE. 128 square, wrapped and repeated. Every exported
 * GLB embeds its own copy of whatever textures its materials use, so a 1024
 * map would add most of a megabyte to each of eighty-nine files for detail no
 * one can see on a plate 100mm across.
 *
 * And it is BUILT ONCE. A module-level singleton rather than a texture per
 * material: eighty-eight pedals sharing one surface is correct (they are all
 * the same paint process) and it keeps the GPU holding one image.
 */

/** Deterministic, and the seed is a constant so two runs agree exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIZE = 128
const SEED = 0x5150

/**
 * Value noise on a wrapping lattice.
 *
 * The lattice wraps with a modulo rather than being clamped, which is what
 * makes the result TILEABLE: a seam across a pedal's lid is far more visible
 * than the texture it was added for.
 */
function noiseField(random: () => number, cells: number): number[] {
  const lattice: number[] = []
  for (let i = 0; i < cells * cells; i += 1) lattice.push(random())

  const at = (x: number, y: number) => lattice[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)]
  const smooth = (t: number) => t * t * (3 - 2 * t)

  const out = new Array<number>(SIZE * SIZE)
  const scale = cells / SIZE
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const fx = x * scale
      const fy = y * scale
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = smooth(fx - x0)
      const ty = smooth(fy - y0)
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
      out[y * SIZE + x] = top * (1 - ty) + bottom * ty
    }
  }
  return out
}

let cached: THREE.CanvasTexture | null = null

/**
 * The orange-peel normal map. One instance, built on first use.
 *
 * Two octaves: a coarse one for the roll of the cured coat and a fine one for
 * the grain in it. A single octave reads as either a dent or as static.
 */
export function powderCoatNormal(): THREE.CanvasTexture | null {
  if (cached) return cached
  if (typeof document === "undefined") return null

  const random = mulberry32(SEED)
  const coarse = noiseField(random, 8)
  const fine = noiseField(random, 32)
  const height = coarse.map((v, i) => v * 0.65 + fine[i] * 0.35)

  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext("2d")
  if (!context) return null
  const image = context.createImageData(SIZE, SIZE)

  /* Central differences on the wrapped height field, which is the ordinary way
     to turn a heightmap into a tangent-space normal.

     STRENGTH IS SMALL, AND THE FIRST PASS IGNORED THAT WARNING WHILE WRITING
     IT. At 2.4, repeated six times across a face, a TS9 came out looking like
     hammered paint: not a subtle break-up of the highlight but a crocodile
     skin, which is a worse lie than the flat green it replaced. Powder coat is
     a texture you FEEL. The pair that works is a low amplitude and a fine
     repeat: the grain has to be near the edge of visible, because what it is
     doing is disturbing a reflection rather than being seen. */
  const STRENGTH = 1.1
  const sample = (x: number, y: number) =>
    height[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)]

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * STRENGTH
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * STRENGTH
      const length = Math.hypot(dx, dy, 1)
      const i = (y * SIZE + x) * 4
      image.data[i] = Math.round(((-dx / length) * 0.5 + 0.5) * 255)
      image.data[i + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255)
      image.data[i + 2] = Math.round((1 / length) * 0.5 * 255 + 127.5)
      image.data[i + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  /* Repeated hard, because these UVs are per-face 0..1 on boxes of very
     different sizes: what matters is that the grain is FINE on every one of
     them, not that it is physically identical across a wah and a micro. */
  texture.repeat.set(16, 16)
  texture.needsUpdate = true
  cached = texture
  return texture
}
