"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Info,
  MapPin,
  Printer,
  RefreshCw,
  Stamp,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { getAnnualStatement, type StatementResponse } from "@/lib/financial-reports";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AnnualStatementPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = use(params);
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Annual statement">
        <StatementView year={Number(year)} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";
type Statement = StatementResponse["data"];

function StatementView({ year }: { year: number }) {
  const [state, setState] = useState<LoadState>("loading");
  const [statement, setStatement] = useState<Statement | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getAnnualStatement(year);
      setStatement(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [year]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAnnualStatement(year);
        if (!alive) return;
        setStatement(data);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

  return (
    <div className="relative">
      {/* Paper wash (suppressed in print) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background print:hidden" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply print:hidden"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Scoped print styles: hide dashboard chrome, tighten the card. */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, aside, [data-print-hide="true"] { display: none !important; }
          .statement-card { box-shadow: none !important; border-color: #000 !important; }
          .statement-card::before, .statement-card::after { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <div
          className="flex items-center justify-between gap-4 print:hidden"
          data-print-hide="true"
        >
          <Link
            href="/caregiver/earnings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to earnings
          </Link>

          {state === "ready" && statement && (
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
            >
              <Printer className="size-3.5" strokeWidth={2} />
              Print or save as PDF
            </Button>
          )}
        </div>

        <Header year={year} />

        <div className="mt-10">
          {state === "loading" && <LoadingCard />}
          {state === "error" && <ErrorCard onRetry={reload} />}
          {state === "ready" && statement && <StatementCard statement={statement} />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header({ year }: { year: number }) {
  return (
    <header className="print:mt-0">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Annual statement
        <span className="text-foreground/30">— § 19</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        Your{" "}
        <span className="font-normal italic text-primary">
          {year} <span className="not-italic">earnings.</span>
        </span>
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        A receipt of every completed visit in {year}, formatted for your T4A filing. Keep a copy for
        your records — the CRA doesn&rsquo;t receive a slip from us unless you cross the $500
        threshold.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Statement card — the carbon-copy receipt
 * ───────────────────────────────────────────────────────────── */

function StatementCard({ statement }: { statement: Statement }) {
  const { caregiver, totals, t4a, year, generated_at } = statement;
  const generatedAt = new Date(generated_at);

  return (
    <section
      aria-label={`Annual statement ${year}`}
      className="statement-card relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-[0_1px_0_theme(colors.foreground/0.04)] sm:p-12"
    >
      {/* Decorative corner "stamp" — suppressed in print */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-4 grid size-28 rotate-[8deg] place-items-center print:hidden"
      >
        <div className="grid size-20 place-items-center rounded-full border border-primary/30 bg-primary/[0.04] text-primary">
          <div className="text-center">
            <p className="font-mono text-[8px] tracking-[0.3em] uppercase">Year</p>
            <p className="font-mono text-base font-semibold tabular-nums">{year}</p>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          <Stamp className="size-3" strokeWidth={2} />
          Earnings statement · T4A Box 048
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">KindredCare</p>
          <span className="text-foreground/30">·</span>
          <p className="flex items-center gap-1 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            <MapPin className="size-3" strokeWidth={2} />
            Durham Region, Ontario
          </p>
        </div>
      </div>

      <div className="my-7 border-t-2 border-dashed border-border/60" />

      {/* Recipient block — formal receipt header */}
      <dl className="grid gap-6 text-sm sm:grid-cols-[2fr_1fr]">
        <div>
          <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Issued to
          </dt>
          <dd className="mt-2 text-lg font-semibold tracking-tight">{caregiver.name}</dd>
          <dd className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            {caregiver.email}
          </dd>
          {caregiver.postal_code && (
            <dd className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
              {caregiver.postal_code}
            </dd>
          )}
        </div>
        <div className="sm:text-right">
          <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Statement period
          </dt>
          <dd className="mt-2 font-mono text-sm tabular-nums text-foreground">Jan 1 – Dec 31</dd>
          <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">{year}</dd>
        </div>
      </dl>

      <div className="my-8 border-t border-border/60" />

      {/* The hero: gross earnings number */}
      <div className="relative rounded-2xl border border-primary/20 bg-primary/[0.03] p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-primary/40" />
          Gross earnings · before platform fee
        </div>
        <p className="mt-4 font-mono text-5xl leading-none font-semibold tracking-tight tabular-nums text-foreground sm:text-6xl">
          {formatDollars(totals.gross_cents)}
        </p>
        <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
          Across {totals.visits} visit{totals.visits === 1 ? "" : "s"}
        </p>
      </div>

      {/* Perforation */}
      <div className="my-8 border-t-2 border-dashed border-border/60" />

      {/* Four-up breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <BreakdownCell label="Gross" value={formatDollars(totals.gross_cents)} />
        <BreakdownCell label="Platform fee" value={`− ${formatDollars(totals.fee_cents)}`} muted />
        <BreakdownCell label="Net payout" value={formatDollars(totals.net_cents)} emphasized />
        <BreakdownCell label="Visits" value={String(totals.visits)} mono />
      </div>

      <div className="my-9 border-t border-dashed border-border/60" />

      {/* T4A block */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-5 shrink-0 text-foreground/70" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              For your T4A filing
            </div>
            <h2 className="mt-2 text-base font-semibold tracking-tight">
              Box 048 — Fees for services
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Report your <span className="font-medium text-foreground">gross earnings</span> on Box
              048 of your T4A. Platform fees aren&rsquo;t deducted at this step — they live on your
              tax return as a business expense.
            </p>

            <dl className="mt-5 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  Box 048 amount
                </dt>
                <dd className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">
                  {formatDollars(t4a.box_048_cents)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  CRA threshold
                </dt>
                <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">
                  {formatDollars(t4a.threshold_cents)} / year
                </dd>
                <dd className="mt-2">
                  {t4a.over_threshold ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                      <Stamp className="size-2.5" strokeWidth={2.25} />
                      Over threshold · slip issued
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      <Info className="size-2.5" strokeWidth={2.25} />
                      Under threshold
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {t4a.over_threshold && (
              <p className="mt-5 rounded-xl border border-accent/25 bg-accent/[0.03] p-3 text-xs leading-relaxed text-foreground/80">
                Because you earned more than{" "}
                <span className="font-mono tabular-nums">{formatDollars(t4a.threshold_cents)}</span>{" "}
                this year, KindredCare will issue you an official T4A slip by the end of February.
                You&rsquo;ll receive it by email and find it on this page too.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono tabular-nums">
          Generated{" "}
          {generatedAt.toLocaleString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p className="font-mono">KindredCare · Durham Region, Ontario</p>
      </div>
    </section>
  );
}

function BreakdownCell({
  label,
  value,
  muted,
  emphasized,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasized?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        emphasized ? "border-primary/30 bg-primary/[0.04]" : "border-border/60 bg-card",
      )}
    >
      <p className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono font-semibold tabular-nums",
          emphasized ? "text-lg text-primary sm:text-xl" : "text-base sm:text-lg",
          muted ? "text-muted-foreground" : "",
          mono ? "text-foreground" : "",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers — money formatting
 * ───────────────────────────────────────────────────────────── */

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

/* ─────────────────────────────────────────────────────────────
 * Loading + error states
 * ───────────────────────────────────────────────────────────── */

function LoadingCard() {
  return (
    <div
      aria-busy="true"
      className="relative rounded-3xl border border-border/60 bg-card p-6 sm:p-12"
    >
      <div className="flex flex-col gap-3">
        <div className="h-3 w-64 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="my-7 border-t-2 border-dashed border-border/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="my-8 border-t border-border/60" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/40" />
      <div className="my-8 border-t-2 border-dashed border-border/60" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <section
      aria-label="Error loading statement"
      className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Couldn&rsquo;t load this statement.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Either the year is outside our records or the connection wobbled. Try again.
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
