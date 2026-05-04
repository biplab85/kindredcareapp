"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, RefreshCw, Wallet } from "lucide-react";
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

      <div className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Header />

        <div className="mt-10 space-y-10">
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
        Earnings
        <span className="text-foreground/30">— § 17</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">What you&rsquo;ve earned.</span>
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        The running ledger of every visit you&rsquo;ve completed. Each payout transfers
        automatically 24 hours after the visit ends.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Four-up stat grid
 *   Pending gets a primary ring — the one the caregiver wants to
 *   watch most closely between visits. Others sit quieter.
 * ───────────────────────────────────────────────────────────── */

function StatGrid({ totals }: { totals: EarningsTotals }) {
  return (
    <section aria-label="Totals">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="Pending"
          value={formatCents(totals.pending_cents)}
          hint="awaiting transfer"
          emphasized
        />
        <Stat label="This month" value={formatCents(totals.this_month_cents)} hint={monthLabel()} />
        <Stat
          label="This year"
          value={formatCents(totals.this_year_cents)}
          hint={String(new Date().getFullYear())}
        />
        <Stat label="Lifetime" value={formatCents(totals.lifetime_cents)} hint="since joining" />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasized,
}: {
  label: string;
  value: string;
  hint: string;
  emphasized?: boolean;
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
      <p
        className={cn(
          "font-mono text-[10px] tracking-[0.22em] uppercase",
          emphasized ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-3 font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function monthLabel(): string {
  return new Date().toLocaleDateString("en-CA", { month: "long" });
}

/* ─────────────────────────────────────────────────────────────
 * Payout history — ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

function HistorySection({ rows }: { rows: EarningsHistoryRow[] }) {
  return (
    <section aria-label="Payout history">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Payout history
        <span className="text-foreground/30">— § 18</span>
      </div>

      {rows.length === 0 ? <EmptyHistoryCard /> : <HistoryList rows={rows} />}
    </section>
  );
}

function HistoryList({ rows }: { rows: EarningsHistoryRow[] }) {
  return (
    <ul className="space-y-4">
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

  // "Releases [date]" hint when the payout hasn't fired yet AND the
  // release window is still in the future.
  const showsReleaseHint =
    row.payout_status === "pending" && release !== null && release.getTime() > nowMs;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card transition-colors",
        row.payout_status === "released"
          ? "border-success/25"
          : row.payout_status === "held"
            ? "border-accent/25 bg-accent/[0.02]"
            : "border-border/60 hover:border-border",
      )}
    >
      {/* Perforated left edge — same vocabulary as saved cards */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="grid gap-4 p-5 pl-9 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8 sm:p-6 sm:pl-11">
        {/* Identity column */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
              {date
                ? date.toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Date unknown"}
            </p>
            <StatusPill status={row.payout_status} />
          </div>

          <p className="mt-2 text-lg font-semibold tracking-tight text-primary">{row.service}</p>

          {showsReleaseHint && release && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" strokeWidth={2} />
              Releases{" "}
              <span className="font-mono tabular-nums text-foreground/80">
                {release.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          )}

          {transferred && row.payout_status === "released" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-success/80">
              <CheckCircle2 className="size-3" strokeWidth={2.25} />
              Transferred{" "}
              <span className="font-mono tabular-nums">
                {transferred.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          )}
        </div>

        {/* Money column */}
        <dl className="border-t border-dashed border-border/60 pt-4 sm:border-0 sm:pt-0 sm:text-right">
          <MoneyLine label="Gross" value={formatCents(row.subtotal_cents)} />
          <MoneyLine label="Fee (7.5%)" value={`− ${formatCents(row.platform_fee_cents)}`} muted />
          <div className="mt-2 border-t border-dashed border-border/60 pt-2">
            <MoneyLine label="Net" value={formatCents(row.caregiver_payout_cents)} emphasized />
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

function StatusPill({ status }: { status: PayoutStatus }) {
  if (status === "released") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-success uppercase">
        <CheckCircle2 className="size-2.5" strokeWidth={2.25} />
        {payoutStatusLabel(status)}
      </span>
    );
  }
  if (status === "held") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-accent uppercase">
        <AlertTriangle className="size-2.5" strokeWidth={2.25} />
        {payoutStatusLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
      <Clock className="size-2.5" strokeWidth={2.25} />
      {payoutStatusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty state — before the first completed visit
 * ───────────────────────────────────────────────────────────── */

function EmptyHistoryCard() {
  return (
    <section
      aria-label="No payouts yet"
      className="rounded-3xl border-2 border-dashed border-border/60 bg-card/50 p-8 text-center sm:p-12"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Wallet className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">
        <span className="italic text-primary">Your first payout</span> is on the way.
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The moment you wrap up a visit, it shows up here — gross, fee, net, and the date the
        transfer releases.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Loading + error
 * ───────────────────────────────────────────────────────────── */

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
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
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
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-3 w-40 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <section
      aria-label="Error loading earnings"
      className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Couldn&rsquo;t load your earnings.
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
