"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  type LucideIcon,
  RefreshCw,
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
    <div className="max-w-4xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
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
 * Four-up stat grid — Pending leads (primary), the rest sit quieter.
 * ───────────────────────────────────────────────────────────── */

function StatGrid({ totals }: { totals: EarningsTotals }) {
  return (
    <section aria-label="Totals">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="Pending"
          value={formatCents(totals.pending_cents)}
          hint="awaiting transfer"
          icon={Wallet}
          emphasized
        />
        <Stat
          label="This month"
          value={formatCents(totals.this_month_cents)}
          hint={monthLabel()}
          icon={CalendarDays}
        />
        <Stat
          label="This year"
          value={formatCents(totals.this_year_cents)}
          hint={String(new Date().getFullYear())}
          icon={CalendarRange}
        />
        <Stat
          label="Lifetime"
          value={formatCents(totals.lifetime_cents)}
          hint="since joining"
          icon={CheckCircle2}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  emphasized,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5",
        emphasized ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg",
            emphasized ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <p
          className={cn(
            "text-[11px] font-semibold tracking-[0.12em] uppercase",
            emphasized ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function monthLabel(): string {
  return new Date().toLocaleDateString("en-CA", { month: "long" });
}

/* ─────────────────────────────────────────────────────────────
 * Payout history
 * ───────────────────────────────────────────────────────────── */

function HistorySection({ rows }: { rows: EarningsHistoryRow[] }) {
  return (
    <section aria-label="Payout history">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
        Payout history
      </h2>

      {rows.length === 0 ? <EmptyHistoryCard /> : <HistoryList rows={rows} />}
    </section>
  );
}

function HistoryList({ rows }: { rows: EarningsHistoryRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.booking_id}>
          <HistoryRow row={row} />
        </li>
      ))}
    </ul>
  );
}

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

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-colors sm:p-6",
        row.payout_status === "released"
          ? "border-success/30"
          : row.payout_status === "held"
            ? "border-accent/30 bg-accent/[0.02]"
            : "border-border",
      )}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
        {/* Identity column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-base font-semibold tracking-tight text-foreground">{row.service}</p>
            <StatusPill status={row.payout_status} />
          </div>

          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
            <CalendarDays className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
            {date
              ? date.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Date unknown"}
          </p>

          {showsReleaseHint && release && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" strokeWidth={2} />
              Releases{" "}
              <span className="font-medium tabular-nums text-foreground/80">
                {release.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </span>
            </p>
          )}

          {transferred && row.payout_status === "released" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
              Transferred{" "}
              <span className="font-medium tabular-nums">
                {transferred.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </span>
            </p>
          )}
        </div>

        {/* Money column — fee-on-top so the caregiver receives the base in
            full; the family-paid total just adds the platform's cut on top. */}
        <dl className="border-t border-border/60 pt-4 sm:border-0 sm:pt-0 sm:text-right">
          <MoneyLine label="Family paid" value={formatCents(row.subtotal_cents)} muted />
          <MoneyLine label="Platform fee" value={formatCents(row.platform_fee_cents)} muted />
          <div className="mt-2 border-t border-border/60 pt-2">
            <MoneyLine
              label="You received"
              value={formatCents(row.caregiver_payout_cents)}
              emphasized
            />
          </div>
        </dl>
      </div>
    </article>
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
    <div className="flex items-baseline justify-between gap-4 sm:justify-end sm:gap-6">
      <dt className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasized ? "text-base font-bold text-foreground" : "text-sm",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusPill({ status }: { status: PayoutStatus }) {
  if (status === "released") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <CheckCircle2 className="size-3" strokeWidth={2.25} />
        {payoutStatusLabel(status)}
      </span>
    );
  }
  if (status === "held") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
        <AlertTriangle className="size-3" strokeWidth={2.25} />
        {payoutStatusLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
      <Clock className="size-3" strokeWidth={2.25} />
      {payoutStatusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty state — before the first completed visit
 * ───────────────────────────────────────────────────────────── */

function EmptyHistoryCard() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 sm:p-5"
            aria-busy="true"
          >
            <div className="flex items-center gap-2">
              <div className="size-7 animate-pulse rounded-lg bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 sm:p-6"
            aria-busy="true"
          >
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-3 w-40 animate-pulse rounded bg-muted" />
          </div>
        ))}
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
