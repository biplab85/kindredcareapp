"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide eye toggle. Forwards every input prop
 * (including react-hook-form's `register()` ref/onChange in React 19) straight
 * through to the underlying Input, so it's a drop-in replacement for
 * `<Input type="password" />`.
 */
function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Lock
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11 pl-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center rounded-r-lg px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
      </button>
    </div>
  );
}

export { PasswordInput };
