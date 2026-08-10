import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
 * Two shapes, matching the sister sites rather than one radius for everything.
 *
 * The money action is a SAGE gradient, not the site accent. Green is the
 * family's "go" colour (Nicotia's .addcart, Legal-Leaf's before it), and
 * keeping the buy button green everywhere means the one button that spends
 * money looks the same on all four sites. The site accent stays on identity
 * and navigation, so the two never compete.
 *
 * Navigation-shaped variants (outline, ghost) are full pills; the commerce
 * variants keep a 10px radius so a wide CTA does not turn into a lozenge.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "rounded-[10px] bg-gradient-to-r from-[var(--sage-dk)] to-[var(--sage)] text-[#04140a] shadow-[0_4px_14px_rgba(34,197,94,.2)] hover:brightness-110 hover:shadow-[0_6px_20px_rgba(34,197,94,.35)]",
        accent:
          "rounded-[10px] bg-[var(--copper)] text-[var(--primary-foreground)] hover:bg-[var(--amber-soft)]",
        outline:
          "rounded-full border border-[var(--line)] bg-[var(--chip)] text-[var(--foreground)] hover:border-[var(--gold)] hover:text-[var(--gold)]",
        ghost: "rounded-full bg-transparent text-[var(--foreground)] hover:bg-[var(--secondary)]",
        subtle:
          "rounded-full bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]",
        destructive: "rounded-[10px] bg-[var(--destructive)] text-[#2a0d0d] hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 text-[13px] tracking-[0.02em]",
        lg: "h-12 px-6 text-sm tracking-[0.03em]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = "Button"

export { buttonVariants }
