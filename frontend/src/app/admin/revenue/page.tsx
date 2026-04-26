"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  BadgePercent,
  CalendarDays,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  getAdminRevenue,
  type RevenueBucket,
  type RevenuePeriod,
  type RevenueResponse,
  type RevenueTotals,
  type ServiceCategoryRef,
} from "@/lib/financial-reports";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminRevenuePage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Revenue">
        <RevenueView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";
type Report = RevenueResponse["data"];

function yearStartString(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function todayString(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function RevenueView() {
  // Controlled inputs. Changes trigger an explicit reload() call, not a
  // useEffect-on-param-change (per React 19 rule against derived-state effects).
  const [period, setPeriod] = useState<RevenuePeriod>("monthly");
  const [from, setFrom] = useState<string>(() => yearStartString());
  const [to, setTo] = useState<string>(() => todayString());

  const [state, setState] = useState<LoadState>("loading");
  const [report, setReport] = useState<Report | null>(null);

  const reload = useCallback(async (next: { period: RevenuePeriod; from: string; to: string }) => {
    setState("loading");
    try {
      const data = await getAdminRevenue(next);
      setReport(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  // Initial mount only — subsequent changes go through onChange handlers.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAdminRevenue({ period, from, to });
        if (!alive) return;
        setReport(data);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPeriodChange(next: RevenuePeriod) {
    if (next === period) return;
    setPeriod(next);
    void reload({ period: next, from, to });
  }

  function onFromChange(next: string) {
    setFrom(next);
    if (next) void reload({ period, from: next, to });
  }

  function onToChange(next: string) {
    setTo(next);
    if (next) void reload({ period, from, to: next });
  }

  function retry() {
    void reload({ period, from, to });
  }

  return (
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Header />

        <Controls
          period={period}
          from={from}
          to={to}
          onPeriodChange={onPeriodChange}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onRefresh={retry}
        />

        <div className="mt-8 space-y-10">
          {state === "loading" && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={retry} />}
          {state === "ready" && report && (
            <>
              <StatGrid totals={report.totals} prior={report.prior_period.totals} />
              <TrendSection
                buckets={report.series}
                categories={report.categories}
                period={report.period}
              />
              <SeriesSection buckets={report.series} categories={report.categories} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Revenue
        <span className="text-foreground/30">— § 20</span>
      </div>

      <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl">
        <span className="font-normal italic text-primary">The books,</span> in one place.
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Platform-side revenue across the selected range. Commission is the KindredCare fee — what we
        actually keep after refunds clear. Net = commission − refunds.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls — period pills + date range
 * ───────────────────────────────────────────────────────────── */

function Controls({
  period,
  from,
  to,
  onPeriodChange,
  onFromChange,
  onToChange,
  onRefresh,
}: {
  period: RevenuePeriod;
  from: string;
  to: string;
  onPeriodChange: (p: RevenuePeriod) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Report controls"
      className="mt-8 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-6">
        {/* Period */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Period
          </p>
          <div className="mt-2 inline-flex rounded-full border border-border/70 bg-background p-1">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                aria-pressed={p === period}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  p === period
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* From */}
        <div>
          <label
            htmlFor="rev-from"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            From
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="rev-from"
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        {/* To */}
        <div>
          <label
            htmlFor="rev-to"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            To
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="rev-to"
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        <div className="ml-auto">
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Four-up stat grid
 *   Commission gets a primary ring — it's the platform's actual revenue,
 *   the number admins care about most. GMV is context, Refunds is risk.
 * ───────────────────────────────────────────────────────────── */

function StatGrid({ totals, prior }: { totals: RevenueTotals; prior: RevenueTotals }) {
  return (
    <section aria-label="Totals">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="GMV"
          value={formatDollars(totals.gmv_cents)}
          hint={`${totals.visits} visit${totals.visits === 1 ? "" : "s"}`}
          icon={<TrendingUp className="size-3.5" strokeWidth={2} />}
          delta={deltaPercent(totals.gmv_cents, prior.gmv_cents)}
        />
        <Stat
          label="Commission"
          value={formatDollars(totals.commission_cents)}
          hint="7.5% of GMV"
          icon={<BadgePercent className="size-3.5" strokeWidth={2} />}
          emphasized
          delta={deltaPercent(totals.commission_cents, prior.commission_cents)}
        />
        <Stat
          label="Refunds"
          value={formatDollars(totals.refunds_cents)}
          hint="paid back"
          icon={<ArrowDownLeft className="size-3.5" strokeWidth={2} />}
          delta={deltaPercent(totals.refunds_cents, prior.refunds_cents)}
          /* For refunds, "down" is the good direction. */
          invertDeltaTone
        />
        <Stat
          label="Net"
          value={formatDollars(totals.net_cents)}
          hint="commission − refunds"
          icon={<Wallet className="size-3.5" strokeWidth={2} />}
          delta={deltaPercent(totals.net_cents, prior.net_cents)}
        />
      </div>
    </section>
  );
}

/** Returns null when prior is zero (no meaningful comparison). */
function deltaPercent(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function Stat({
  label,
  value,
  hint,
  icon,
  emphasized,
  delta,
  invertDeltaTone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  emphasized?: boolean;
  delta?: number | null;
  /** When true, a positive delta is rendered as warn (e.g. refunds up = bad). */
  invertDeltaTone?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        emphasized
          ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/15"
          : "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-md",
            emphasized ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <p
          className={cn(
            "font-mono text-[10px] tracking-[0.22em] uppercase",
            emphasized ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        {delta !== null && delta !== undefined && (
          <DeltaPill delta={delta} invert={invertDeltaTone} />
        )}
      </div>
    </div>
  );
}

function DeltaPill({ delta, invert }: { delta: number; invert?: boolean }) {
  const isUp = delta >= 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] tabular-nums",
        isGood ? "bg-success/[0.12] text-success" : "bg-foreground/[0.06] text-foreground/70",
      )}
      title="vs prior period"
    >
      {isUp ? "▲" : "▼"}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Series section — per-bucket ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

function SeriesSection({
  buckets,
  categories,
}: {
  buckets: RevenueBucket[];
  categories: ServiceCategoryRef[];
}) {
  return (
    <section aria-label="Series">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Breakdown
        <span className="text-foreground/30">— § 21</span>
      </div>

      {buckets.length === 0 ? (
        <EmptyBuckets />
      ) : (
        <ul className="space-y-4">
          {buckets.map((b) => (
            <li key={b.bucket}>
              <BucketRow bucket={b} categories={categories} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Trend section — stacked bar chart of visits per bucket, broken
 * down by service category. Pure SVG, no chart library.
 * ───────────────────────────────────────────────────────────── */

/** Stable color stripes keyed by category index — paint never shuffles. */
const CATEGORY_HUES = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-accent)",
  "oklch(0.65 0.12 90)", // mustard
  "oklch(0.62 0.15 295)", // violet
  "oklch(0.62 0.13 200)", // teal
];

function categoryColor(catId: number, catalog: ServiceCategoryRef[]): string {
  const idx = catalog.findIndex((c) => c.id === catId);
  if (idx === -1) return "var(--color-muted)";
  return CATEGORY_HUES[idx % CATEGORY_HUES.length];
}

function TrendSection({
  buckets,
  categories,
  period,
}: {
  buckets: RevenueBucket[];
  categories: ServiceCategoryRef[];
  period: RevenuePeriod;
}) {
  if (buckets.length === 0) return null;

  const peakVisits = Math.max(1, ...buckets.map((b) => b.visits));

  return (
    <section aria-label="Trend chart">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Booking trend
        <span className="text-foreground/30">— § 22 · {period}</span>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        {/* Legend */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {categories.map((c, idx) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="block size-3 rounded-sm"
                style={{ background: CATEGORY_HUES[idx % CATEGORY_HUES.length] }}
              />
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                {c.name}
              </span>
            </span>
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
          {buckets.map((b) => (
            <TrendBar key={b.bucket} bucket={b} peak={peakVisits} categories={categories} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrendBar({
  bucket,
  peak,
  categories,
}: {
  bucket: RevenueBucket;
  peak: number;
  categories: ServiceCategoryRef[];
}) {
  // Build segments in catalog order so colors are stable across buckets.
  const segments = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: bucket.categories[String(c.id)] ?? 0,
    }))
    .filter((s) => s.count > 0);

  const ratio = bucket.visits / peak;
  const heightPct = Math.max(2, ratio * 100);

  return (
    <div className="flex min-w-[36px] flex-1 flex-col items-center gap-2">
      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
        {bucket.visits || ""}
      </span>
      <div
        className="relative w-full overflow-hidden rounded-md border border-border/40 bg-muted/30"
        style={{ height: 140 }}
        title={`${bucket.label} · ${bucket.visits} visit${bucket.visits === 1 ? "" : "s"}`}
      >
        <div
          className="absolute right-0 bottom-0 left-0 flex flex-col-reverse"
          style={{ height: `${heightPct}%` }}
        >
          {segments.map((seg) => (
            <div
              key={seg.id}
              style={{
                height: `${(seg.count / Math.max(1, bucket.visits)) * 100}%`,
                background: categoryColor(seg.id, categories),
              }}
              title={`${seg.name}: ${seg.count}`}
            />
          ))}
        </div>
      </div>
      <p className="max-w-[80px] truncate text-center font-mono text-[9px] tracking-[0.05em] text-muted-foreground">
        {bucket.label}
      </p>
    </div>
  );
}

function BucketRow({
  bucket,
  categories,
}: {
  bucket: RevenueBucket;
  categories: ServiceCategoryRef[];
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card transition-colors",
        bucket.refunds_cents > 0
          ? "border-accent/25 bg-accent/[0.01]"
          : "border-border/60 hover:border-border",
      )}
    >
      {/* Perforated left edge — echoes the earnings dashboard */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="grid gap-4 p-5 pl-9 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-6 sm:pl-11">
        {/* Identity */}
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-primary">{bucket.label}</p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            <Receipt className="size-3" strokeWidth={2} />
            {bucket.visits} visit{bucket.visits === 1 ? "" : "s"}
          </p>
          <CategoryBreakdown bucket={bucket} categories={categories} />
        </div>

        {/* Money */}
        <dl className="grid gap-1 border-t border-dashed border-border/60 pt-4 sm:border-0 sm:pt-0 sm:justify-items-end">
          <MoneyLine label="Gross" value={formatDollars(bucket.gmv_cents)} />
          <MoneyLine label="Commission" value={formatDollars(bucket.commission_cents)} />
          {bucket.refunds_cents > 0 && (
            <MoneyLine label="Refunds" value={`− ${formatDollars(bucket.refunds_cents)}`} muted />
          )}
          <div className="mt-1 border-t border-dashed border-border/60 pt-1 sm:min-w-[12rem]">
            <MoneyLine label="Net" value={formatDollars(bucket.net_cents)} emphasized />
          </div>
        </dl>
      </div>
    </article>
  );
}

function CategoryBreakdown({
  bucket,
  categories,
}: {
  bucket: RevenueBucket;
  categories: ServiceCategoryRef[];
}) {
  const present = categories
    .map((c) => ({ ...c, count: bucket.categories[String(c.id)] ?? 0 }))
    .filter((c) => c.count > 0);

  if (present.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {present.map((c) => (
        <li key={c.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="block size-2 rounded-sm"
            style={{ background: categoryColor(c.id, categories) }}
          />
          <span className="font-mono text-[10px] tracking-[0.05em] text-muted-foreground">
            {c.name}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-foreground/70">{c.count}</span>
        </li>
      ))}
    </ul>
  );
}

function MoneyLine({
  label,
  value,
  muted,
  emphasized,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 sm:justify-end">
      <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          emphasized ? "text-base font-semibold text-foreground" : "text-sm",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error
 * ───────────────────────────────────────────────────────────── */

function EmptyBuckets() {
  return (
    <section
      aria-label="No revenue in range"
      className="rounded-3xl border-2 border-dashed border-border/60 bg-card/50 p-8 text-center sm:p-12"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <TrendingUp className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">
        No revenue <span className="italic text-primary">in this window.</span>
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Try widening the date range, or flip to a coarser period. The books look empty — which
        usually means we&rsquo;re just early.
      </p>
    </section>
  );
}

function LoadingView() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
            aria-busy="true"
          >
            <div className="flex items-center gap-2">
              <div className="size-6 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative rounded-2xl border border-border/60 bg-card p-5 pl-9 sm:p-6 sm:pl-11"
            aria-busy="true"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.15)_1px,transparent_1.5px)] bg-[length:100%_12px]"
            />
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-3 w-40 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-label="Error loading revenue"
      className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Couldn&rsquo;t load revenue for this range.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A hiccup on our end, most likely. Try again in a moment.
          </p>
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}
