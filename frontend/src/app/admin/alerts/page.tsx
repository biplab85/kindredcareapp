"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  Bell,
  BellOff,
  Eye,
  Flag,
  LayoutGrid,
  type LucideIcon,
  MoreVertical,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Table as TableIcon,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
type ViewMode = "grid" | "table";

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
  const [view, setView] = useState<ViewMode>("grid");
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
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Header />

      <KindBar
        byKind={byKind}
        selected={selectedKinds}
        loading={state === "loading"}
        onToggle={toggleKind}
        onClear={clearFilters}
        onRefresh={retry}
      />

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <ResultMeta total={total} state={state} hasFilters={selectedKinds.size > 0} />
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      <div>
        {state === "loading" && !resp && <LoadingView view={view} />}
        {state === "error" && <ErrorCard onRetry={retry} />}
        {state !== "error" &&
          resp &&
          (resp.data.length === 0 ? (
            <QuietState hasFilters={selectedKinds.size > 0} />
          ) : view === "table" ? (
            <AlertTable alerts={resp.data} />
          ) : (
            <Feed alerts={resp.data} />
          ))}
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
        Alerts
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Open panic alerts, incidents, disputes, flagged visits, flagged verifications, and flagged
        reviews — aggregated and ranked by severity. Each card links to the surface where you can
        act on it.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Kind bar — filterable counts
 * ───────────────────────────────────────────────────────────── */

