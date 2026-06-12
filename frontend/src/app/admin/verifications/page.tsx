"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Eye,
  LayoutGrid,
  Mail,
  MoreVertical,
  RefreshCw,
  ShieldCheck,
  ShieldX,
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
import { SlideTabs } from "@/components/ui/slide-tabs";
import {
  checkTypeLabel,
  getVerifications,
  type StatusFilter,
  statusLabel,
  type StatusTone,
  statusTone,
  type VerificationListItem,
} from "@/lib/admin-verifications";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminVerificationsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Verifications">
        <VerificationsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";
type ViewMode = "grid" | "table";

const TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "flagged", label: "Flagged" },
  { value: "not_started", label: "Not started" },
  { value: "cleared", label: "Cleared" },
  { value: "rejected", label: "Rejected" },
];

function VerificationsView() {
  const [tab, setTab] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [items, setItems] = useState<VerificationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async (next: StatusFilter) => {
    setState("loading");
    try {
      const resp = await getVerifications(next);
      setItems(resp.data);
      setTotal(resp.total);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await getVerifications("all");
        if (!alive) return;
        setItems(resp.data);
        setTotal(resp.total);
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

  function onTabChange(next: StatusFilter) {
    if (next === tab) return;
    setTab(next);
    void reload(next);
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload(tab);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
          Verifications
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each pending row is a caregiver waiting on a human decision. Approve clears the check;
          reject sends them back with a specific reason. Both land on the audit trail.
        </p>
      </div>

      {/* Filter toolbar */}
      <section
        aria-label="Filters"
        className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Status
            </p>
            <SlideTabs
              ariaLabel="Verification status"
              value={tab}
              options={TABS}
              onChange={onTabChange}
              tabWidthClass="w-[92px]"
            />
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </section>

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <ResultMeta total={total} state={state} />
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      <div>
        {state === "loading" && <LoadingView view={view} />}
        {state === "error" && <ErrorCard onRetry={() => reload(tab)} />}
        {state === "ready" &&
          (items.length === 0 ? (
            <EmptyState tab={tab} />
          ) : view === "table" ? (
            <VerificationTable items={items} />
          ) : (
            <List items={items} />
          ))}
      </div>
    </div>
  );
}

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

function VerificationActionsMenu({ id }: { id: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Verification actions"
        className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-32">
        <DropdownMenuItem
          render={<Link href={`/admin/verifications/${id}`} />}
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

function ResultMeta({ total, state }: { total: number; state: LoadState }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Counting…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">{total === 1 ? "record" : "records"}</span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * List — premium rows
 * ───────────────────────────────────────────────────────────── */

const AVATAR_TONES: Record<StatusTone, string> = {
  good: "bg-success/10 text-success",
  alarm: "bg-accent/10 text-accent",
  warn: "bg-foreground/10 text-foreground/70",
  neutral: "bg-primary/10 text-primary",
};

function List({ items }: { items: VerificationListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id}>
          <Row item={it} />
        </li>
      ))}
    </ul>
  );
}

function Row({ item }: { item: VerificationListItem }) {
  const tone = statusTone(item.status);
  const updated = new Date(item.updated_at);

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-16px_rgba(10,14,40,0.22)]",
        tone === "alarm"
          ? "border-accent/40 bg-accent/[0.03] hover:border-accent/60"
          : tone === "good"
            ? "border-success/30 bg-success/[0.02] hover:border-success/50"
            : "border-border hover:border-primary/30",
      )}
    >
      <Link
        href={`/admin/verifications/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold",
            AVATAR_TONES[tone],
          )}
        >
          {initialsOf(item.user.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary">
              {item.user.name}
            </h3>
            <CheckTypePill type={item.check_type} />
            <StatusPill status={item.status} tone={tone} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium tabular-nums text-muted-foreground/70">
              #{String(item.id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
              {item.user.email}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="tabular-nums">
              Updated {updated.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </Link>

      <VerificationActionsMenu id={item.id} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Table view — striped + hover
 * ───────────────────────────────────────────────────────────── */

function VerificationTable({ items }: { items: VerificationListItem[] }) {
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>Caregiver</th>
              <th className={th}>Check</th>
              <th className={th}>Status</th>
              <th className={th}>Updated</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <VerificationTableRow key={it.id} item={it} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerificationTableRow({ item }: { item: VerificationListItem }) {
  const tone = statusTone(item.status);
  const updated = new Date(item.updated_at);

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5">
        <Link href={`/admin/verifications/${item.id}`} className="group flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
              AVATAR_TONES[tone],
            )}
          >
            {initialsOf(item.user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground group-hover:text-primary">
              {item.user.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground/70">
              #{String(item.id).padStart(5, "0")} · {item.user.email}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <CheckTypePill type={item.check_type} />
      </td>
      <td className="px-4 py-3">
        <StatusPill status={item.status} tone={tone} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
        {updated.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <VerificationActionsMenu id={item.id} />
      </td>
    </tr>
  );
}

function CheckTypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
      {checkTypeLabel(type)}
    </span>
  );
}

function StatusPill({ status, tone }: { status: string; tone: StatusTone }) {
  const isCleared = status === "cleared";
  const isFlagged = status === "flagged";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-success/10 text-success",
        tone === "alarm" && "bg-accent/10 text-accent",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {isCleared && <BadgeCheck className="size-3" strokeWidth={2.25} />}
      {isFlagged && <ShieldX className="size-3" strokeWidth={2.25} />}
      {statusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function EmptyState({ tab }: { tab: StatusFilter }) {
  const isPending = tab === "pending_review";
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-success/10 text-success">
        <ShieldCheck className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        {isPending ? "Inbox zero." : "Nothing here yet."}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {isPending
          ? "No caregivers are waiting on a verification decision."
          : "Try a different status to see what's elsewhere in the queue."}
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
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the queue.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again — and if it keeps failing, ping engineering.
      </p>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
