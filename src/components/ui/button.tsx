import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.006em] select-none transition-[background-color,transform,opacity] duration-150 ease-standard active:scale-[0.98] active:duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        secondary: "bg-secondary text-foreground hover:bg-surface-2",
        ghost: "text-foreground hover:bg-secondary",
        link: "rounded-none px-0 text-brand-text underline-offset-4 hover:underline",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "text-foreground ring-1 ring-inset ring-border hover:bg-secondary",
      },
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        md: "h-11 px-[22px] text-[15px]",
        lg: "h-[52px] px-7 text-base font-semibold",
        xl: "h-14 px-8 text-[17px] font-semibold",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
