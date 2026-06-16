"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/**
 * shadcn-style single-thumb slider on Base UI primitives. Mirrors the
 * project's other ui/* wrappers (data-slot, token-driven styling). Base UI
 * positions the indicator + thumb; we only provide the visual treatment.
 */
function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative w-full select-none", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full touch-none items-center py-2">
        <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-muted">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-5 rounded-full border-2 border-primary bg-background shadow-sm outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
