import type { Metadata } from "next"
import { StompLink } from "@/components/ui/stomp"
import { RigRoomView } from "./rig-room-view"
import { buildScene } from "@/lib/rig-room/scene"
import { encodeRig } from "@/lib/pedalboard/board-url"

/**
 * The rig room: a board you can turn around and look at.
 *
 * A SEPARATE VIEW, NOT A REPLACEMENT. CLAUDE.md section 16 allows exactly one
 * 3D thing on this site and is precise about why the planner is not it: the
 * planner has to stay indexable, keep its outbound /go links in the DOM, share
 * its layout, power and cable engines with the server so the assistant can
 * build a rig, and be usable with a screen reader. This page adds a view of a
 * rig; /pedalboard remains the place you build one.
 *
 * It reads the SAME `?rig=` parameter the planner writes, through the same
 * codec, so "see it in 3D" is a link rather than an export. Nothing here has
 * its own idea of what a rig is, which is the whole reason a game engine was
 * turned down for it: a Godot build could not import lib/pedalboard, so the
 * chain and layout rules would have had to be rewritten in GDScript and would
 * have drifted the way the condition classifier nearly did.
 */

export const metadata: Metadata = {
  title: "The rig room: a pedalboard in three dimensions",
  description:
    "Turn a pedalboard around and look at it. Real pedal dimensions from the catalogue, cables in signal order, and every pedal linked to prices across every store.",
  alternates: { canonical: "/rig-room" },
}

export default async function RigRoomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = typeof params.rig === "string" ? params.rig : null
  const scene = buildScene(raw)

  /*
   * Round trip back to the planner carrying this exact rig. Built with the
   * planner's own encoder rather than by passing the raw string through, so a
   * link that arrived slightly malformed leaves here in canonical form.
   */
  const plannerHref = `/pedalboard?rig=${encodeURIComponent(
    encodeRig({
      boardId: scene.board.id,
      supplyId: null,
      placements: scene.boxes.map((b) => ({
        key: b.key,
        xMm: b.xMm,
        yMm: b.yMm,
        rotation: b.rotation,
      })),
    }),
  )}`

  return (
    <div className="shell space-y-8 py-10">
      <header className="space-y-3">
        <p className="eyebrow">The rig room</p>
        <h1 className="h-display">
          {scene.isDemo ? "A board you can walk around" : "Your board, in three dimensions"}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
          Every pedal here is drawn at the size it actually is, from the same catalogue the planner
          measures with, on a {scene.board.brand} {scene.board.model}. The cables run in signal
          order rather than board order, which is why they cross.
        </p>
        {scene.isDemo && (
          <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
            This is a demonstration board, because you arrived without one. Build your own in the
            planner and it opens here.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <StompLink href={plannerHref} variant="go">
            {scene.isDemo ? "Build your own" : "Edit this rig"}
          </StompLink>
          <StompLink href="/rigs" variant="ghost">
            Artist rigs
          </StompLink>
        </div>
      </header>

      <RigRoomView scene={scene} />

      <p className="max-w-prose text-xs leading-relaxed text-[var(--muted-foreground)]">
        Dimensions come from the pedal catalogue and are marked in the planner as maker figures,
        enclosure figures or estimates. Heights include knobs, which is what decides whether a board
        closes in its case.
      </p>
    </div>
  )
}
