"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileCompletionRingProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { dim: 64, stroke: 5, fontSize: "text-sm", labelSize: "text-[0.55rem]" },
  md: { dim: 96, stroke: 6, fontSize: "text-xl", labelSize: "text-xs" },
  lg: { dim: 128, stroke: 7, fontSize: "text-3xl", labelSize: "text-sm" },
};

function getColor(pct: number) {
  if (pct >= 70) return { ring: "stroke-success", text: "text-success", bg: "bg-success/10" };
  if (pct >= 40) return { ring: "stroke-warning", text: "text-warning", bg: "bg-warning/10" };
  return { ring: "stroke-accent", text: "text-accent", bg: "bg-accent/10" };
}

export function ProfileCompletionRing({
  percentage,
  size = "md",
  showLabel = true,
  className,
}: ProfileCompletionRingProps) {
  const config = sizeConfig[size];
  const radius = (config.dim - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = getColor(percentage);
  const [animated, setAnimated] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    const from = 0;
    const to = percentage;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [percentage]);

  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: config.dim, height: config.dim }}>
        <svg width={config.dim} height={config.dim} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={config.dim / 2}
            cy={config.dim / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            className="stroke-muted"
          />
          {/* Progress arc */}
          <circle
            cx={config.dim / 2}
            cy={config.dim / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(color.ring, "transition-[stroke-dashoffset] duration-300")}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {percentage === 100 ? (
            <CheckCircle2
              className={cn(
                "text-success",
                size === "sm" ? "size-5" : size === "md" ? "size-7" : "size-9",
              )}
            />
          ) : (
            <span className={cn("font-bold tabular-nums", config.fontSize, color.text)}>
              {Math.round(animated)}%
            </span>
          )}
        </div>
      </div>

      {showLabel && (
        <span className={cn("font-medium", config.labelSize, color.text)}>
          {percentage >= 100
            ? "Complete!"
            : percentage >= 70
              ? "Matchable"
              : `${100 - percentage}% to go`}
        </span>
      )}
    </div>
  );
}
