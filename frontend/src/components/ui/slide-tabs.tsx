"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented control with a sliding active-background pill. Equal-width tabs so
 * the indicator can animate via translateX(index * 100%) — no JS measurement.
 */
export function SlideTabs<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  tabWidthClass = "w-[92px]",
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  ariaLabel?: string;
  tabWidthClass?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="relative inline-flex rounded-lg border border-border bg-muted/40 p-1"
    >
      {/* Sliding active background */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 rounded-md bg-card shadow-xs ring-1 ring-border transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          tabWidthClass,
        )}
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 cursor-pointer rounded-md py-1.5 text-center text-xs font-medium whitespace-nowrap transition-colors",
              tabWidthClass,
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
