"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileText, Info, MapPin, Printer, RefreshCw } from "lucide-react";
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
    <>
      {/* Scoped print styles: hide dashboard chrome, tighten the card. */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, aside, [data-print-hide="true"] { display: none !important; }
          .statement-card { box-shadow: none !important; border-color: #000 !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <div
          className="mb-5 flex items-center justify-between gap-4 print:hidden"
          data-print-hide="true"
        >
          <Link
            href="/caregiver/earnings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back to earnings
          </Link>

          {state === "ready" && statement && (
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="cursor-pointer"
            >
              <Printer className="size-3.5" strokeWidth={2} />
              Print or save as PDF
            </Button>
          )}
        </div>

        <Header year={year} />

        <div className="mt-6">
          {state === "loading" && <LoadingCard />}
          {state === "error" && <ErrorCard onRetry={reload} />}
          {state === "ready" && statement && <StatementCard statement={statement} />}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header({ year }: { year: number }) {
  return (
    <div className="print:mt-0">
      <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
        Your {year} earnings
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        A receipt of every completed visit in {year}, formatted for your T4A filing. Keep a copy for
        your records — the CRA doesn&rsquo;t receive a slip from us unless you cross the $500
        threshold.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Statement card
 * ───────────────────────────────────────────────────────────── */

function StatementCard({ statement }: { statement: Statement }) {
  const { caregiver, totals, t4a, year, generated_at } = statement;
  const generatedAt = new Date(generated_at);

  return (
    <section
      aria-label={`Annual statement ${year}`}
      className="statement-card overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-10"
    >
      {/* Masthead */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <FileText className="size-3.5" strokeWidth={2} />
            Earnings statement · T4A Box 048
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-semibold tracking-tight text-foreground">KindredCare</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" strokeWidth={2} />
              Canada
            </span>
          </div>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/[0.06] text-center text-primary">
          <span>
            <span className="block text-[9px] font-semibold tracking-[0.18em] uppercase">Year</span>
            <span className="block text-base font-bold tabular-nums">{year}</span>
          </span>
        </span>
      </div>

      <div className="my-6 border-t border-border" />

      {/* Recipient block */}
      <dl className="grid gap-6 text-sm sm:grid-cols-[2fr_1fr]">
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Issued to
          </dt>
          <dd className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
            {caregiver.name}
          </dd>
          <dd className="mt-0.5 text-[13px] text-muted-foreground">{caregiver.email}</dd>
          {caregiver.postal_code && (
            <dd className="text-[13px] text-muted-foreground tabular-nums">
              {caregiver.postal_code}
            </dd>
          )}
        </div>
        <div className="sm:text-right">
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Statement period
          </dt>
          <dd className="mt-1.5 text-sm tabular-nums text-foreground">Jan 1 – Dec 31</dd>
          <dd className="text-sm tabular-nums text-foreground">{year}</dd>
        </div>
      </dl>

      <div className="my-6 border-t border-border" />

      {/* Hero: gross earnings */}
      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
          Gross earnings · before platform fee
        </p>
        <p className="mt-3 text-5xl leading-none font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
          {formatDollars(totals.gross_cents)}
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground tabular-nums">
          Across {totals.visits} visit{totals.visits === 1 ? "" : "s"}
        </p>
      </div>

      <div className="my-6 border-t border-border" />

      {/* Four-up breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BreakdownCell label="Gross" value={formatDollars(totals.gross_cents)} />
        <BreakdownCell label="Platform fee" value={`− ${formatDollars(totals.fee_cents)}`} muted />
        <BreakdownCell label="Net payout" value={formatDollars(totals.net_cents)} emphasized />
        <BreakdownCell label="Visits" value={String(totals.visits)} />
      </div>

      <div className="my-6 border-t border-border" />

      {/* T4A block */}
      <div className="rounded-xl border border-border bg-muted/20 p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground/70">
            <FileText className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              For your T4A filing
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
              Box 048 — Fees for services
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Report your <span className="font-medium text-foreground">gross earnings</span> on Box
              048 of your T4A. Platform fees aren&rsquo;t deducted at this step — they live on your
              tax return as a business expense.
            </p>

            <dl className="mt-5 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Box 048 amount
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {formatDollars(t4a.box_048_cents)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  CRA threshold
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground">
                  {formatDollars(t4a.threshold_cents)} / year
                </dd>
                <dd className="mt-2">
                  {t4a.over_threshold ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      <FileText className="size-3" strokeWidth={2.25} />
                      Over threshold · slip issued
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                      <Info className="size-3" strokeWidth={2.25} />
                      Under threshold
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {t4a.over_threshold && (
              <p className="mt-5 rounded-lg border border-accent/25 bg-accent/[0.04] p-3 text-xs leading-relaxed text-foreground/80">
                Because you earned more than{" "}
                <span className="font-semibold tabular-nums">
                  {formatDollars(t4a.threshold_cents)}
                </span>{" "}
                this year, KindredCare will issue you an official T4A slip by the end of February.
                You&rsquo;ll receive it by email and find it on this page too.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col gap-1 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="tabular-nums">
          Generated{" "}
          {generatedAt.toLocaleString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p>KindredCare · Canada</p>
      </div>
    </section>
  );
}

function BreakdownCell({
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
    <div
      className={cn(
        "rounded-lg border p-4",
        emphasized ? "border-primary/30 bg-primary/[0.04]" : "border-border/60 bg-muted/20",
      )}
    >
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-bold tabular-nums",
          emphasized ? "text-lg text-primary sm:text-xl" : "text-base text-foreground sm:text-lg",
          muted && "text-muted-foreground",
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
    <div aria-busy="true" className="rounded-xl border border-border bg-card p-6 sm:p-10">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-64 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="my-6 border-t border-border" />
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
      <div className="my-6 border-t border-border" />
      <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
      <div className="my-6 border-t border-border" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-muted/20 p-4">
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
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&rsquo;t load this statement.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Either the year is outside our records or the connection wobbled. Try again.
      </p>
      <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Try again
      </Button>
    </div>
  );
}
