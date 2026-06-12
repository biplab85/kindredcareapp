"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Landmark,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
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
import { cn } from "@/lib/utils";

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
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/settings"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Payouts</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We hold each visit&rsquo;s payment for 24 hours after the visit ends, then transfer your
          share directly to your bank through Stripe. Your info stays with Stripe — we only see
          whether payouts are enabled.
        </p>
      </header>

      <div className="mt-6 space-y-6">
        {state === "loading" && <LoadingCard />}
        {state === "error" && <ErrorCard onRetry={reload} />}
        {state === "ready" && setupPending && <StripePendingCard />}
        {state === "ready" && !setupPending && status && (
          <ConfiguredState status={status} onChanged={reload} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared card shell
 * ───────────────────────────────────────────────────────────── */

const TONES = {
  primary: {
    tile: "bg-primary/10 text-primary ring-primary/20",
    band: "from-primary/[0.06]",
    pill: "bg-primary/10 text-primary ring-primary/20",
  },
  accent: {
    tile: "bg-accent/10 text-accent ring-accent/20",
    band: "from-accent/[0.06]",
    pill: "bg-accent/10 text-accent ring-accent/25",
  },
  success: {
    tile: "bg-success/10 text-success ring-success/25",
    band: "from-success/[0.06]",
    pill: "bg-success/10 text-success ring-success/30",
  },
} as const;

function StateCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  status,
  children,
}: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  status: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-br to-transparent px-6 py-4 sm:px-8",
          t.band,
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", t.tile)}>
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
            t.pill,
          )}
        >
          {status}
        </span>
      </div>
      <div className="px-6 py-6 sm:px-8">{children}</div>
    </section>
  );
}

function FeatureRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="pt-0.5 text-sm leading-relaxed text-foreground/90">{children}</span>
    </li>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {message}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * State A — Stripe setup pending (backend reports unconfigured)
 * ───────────────────────────────────────────────────────────── */

function StripePendingCard() {
  return (
    <StateCard
      tone="primary"
      icon={Banknote}
      title="Payouts are warming up"
      subtitle="Stripe isn't live in this environment yet"
      status="Coming soon"
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Your earnings are already being tracked. The moment Stripe is live, this page becomes your
        payout dashboard and we&rsquo;ll transfer everything that&rsquo;s accumulated.
      </p>

      <p className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        What goes here, once it&rsquo;s ready
      </p>
      <ul className="mt-3 space-y-2.5">
        <FeatureRow icon={Landmark}>
          Connect your bank directly through Stripe — it takes about five minutes.
        </FeatureRow>
        <FeatureRow icon={Banknote}>
          Every visit pays out 24 hours after it ends, minus the 7.5% platform fee.
        </FeatureRow>
        <FeatureRow icon={FileCheck}>
          Your earnings history, year-to-date totals, and T4A-ready statements live here too.
        </FeatureRow>
      </ul>
    </StateCard>
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
 * Not yet connected
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
    <StateCard
      tone="primary"
      icon={Landmark}
      title="Connect your bank"
      subtitle="One quick setup with Stripe"
      status="Not connected"
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        We use Stripe to move money safely — you&rsquo;ll be sent to their secure page to share your
        banking details and verify your ID. KindredCare never sees the underlying info. When you
        come back, this page will light up green.
      </p>

      <p className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Have ready
      </p>
      <ul className="mt-3 space-y-2.5">
        <FeatureRow icon={ShieldCheck}>
          A government-issued photo ID — driver&rsquo;s licence, passport, or PR card.
        </FeatureRow>
        <FeatureRow icon={Banknote}>
          Your Canadian bank details — transit, institution, and account numbers.
        </FeatureRow>
        <FeatureRow icon={FileCheck}>
          Your SIN, for T4A reporting if you earn more than $500 in a calendar year.
        </FeatureRow>
      </ul>

      {errorMsg && <ErrorNote message={errorMsg} />}

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button onClick={start} disabled={busy} size="lg">
          {busy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <ArrowUpRight className="size-4" strokeWidth={2.25} />
          )}
          Start payout setup
        </Button>
        <p className="text-xs text-muted-foreground">
          Takes about five minutes. Returns you here when you&rsquo;re done.
        </p>
      </div>
    </StateCard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Connected but not yet enabled
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
    <StateCard
      tone="accent"
      icon={ArrowUpRight}
      title="Finish your Stripe setup"
      subtitle="Stripe still needs a few details"
      status="In progress"
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Stripe still needs a few details before your bank can receive payouts. Pick up where you
        left off — they&rsquo;ll resume from the last saved step.
      </p>

      {errorMsg && <ErrorNote message={errorMsg} />}

      <div className="mt-6 flex flex-wrap items-center gap-3">
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

      <p className="mt-4 text-xs text-muted-foreground">
        If Stripe has already confirmed you, tap Refresh and this page will flip to green.
      </p>
    </StateCard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Enabled
 * ───────────────────────────────────────────────────────────── */

function EnabledCard({ status }: { status: ConnectStatus }) {
  const [busy, setBusy] = useState(false);

  async function manage() {
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
    <StateCard
      tone="success"
      icon={CheckCircle2}
      title="You're all set"
      subtitle="Payouts are active on your account"
      status="Active"
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every completed visit pays out 24 hours after it ends. Stripe takes care of the rest —
        expect each transfer in your bank a business day or two later.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Onboarded
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            {onboardedAt
              ? onboardedAt.toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Platform fee
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            7.5%{" "}
            <span className="font-normal text-muted-foreground">· deducted before transfer</span>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button onClick={manage} disabled={busy} variant="outline">
          {busy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          ) : (
            <ExternalLink className="size-3.5" strokeWidth={2} />
          )}
          Manage on Stripe
        </Button>
        <p className="text-xs text-muted-foreground">
          Update your bank, change account details, or download statements.
        </p>
      </div>
    </StateCard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States: loading, error
 * ───────────────────────────────────────────────────────────── */

function LoadingCard() {
  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-border px-6 py-4 sm:px-8">
        <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
      <div className="space-y-3 px-6 py-6 sm:px-8">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
        <div className="mt-2 h-14 w-full animate-pulse rounded-xl bg-muted/50" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <section
      aria-label="Error loading payouts"
      className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
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
