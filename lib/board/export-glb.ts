import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { SCENE_UNITS_PER_MM } from "@/lib/board/pedal-models"

/**
 * glTF IS METRES, BY SPECIFICATION, AND THE VIEWER IS NOT.
 *
 * The viewer works at 1 unit = 10mm so a pedal is not a speck under a default
 * camera. Export that unchanged and a DS-1 arrives in the game measuring
 * 770 x 1326mm, which does not error and does not look wrong on its own: it
 * looks like a coffee table, and you only find out when it is standing next to
 * something else. Derived from the viewer's own constant rather than written
 * as 0.1, so the two cannot drift.
 */
const UNITS_TO_METRES = 0.001 / SCENE_UNITS_PER_MM

/**
 * ONE MEASURED PEDAL, AS A GLB, FOR THE RIG ROOM.
 *
 * Called only from the render bench, which fails closed on RENDER_BENCH, and
 * driven by `scripts/gear-3d/export-models-glb.mjs`. It lives in the app
 * rather than in that script for a dull but decisive reason: three.js is
 * bundled here, and a bare `import("three")` evaluated inside the page cannot
 * be resolved by the browser without an import map.
 *
 * WHAT IT NORMALISES, AND WHY EACH ONE WOULD OTHERWISE BE A BUG IN THE GAME.
 */
export async function exportPedalGlb(source: THREE.Object3D): Promise<{
  glb: ArrayBuffer
  names: string[]
  sizeMM: [number, number, number]
}> {
  const pedal = source.clone(true)

  /*
   * SCALE BACK TO REAL MILLIMETRES.
   *
   * The viewer scales every pedal to fill one frame, because a portrait of a
   * 42mm micro and a portrait of a 254mm wah should be the same size on a
   * card. A room is the opposite: a pedal that arrives pre-scaled to its
   * neighbour's size is a board where nothing is the size it is. The geometry
   * underneath was always built from the real numbers, so resetting the
   * group's own scale is all it takes.
   */
  pedal.scale.setScalar(UNITS_TO_METRES)
  pedal.position.set(0, 0, 0)
  pedal.rotation.set(0, 0, 0)
  pedal.updateMatrixWorld(true)

  /*
   * ANCHORED BOTTOM CENTRE, here rather than in the game.
   *
   * The Blender-authored DS-1 already exports that way, and a room that has to
   * remember which tool made which asset is a room that will get it wrong. It
   * is also what makes "sits at y = 0" an assertion the validator can make of
   * every asset rather than of one.
   */
  const bounds = new THREE.Box3().setFromObject(pedal)
  const centre = bounds.getCenter(new THREE.Vector3())
  pedal.position.set(-centre.x, -bounds.min.y, -centre.z)
  pedal.updateMatrixWorld(true)

  /*
   * PLAIN glTF PBR, WITH NO EXTENSIONS, AND THIS IS NOT TIDINESS.
   *
   * The viewer paints bodies with MeshPhysicalMaterial because clearcoat is
   * what makes a lacquered enclosure read as painted metal rather than as
   * plastic. Exported, that becomes KHR_materials_clearcoat, and the emissive
   * LED becomes KHR_materials_emissive_strength. Both are optional extensions,
   * neither is listed as REQUIRED, and three.js reads the file back perfectly:
   * a green TS9 with its legends on it.
   *
   * Godot 3.5 renders the same file WHITE. Twelve pedals arrived on the board
   * as twelve white bricks with black knobs, and nothing errored anywhere in
   * the chain, which is why this was found by looking at a picture rather than
   * by a check. The engine is entitled to ignore an extension it does not
   * know; what it must not have to do is guess, so the export stops asking.
   *
   * Standard PBR carries everything a game needs off this model: colour, the
   * silkscreen map, roughness, metalness and the lamp. Clearcoat is a
   * subtlety of the website's own product shot, and the website keeps it.
   */
  pedal.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    const from = mesh.material as THREE.MeshStandardMaterial
    if (Array.isArray(mesh.material) || !from?.isMaterial) return
    /*
     * EVERY MAP, NOT JUST THE COLOUR ONE.
     *
     * The first version of this copied `map` and nothing else, and the day a
     * normal map was added to the pedal bodies the export did not change by a
     * single byte: the exporter reported eighty-nine files "unchanged" and
     * every one of them was silently flat. Copying the whole set means the next
     * map to arrive comes with it rather than being discovered missing.
     */
    const flat = new THREE.MeshStandardMaterial({
      color: from.color?.clone() ?? new THREE.Color(0xffffff),
      map: from.map ?? null,
      normalMap: from.normalMap ?? null,
      roughnessMap: from.roughnessMap ?? null,
      metalnessMap: from.metalnessMap ?? null,
      aoMap: from.aoMap ?? null,
      alphaMap: from.alphaMap ?? null,
      emissiveMap: from.emissiveMap ?? null,
      roughness: from.roughness ?? 0.6,
      metalness: from.metalness ?? 0,
      emissive: from.emissive?.clone() ?? new THREE.Color(0x000000),
      transparent: from.transparent ?? false,
      opacity: from.opacity ?? 1,
      side: from.side ?? THREE.FrontSide,
    })
    if (from.normalScale) flat.normalScale.copy(from.normalScale)
    /* Left at 1 deliberately: any other value is what emits
       KHR_materials_emissive_strength, and the colour already carries it. */
    flat.emissiveIntensity = 1
    flat.name = from.name || ""
    mesh.material = flat
  })

  const names: string[] = []
  pedal.traverse((node) => {
    if (node.name) names.push(node.name)
  })

  const size = new THREE.Box3().setFromObject(pedal).getSize(new THREE.Vector3())

  const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
    new GLTFExporter().parse(
      pedal,
      (out) => resolve(out as ArrayBuffer),
      (error) => reject(error),
      {
        /* Binary, and visible only: the viewer hides nothing, but a future
           model that does must not ship its hidden parts into a game where
           something can walk behind them. */
        binary: true,
        onlyVisible: true,
        /*
         * THE SILKSCREEN IS THE WHOLE FILE, UNCAPPED.
         *
         * A pedal's geometry is a few hundred triangles; its print is a canvas
         * texture drawn at the size that keeps 4mm type crisp under a camera
         * that can push right up to it. Exported raw, eighty-nine pedals came
         * to 63MB, almost all of it PNG. 512 is the size the website's own
         * stills are delivered at, it is more resolution than a plate 100mm
         * across can use at arm's length in a game, and it is the difference
         * between a repository somebody can clone and one they cannot.
         */
        maxTextureSize: 512,
      },
    )
  })

  return { glb, names, sizeMM: [size.x * 1000, size.y * 1000, size.z * 1000] }
}
