import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex h-6 items-center rounded-full px-2.5 text-micro", {
  variants: {
    variant: {
      neutral: "bg-surface text-foreground",
      brand: "bg-info-tint text-brand-text",
      success: "bg-success-tint text-success",
      warning: "bg-warning-tint text-warning",
      danger: "bg-danger-tint text-danger-text",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
