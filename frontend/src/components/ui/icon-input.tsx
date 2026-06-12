"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Input with a leading icon tucked inside the field — the premium auth-form
 * treatment. Forwards every input prop (including react-hook-form's
 * `register()` ref/onChange in React 19) straight through to Input.
 */
function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input {...props} className={cn("pl-10", className)} />
    </div>
  );
}

export { IconInput };
