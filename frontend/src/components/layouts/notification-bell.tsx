"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  AlertCircle,
  AlertOctagon,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  MapPinOff,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listNotifications,
  markNotificationRead,
  renderNotification,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * NotificationBell — top-bar bell that opens a dropdown panel.
 * Click reveals the latest 10 notifications with clear read /
 * unread styling; a "View all" footer routes to /notifications.
 *
 * Data + read-state logic is unchanged — this reuses the existing
 * listNotifications / markNotificationRead helpers and only layers
 * on the dropdown UI and interaction flow.
 * ───────────────────────────────────────────────────────────── */

const PANEL_LIMIT = 10;

interface NotificationBellProps {
  /** Initial unread count so the badge isn't blank during first fetch. */
  initialCount?: number;
}

export function NotificationBell({ initialCount = 0 }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(initialCount);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const loadedOnce = useRef(false);

  // Single source of truth for both the badge count and the panel list:
  // one /notifications fetch, sliced to the latest 10 for the dropdown.
  const load = useCallback(async () => {
    try {
      const resp = await listNotifications();
      setItems(resp.data.slice(0, PANEL_LIMIT));
      setUnread(resp.meta.unread);
      setState("ready");
      loadedOnce.current = true;
    } catch {
      // Badge is non-critical; surface the error only inside the panel.
      if (!loadedOnce.current) setState("error");
    }
  }, []);

  // Prime on mount, then poll every 60s — paused while the tab is hidden so
  // we don't burn cycles in the background. Mirrors the prior topbar behavior.
  // The initial fetch is an inline IIFE so the post-await setState isn't seen
  // as a synchronous effect update (React 19 cascading-render rule).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await listNotifications();
        if (!alive) return;
        setItems(resp.data.slice(0, PANEL_LIMIT));
        setUnread(resp.meta.unread);
        setState("ready");
        loadedOnce.current = true;
      } catch {
        if (alive && !loadedOnce.current) setState("error");
      }
    })();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [load]);

  // Refresh the moment the panel opens so a first click shows current state.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  // Optimistically clear the unread mark; the Link handles navigation.
  async function handleActivate(n: NotificationItem) {
    setOpen(false);
    if (n.read_at !== null) return;
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
    );
    setUnread((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(n.id);
    } catch {
      // Non-fatal — next poll reconciles the true state.
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 grid size-4 min-w-[1rem] place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bell className="size-3.5" strokeWidth={2} />
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h3>
          </div>
          {unread > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {unread} new
            </span>
          )}
        </div>

        {/* Body */}
        {state === "loading" && items.length === 0 ? (
          <PanelSkeleton />
        ) : state === "error" && items.length === 0 ? (
          <PanelMessage
            icon={<AlertCircle className="size-6" strokeWidth={1.75} />}
            tone="accent"
            title="Couldn't load notifications"
            body="We'll retry automatically in a moment."
          />
        ) : items.length === 0 ? (
          <PanelMessage
            icon={<CheckCircle2 className="size-6" strokeWidth={1.75} />}
            tone="success"
            title="All caught up"
            body="New activity will show up here."
          />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border/70 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <PanelRow item={n} onActivate={() => handleActivate(n)} />
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted/60"
        >
          View all
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Row — compact variant of the full-page notification row.
 * ───────────────────────────────────────────────────────────── */

function PanelRow({ item, onActivate }: { item: NotificationItem; onActivate: () => void }) {
  const display = renderNotification(item);
  const isUnread = item.read_at === null;
  const tone = toneFor(item.type);

  const inner = (
    <div
      className={cn(
        "flex items-start gap-2.5 px-4 py-3 transition-colors",
        isUnread ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-muted/50",
        tone === "alarm" && isUnread && "bg-accent/[0.05] hover:bg-accent/[0.09]",
      )}
    >
      {/* Type avatar */}
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm tracking-tight",
              isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/75",
            )}
          >
            {display.title}
          </p>
          {/* Unread indicator */}
          {isUnread && (
            <span
              aria-label="Unread"
              className={cn(
                "size-2 shrink-0 rounded-full",
                tone === "alarm" ? "bg-accent" : "bg-primary",
              )}
            />
          )}
        </div>
        {display.body && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {display.body}
          </p>
        )}
        <p className="mt-1 text-[11px] tracking-tight text-muted-foreground/80">
          {relativeTime(item.created_at)}
        </p>
      </div>
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

/* ─────────────────────────────────────────────────────────────
 * Panel states
 * ───────────────────────────────────────────────────────────── */

function PanelSkeleton() {
  return (
    <ul className="divide-y divide-border/70" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-start gap-2.5 px-4 py-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PanelMessage({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "success" | "accent";
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-2xl",
          tone === "success" ? "bg-success/10 text-success" : "bg-accent/10 text-accent",
        )}
      >
        {icon}
      </span>
      <h4 className="mt-3 text-sm font-semibold tracking-tight text-foreground">{title}</h4>
      <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Presentation helpers (compact mirror of the full page)
 * ───────────────────────────────────────────────────────────── */

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
  if (type === "arrival_report_filed") return <MapPinOff {...props} />;
  if (type === "caregiver_arrival_ping") return <Clock {...props} />;
  if (type === "caregiver_arrival_acknowledged") return <CheckCircle2 {...props} />;
  return <Bell {...props} />;
}

function toneFor(type: NotificationType | string): "alarm" | "good" | "neutral" {
  if (type === "panic_triggered" || type === "incident_reported") return "alarm";
  if (type === "booking_confirmed" || type === "visit_completed") return "good";
  if (type === "certification_verified") return "good";
  if (type === "certification_rejected") return "alarm";
  if (type === "arrival_report_filed" || type === "caregiver_arrival_ping") return "alarm";
  if (type === "caregiver_arrival_acknowledged") return "good";
  return "neutral";
}

/** Short "just now / 5m / 3h / 2d / Jun 4" stamp for the dense panel. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
