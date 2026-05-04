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

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Header />

        <Controls
          filters={filters}
          onActionChange={onActionChange}
          onTargetChange={onTargetChange}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onRefresh={retry}
        />

        <ResultMeta total={total} state={state} />

        <div className="mt-6">
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
        Audit log
        <span className="text-foreground/30">— § 28</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">The trail,</span> in chronological order.
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Every state-changing decision an admin makes lands here. Suspensions, refunds, panic
        resolutions, incident triage — appended once, never edited. Filter by action or target to
        reconstruct what happened, when, and who pulled the trigger.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls
 * ───────────────────────────────────────────────────────────── */

function Controls({
  filters,
  onActionChange,
  onTargetChange,
  onFromChange,
  onToChange,
  onRefresh,
}: {
  filters: FilterState;
  onActionChange: (v: string) => void;
  onTargetChange: (v: AuditTargetType | "all") => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Audit log controls"
      className="mt-8 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-6">
        {/* Action */}
        <div className="min-w-[160px]">
          <label
            htmlFor="audit-action"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            Action
          </label>
          <select
            id="audit-action"
            value={filters.action}
            onChange={(e) => onActionChange(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-primary/50"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || "any"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target type pills */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Target
          </p>
          <div className="mt-2 inline-flex flex-wrap rounded-full border border-border/70 bg-background p-1">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTargetChange(opt.value)}
                aria-pressed={opt.value === filters.targetType}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  opt.value === filters.targetType
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* From */}
        <div>
          <label
            htmlFor="audit-from"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            From
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="audit-from"
              type="date"
              value={filters.from}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        {/* To */}
        <div>
          <label
            htmlFor="audit-to"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            To
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="audit-to"
              type="date"
              value={filters.to}
              onChange={(e) => onToChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        <div className="ml-auto">
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="size-3.5" strokeWidth={2} />
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
    <div className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-8 bg-foreground/30" />
      <span>
        {state === "loading" ? (
          "Loading the trail…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span> entr
            {total === 1 ? "y" : "ies"}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 29</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Timeline — perforated rail down the left side
 * ───────────────────────────────────────────────────────────── */

function Timeline({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <ol className="relative space-y-4">
      {/* Continuous dotted rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-2 bottom-2 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
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
        "ml-9 rounded-2xl border bg-card p-5 transition-colors sm:p-6",
        tone === "alarm" && "border-accent/40 bg-accent/[0.03]",
        tone === "warn" && "border-foreground/15 bg-foreground/[0.02]",
        tone === "good" && "border-success/30 bg-success/[0.03]",
        tone === "neutral" && "border-border/60",
      )}
    >
      {/* Marker dot on the rail */}
      <span
        aria-hidden
        className={cn(
          "absolute top-7 -left-[3px] grid size-3 place-items-center rounded-full ring-2",
          tone === "alarm" && "bg-accent ring-accent/30",
          tone === "warn" && "bg-foreground/40 ring-foreground/15",
          tone === "good" && "bg-success ring-success/25",
          tone === "neutral" && "bg-foreground/40 ring-foreground/10",
        )}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
              {ts
                ? ts.toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
            <ToneBadge tone={tone} />
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{actionLabel(entry.action)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="inline-flex items-center gap-1">
              <ScrollText className="size-3" strokeWidth={2} />
              <span className="font-mono normal-case tracking-[0.05em]">{entry.action}</span>
            </span>
            {entry.target_type && entry.target_id !== null && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="size-3" strokeWidth={2} />
                  <span>
                    {targetTypeLabel(entry.target_type)} #{String(entry.target_id).padStart(5, "0")}
                  </span>
                </span>
              </>
            )}
          </p>
        </div>

        {entry.admin && (
          <div className="text-right">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              By
            </p>
            <p className="mt-0.5 text-sm font-medium">{entry.admin.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{entry.admin.email}</p>
          </div>
        )}
      </div>

      {entry.reason && (
        <blockquote className="mt-4 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
          &ldquo;{entry.reason}&rdquo;
        </blockquote>
      )}

      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground">
            Metadata <span className="text-foreground/30 group-open:hidden">▸</span>
            <span className="hidden text-foreground/30 group-open:inline">▾</span>
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </details>
      )}
    </article>
  );
}

function ToneBadge({ tone }: { tone: ReturnType<typeof actionTone> }) {
  if (tone === "alarm") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-accent-foreground uppercase">
        <ShieldOff className="size-2.5" strokeWidth={2.25} />
        Alarm
      </span>
    );
  }
  if (tone === "warn") {
    return (
      <span className="inline-flex items-center rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
        Note
      </span>
    );
  }
  if (tone === "good") {
    return (
      <span className="inline-flex items-center rounded-full border border-success/40 bg-success/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
      Logged
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <section className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <ScrollText className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        Nothing logged <span className="font-normal italic text-muted-foreground">yet.</span>
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Once an admin takes a state-changing action, the trail starts here.
      </p>
    </section>
  );
}

function LoadingView() {
  return (
    <ol className="relative space-y-4" aria-busy="true">
      <span
        aria-hidden
        className="pointer-events-none absolute top-2 bottom-2 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.18)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="ml-9 h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60"
        />
      ))}
    </ol>
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
          <h3 className="text-base font-semibold tracking-tight">
            Couldn&apos;t load the audit trail.
          </h3>
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
      className="mt-8 flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3"
    >
      <button
        type="button"
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors",
          canPrev ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )}
      >
        <ChevronLeft className="size-3.5" strokeWidth={2} />
        Prev
      </button>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
        Page <span className="text-foreground">{page}</span> of {lastPage}
      </p>
      <button
        type="button"
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors",
          canNext ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )}
      >
        Next
        <ChevronRight className="size-3.5" strokeWidth={2} />
      </button>
    </nav>
  );
}
