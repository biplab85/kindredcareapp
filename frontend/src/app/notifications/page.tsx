"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
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

      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Header unread={unread} />

        <Controls
          unread={unread}
          busy={busy}
          onMarkAllRead={handleMarkAllRead}
          onRefresh={() => void reload()}
        />

        <div className="mt-6">
          {state === "loading" && !resp && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={() => void reload()} />}
          {state !== "error" &&
            resp &&
            (items.length === 0 ? (
              <EmptyState />
            ) : (
              <NotificationFeed items={items} onItemClick={handleItemClick} />
            ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header({ unread }: { unread: number }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">Your bell,</span> in long form.
      </h1>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Booking offers, message receipts, safety alerts, and reminders. Click any item to mark it
        read and jump to the relevant booking.
        {unread > 0 && (
          <>
            {" "}
            <span className="font-semibold text-foreground">{unread} unread.</span>
          </>
        )}
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls
 * ───────────────────────────────────────────────────────────── */

function Controls({
  unread,
  busy,
  onMarkAllRead,
  onRefresh,
}: {
  unread: number;
  busy: boolean;
  onMarkAllRead: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-end gap-2">
      {unread > 0 && (
        <Button onClick={onMarkAllRead} disabled={busy} variant="outline" size="sm">
          <CheckCheck className="size-3.5" strokeWidth={2} />
          Mark all read
        </Button>
      )}
      <Button onClick={onRefresh} variant="outline" size="sm">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Refresh
      </Button>
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
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id}>
          <NotificationCard item={n} onActivate={() => onItemClick(n)} />
        </li>
      ))}
    </ul>
  );
}

function NotificationCard({
  item,
  onActivate,
}: {
  item: NotificationItem;
  onActivate: () => void;
}) {
  const display = renderNotification(item);
  const isUnread = item.read_at === null;
  const ts = item.created_at ? new Date(item.created_at) : null;
  const tone = toneFor(item.type);

  const inner = (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors sm:p-5",
        isUnread
          ? "border-primary/30 bg-primary/[0.02] hover:border-primary/50"
          : "border-border/60 hover:border-foreground/30",
        tone === "alarm" && "border-accent/40 bg-accent/[0.04] hover:border-accent/60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            tone === "alarm" && "bg-accent text-accent-foreground",
            tone === "good" && "bg-success/15 text-success",
            tone === "neutral" && "bg-muted/60 text-muted-foreground",
            isUnread && tone === "neutral" && "bg-primary/15 text-primary",
          )}
        >
          <TypeIcon type={item.type} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p
              className={cn("text-sm font-semibold tracking-tight", isUnread && "text-foreground")}
            >
              {display.title}
            </p>
            {ts && (
              <span className="font-mono text-[10px] tracking-[0.05em] text-muted-foreground tabular-nums">
                {ts.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground/80">
            {display.body}
          </p>
          {isUnread && (
            <span className="mt-2 inline-block rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-primary-foreground uppercase">
              Unread
            </span>
          )}
        </div>
      </div>
    </article>
  );

  if (display.href) {
    return (
      <Link href={display.href} onClick={onActivate} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onActivate} className="block w-full text-left">
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
  return <Bell {...props} />;
}

function toneFor(type: NotificationType | string): "alarm" | "good" | "neutral" {
  if (type === "panic_triggered" || type === "incident_reported") return "alarm";
  if (type === "booking_confirmed" || type === "visit_completed") return "good";
  return "neutral";
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <section className="rounded-3xl border border-dashed border-success/40 bg-success/[0.04] p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
        <Sparkles className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        All caught up, <span className="font-normal italic text-success">nothing new.</span>
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Notifications appear here as bookings move and messages arrive.
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
          <h3 className="text-base font-semibold tracking-tight">
            Couldn&apos;t load notifications.
          </h3>
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
