import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
 * The shared button, now speaking the site's own control language.
 *
 * This used to carry the family's shapes: a sage gradient for the money
 * action, full pills for navigation, a copper accent variant. Those matched
 * the sister sites, which is exactly the resemblance the redesign set out to
 * break, and this file is the highest-leverage place to break it: every page
 * that renders <Button> converts at once.
 *
 * So the variants map onto the stompbox classes in globals.css rather than
 * redefining a parallel set of styles here. globals.css stays the single
 * source of truth, because plenty of buttons on this site are server-rendered
 * anchors or third-party components that can only opt in with a class name.
 *
 * WHAT MAPS TO WHAT, and the reasoning is the same as components/ui/stomp.tsx:
 *
 *   default      the green enclosure. ONE per view: it is the thing you
 *                actually want pressed, and two of them means neither reads
 *                as primary
 *   accent       a dark enclosure with a brass edge, for real actions that
 *                are not THE action
 *   outline      the same, without an LED, for rows of sibling controls where
 *                six lit LEDs would be a runway
 *   ghost        no enclosure at all, for things that would be text links if
 *                they did not need a hit target
 *   subtle       ghost with a filled rest state
 *   destructive  keeps its own red, because a delete button that looks like
 *                every other button is a bug waiting to happen
 *
 * Sizes map to the stomp size classes, so padding and type scale stay in one
 * place. `icon` is the exception: a square icon button is a KNOB, not a
 * stompbox, and it gets the knurled treatment instead.
 */
const buttonVariants = cva("", {
  variants: {
    variant: {
      default: "stomp stomp-go",
      accent: "stomp",
      outline: "stomp stomp-plain",
      ghost: "stomp stomp-ghost",
      subtle: "stomp stomp-ghost bg-[var(--secondary)]",
      destructive: "stomp stomp-destructive",
    },
    size: {
      sm: "stomp-sm",
      default: "",
      lg: "stomp-lg",
      icon: "",
    },
  },
  compoundVariants: [
    /*
     * An icon-sized button is a knob, whatever variant was asked for. The
     * stomp classes are dropped entirely rather than layered under .knob,
     * since a round knurled control has no use for an enclosure's border,
     * silkscreen line or LED.
     */
    { size: "icon", class: "!rounded-full" },
  ],
  defaultVariants: { variant: "default", size: "default" },
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    // Square icon buttons become knobs. Handled here rather than in cva so the
    // stomp classes are genuinely absent rather than overridden.
    if (size === "icon") {
      return <button ref={ref} className={cn("knob", className)} {...props} />
    }
    return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  },
)
Button.displayName = "Button"

export { buttonVariants }