function KindBar({
  byKind,
  selected,
  loading,
  onToggle,
  onClear,
  onRefresh,
}: {
  byKind: Partial<Record<AlertKind, number>>;
  selected: Set<AlertKind>;
  loading: boolean;
  onToggle: (k: AlertKind) => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Filter by kind"
      className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="mr-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Kind
        </span>
        {KIND_ORDER.map((kind) => {
          const count = byKind[kind] ?? 0;
          const isSelected = selected.has(kind);
          const Icon = KIND_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onToggle(kind)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary",
              )}
            >
              <Icon className="size-3.5" strokeWidth={2.25} />
              {KIND_LABELS[kind]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button onClick={onClear} variant="ghost" size="sm" className="cursor-pointer">
              Clear
            </Button>
          )}
          <Button onClick={onRefresh} variant="outline" size="sm" className="cursor-pointer">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

const KIND_ICONS: Record<AlertKind, LucideIcon> = {
  panic: AlertOctagon,
  incident: ShieldAlert,
  dispute: Bell,
  flagged_booking: Flag,
  flagged_verification: Flag,
  flagged_review: Star,
};

/* ─────────────────────────────────────────────────────────────
 * View switcher + actions menu
 * ───────────────────────────────────────────────────────────── */

function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { value: "grid", label: "Grid view", icon: LayoutGrid },
    { value: "table", label: "Table view", icon: TableIcon },
  ];
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {options.map((o) => {
        const Icon = o.icon;
        const active = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-label={o.label}
            aria-pressed={active}
            title={o.label}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-lg transition-colors",
              active
                ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

function AlertActionsMenu({ targetUrl }: { targetUrl: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Alert actions"
        className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-32">
        <DropdownMenuItem
          render={<Link href={targetUrl} />}
          className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
        >
          <Eye className="size-4 text-muted-foreground" />
          View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Aggregating…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">
            {total === 1 ? "alert" : "alerts"}
            {hasFilters && " · filtered"}
          </span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Feed
 * ───────────────────────────────────────────────────────────── */

function Feed({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </div>
  );
}

const ICON_TILE_TONES: Record<AlertTone, string> = {
  alarm: "bg-accent/10 text-accent",
  warn: "bg-foreground/10 text-foreground/70",
  neutral: "bg-muted text-muted-foreground",
};

// Gradient for the card header band, keyed off severity tone.
const HEADER_TONES: Record<AlertTone, string> = {
  alarm: "from-accent/15 via-accent/5",
  warn: "from-foreground/10 via-foreground/5",
  neutral: "from-primary/12 via-primary/5",
};

function AlertCard({ alert }: { alert: Alert }) {
  const tone = severityTone(alert.severity);
  const occurred = alert.occurred_at ? new Date(alert.occurred_at) : null;
  const Icon = KIND_ICONS[alert.kind];

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(10,14,40,0.28)]",
        tone === "alarm"
          ? "border-accent/40 hover:border-accent/60"
          : "border-border hover:border-primary/30",
      )}
    >
      {/* Header band — gradient keyed off severity tone */}
      <div
        className={cn(
          "relative h-20 w-full overflow-hidden bg-gradient-to-br to-transparent",
          HEADER_TONES[tone],
        )}
      >
        <div className="absolute top-2.5 right-2.5">
          <AlertActionsMenu targetUrl={alert.target_url} />
        </div>
      </div>

      {/* Icon tile overlapping the band */}
      <div className="px-4">
        <Link href={alert.target_url} aria-label={alert.title}>
          <span
            className={cn(
              "-mt-9 grid size-16 place-items-center rounded-2xl ring-4 ring-card transition-transform group-hover:scale-[1.03]",
              ICON_TILE_TONES[tone],
            )}
          >
            <Icon className="size-7" strokeWidth={2} />
          </span>
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
        <Link
          href={alert.target_url}
          className="line-clamp-1 text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          {alert.title}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SeverityPill severity={alert.severity} tone={tone} />
          <KindPill kind={alert.kind} />
        </div>

        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {alert.summary}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {occurred ? (
            <span className="tabular-nums text-muted-foreground/70">
              {occurred.toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span />
          )}
          {alert.actor && (
            <span className="truncate text-right">
              <span className="capitalize text-muted-foreground/70">{alert.actor.role}</span>{" "}
              <span className="font-medium text-foreground/80">{alert.actor.name}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Table view — striped + hover
 * ───────────────────────────────────────────────────────────── */

function AlertTable({ alerts }: { alerts: Alert[] }) {
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>Alert</th>
              <th className={th}>Kind</th>
              <th className={th}>Severity</th>
              <th className={th}>When</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <AlertTableRow key={a.id} alert={a} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertTableRow({ alert }: { alert: Alert }) {
  const tone = severityTone(alert.severity);
  const occurred = alert.occurred_at ? new Date(alert.occurred_at) : null;
  const Icon = KIND_ICONS[alert.kind];

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5">
        <Link href={alert.target_url} className="group flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              ICON_TILE_TONES[tone],
            )}
          >
            <Icon className="size-4.5" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground group-hover:text-primary">
              {alert.title}
            </span>
            <span className="block max-w-md truncate text-xs text-muted-foreground/70">
              {alert.summary}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <KindPill kind={alert.kind} />
      </td>
      <td className="px-4 py-3">
        <SeverityPill severity={alert.severity} tone={tone} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
        {occurred ? occurred.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "—"}
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <AlertActionsMenu targetUrl={alert.target_url} />
      </td>
    </tr>
  );
}

function SeverityPill({ severity, tone }: { severity: AlertSeverity; tone: AlertTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {severity}
    </span>
  );
}

function KindPill({ kind }: { kind: AlertKind }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
      {KIND_LABELS[kind]}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function QuietState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-success/40 bg-success/[0.04] px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-success/10 text-success">
        {hasFilters ? (
          <BellOff className="size-7" strokeWidth={1.75} />
        ) : (
          <Sparkles className="size-7" strokeWidth={1.75} />
        )}
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        {hasFilters ? "Nothing in that slice." : "All clear — nothing urgent."}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try a different combination of kinds, or clear filters."
          : "No open panic alerts, incidents, disputes, or flagged items right now."}
      </p>
    </div>
  );
}

function LoadingView({ view }: { view: ViewMode }) {
  if (view === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0"
          >
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-20 w-full animate-pulse bg-muted" />
          <div className="px-4">
            <div className="-mt-9 size-16 animate-pulse rounded-2xl bg-muted ring-4 ring-card" />
          </div>
          <div className="space-y-2 px-4 pt-3 pb-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the feed.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again.
      </p>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}
