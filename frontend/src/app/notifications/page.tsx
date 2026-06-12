"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  AlertCircle,
  AlertOctagon,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  FileText,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationType,
  markAllNotificationsRead,
  markNotificationRead,
  renderNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <DashboardShell pageTitle="Notifications">
        <NotificationsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

function NotificationsView() {
  const [resp, setResp] = useState<NotificationListResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const next = await listNotifications();
      setResp(next);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await listNotifications();
        if (!alive) return;
        setResp(next);
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

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMarkAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      toast.success("All caught up.");
      void reload();
    } catch {
      toast.error("Couldn't mark all as read.");
    } finally {
      setBusy(false);
    }
  }

  async function handleItemClick(n: NotificationItem) {
    // Optimistically mark read; navigation happens via the Link wrapper.
    if (n.read_at !== null) return;
    try {
      await markNotificationRead(n.id);
      setResp((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((x) =>
                x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
              ),
              meta: { ...prev.meta, unread: Math.max(0, prev.meta.unread - 1) },
            }
          : prev,
      );
    } catch {
      // Non-fatal; user can retry.
    }
  }

  const unread = resp?.meta.unread ?? 0;
  const items = resp?.data ?? [];

  return (
    <div className="max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">Notifications</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Booking offers, message receipts, safety alerts, and reminders. Click any item to mark it
          read and jump to the relevant booking.
        </p>
      </div>

      {/* Notifications panel */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bell className="size-4" strokeWidth={2} />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              All notifications
            </h2>
            {unread > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button
                onClick={handleMarkAllRead}
                disabled={busy}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                <CheckCheck className="size-3.5" strokeWidth={2} />
                Mark all read
              </Button>
            )}
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
        </div>

        {state === "loading" && !resp ? (
          <LoadingView />
        ) : state === "error" ? (
          <ErrorCard onRetry={() => void reload()} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <NotificationFeed items={items} onItemClick={handleItemClick} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Feed
 * ───────────────────────────────────────────────────────────── */

function NotificationFeed({
  items,
  onItemClick,
}: {
  items: NotificationItem[];
  onItemClick: (n: NotificationItem) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((n) => (
        <li key={n.id}>
          <NotificationRow item={n} onActivate={() => onItemClick(n)} />
        </li>
      ))}
    </ul>
  );
}

function NotificationRow({ item, onActivate }: { item: NotificationItem; onActivate: () => void }) {
  const display = renderNotification(item);
  const isUnread = item.read_at === null;
  const ts = item.created_at ? new Date(item.created_at) : null;
  const tone = toneFor(item.type);

  const inner = (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors",
        isUnread ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-muted/50",
        tone === "alarm" && isUnread && "bg-accent/[0.05] hover:bg-accent/[0.08]",
      )}
    >
      {/* Unread dot column */}
      <span className="flex w-2 shrink-0 justify-center">
        {isUnread && (
          <span
            aria-label="Unread"
            className={cn("size-2 rounded-full", tone === "alarm" ? "bg-accent" : "bg-primary")}
          />
        )}
      </span>

      {/* Sender / type avatar */}
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          tone === "alarm"
            ? "bg-accent/15 text-accent"
            : tone === "good"
              ? "bg-success/15 text-success"
              : isUnread
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
        )}
      >
        <TypeIcon type={item.type} />
      </span>

      {/* Subject + snippet on one line */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn(
            "max-w-[45%] shrink-0 truncate text-sm tracking-tight",
            isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
          )}
        >
          {display.title}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {display.body}
        </span>
      </div>

      {/* Timestamp */}
      {ts && (
        <span
          className={cn(
            "shrink-0 text-xs whitespace-nowrap tabular-nums",
            isUnread ? "font-medium text-foreground/70" : "text-muted-foreground",
          )}
        >
          {ts.toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );

  if (display.href) {
    return (
      <Link href={display.href} onClick={onActivate} className="block cursor-pointer">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onActivate} className="block w-full cursor-pointer text-left">
      {inner}
    </button>
  );
}

function TypeIcon({ type }: { type: NotificationType | string }) {
  const props = { className: "size-4", strokeWidth: 2 } as const;
  if (type === "panic_triggered") return <AlertOctagon {...props} />;
  if (type === "incident_reported") return <AlertCircle {...props} />;
  if (type === "message_received") return <MessageSquare {...props} />;
  if (type === "booking_offered" || type === "shift_reminder") return <CalendarClock {...props} />;
  if (type === "booking_confirmed" || type === "visit_completed")
    return <CheckCircle2 {...props} />;
  if (type === "booking_declined" || type === "booking_expired" || type === "booking_cancelled")
    return <XCircle {...props} />;
  if (type === "booking_checked_in") return <Sparkles {...props} />;
  if (type === "certification_verified") return <Award {...props} />;
  if (type === "certification_rejected") return <XCircle {...props} />;
  if (type === "certification_document_submitted") return <FileText {...props} />;
  if (type === "verification_documents_submitted") return <ShieldCheck {...props} />;
  return <Bell {...props} />;
}

function toneFor(type: NotificationType | string): "alarm" | "good" | "neutral" {
  if (type === "panic_triggered" || type === "incident_reported") return "alarm";
  if (type === "booking_confirmed" || type === "visit_completed") return "good";
  if (type === "certification_verified") return "good";
  if (type === "certification_rejected") return "alarm";
  return "neutral";
}

/* ─────────────────────────────────────────────────────────────
 * States — rendered inside the panel body
 * ───────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-success/10 text-success">
        <CheckCheck className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">All caught up</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Notifications appear here as bookings move and messages arrive.
      </p>
    </div>
  );
}

function LoadingView() {
  return (
    <ul className="divide-y divide-border" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3.5 px-5 py-4">
          <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load notifications.
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">Something went wrong fetching your feed.</p>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}
