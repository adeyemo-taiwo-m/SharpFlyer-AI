import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-2xl p-4", {
  variants: {
    variant: {
      default: "bg-info-tint text-foreground",
      success: "bg-success-tint text-success",
      warning: "bg-warning-tint text-warning",
      danger: "bg-danger-tint text-danger-text",
    },
  },
  defaultVariants: { variant: "default" },
});

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...props }, ref) => <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />);
Alert.displayName = "Alert";
const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h5 ref={ref} className={cn("text-body-strong font-semibold", className)} {...props} />);
AlertTitle.displayName = "AlertTitle";
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("mt-1 text-small opacity-90", className)} {...props} />);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
