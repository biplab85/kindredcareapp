import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * MetricCard — editorial-toned dashboard tile. Replaces the
 * generic shadcn Card + icon + number pattern with a more
 * distinctive composition (tabular-num value, micro-label,
 * accent-tinted icon well, optional link arrow).
 * ───────────────────────────────────────────────────────────── */

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Small description under the value. */
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "neutral";
  /** If provided, card becomes clickable and reveals an arrow on hover. */
  href?: string;
  /** Optional trailing pill (e.g. "+3 this week"). */
  trailing?: React.ReactNode;
}

const TONE_STYLES: Record<Required<MetricCardProps>["tone"], { well: string; text: string }> = {
  primary: { well: "bg-primary/10", text: "text-primary" },
  accent: { well: "bg-accent/10", text: "text-accent" },
  success: { well: "bg-success/10", text: "text-success" },
  neutral: { well: "bg-muted", text: "text-foreground" },
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  trailing,
}: MetricCardProps) {
  const styles = TONE_STYLES[tone];

  const Inner = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between gap-5 rounded-2xl border border-border/60 bg-card p-5 transition-all",
        href &&
          "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_10px_40px_-18px_rgba(10,14,40,0.18)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid size-10 place-items-center rounded-xl", styles.well, styles.text)}>
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        {href && (
          <ArrowUpRight
            className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            strokeWidth={1.75}
          />
        )}
      </div>

      <div>
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
          {value}
        </p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </p>
        {hint && <p className="mt-2 text-sm italic leading-snug text-muted-foreground">{hint}</p>}
        {trailing && <div className="mt-3">{trailing}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {Inner}
      </Link>
    );
  }
  return Inner;
}
