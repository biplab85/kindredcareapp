import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * SectionCard — the editorial-toned card wrapper used across
 * dashboard / settings / verification sections. Replaces the
 * generic shadcn Card+CardContent so the vocabulary (micro-label
 * eyebrow, soft border, deliberate padding) stays consistent.
 * ───────────────────────────────────────────────────────────── */

interface SectionCardProps {
  /** Optional eyebrow label (uppercase tracking) above the title. */
  eyebrow?: string;
  /** Section title — renders as a serif-weighted h2. */
  title?: string;
  /** Right-aligned slot for actions / status pill. */
  action?: React.ReactNode;
  /** Intro paragraph below the title. */
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Set to `false` to remove the inner padding (e.g. for full-bleed grids). */
  padded?: boolean;
}

export function SectionCard({
  eyebrow,
  title,
  action,
  description,
  children,
  className,
  padded = true,
}: SectionCardProps) {
  const hasHeader = eyebrow || title || action || description;

  return (
    <section
      className={cn(
        "rounded-3xl border border-border/60 bg-card",
        padded && "p-6 sm:p-8",
        className,
      )}
    >
      {hasHeader && (
        <header className={cn("mb-6", !padded && "px-6 pt-6 sm:px-8 sm:pt-8")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {eyebrow && (
                <div className="mb-2 flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                  <span className="h-px w-6 bg-foreground/30" />
                  {eyebrow}
                </div>
              )}
              {title && (
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
              )}
              {description && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
          </div>
        </header>
      )}

      <div className={cn(!padded && "px-6 pb-6 sm:px-8 sm:pb-8")}>{children}</div>
    </section>
  );
}
