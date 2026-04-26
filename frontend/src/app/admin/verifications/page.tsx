"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
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

const TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending_review", label: "Pending" },
  { value: "flagged", label: "Flagged" },
  { value: "not_started", label: "Not started" },
  { value: "cleared", label: "Cleared" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function VerificationsView() {
  const [tab, setTab] = useState<StatusFilter>("pending_review");
  const [items, setItems] = useState<VerificationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");

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
        const resp = await getVerifications("pending_review");
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

  return (
    <div className="relative">
      {/* Paper wash + noise */}
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

        <Controls tab={tab} onTabChange={onTabChange} onRefresh={() => reload(tab)} />

        <ResultMeta total={total} state={state} />

        <div className="mt-6">
          {state === "loading" && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={() => reload(tab)} />}
          {state === "ready" &&
            (items.length === 0 ? <EmptyState tab={tab} /> : <List items={items} />)}
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
        Verifications
        <span className="text-foreground/30">— § 30</span>
      </div>

      <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl">
        <span className="font-normal italic text-primary">Clear the queue,</span> earn the badge.
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Each pending row is a caregiver waiting on a human decision. Approve clears the check.
        Reject sends them back with a specific reason. Both land on the audit trail.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls — status pills + refresh
 * ───────────────────────────────────────────────────────────── */

function Controls({
  tab,
  onTabChange,
  onRefresh,
}: {
  tab: StatusFilter;
  onTabChange: (next: StatusFilter) => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Filters"
      className="mt-8 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Status
          </p>
          <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full border border-border/70 bg-background p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onTabChange(t.value)}
                aria-pressed={t.value === tab}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  t.value === tab
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
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
          "Counting…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span>{" "}
            {total === 1 ? "record" : "records"}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 31</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * List — ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

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
    <Link
      href={`/admin/verifications/${item.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card transition-all",
        tone === "alarm" && "border-accent/40 bg-accent/[0.02] hover:border-accent/60",
        tone === "warn" && "border-foreground/15 hover:border-foreground/30",
        tone === "good" && "border-success/30 bg-success/[0.02] hover:border-success/50",
        tone === "neutral" && "border-border/60 hover:border-foreground/30",
      )}
    >
      {/* Perforated left edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="flex items-center gap-4 py-4 pr-5 pl-9 sm:py-5 sm:pl-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">{item.user.name}</h3>
            <CheckTypePill type={item.check_type} />
            <StatusPill status={item.status} tone={tone} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="font-mono tabular-nums text-foreground/60">
              ID {String(item.id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5 normal-case tracking-[0.05em]">
              <Mail className="size-3" strokeWidth={2} />
              <span className="text-foreground/70">{item.user.email}</span>
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="font-mono normal-case tracking-[0.05em] tabular-nums">
              Updated{" "}
              {updated.toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
              })}
            </span>
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

function CheckTypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "good" && "border border-success/40 bg-success/[0.07] text-success",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
      )}
    >
      {isCleared && <BadgeCheck className="size-2.5" strokeWidth={2.25} />}
      {isFlagged && <ShieldX className="size-2.5" strokeWidth={2.25} />}
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
    <section className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <ShieldCheck className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        {isPending ? (
          <>
            Inbox <span className="font-normal italic text-success">zero.</span>
          </>
        ) : (
          <>
            Nothing here <span className="font-normal italic text-muted-foreground">yet.</span>
          </>
        )}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {isPending
          ? "No caregivers are waiting on a verification decision."
          : "Try a different status to see what's elsewhere in the queue."}
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
          className="h-[88px] animate-pulse rounded-2xl border border-border/60 bg-card/60"
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
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the queue.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again — and if it keeps failing, ping engineering.
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
