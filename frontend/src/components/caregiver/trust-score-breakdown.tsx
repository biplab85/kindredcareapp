"use client";

import { Award, ClipboardCheck, ShieldCheck, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Renders the four components that make up a caregiver's composite trust
 * score. The composite is a weighted average and looks the same whether
 * it came from verification, reviews, reliability, or tenure — surfacing
 * the breakdown lets a family see *why* a caregiver scored what they did.
 *
 * Weights mirror TrustScoreCalculator on the backend:
 *   verification 40% · reviews 30% · reliability 20% · tenure 10%
 *
 * For "new" caregivers (<3 reviews), the parent surface usually hides
 * the composite — but verification still scores meaningfully on its own
 * and stays visible. That's why this component renders the four bars
 * independently rather than as a stacked total.
 */

export interface TrustComponents {
  verification: number;
  reviews: number;
  reliability: number;
  tenure: number;
}

const ROWS = [
  {
    key: "verification" as const,
    label: "Verification",
    weight: 40,
    icon: ShieldCheck,
    hint: "How many of the four background checks (identity, criminal record, sanctions, references) have cleared. Weighted highest because it's the most concrete signal.",
  },
  {
    key: "reviews" as const,
    label: "Reviews",
    weight: 30,
    icon: Star,
    hint: "Average rating from past family visits. Neutral until at least 3 reviews exist so newcomers aren't penalised for having no history.",
  },
  {
    key: "reliability" as const,
    label: "Reliability",
    weight: 20,
    icon: ClipboardCheck,
    hint: "Visit completion rate and on-time check-in record. Neutral for new caregivers with no visits yet.",
  },
  {
    key: "tenure" as const,
    label: "Tenure",
    weight: 10,
    icon: Award,
    hint: "Time on the KindredCare platform, capped at one year. Small input but a useful tiebreaker.",
  },
];

export function TrustScoreBreakdown({
  components,
  className,
}: {
  components: TrustComponents;
  className?: string;
}) {
  return (
    <TooltipProvider delay={250}>
      <ul className={cn("space-y-3", className)}>
        {ROWS.map(({ key, label, weight, icon: Icon, hint }) => {
          const value = components[key];
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
                  <Icon className="size-3.5 text-primary" strokeWidth={2.25} />
                  {label}
                  <span className="font-mono text-[10px] font-medium text-muted-foreground normal-case">
                    {weight}%
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`About the ${label} component`}
                          className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <span className="text-[10px]">i</span>
                        </button>
                      }
                    />
                    <TooltipContent>
                      <p className="max-w-[260px] text-xs leading-relaxed">{hint}</p>
                    </TooltipContent>
                  </Tooltip>
                </p>
                <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {value}
                  <span className="ml-0.5 text-muted-foreground">/100</span>
                </p>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    value >= 80
                      ? "bg-success"
                      : value >= 50
                        ? "bg-primary"
                        : value > 0
                          ? "bg-accent"
                          : "bg-muted",
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
