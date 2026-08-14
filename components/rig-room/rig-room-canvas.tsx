"use client"

import { useEffect, useRef, useState } from "react"
import type { RigScene } from "@/lib/rig-room/scene"

/**
 * The rig room: the board and its pedals, in three dimensions.
 *
 * WHAT THIS IS AND IS NOT. It is a separate view, deliberately, and the
 * planner at /pedalboard is untouched. CLAUDE.md section 16 is explicit that
 * the planner must not become a canvas: it has to stay indexable, keep the
 * outbound /go links in the DOM, share its engines with the server so the
 * assistant can build a rig, and be reachable by a screen reader. A canvas
 * satisfies none of those. So this draws a rig somebody already has, and
 * every pedal in it is ALSO listed as ordinary DOM beneath, with the same
 * links. Turn this canvas off entirely and the page still works.
 *
 * THE GEOMETRY IS NOT HERE. lib/rig-room/scene.ts turns a rig into boxes and
 * cable endpoints in millimetres, and this only draws them. That split is what
 * makes the arithmetic testable: a pedal an inch through the board would look
 * approximately right on screen and is an assertion in a unit test.
 *
 * three.js is imported DYNAMICALLY. It is around 600KB and nothing else on the
 * site needs it, so it must not land in the shared bundle for the sake of one
 * page that some visitors will never scroll to.
 */

/** 1 world unit is one metre, so a 600mm board is 0.6 across. */
const MM = 0.001

