"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<{ size?: "sm" | "md" | "lg" }>({});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & { size?: "sm" | "md" | "lg" }
>(({ className, size = "md", ...props }, ref) => (
  <ToggleGroupContext.Provider value={{ size }}>
    <ToggleGroupPrimitive.Root ref={ref} className={cn("flex items-center justify-center gap-1 rounded-full bg-surface p-1", className)} {...props} />
  </ToggleGroupContext.Provider>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  const { size } = React.useContext(ToggleGroupContext);
  const sizeClass = size === "sm" ? "h-9 px-3 text-small" : size === "lg" ? "h-12 px-5 text-base" : "h-10 px-4 text-callout";

  return <ToggleGroupPrimitive.Item ref={ref} className={cn("rounded-full text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-background data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-1 disabled:pointer-events-none disabled:opacity-50", sizeClass, className)} {...props} />;
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
