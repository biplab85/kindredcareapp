"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Car,
  ChefHat,
  CheckCircle2,
  Clock,
  Flower2,
  Footprints,
  Heart,
  type LucideIcon,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  SprayCan,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type EarningsHistoryRow,
  type EarningsTotals,
  formatCents,
  getEarnings,
  payoutStatusLabel,
  type PayoutStatus,
} from "@/lib/payouts";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function CaregiverEarningsPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Earnings">
        <EarningsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

function EarningsView() {
  const [state, setState] = useState<LoadState>("loading");
  const [totals, setTotals] = useState<EarningsTotals | null>(null);
  const [history, setHistory] = useState<EarningsHistoryRow[]>([]);

  const reload = useCallback(async () => {
    try {
      const data = await getEarnings();
      setTotals(data.totals);
      setHistory(data.history);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getEarnings();
        if (!alive) return;
        setTotals(data.totals);
        setHistory(data.history);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Header />

      <div className="mt-6 space-y-8">
        {state === "loading" && <LoadingView />}
        {state === "error" && <ErrorCard onRetry={reload} />}
        {state === "ready" && totals && (
          <>
            <StatGrid totals={totals} />
            <HistorySection rows={history} />
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
        Earnings
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        The running ledger of every visit you&rsquo;ve completed. Each payout transfers
        automatically 48 hours after the visit ends.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * KPI tiles — Metronic demo1 treatment: a faint tonal gradient
 * wash, a solid colour-coded icon badge, an oversized value and a
 * supporting hint. Mirrors the dashboard's MetricTile so the two
 * surfaces read as one product.
 * ───────────────────────────────────────────────────────────── */

type Tone = "primary" | "accent" | "success" | "neutral";

const TILE_STYLES: Record<Tone, { grad: string; ring: string; badge: string }> = {
  primary: {
    grad: "from-primary/[0.14] via-primary/[0.04] to-transparent",
    ring: "border-primary/20",
    badge: "bg-primary text-primary-foreground",
  },
  accent: {
    grad: "from-accent/[0.14] via-accent/[0.04] to-transparent",
    ring: "border-accent/20",
    badge: "bg-accent text-accent-foreground",
  },
  success: {
    grad: "from-success/[0.14] via-success/[0.04] to-transparent",
    ring: "border-success/20",
    badge: "bg-success text-success-foreground",
  },
  neutral: {
    grad: "from-foreground/[0.08] via-foreground/[0.02] to-transparent",
    ring: "border-border/60",
    badge: "bg-foreground/80 text-background",
  },
};

function StatGrid({ totals }: { totals: EarningsTotals }) {
  return (
    <section aria-label="Totals">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending payout"
          value={formatCents(totals.pending_cents)}
          hint="In 48h escrow — not yet in your bank"
          icon={Wallet}
          tone="primary"
        />
        <StatTile
          label="Earned this month"
          value={formatCents(totals.this_month_cents)}
          hint={`${formatCents(totals.this_month_released_cents)} paid out · ${monthLabel()}`}
          icon={CalendarDays}
          tone="success"
        />
        <StatTile
          label="Earned this year"
          value={formatCents(totals.this_year_cents)}
          hint={`${formatCents(totals.this_year_released_cents)} paid out · ${new Date().getFullYear()}`}
          icon={CalendarRange}
          tone="accent"
        />
        <StatTile
          label="Lifetime earned"
          value={formatCents(totals.lifetime_cents)}
          hint={`${formatCents(totals.lifetime_released_cents)} paid out · since joining`}
          icon={TrendingUp}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const s = TILE_STYLES[tone];
  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-[0_1px_3px_rgba(10,14,40,0.06)]",
        s.ring,
      )}
    >
      {/* tonal gradient wash */}
      <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", s.grad)} />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", s.badge)}>
            <Icon className="size-[1.1rem]" strokeWidth={2} />
          </span>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {label}
          </p>
        </div>
        <p className="mt-4 text-3xl leading-none font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function monthLabel(): string {
  return new Date().toLocaleDateString("en-CA", { month: "long" });
}

/* ─────────────────────────────────────────────────────────────
 * Payout history — a statement-style ledger. On desktop it reads as
 * a true column-aligned table (Service · Family paid · Platform fee
 * · Net payout · Status) under a labelled header row, closing with a
 * totals footer. On mobile each entry collapses into a clean stacked
 * card. Restraint over ornament — the high-end SaaS register look.
 * ───────────────────────────────────────────────────────────── */

// Column template shared by the header row and every data row so the
// columns stay pixel-aligned. One source of truth avoids drift.
const LEDGER_COLS =
  "sm:grid sm:grid-cols-[minmax(0,1.8fr)_1fr_1fr_1.15fr_auto] sm:items-center sm:gap-4";

function HistorySection({ rows }: { rows: EarningsHistoryRow[] }) {
  const grossTotal = rows.reduce((sum, r) => sum + r.subtotal_cents, 0);
  const feeTotal = rows.reduce((sum, r) => sum + r.platform_fee_cents, 0);
  const netTotal = rows.reduce((sum, r) => sum + r.caregiver_payout_cents, 0);
  const pendingNet = rows
    .filter((r) => r.payout_status === "pending")
    .reduce((sum, r) => sum + r.caregiver_payout_cents, 0);

  return (
    <section aria-label="Payout history">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(10,14,40,0.06)]">
        {/* card-header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Payout history
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Every completed visit, with its full fee breakdown.
            </p>
          </div>
          {pendingNet > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-warning/25 bg-warning/[0.1] py-1.5 pr-4 pl-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-warning/20 text-warning-foreground">
                <Clock className="size-3.5" strokeWidth={2.25} />
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-foreground tabular-nums">
                  {formatCents(pendingNet)}
                </p>
                <p className="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                  In escrow
                </p>
              </div>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="border-t border-border">
            <EmptyHistory />
          </div>
        ) : (
          <>
            {/* column header (desktop only) */}
            <div
              className={cn("hidden border-y border-border bg-muted/40 px-6 py-2.5", LEDGER_COLS)}
            >
              <ColHead className="text-left">Service</ColHead>
              <ColHead className="text-right">Family paid</ColHead>
              <ColHead className="text-right">Platform fee</ColHead>
              <ColHead className="text-right">Net payout</ColHead>
              <ColHead className="text-right">Status</ColHead>
            </div>

            <ul className="divide-y divide-border border-t border-border sm:border-t-0">
              {rows.map((row) => (
                <li key={row.booking_id}>
                  <HistoryRow row={row} />
                </li>
              ))}
            </ul>

            {/* totals footer — statement-style summary */}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border bg-muted/30 px-6 py-3.5">
              <p className="text-[13px] text-muted-foreground">
                {rows.length} payout{rows.length === 1 ? "" : "s"}
                <span className="mx-2 text-border">·</span>
                Gross{" "}
                <span className="font-medium text-foreground/80 tabular-nums">
                  {formatCents(grossTotal)}
                </span>
                <span className="mx-2 text-border">·</span>
                Fees{" "}
                <span className="font-medium text-foreground/80 tabular-nums">
                  {formatCents(feeTotal)}
                </span>
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                  Net total
                </span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {formatCents(netTotal)}
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ColHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/90 uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Service-category → glyph, matched on keywords in the service name so a
   missing slug never breaks the row. Companionship + unknown fall to Heart. */
const CATEGORY_ICONS: ReadonlyArray<readonly [readonly string[], LucideIcon]> = [
  [["tech"], Smartphone],
  [["errand", "shop", "grocer"], ShoppingBag],
  [["walk"], Footprints],
  [["garden"], Flower2],
  [["cook", "meal"], ChefHat],
  [["transport", "drive", "ride"], Car],
  [["clean", "housekeep"], SprayCan],
];

/* Per-status dot + chip theming for the StatusBadge. */
const STATUS_META: Record<PayoutStatus, { dot: string; text: string; chip: string }> = {
  pending: {
    dot: "bg-warning",
    text: "text-warning-foreground",
    chip: "bg-warning/[0.15] ring-warning/30",
  },
  released: {
    dot: "bg-success",
    text: "text-success",
    chip: "bg-success/[0.08] ring-success/15",
  },
  held: { dot: "bg-accent", text: "text-accent", chip: "bg-accent/[0.08] ring-accent/15" },
};

function HistoryRow({ row }: { row: EarningsHistoryRow }) {
  // Snapshot "now" at mount so render stays pure. The release-hint copy
  // doesn't need real-time freshness — the list reloads whenever the
  // caregiver revisits the page.
  const [nowMs] = useState(() => Date.now());

  const date = row.check_out_at ? new Date(row.check_out_at) : null;
  const release = row.payout_at ? new Date(row.payout_at) : null;
  const transferred = row.payout_transferred_at ? new Date(row.payout_transferred_at) : null;

  const showsReleaseHint =
    row.payout_status === "pending" && release !== null && release.getTime() > nowMs;

  const serviceKey = row.service.toLowerCase();
  const Icon =
    CATEGORY_ICONS.find(([keys]) => keys.some((k) => serviceKey.includes(k)))?.[1] ?? Heart;

  return (
    <article
      className={cn(
        "grid grid-cols-1 gap-3 px-6 py-4 transition-colors hover:bg-muted/30",
        LEDGER_COLS,
      )}
    >
      {/* Service — glyph + name + date, with status inline on mobile only */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/[0.07] text-primary ring-1 ring-primary/10">
          <Icon className="size-[1.15rem]" strokeWidth={1.875} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {row.service}
            </p>
            <StatusBadge status={row.payout_status} className="sm:hidden" />
          </div>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
            <CalendarDays className="size-3.5 text-muted-foreground/60" strokeWidth={2} />
            {date
              ? date.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Date unknown"}
            {showsReleaseHint && release && (
              <>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3 text-muted-foreground/60" strokeWidth={2} />
                  releases {release.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
              </>
            )}
            {transferred && row.payout_status === "released" && (
              <>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-3" strokeWidth={2.25} />
                  paid {transferred.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Family paid (gross) — fee-on-top, so this is the base plus platform cut */}
      <MoneyCell label="Family paid" value={formatCents(row.subtotal_cents)} />

      {/* Platform fee — subtracted from what the family paid, not from the base */}
      <MoneyCell label="Platform fee" value={`−${formatCents(row.platform_fee_cents)}`} />

      {/* Net payout — the figure that lands in the caregiver's bank */}
      <MoneyCell
        label="Net payout"
        value={formatCents(row.caregiver_payout_cents)}
        valueClassName={cn(
          "text-[15px] font-bold",
          row.payout_status === "released" ? "text-success" : "text-foreground",
        )}
      />

      {/* Status — its own column on desktop, hidden here on mobile (shown inline above) */}
      <div className="hidden sm:flex sm:justify-self-end">
        <StatusBadge status={row.payout_status} />
      </div>
    </article>
  );
}

function MoneyCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:justify-end">
      <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase sm:hidden">
        {label}
      </span>
      <span className={cn("text-sm text-muted-foreground tabular-nums", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status, className }: { status: PayoutStatus; className?: string }) {
  const s = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
        s.chip,
        s.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {payoutStatusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty state — before the first completed visit. Lives inside the
 * history card so the surface stays whole.
 * ───────────────────────────────────────────────────────────── */

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Wallet className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Your first payout is on the way.
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The moment you wrap up a visit, it shows up here — gross, fee, net, and the date the
        transfer releases.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Loading + error
 * ───────────────────────────────────────────────────────────── */

function LoadingView() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(10,14,40,0.06)]"
            aria-busy="true"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-9 animate-pulse rounded-xl bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 h-8 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(10,14,40,0.06)]">
        <div className="px-6 py-5">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-5 px-6 py-4"
              aria-busy="true"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-xl bg-muted" />
                <div>
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="hidden gap-8 sm:flex">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&rsquo;t load your earnings.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        A hiccup on our end, most likely. Try again in a moment.
      </p>
      <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Try again
      </Button>
    </div>
  );
}
