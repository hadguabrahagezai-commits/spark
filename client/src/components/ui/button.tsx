import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium tracking-[0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-200 hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "spark-cta border border-primary-border shadow-[0_12px_32px_hsl(var(--primary)/0.22)]",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border shadow-[0_12px_28px_hsl(var(--destructive)/0.2)]",
        outline:
          "border [border-color:var(--button-outline)] bg-card/50 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] active:shadow-none",
        secondary: "border bg-secondary/90 text-secondary-foreground border border-secondary-border shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
        ghost: "border border-transparent bg-transparent hover:bg-white/5",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
