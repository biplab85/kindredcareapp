"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
  showValue?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export function StarRating({
  value,
  onChange,
  max = 5,
  size = "md",
  readonly = false,
  showValue = false,
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const isInteractive = !readonly && !!onChange;
  const displayValue = hoverValue || value;

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="group"
      aria-label="Rating"
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= displayValue;
        const isHalf = !isFilled && starValue - 0.5 <= displayValue;

        return (
          <button
            key={starValue}
            type="button"
            disabled={!isInteractive}
            className={cn(
              "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              isInteractive && "cursor-pointer hover:scale-110 transition-transform",
              !isInteractive && "cursor-default",
            )}
            onClick={() => onChange?.(starValue)}
            onMouseEnter={() => isInteractive && setHoverValue(starValue)}
            onMouseLeave={() => isInteractive && setHoverValue(0)}
            aria-label={`${starValue} star${starValue !== 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                sizeMap[size],
                isFilled && "fill-amber-400 text-amber-400",
                isHalf && "fill-amber-400/50 text-amber-400",
                !isFilled && !isHalf && "fill-transparent text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
      {showValue && (
        <span className="ml-1.5 text-sm font-medium text-muted-foreground tabular-nums">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
