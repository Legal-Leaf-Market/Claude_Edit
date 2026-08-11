import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The site's button, as a stompbox face.
 *
 * The styling lives in globals.css under PEDAL CONTROLS rather than here,
 * because plenty of buttons on this site are server-rendered anchors, third
 * party components, or plain <button> elements inside client islands, and all
 * of them should be able to opt in with a class name. This component is the
 * ergonomic wrapper over that class, not the source of truth for it.
 *
 * WHICH VARIANT TO USE, which is the only part that needs judgement:
 *
 *   go     ONE per view. The bright green enclosure is the thing you actually
 *          want the shopper to press: see it at the store, build the board,
 *          save the alert. Two on a screen and neither reads as primary.
 *   solid  the default. A dark enclosure with a brass edge, for real actions
 *          that are not THE action.
 *   ghost  no enclosure and no LED, for anything that would be a text link if
 *          it did not need a hit target: cancel, back, show more.
 *
 * The LED is not decorative. It is dim at rest, lit on hover and blazing while
 * held, which is the whole feedback story for a control that otherwise only
 * moves two pixels.
 */

type Variant = "go" | "solid" | "ghost"
type Size = "sm" | "md" | "lg"

const VARIANT_CLASS: Record<Variant, string> = {
  go: "stomp-go",
  solid: "",
  ghost: "stomp-ghost",
}

const SIZE_CLASS: Record<Size, string> = {
  sm: "stomp-sm",
  md: "",
  lg: "stomp-lg",
}

function stompClass({
  variant = "solid",
  size = "md",
  led = true,
  className,
}: {
  variant?: Variant
  size?: Size
  led?: boolean
  className?: string
}) {
  return cn(
    "stomp",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    // A toolbar of six lit LEDs is a runway, so rows of sibling controls turn
    // them off and let hover do the work.
    !led && "stomp-plain",
    className,
  )
}

export function Stomp({
  variant,
  size,
  led,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; led?: boolean }) {
  return (
    <button className={stompClass({ variant, size, led, className })} {...rest}>
      {children}
    </button>
  )
}

/**
 * The same face on a link.
 *
 * Separate from Stomp rather than a polymorphic `as` prop: the two take
 * genuinely different props (href versus onClick and disabled), and a union
 * type that pretends otherwise pushes the mistake to runtime.
 */
export function StompLink({
  variant,
  size,
  led,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; led?: boolean }) {
  return (
    <Link className={stompClass({ variant, size, led, className })} {...rest}>
      {children}
    </Link>
  )
}

/**
 * A circular knurled control, for icon-only buttons.
 *
 * Pass `on` for a control with a state (a theme toggle, a filter that is
 * applied). It turns the knob and greens the pointer, which is how a real
 * control shows you where it is set.
 */
export function Knob({
  size = "md",
  on,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { size?: "sm" | "md"; on?: boolean }) {
  return (
    <button
      className={cn("knob", size === "sm" && "knob-sm", className)}
      data-on={on ? "true" : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}

export function KnobLink({
  size = "md",
  on,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { size?: "sm" | "md"; on?: boolean }) {
  return (
    <Link
      className={cn("knob", size === "sm" && "knob-sm", className)}
      data-on={on ? "true" : undefined}
      {...rest}
    >
      {children as ReactNode}
    </Link>
  )
}
