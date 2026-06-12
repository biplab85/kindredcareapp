"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Family-facing breakdown of the four background checks KindredCare runs.
 *
 * Previously the UI collapsed all four checks into a single "Basic Verified"
 * pill — green if all four cleared, gray otherwise. That hid the most
 * concrete trust signal we can show a family: "this caregiver was screened
 * for X, Y, and Z on these specific dates." This component surfaces each
 * check individually.
 *
 * Two variants:
 *
 * - **card**   Full grid with each row showing check name + status + date.
 *              Used on /caregivers/[id] where families are evaluating.
 * - **slim**   Four small inline chips with check name + status tone.
 *              Used on /gigs/[id] booking-decision surface and inside
 *              marketplace card hover detail.
 *
 * Tooltips explain CPIC / AML — most families have no idea what those
 * acronyms mean, and a trust signal users don't understand isn't a
 * trust signal.
 */

export type VerificationCheckType = "identity" | "cpic" | "aml" | "reference";

export type VerificationCheckStatus =
  | "not_started"
  | "pending_review"
  | "cleared"
  | "flagged"
  | "rejected";

export interface VerificationCheck {
  check_type: VerificationCheckType;
  status: VerificationCheckStatus;
  reviewed_at: string | null;
}

interface Meta {
  label: string;
  hint: string;
}

const CHECK_META: Record<VerificationCheckType, Meta> = {
  identity: {
    label: "Identity",
    hint: "Government-issued ID + selfie, reviewed by KindredCare staff.",
  },
  cpic: {
    label: "Criminal record",
    hint: "Canadian Police Information Centre (CPIC) check — flags criminal convictions on record across Canada.",
  },
  aml: {
    label: "Sanctions",
    hint: "AML/sanctions screening — checks the caregiver isn't on any financial-crimes or terrorism watchlist.",
  },
  reference: {
    label: "References",
    hint: "Two professional references contacted directly by our team.",
  },
};

const STATUS_META: Record<
  VerificationCheckStatus,
  { label: string; icon: LucideIcon; tone: Tone }
> = {
  cleared: { label: "Cleared", icon: CheckCircle2, tone: "success" },
  pending_review: { label: "In review", icon: Clock, tone: "primary" },
  not_started: { label: "Not started", icon: HelpCircle, tone: "neutral" },
  flagged: { label: "Flagged", icon: AlertTriangle, tone: "accent" },
  rejected: { label: "Rejected", icon: XCircle, tone: "destructive" },
};

type Tone = "success" | "primary" | "neutral" | "accent" | "destructive";

const TONE_PILL: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  primary: "bg-primary/10 text-primary ring-primary/20",
  neutral: "bg-muted text-muted-foreground ring-border",
  accent: "bg-accent/10 text-accent ring-accent/20",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
};

const CHECK_ORDER: VerificationCheckType[] = ["identity", "cpic", "aml", "reference"];

function normalize(checks: VerificationCheck[]): Record<VerificationCheckType, VerificationCheck> {
  const out = {} as Record<VerificationCheckType, VerificationCheck>;
  for (const type of CHECK_ORDER) {
    out[type] = checks.find((c) => c.check_type === type) ?? {
      check_type: type,
      status: "not_started",
      reviewed_at: null,
    };
  }
  return out;
}

function formatReviewedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function VerificationBreakdown({
  checks,
  variant,
  className,
}: {
  checks: VerificationCheck[];
  variant: "card" | "slim";
  className?: string;
}) {
  const indexed = normalize(checks);

  if (variant === "slim") {
    return (
      <TooltipProvider delay={250}>
        <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
          {CHECK_ORDER.map((type) => {
            const check = indexed[type];
            const status = STATUS_META[check.status];
            const Icon = status.icon;
            const meta = CHECK_META[type];
            return (
              <li key={type}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`${meta.label}: ${status.label}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40",
                          TONE_PILL[status.tone],
                        )}
                      >
                        <Icon className="size-3" strokeWidth={2.5} />
                        {meta.label}
                      </button>
                    }
                  />
                  <TooltipContent>
                    <p className="font-semibold">
                      {meta.label} — {status.label}
                    </p>
                    <p className="mt-1 max-w-[260px] text-xs leading-relaxed opacity-80">
                      {meta.hint}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delay={250}>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]",
          className,
        )}
      >
        <div className="flex min-h-14 items-center gap-2 border-b border-border px-5">
          <ShieldCheck className="size-4 text-primary" strokeWidth={2} />
          <h2 className="text-base font-semibold tracking-tight">Background checks</h2>
        </div>
        <ul className="divide-y divide-border/60">
          {CHECK_ORDER.map((type) => {
            const check = indexed[type];
            const status = STATUS_META[check.status];
            const Icon = status.icon;
            const meta = CHECK_META[type];
            const date = formatReviewedAt(check.reviewed_at);
            return (
              <li key={type} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    TONE_PILL[status.tone],
                  )}
                >
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {meta.label}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label={`About the ${meta.label} check`}
                            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <HelpCircle className="size-3.5" strokeWidth={2} />
                          </button>
                        }
                      />
                      <TooltipContent>
                        <p className="max-w-[260px] text-xs leading-relaxed">{meta.hint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {check.status === "cleared" && date
                      ? `Cleared ${date}`
                      : check.status === "pending_review"
                        ? "Awaiting admin review"
                        : check.status === "rejected" && date
                          ? `Rejected ${date}`
                          : check.status === "flagged"
                            ? "Under closer review"
                            : "Not yet submitted"}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1",
                    TONE_PILL[status.tone],
                  )}
                >
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}
