import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

const skeletonVariants = cva(
  "animate-pulse rounded-md bg-muted",
  {
    variants: {
      variant: {
        default: "h-4 w-full",
        circle: "rounded-full",
        rect: "rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, className }))}
        {...props}
      />
    )
  }
)
Skeleton.displayName = "Skeleton"

export { Skeleton }
