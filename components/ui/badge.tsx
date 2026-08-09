import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]",
        deal: "border-transparent bg-[var(--deal)]/15 text-[var(--deal)]",
        source: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
        amber: "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]",
        warn: "border-transparent bg-[var(--destructive)]/15 text-[var(--destructive)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
