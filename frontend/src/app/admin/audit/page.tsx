"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ScrollText,
  ShieldOff,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { SlideTabs } from "@/components/ui/slide-tabs";
import {
  type AuditLogEntry,
  type AuditLogResponse,
  type AuditTargetType,
  actionLabel,
  actionTone,
  getAuditLog,
  targetTypeLabel,
} from "@/lib/admin-audit";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminAuditPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Audit log">
        <AuditView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";
type AuditTone = ReturnType<typeof actionTone>;

interface FilterState {
  action: string;
  targetType: AuditTargetType | "all";
  from: string;
  to: string;
}

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any action" },
  { value: "user.suspended", label: "User suspended" },
  { value: "user.reactivated", label: "User reactivated" },
  { value: "panic.acknowledged", label: "Panic acknowledged" },
  { value: "panic.resolved", label: "Panic resolved" },
  { value: "incident.assigned", label: "Incident assigned" },
  { value: "incident.resolved", label: "Incident resolved" },
  { value: "incident.dismissed", label: "Incident dismissed" },
];

const TARGET_OPTIONS: Array<{ value: AuditTargetType | "all"; label: string }> = [
  { value: "all", label: "Anything" },
  { value: "user", label: "User" },
  { value: "panic_alert", label: "Panic" },
  { value: "incident_report", label: "Incident" },
  { value: "booking", label: "Booking" },
];

