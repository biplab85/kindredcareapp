import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * DashboardMetric — the modern-dashboard flavour of a stat tile.
 * Big tabular-num value in DM Sans (not mono), muted uppercase
 * micro-label, tone-tinted icon chip, optional hint line, and an
 * optional link arrow that reveals on hover.
 *
 * Distinct from MetricCard (the editorial version) — this one
 * uses rounded-2xl with a much softer shadow and DM Sans value
 * so it reads as a dashboard tile, not a magazine figure.
 * ───────────────────────────────────────────────────────────── */

interface DashboardMetricProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "neutral";
  /** Renders as a clickable card when provided. */
  href?: string;
  /** Optional element rendered under the value (e.g. a tiny sparkline or delta pill). */
  trailing?: React.ReactNode;
}

const TONE_STYLES: Record<Required<DashboardMetricProps>["tone"], { well: string; text: string }> =
  {
    primary: { well: "bg-primary/10", text: "text-primary" },
    accent: { well: "bg-accent/10", text: "text-accent" },
    success: { well: "bg-success/10", text: "text-success" },
    neutral: { well: "bg-muted", text: "text-foreground" },
  };

export function DashboardMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  trailing,
}: DashboardMetricProps) {
  const styles = TONE_STYLES[tone];

  const card = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between gap-6 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all",
        href &&
          "hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_8px_24px_-12px_rgba(10,14,40,0.14)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid size-10 place-items-center rounded-xl", styles.well, styles.text)}>
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </div>
        {href && (
          <ArrowUpRight
            className="size-4 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
            strokeWidth={1.75}
          />
        )}
      </div>

      <div>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[2rem]">
          {value}
        </p>
        {hint && <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{hint}</p>}
        {trailing && <div className="mt-3">{trailing}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }
  return card;
}
