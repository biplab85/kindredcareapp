import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * PageHeader — the editorial page intro used across every
 * signed-in route. Renders the § marker + display + body so
 * individual pages don't keep duplicating the same block.
 * ───────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  /** The small uppercase label rendered above the display. */
  eyebrow: string;
  /** The § NN code rendered after the eyebrow (e.g. "§ 01"). */
  marker?: string;
  /** The main display block — accepts JSX so pages can add an italic emphasis span. */
  display: React.ReactNode;
  /** Lede paragraph under the display. */
  body?: React.ReactNode;
  /** Right-aligned actions (CTAs, status badges). */
  actions?: React.ReactNode;
  /** Small footnote/meta line below the body (tabular-nums friendly). */
  meta?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  marker,
  display,
  body,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("relative", className)}>
      <div className="flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        {eyebrow}
        {marker && <span className="text-foreground/30">— {marker}</span>}
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-[3.25rem]">
          {display}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {body && (
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
      )}

      {meta && (
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {meta}
        </p>
      )}
    </header>
  );
}