function AuditView() {
  const [filters, setFilters] = useState<FilterState>({
    action: "",
    targetType: "all",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [resp, setResp] = useState<AuditLogResponse | null>(null);

  const reload = useCallback(async (f: FilterState, p: number) => {
    setState("loading");
    try {
      const data = await getAuditLog({
        action: f.action || undefined,
        target_type: f.targetType === "all" ? undefined : f.targetType,
        from: f.from || undefined,
        to: f.to || undefined,
        page: p,
        per_page: 50,
      });
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
        const data = await getAuditLog({ page: 1, per_page: 50 });
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

  function onActionChange(next: string) {
    const f = { ...filters, action: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onTargetChange(next: AuditTargetType | "all") {
    const f = { ...filters, targetType: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onFromChange(next: string) {
    const f = { ...filters, from: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onToChange(next: string) {
    const f = { ...filters, to: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onPageChange(next: number) {
    setPage(next);
    void reload(filters, next);
  }

  function retry() {
    void reload(filters, page);
  }

  const total = resp?.meta.total ?? 0;
  const lastPage = resp?.meta.last_page ?? 1;
  const entries = resp?.data ?? [];

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Header />

      <Controls
        filters={filters}
        loading={state === "loading"}
        onActionChange={onActionChange}
        onTargetChange={onTargetChange}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onRefresh={retry}
      />

      <div className="mt-6 mb-3">
        <ResultMeta total={total} state={state} />
      </div>

      <div>
        {state === "loading" && !resp && <LoadingView />}
        {state === "error" && <ErrorCard onRetry={retry} />}
        {state !== "error" && resp && (
          <>
            {entries.length === 0 ? <EmptyState /> : <Timeline entries={entries} />}
            {entries.length > 0 && lastPage > 1 && (
              <Pagination page={page} lastPage={lastPage} onChange={onPageChange} />
            )}
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
        Audit log
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Every state-changing decision an admin makes lands here — suspensions, refunds, panic
        resolutions, incident triage — appended once, never edited. Filter by action or target to
        reconstruct what happened, when, and who pulled the trigger.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls
 * ───────────────────────────────────────────────────────────── */

const FIELD_CLASS =
  "flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50";

function Controls({
  filters,
  loading,
  onActionChange,
  onTargetChange,
  onFromChange,
  onToChange,
  onRefresh,
}: {
  filters: FilterState;
  loading: boolean;
  onActionChange: (v: string) => void;
  onTargetChange: (v: AuditTargetType | "all") => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Audit log controls"
      className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {/* Action */}
        <div className="min-w-[180px]">
          <label
            htmlFor="audit-action"
            className="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            Action
          </label>
          <select
            id="audit-action"
            value={filters.action}
            onChange={(e) => onActionChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || "any"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target type */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Target
          </p>
          <SlideTabs
            ariaLabel="Target type"
            value={filters.targetType}
            options={TARGET_OPTIONS}
            onChange={onTargetChange}
            tabWidthClass="w-[84px]"
          />
        </div>

        {/* Date range — From + To inline on one row */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Period
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="audit-from" className="text-sm font-medium text-muted-foreground">
                From
              </label>
              <div className={FIELD_CLASS}>
                <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
                <input
                  id="audit-from"
                  type="date"
                  value={filters.from}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="w-32 bg-transparent text-sm tabular-nums outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="audit-to" className="text-sm font-medium text-muted-foreground">
                To
              </label>
              <div className={FIELD_CLASS}>
                <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
                <input
                  id="audit-to"
                  type="date"
                  value={filters.to}
                  onChange={(e) => onToChange(e.target.value)}
                  className="w-32 bg-transparent text-sm tabular-nums outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto">
          <Button onClick={onRefresh} variant="outline" size="sm" className="cursor-pointer">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Result meta
 * ───────────────────────────────────────────────────────────── */

function ResultMeta({ total, state }: { total: number; state: LoadState }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Loading the trail…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">{total === 1 ? "entry" : "entries"}</span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Timeline — solid rail + tone dots
 * ───────────────────────────────────────────────────────────── */

const DOT_TONES: Record<AuditTone, string> = {
  alarm: "bg-accent",
  warn: "bg-foreground/40",
  good: "bg-success",
  neutral: "bg-muted-foreground/50",
};

function Timeline({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <ol className="relative space-y-3">
      {/* Continuous rail */}
      <span aria-hidden className="absolute top-3 bottom-3 left-[19px] w-px bg-border" />
      {entries.map((entry) => (
        <li key={entry.id} className="relative pl-12">
          <span
            aria-hidden
            className={cn(
              "absolute top-5 left-[13px] size-3 rounded-full ring-4 ring-background",
              DOT_TONES[actionTone(entry.action)],
            )}
          />
          <TimelineRow entry={entry} />
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({ entry }: { entry: AuditLogEntry }) {
  const tone = actionTone(entry.action);
  const ts = entry.created_at ? new Date(entry.created_at) : null;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-colors",
        tone === "alarm" && "border-accent/40 bg-accent/[0.03]",
        tone === "good" && "border-success/30 bg-success/[0.03]",
        (tone === "warn" || tone === "neutral") && "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {ts
                ? ts.toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
            <ToneBadge tone={tone} />
          </div>
          <h3 className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
            {actionLabel(entry.action)}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ScrollText className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
              <span className="font-medium text-muted-foreground/80">{entry.action}</span>
            </span>
            {entry.target_type && entry.target_id !== null && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
                  {targetTypeLabel(entry.target_type)} #{String(entry.target_id).padStart(5, "0")}
                </span>
              </>
            )}
          </div>
        </div>

        {entry.admin && (
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              By
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{entry.admin.name}</p>
            <p className="text-xs text-muted-foreground">{entry.admin.email}</p>
          </div>
        )}
      </div>

      {entry.reason && (
        <p className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
          {entry.reason}
        </p>
      )}

      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ChevronRight
              className="size-3.5 transition-transform group-open:rotate-90"
              strokeWidth={2}
            />
            Metadata
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </details>
      )}
    </article>
  );
}

function ToneBadge({ tone }: { tone: AuditTone }) {
  if (tone === "alarm") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
        <ShieldOff className="size-3" strokeWidth={2.25} />
        Alarm
      </span>
    );
  }
  if (tone === "good") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        Resolved
      </span>
    );
  }
  if (tone === "warn") {
    return (
      <span className="inline-flex items-center rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
        Note
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
      Logged
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <ScrollText className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Nothing logged yet.
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Once an admin takes a state-changing action, the trail starts here.
      </p>
    </div>
  );
}

function LoadingView() {
  return (
    <ol className="relative space-y-3" aria-busy="true">
      <span aria-hidden className="absolute top-3 bottom-3 left-[19px] w-px bg-border" />
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="relative pl-12">
          <span className="absolute top-5 left-[13px] size-3 rounded-full bg-muted ring-4 ring-background" />
          <div className="h-28 animate-pulse rounded-xl border border-border bg-card/60" />
        </li>
      ))}
    </ol>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the audit trail.
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

/* ─────────────────────────────────────────────────────────────
 * Pagination
 * ───────────────────────────────────────────────────────────── */

function Pagination({
  page,
  lastPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  onChange: (next: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < lastPage;

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <Button
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        variant="outline"
        size="sm"
        className="cursor-pointer"
      >
        <ChevronLeft className="size-3.5" strokeWidth={2} />
        Prev
      </Button>
      <p className="text-sm text-muted-foreground tabular-nums">
        Page <span className="font-semibold text-foreground">{page}</span> of {lastPage}
      </p>
      <Button
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        variant="outline"
        size="sm"
        className="cursor-pointer"
      >
        Next
        <ChevronRight className="size-3.5" strokeWidth={2} />
      </Button>
    </nav>
  );
}
