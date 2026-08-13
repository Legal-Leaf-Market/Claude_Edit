import Link from "next/link"
import { clsx } from "clsx"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

/**
 * The button language: every button is a stompbox face, every icon control is
 * a knob. The CSS is in app/globals.css under PEDAL CONTROLS, along with the
 * five rules that keep it from going cheesy. These components exist so a
 * variant is chosen by name rather than by remembering four class strings.
 */

type Variant = "default" | "go" | "ghost"
type Size = "sm" | "md" | "lg"

function stompClass(variant: Variant, size: Size, plain: boolean, className?: string): string {
  return clsx(
    "stomp",
    variant === "go" && "stomp-go",
    variant === "ghost" && "stomp-ghost",
    size === "sm" && "stomp-sm",
    size === "lg" && "stomp-lg",
    /* No LED: for a button in a row of buttons, where six lights is a runway. */
    plain && "stomp-plain",
    className,
  )
}

type StompProps = ComponentPropsWithoutRef<"button"> & {
  variant?: Variant
  size?: Size
  plain?: boolean
}

export function Stomp({
  variant = "default",
  size = "md",
  plain = false,
  className,
  children,
  ...rest
}: StompProps) {
  return (
    <button type="button" className={stompClass(variant, size, plain, className)} {...rest}>
      {children}
    </button>
  )
}

type StompLinkProps = {
  href: string
  variant?: Variant
  size?: Size
  plain?: boolean
  className?: string
  children: ReactNode
  /** External links get the rel/target pair; internal ones use next/link. */
  external?: boolean
}

export function StompLink({
  href,
  variant = "default",
  size = "md",
  plain = false,
  className,
  children,
  external = false,
}: StompLinkProps) {
  const classes = stompClass(variant, size, plain, className)

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  )
}

type KnobProps = ComponentPropsWithoutRef<"button"> & { small?: boolean }

/** An icon-only control. The icon must not rotate with the knob body, which the CSS handles. */
export function Knob({ small = false, className, children, ...rest }: KnobProps) {
  return (
    <button type="button" className={clsx("knob", small && "knob-sm", className)} {...rest}>
      {children}
    </button>
  )
}
