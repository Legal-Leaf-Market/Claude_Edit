/**
 * THE PRINTED PANEL, AS TEXTURES RATHER THAN AS GEOMETRY.
 *
 * The brief is explicit that letters must not be modelled as meshes, and it
 * allows either UV-mapped textures or decal planes. Decals win here: the panel
 * print sits on two flat faces, a decal plane needs no unwrap to be correct,
 * and a plane with its own alpha is trivially re-generated when a legend
 * changes.
 *
 * NO MANUFACTURER'S MARK. The brief lists "BOSS branding" among the required
 * graphics and that is the one item declined, for the reason CLAUDE.md section
 * 16 gives: naming the product is what a parts list does and what every
 * merchant photograph already does, while reproducing a brand's mark as artwork
 * is a different act. The model says DS-1 and Distortion in this site's own
 * type, which is what tells you which pedal it is.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const OUT = path.join(process.cwd(), "scripts", "gear-3d", "textures")
mkdirSync(OUT, { recursive: true })

/** Silkscreen white, slightly off so it does not glare under a key light. */
const INK = "#f2f3f5"

/**
 * The rear control shelf.
 *
 * Drawn in the shelf's own millimetres and rasterised square, so a legend's
 * position in this file is its position on the pedal. The plane in Blender is
 * built from the same two numbers.
 */
const SHELF_W = 68
const SHELF_D = 66

/*
 * THIS FRAME IS THE PLANE'S FRAME, AND IT IS INSET FROM THE PEDAL.
 *
 * It was drawn at the pedal's full 73 x 70 while the plane in Blender is 68 x
 * 66, inset to stay inside the casting's 2.2mm corner bevel. Two frames for
 * one print is the drift CLAUDE.md section 16 describes for the runtime
 * viewer's decals, and it does not throw: it shifts every legend a couple of
 * millimetres and nobody can see which of the two files is wrong. So the
 * numbers here ARE the numbers there, and the origin is the shelf's back edge.
 *
 * y grows toward the toe. The knobs' centres land at y = 32 and they stand 9mm
 * proud of a face the camera looks along, so everything between y = 24 and
 * y = 41 is under a knob and everything just behind them is in a knob's
 * shadow. That is why the legends are printed in FRONT of what they label:
 * the same clearance rule the pedal models already follow, and the reason the
 * first pass of this file was unreadable rather than wrong. It had the rule
 * written in a comment and the legends at y = 34, dead under the knobs.
 */
const KNOB_X = [12.5, 34, 55.5]

const shelf = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 ${SHELF_W} ${SHELF_D}">
  <rect width="100%" height="100%" fill="none"/>
  <g font-family="DejaVu Sans, sans-serif" fill="${INK}" text-anchor="middle">
    <!-- CHECK, in front of the indicator, which is at y = 10 -->
    <text x="34" y="15" font-size="2.6" letter-spacing="0.5" font-weight="600">CHECK</text>

    <!-- Knob legends, clear of the front edge of a 16.8mm knob -->
    <text x="${KNOB_X[0]}" y="43" font-size="3" letter-spacing="0.6" font-weight="600">TONE</text>
    <text x="${KNOB_X[1]}" y="43" font-size="3" letter-spacing="0.6" font-weight="600">LEVEL</text>
    <text x="${KNOB_X[2]}" y="43" font-size="3" letter-spacing="0.6" font-weight="600">DIST</text>

    <!-- The product, at the front of the shelf where the step begins -->
    <text x="34" y="55" font-size="8" font-weight="800" letter-spacing="0.4">DS-1</text>
    <text x="34" y="62.5" font-size="3.8" font-weight="500" letter-spacing="1.5">DISTORTION</text>
  </g>
</svg>`

/** The side walls, which carry only the socket names. */
const side = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128" viewBox="0 0 40 10">
  <g font-family="DejaVu Sans, sans-serif" fill="${INK}" text-anchor="middle">
    <text x="20" y="7" font-size="4" letter-spacing="0.8" font-weight="600">${label}</text>
  </g>
</svg>`

const jobs = [
  ["ds1-shelf.png", shelf],
  ["ds1-input.png", side("INPUT")],
  ["ds1-output.png", side("OUTPUT")],
]

for (const [name, svg] of jobs) {
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(path.join(OUT, name), buffer)
  console.log(`  + ${name} (${Math.round(buffer.length / 1024)}kB)`)
}
