"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn("peer inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full bg-surface-2 p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none block size-7 rounded-full bg-white shadow-1 transition-transform data-[state=checked]:translate-x-5" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