export function RigRoomCanvas({
  scene,
  selectedKey,
  onSelect,
}: {
  scene: RigScene
  selectedKey: string | null
  onSelect: (key: string | null) => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  /*
   * Selection is read through a ref inside the render loop rather than being a
   * dependency of the effect. Rebuilding the whole scene on every click would
   * drop the camera back to its starting angle, which is precisely the thing
   * that makes a 3D view feel broken.
   */
  const selectedRef = useRef(selectedKey)
  selectedRef.current = selectedKey

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let cleanup: (() => void) | null = null

    void (async () => {
      let THREE: typeof import("three")
      try {
        THREE = await import("three")
      } catch {
        // WebGL absent, an old browser, or a blocked chunk. The DOM list below
        // is the real content, so this degrades to nothing rather than to an
        // error.
        if (!disposed) setFailed(true)
        return
      }
      if (disposed) return

      const width = mount.clientWidth || 800
      const height = mount.clientHeight || 480

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      mount.appendChild(renderer.domElement)

      const world = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 100)

      const boardW = scene.board.usableWidthMm * MM
      const boardD = scene.board.usableDepthMm * MM

      /*
       * The whole rig is built around its own centre, so orbiting rotates the
       * board rather than swinging it around a corner. Every pedal coordinate
       * is shifted by half the board, once, here.
       */
      const rig = new THREE.Group()
      rig.position.set(-boardW / 2, 0, -boardD / 2)
      world.add(rig)

      /* ---- lighting -------------------------------------------------- */
      // Two lights and no shadows. A rack of gear at rest is still, and
      // shadow maps on a page that is already a toy is spend for nothing.
      world.add(new THREE.AmbientLight(0xffffff, 1.1))
      const key = new THREE.DirectionalLight(0xffffff, 1.9)
      key.position.set(0.6, 1.4, 0.8)
      world.add(key)
      const fill = new THREE.DirectionalLight(0xffd9a0, 0.5)
      fill.position.set(-0.8, 0.5, -0.6)
      world.add(fill)

      /* ---- the board -------------------------------------------------- */
      const boardH = Math.max(scene.board.heightMm * MM * 0.35, 0.012)
      const boardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(boardW, boardH, boardD),
        // Metal stays dark and is never tinted, the same rule the CSS
        // controls follow. It is what lets the effect colours read at all.
        new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.75, metalness: 0.55 }),
      )
      boardMesh.position.set(boardW / 2, -boardH / 2, boardD / 2)
      rig.add(boardMesh)

      // Rails, drawn from the catalogue's real offsets. They are the reason a
      // deep pedal can fail to fit a board whose area looks ample, so showing
      // them is showing the constraint rather than decoration.
      for (const rail of scene.board.rails) {
        const railMesh = new THREE.Mesh(
          new THREE.BoxGeometry(boardW, boardH * 0.9, rail.depthMm * MM),
          new THREE.MeshStandardMaterial({ color: 0x2e3237, roughness: 0.6, metalness: 0.7 }),
        )
        railMesh.position.set(boardW / 2, boardH * 0.15, rail.offsetMm * MM + (rail.depthMm * MM) / 2)
        rig.add(railMesh)
      }

      /* ---- the pedals -------------------------------------------------- */
      const pickable: import("three").Object3D[] = []
      const bodyByKey = new Map<string, import("three").Mesh>()
      const bandByKey = new Map<string, import("three").Mesh>()

      for (const box of scene.boxes) {
        const w = box.widthMm * MM
        const d = box.depthMm * MM
        const h = Math.max(box.heightMm * MM, 0.02)

        const group = new THREE.Group()
        group.position.set(box.xMm * MM + w / 2, h / 2, box.yMm * MM + d / 2)

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: 0x31363c, roughness: 0.42, metalness: 0.72 }),
        )
        body.userData.key = box.key
        group.add(body)
        pickable.push(body)
        bodyByKey.set(box.key, body)

        /*
         * The effect colour as a thin band across the top, never as the body.
         * Same discipline as the CSS: enclosures are drab, and one saturated
         * edge is what makes the board's shape readable at a glance.
         */
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.82, h * 0.06, d * 0.1),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(box.colour),
            emissive: new THREE.Color(box.colour),
            emissiveIntensity: 0.5,
            roughness: 0.3,
          }),
        )
        band.position.set(0, h / 2 + 0.0005, -d * 0.3)
        group.add(band)
        bandByKey.set(box.key, band)

        // The footswitch, which is what makes it read as a pedal rather than
        // a block at any angle.
        const stomp = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.min(w, d) * 0.11, Math.min(w, d) * 0.11, h * 0.12, 20),
          new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.9 }),
        )
        stomp.position.set(0, h / 2 + h * 0.06, d * 0.3)
        group.add(stomp)

        rig.add(group)
      }

      /* ---- the cables -------------------------------------------------- */
      // Cables SAG. A straight line between two jacks reads as a wireframe
      // diagram; a curve that dips reads as a patch lead, and the dip is the
      // one bit of physics this view actually needs.
      for (const cable of scene.cables) {
        const from = new THREE.Vector3(cable.from.xMm * MM, cable.from.zMm * MM, cable.from.yMm * MM)
        const to = new THREE.Vector3(cable.to.xMm * MM, cable.to.zMm * MM, cable.to.yMm * MM)
        const span = from.distanceTo(to)
        const mid = from.clone().lerp(to, 0.5)
        // Bowed FORWARD, toward the player, rather than sagging down. A short
        // patch lead between two adjacent pedals has almost no slack to hang
        // with, and a downward curve at this scale just buries it in the
        // board. Bowing it out is both what a stiff cable does and the only
        // version you can see.
        mid.z += Math.max(Math.min(span * 0.55, 0.07), 0.022)
        mid.y += 0.006

        const curve = new THREE.CatmullRomCurve3([from, mid, to])
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 28, 0.0032, 8, false),
          /*
           * Grey rather than black. Patch leads really are usually black, and
           * black cable on a near-black board is invisible at every camera
           * angle, which makes the most informative thing in the scene the
           * one thing you cannot see. Braided grey leads are common enough
           * that this is not a fiction, and it is the only version that
           * reads.
           */
          new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 0.5, metalness: 0.25 }),
        )
        rig.add(tube)
      }

      /* ---- camera and orbit -------------------------------------------- */
      /*
       * A hand-rolled orbit rather than OrbitControls. It is about thirty
       * lines, it avoids a second import path that Next has to resolve, and it
       * lets the vertical angle be clamped above the board so the camera can
       * never end up underneath looking at the back faces.
       */
      const orbit = { theta: -0.5, phi: 0.92, radius: Math.max(boardW, boardD) * 1.75 }
      const applyCamera = () => {
        const r = orbit.radius
        camera.position.set(
          r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
          r * Math.cos(orbit.phi),
          r * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        )
        camera.lookAt(0, 0, 0)
      }
      applyCamera()

      let dragging = false
      let lastX = 0
      let lastY = 0
      let moved = 0

      const onPointerDown = (event: PointerEvent) => {
        dragging = true
        moved = 0
        lastX = event.clientX
        lastY = event.clientY
        renderer.domElement.setPointerCapture(event.pointerId)
      }

      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        lastX = event.clientX
        lastY = event.clientY
        moved += Math.abs(dx) + Math.abs(dy)
        orbit.theta -= dx * 0.006
        // Clamped so the camera stays above the board. Below it there is
        // nothing to see but the underside of a slab.
        orbit.phi = Math.min(Math.max(orbit.phi - dy * 0.005, 0.18), 1.45)
        applyCamera()
      }

      const onPointerUp = (event: PointerEvent) => {
        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId)
        }
        // A drag is not a click. Without this every orbit that happens to end
        // over a pedal selects it.
        if (dragging && moved < 6) pick(event)
        dragging = false
      }

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        const span = Math.max(boardW, boardD)
        orbit.radius = Math.min(Math.max(orbit.radius + event.deltaY * 0.0012, span * 0.7), span * 4)
        applyCamera()
      }

      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function pick(event: PointerEvent) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(pickable, false)[0]
        onSelectRef.current(hit ? (hit.object.userData.key as string) : null)
      }

      renderer.domElement.addEventListener("pointerdown", onPointerDown)
      renderer.domElement.addEventListener("pointermove", onPointerMove)
      renderer.domElement.addEventListener("pointerup", onPointerUp)
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false })

      const onResize = () => {
        const w = mount.clientWidth || 800
        const h = mount.clientHeight || 480
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      const observer = new ResizeObserver(onResize)
      observer.observe(mount)

      /* ---- loop --------------------------------------------------------- */
      let frame = 0
      let lastSelected: string | null = null

      const tick = () => {
        frame = requestAnimationFrame(tick)

        // Selection is applied here rather than in a React effect so that
        // choosing a pedal never rebuilds the scene or resets the camera.
        const selected = selectedRef.current
        if (selected !== lastSelected) {
          for (const [key, band] of bandByKey) {
            const material = band.material as import("three").MeshStandardMaterial
            material.emissiveIntensity = key === selected ? 2.4 : 0.5
          }
          for (const [key, body] of bodyByKey) {
            const material = body.material as import("three").MeshStandardMaterial
            material.color.set(key === selected ? 0x454c55 : 0x31363c)
          }
          lastSelected = selected
        }

        renderer.render(world, camera)
      }
      tick()
      setReady(true)

      cleanup = () => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        renderer.domElement.removeEventListener("pointerdown", onPointerDown)
        renderer.domElement.removeEventListener("pointermove", onPointerMove)
        renderer.domElement.removeEventListener("pointerup", onPointerUp)
        renderer.domElement.removeEventListener("wheel", onWheel)
        // Geometries and materials are not garbage collected with the scene
        // graph, so a page you can navigate away from and back to would leak
        // a whole rig each time.
        world.traverse((object) => {
          const mesh = object as import("three").Mesh
          if (mesh.geometry) mesh.geometry.dispose()
          const material = mesh.material
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else if (material) material.dispose()
        })
        renderer.dispose()
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [scene])

  if (failed) return null

  return (
    <div
      ref={mountRef}
      className="relative h-[clamp(320px,52vh,560px)] w-full overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--bg2)]"
      /*
       * The canvas is decorative in the accessibility sense: everything it
       * shows is listed as text below it, so a screen reader is better served
       * skipping it than being told about a WebGL surface it cannot inspect.
       */
      aria-hidden="true"
    >
      {!ready && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-foreground)]">
          Loading the room...
        </p>
      )}
    </div>
  )
}
