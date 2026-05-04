"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  Bell,
  BellOff,
  Flag,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type Alert,
  type AlertKind,
  type AlertsResponse,
  type AlertSeverity,
  KIND_LABELS,
  type AlertTone,
  getAlerts,
  severityTone,
} from "@/lib/admin-alerts";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminAlertsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Alerts">
        <AlertsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

const KIND_ORDER: AlertKind[] = [
  "panic",
  "incident",
  "dispute",
  "flagged_booking",
  "flagged_verification",
  "flagged_review",
];

function AlertsView() {
  const [selectedKinds, setSelectedKinds] = useState<Set<AlertKind>>(new Set());
  const [resp, setResp] = useState<AlertsResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(async (kinds: Set<AlertKind>) => {
    setState("loading");
    try {
      const data = await getAlerts(kinds.size === 0 ? undefined : Array.from(kinds));
      setResp(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAlerts();
        if (!alive) return;
        setResp(data);
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

  function toggleKind(kind: AlertKind) {
    const next = new Set(selectedKinds);
    if (next.has(kind)) {
      next.delete(kind);
    } else {
      next.add(kind);
    }
    setSelectedKinds(next);
    void reload(next);
  }

  function clearFilters() {
    setSelectedKinds(new Set());
    void reload(new Set());
  }

  function retry() {
    void reload(selectedKinds);
  }

  const total = resp?.meta.total ?? 0;
  const byKind = resp?.meta.by_kind ?? {};

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Header />

        <KindBar
          byKind={byKind}
          selected={selectedKinds}
          onToggle={toggleKind}
          onClear={clearFilters}
          onRefresh={retry}
        />

        <ResultMeta total={total} state={state} hasFilters={selectedKinds.size > 0} />

        <div className="mt-6">
          {state === "loading" && !resp && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={retry} />}
          {state !== "error" &&
            resp &&
            (resp.data.length === 0 ? (
              <QuietState hasFilters={selectedKinds.size > 0} />
            ) : (
              <Feed alerts={resp.data} />
            ))}
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
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">Everything urgent,</span> in one place.
      </h1>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Open panic alerts, incidents, disputes, flagged visits, flagged verifications, flagged
        reviews — aggregated and ranked by severity. Each card links to the surface where you can
        act on it.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Kind bar — filterable counts
 * ───────────────────────────────────────────────────────────── */

function KindBar({
  byKind,
  selected,
  onToggle,
  onClear,
  onRefresh,
}: {
  byKind: Partial<Record<AlertKind, number>>;
  selected: Set<AlertKind>;
  onToggle: (k: AlertKind) => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Filter by kind"
      className="mt-8 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
        {KIND_ORDER.map((kind) => {
          const count = byKind[kind] ?? 0;
          const isSelected = selected.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onToggle(kind)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-background text-foreground hover:border-foreground/40",
              )}
            >
              <KindIcon kind={kind} />
              {KIND_LABELS[kind]}
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-[10px] tabular-nums",
                  isSelected
                    ? "bg-background/15 text-background"
                    : "bg-muted/60 text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button onClick={onClear} variant="outline" size="sm">
              Clear
            </Button>
          )}
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

function KindIcon({ kind }: { kind: AlertKind }) {
  const props = { className: "size-3", strokeWidth: 2.25 } as const;
  switch (kind) {
    case "panic":
      return <AlertOctagon {...props} />;
    case "incident":
      return <ShieldAlert {...props} />;
    case "dispute":
      return <Bell {...props} />;
    case "flagged_booking":
      return <Flag {...props} />;
    case "flagged_verification":
      return <Flag {...props} />;
    case "flagged_review":
      return <Star {...props} />;
  }
}

/* ─────────────────────────────────────────────────────────────
 * Result meta
 * ───────────────────────────────────────────────────────────── */

function ResultMeta({
  total,
  state,
  hasFilters,
}: {
  total: number;
  state: LoadState;
  hasFilters: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-8 bg-foreground/30" />
      <span>
        {state === "loading" ? (
          "Aggregating…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span>{" "}
            {total === 1 ? "alert" : "alerts"}
            {hasFilters && <span className="text-foreground/40"> · filtered</span>}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 44</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Feed
 * ───────────────────────────────────────────────────────────── */

function Feed({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="space-y-3">
      {alerts.map((a) => (
        <li key={a.id}>
          <AlertCard alert={a} />
        </li>
      ))}
    </ul>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const tone = severityTone(alert.severity);
  const occurred = alert.occurred_at ? new Date(alert.occurred_at) : null;

  return (
    <Link
      href={alert.target_url}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card transition-all",
        tone === "alarm" && "border-accent/50 bg-accent/[0.04] hover:border-accent",
        tone === "warn" && "border-foreground/20 hover:border-foreground/40",
        tone === "neutral" && "border-border/60 hover:border-foreground/30",
      )}
    >
      {/* Pulsing dot for active panic */}
      {alert.kind === "panic" && alert.severity === "critical" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,theme(colors.accent/0.15),transparent_60%)]"
        />
      )}

      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="flex items-center gap-4 py-4 pr-5 pl-9 sm:py-5 sm:pl-10">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            tone === "alarm" && "bg-accent text-accent-foreground",
            tone === "warn" && "bg-foreground/10 text-foreground/70",
            tone === "neutral" && "bg-muted/60 text-muted-foreground",
          )}
        >
          <KindIcon kind={alert.kind} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">{alert.title}</h3>
            <SeverityPill severity={alert.severity} tone={tone} />
            <KindPill kind={alert.kind} />
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground/75">
            {alert.summary}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {occurred && (
              <span className="font-mono normal-case tracking-[0.05em] tabular-nums">
                {occurred.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            {alert.actor && (
              <>
                {occurred && (
                  <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                )}
                <span className="normal-case tracking-[0.05em]">
                  <span className="text-foreground/60">{alert.actor.role}</span>{" "}
                  <span className="text-foreground/85">{alert.actor.name}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}

function SeverityPill({ severity, tone }: { severity: AlertSeverity; tone: AlertTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
      )}
    >
      {severity}
    </span>
  );
}

function KindPill({ kind }: { kind: AlertKind }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
      {KIND_LABELS[kind]}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function QuietState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <section className="rounded-3xl border border-dashed border-success/40 bg-success/[0.04] p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
        {hasFilters ? (
          <BellOff className="size-6" strokeWidth={1.75} />
        ) : (
          <Sparkles className="size-6" strokeWidth={1.75} />
        )}
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        {hasFilters ? (
          <>
            Nothing in <span className="font-normal italic text-success">that slice.</span>
          </>
        ) : (
          <>
            All clear, <span className="font-normal italic text-success">nothing urgent.</span>
          </>
        )}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try a different combination of kinds, or clear filters."
          : "No open panic alerts, incidents, disputes, or flagged items right now."}
      </p>
    </section>
  );
}

function LoadingView() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="h-[100px] animate-pulse rounded-2xl border border-border/60 bg-card/60"
        />
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the feed.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again.
          </p>
          <div className="mt-4">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
