"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type ConnectStatus,
  getConnectStatus,
  refreshConnectStatus,
  startConnectOnboarding,
} from "@/lib/payouts";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function PayoutsSettingsPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Payouts">
        <PayoutsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

function PayoutsView() {
  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [backendConfigured, setBackendConfigured] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await getConnectStatus();
      setStatus(res.data);
      setBackendConfigured(res.meta.stripe_configured);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getConnectStatus();
        if (!alive) return;
        setStatus(res.data);
        setBackendConfigured(res.meta.stripe_configured);
        setState("ready");

        // When caregiver returns from Stripe's hosted onboarding,
        // the return URL carries ?status=complete or ?status=refresh.
        // Fire one refresh so the UI reflects the latest state.
        const sp = new URLSearchParams(window.location.search);
        const returning = sp.get("status");
        if (returning === "complete" || returning === "refresh") {
          try {
            const fresh = await refreshConnectStatus();
            if (!alive) return;
            setStatus(fresh);
          } catch {
            // non-fatal — the initial fetch already populated state
          }
        }
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setupPending = state === "ready" && !backendConfigured;

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

      <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/settings"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to settings
        </Link>

        <Header />

        <div className="mt-10 space-y-6">
          {state === "loading" && <LoadingCard />}
          {state === "error" && <ErrorCard onRetry={reload} />}
          {state === "ready" && setupPending && <StripePendingCard />}
          {state === "ready" && !setupPending && status && (
            <ConfiguredState status={status} onChanged={reload} />
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
        Payouts
        <span className="text-foreground/30">— § 13</span>
      </div>

      <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl">
        <span className="font-normal italic text-primary">Where your earnings land.</span>
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        We hold each visit&rsquo;s payment for 24 hours after the visit ends, then transfer your
        share directly to your bank through Stripe. Your info stays with Stripe — we only see
        whether payouts are enabled.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * State A — Stripe setup pending (backend reports unconfigured)
 *   Mirrors the payment-methods pending card so caregivers + families
 *   both see the same "warming up" voice.
 * ───────────────────────────────────────────────────────────── */

function StripePendingCard() {
  return (
    <section
      aria-label="Stripe setup pending"
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.05] via-card to-card p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-24 rotate-12 rounded-full bg-primary/[0.04] blur-2xl"
      />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span className="relative grid size-16 -rotate-[6deg] place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Banknote className="size-7" strokeWidth={1.75} />
            <span className="absolute -right-2 -bottom-2 grid size-6 place-items-center rounded-full bg-background text-primary ring-1 ring-primary/25">
              <Sparkles className="size-3" strokeWidth={2} />
            </span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-foreground/30" />
            Still warming up
          </div>

          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight">
            Payouts <span className="italic text-primary">land soon.</span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Stripe isn&rsquo;t wired up in this environment yet — but your earnings are already
            being tracked. The moment Stripe is live, this page becomes your payout dashboard and
            we&rsquo;ll transfer everything that&rsquo;s accumulated.
          </p>

          <div className="my-7 border-t-2 border-dashed border-primary/20" />

          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            What goes here, once it&rsquo;s ready
          </p>

          <ul className="mt-4 space-y-3 text-sm">
            <Bullet>
              Connect your bank directly through Stripe — it takes about five minutes.
            </Bullet>
            <Bullet>
              Every visit pays out 24 hours after it ends, minus the 7.5% platform fee.
            </Bullet>
            <Bullet>
              Your earnings history, year-to-date totals, and T4A-ready statements live here too.
            </Bullet>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-[0.3rem] grid size-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <ArrowRight className="size-2.5" strokeWidth={2.25} />
      </span>
      <span className="leading-relaxed text-foreground/85">{children}</span>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Configured states (not connected / onboarding / enabled)
 * ───────────────────────────────────────────────────────────── */

function ConfiguredState({
  status,
  onChanged,
}: {
  status: ConnectStatus;
  onChanged: () => Promise<void>;
}) {
  if (!status.connected) {
    return <StartConnectCard />;
  }
  if (!status.payouts_enabled) {
    return <ContinueOnboardingCard onRefresh={onChanged} />;
  }
  return <EnabledCard status={status} />;
}

/* ─────────────────────────────────────────────────────────────
 * Not yet connected — the "open door" state
 * ───────────────────────────────────────────────────────────── */

function StartConnectCard() {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const link = await startConnectOnboarding();
      window.location.href = link.url;
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not start Stripe onboarding right now.",
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Start payout setup"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.05] via-card to-card p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-28 rotate-6 rounded-full bg-primary/[0.05] blur-2xl"
      />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Landmark className="size-7" strokeWidth={1.75} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-foreground/30" />
            One quick setup
          </div>

          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight">
            Let&rsquo;s <span className="italic text-primary">connect your bank.</span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We use Stripe to move money safely — you&rsquo;ll be sent to their secure page to share
            your banking details and verify your ID. KindredCare never sees the underlying info.
            When you come back, this page will light up green.
          </p>

          <div className="my-7 border-t-2 border-dashed border-primary/20" />

          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Have ready
          </p>

          <ul className="mt-4 space-y-3 text-sm">
            <Checklist icon={<ShieldCheck className="size-3" strokeWidth={2.25} />}>
              A government-issued photo ID — driver&rsquo;s licence, passport, or PR card.
            </Checklist>
            <Checklist icon={<Banknote className="size-3" strokeWidth={2.25} />}>
              Your Canadian bank details — transit, institution, and account numbers.
            </Checklist>
            <Checklist icon={<FileCheck className="size-3" strokeWidth={2.25} />}>
              Your SIN, for T4A reporting if you earn more than $500 in a calendar year.
            </Checklist>
          </ul>

          {errorMsg && (
            <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {errorMsg}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button onClick={start} disabled={busy} size="lg">
              {busy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <ArrowUpRight className="size-4" strokeWidth={2.25} />
              )}
              Start payout setup
            </Button>
            <p className="text-xs text-muted-foreground italic">
              Takes about five minutes. Returns you here when you&rsquo;re done.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Checklist({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-[0.3rem] grid size-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        {icon}
      </span>
      <span className="leading-relaxed text-foreground/85">{children}</span>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Connected but not yet enabled — "almost there" state
 * ───────────────────────────────────────────────────────────── */

function ContinueOnboardingCard({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<"continue" | "refresh" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function cont() {
    setBusy("continue");
    setErrorMsg(null);
    try {
      const link = await startConnectOnboarding();
      window.location.href = link.url;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not resume onboarding.");
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setErrorMsg(null);
    try {
      await refreshConnectStatus();
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not refresh status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Continue setup"
      className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/[0.04] via-card to-card p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-24 rotate-12 rounded-full bg-accent/[0.05] blur-2xl"
      />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span className="grid size-16 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
            <ArrowUpRight className="size-7" strokeWidth={1.75} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-foreground/30" />
            Still verifying
          </div>

          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight">
            Almost there — <span className="italic text-accent">finish Stripe setup.</span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Stripe still needs a few details before your bank can receive payouts. Pick up where you
            left off — they&rsquo;ll resume from the last saved step.
          </p>

          {errorMsg && (
            <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {errorMsg}
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button onClick={cont} disabled={busy !== null}>
              {busy === "continue" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <ArrowUpRight className="size-4" strokeWidth={2.25} />
              )}
              Continue setup
            </Button>
            <Button onClick={refresh} disabled={busy !== null} variant="outline">
              {busy === "refresh" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <RefreshCw className="size-4" strokeWidth={2} />
              )}
              Refresh status
            </Button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground italic">
            If Stripe has already confirmed you, tap Refresh and this page will flip to green.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Enabled — the "stamped receipt" state
 * ───────────────────────────────────────────────────────────── */

function EnabledCard({ status }: { status: ConnectStatus }) {
  const [busy, setBusy] = useState(false);

  async function manage() {
    // Once the Express account is fully onboarded, Stripe's AccountLink
    // endpoint returns the hosted dashboard URL instead of the onboarding
    // URL — same method, different landing page based on account state.
    setBusy(true);
    try {
      const link = await startConnectOnboarding();
      window.location.href = link.url;
    } catch {
      setBusy(false);
    }
  }

  const onboardedAt = status.onboarded_at ? new Date(status.onboarded_at) : null;

  return (
    <section
      aria-label="Payouts enabled"
      className="relative overflow-hidden rounded-3xl border border-success/35 bg-gradient-to-br from-success/[0.05] via-card to-card p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-28 rotate-[-8deg] rounded-full bg-success/[0.05] blur-2xl"
      />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span className="relative grid size-16 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/25">
            <CheckCircle2 className="size-7" strokeWidth={1.75} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-success/50" />
            Payouts active
          </div>

          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight">
            You&rsquo;re <span className="italic text-success">set.</span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every completed visit pays out 24 hours after it ends. Stripe takes care of the rest —
            expect each transfer in your bank a business day or two later.
          </p>

          <div className="my-7 border-t-2 border-dashed border-success/25" />

          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                Onboarded
              </dt>
              <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">
                {onboardedAt
                  ? onboardedAt.toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                Platform fee
              </dt>
              <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">
                7.5% <span className="text-muted-foreground">· deducted before transfer</span>
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={manage}
              disabled={busy}
              variant="outline"
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
            >
              {busy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <ExternalLink className="size-3.5" strokeWidth={2} />
              )}
              Manage on Stripe
            </Button>
            <p className="text-xs text-muted-foreground italic">
              Update your bank, change account details, or download statements.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States: loading, error
 * ───────────────────────────────────────────────────────────── */

function LoadingCard() {
  return (
    <div
      aria-busy="true"
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 sm:p-10"
    >
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="size-16 shrink-0 animate-pulse rounded-2xl bg-muted" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="border-t border-dashed border-border/60 pt-6">
            <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <section
      aria-label="Error loading payouts"
      className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Couldn&rsquo;t load your payout setup.
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
