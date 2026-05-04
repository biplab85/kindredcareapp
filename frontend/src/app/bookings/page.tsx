"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Check, Loader2, Sparkles, X } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";
import {
  acceptBooking,
  type Booking,
  type BookingStatus,
  declineBooking,
  formatCents,
  formatHours,
  listBookings,
  statusLabel,
  statusTone,
} from "@/lib/bookings";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "active" | "past";

const TABS: { value: Tab; label: string; hint: string }[] = [
  { value: "upcoming", label: "Upcoming", hint: "pending · confirmed" },
  { value: "active", label: "Active", hint: "on a visit now" },
  { value: "past", label: "Past", hint: "completed · cancelled" },
];

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function BookingsPage() {
  return (
    <AuthGuard roles={["family", "caregiver"]}>
      <DashboardShell pageTitle="Bookings">
        <BookingsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

function BookingsView() {
  const { user } = useAuthStore();
  const role = user?.role as "family" | "caregiver" | undefined;
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBookings(null);
    setError(null);
    try {
      const data = await listBookings(tab);
      setBookings(data);
    } catch {
      setError("We couldn't load your bookings. Refresh to try again.");
    }
  }, [tab]);

  // Load on tab change. All setState calls happen inside the async IIFE
  // (after a microtask) so the effect body itself stays synchronous-clean.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      setBookings(null);
      setError(null);
      try {
        const data = await listBookings(tab);
        if (alive) setBookings(data);
      } catch {
        if (alive) setError("We couldn't load your bookings. Refresh to try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  return (
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6 lg:px-8">
        <BookingsHeader role={role} count={bookings?.length ?? null} />
        <TabBar tab={tab} onChange={setTab} />

        {error ? (
          <ErrorBanner message={error} />
        ) : bookings === null ? (
          <LoadingRows />
        ) : bookings.length === 0 ? (
          <EmptyState tab={tab} role={role} />
        ) : (
          <ol className="mt-10 space-y-4">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <BookingRow booking={booking} viewerRole={role ?? "family"} onChanged={load} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header + tabs
 * ───────────────────────────────────────────────────────────── */

function BookingsHeader({ role, count }: { role?: "family" | "caregiver"; count: number | null }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        {role === "caregiver" ? (
          <>
            Offers, visits,{" "}
            <span className="font-normal italic text-accent">and the record of it all.</span>
          </>
        ) : (
          <>
            The bookings{" "}
            <span className="font-normal italic text-primary">you&rsquo;ve sent out.</span>
          </>
        )}
      </h1>

      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {role === "caregiver"
          ? "New offers arrive with a response window. Accept to confirm, decline to pass the offer to the next-ranked caregiver."
          : "Every offer you send appears here. If the caregiver declines, the cascade moves on automatically."}
        {count !== null && (
          <>
            {" "}
            <span className="font-mono tabular-nums text-foreground/80">{count} in this view.</span>
          </>
        )}
      </p>
    </header>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      role="tablist"
      aria-label="Booking status"
      className="mt-10 flex flex-wrap items-center gap-2 border-b border-border/60 pb-1"
    >
      {TABS.map((t) => {
        const active = tab === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "group relative inline-flex flex-col items-start rounded-lg px-3 py-2 text-left transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-sm font-semibold tracking-tight">{t.label}</span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/80 uppercase">
              {t.hint}
            </span>
            {active && (
              <span aria-hidden className="absolute inset-x-3 -bottom-1 h-[2px] bg-foreground" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Row
 * ───────────────────────────────────────────────────────────── */

function BookingRow({
  booking,
  viewerRole,
  onChanged,
}: {
  booking: Booking;
  viewerRole: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const start = new Date(booking.scheduled_start);
  const date = start.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  const weekday = start.toLocaleDateString("en-CA", { weekday: "short" });
  const time = start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article
      className={cn(
        "group grid gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all sm:grid-cols-[auto_1fr_auto] sm:gap-6 sm:p-6",
        "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_10px_40px_-18px_rgba(10,14,40,0.15)]",
      )}
    >
      {/* Date column */}
      <div className="flex items-start gap-4 sm:flex-col sm:items-start sm:gap-0">
        <div className="shrink-0">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            {weekday}
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
            {date}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{time}</p>
        </div>
      </div>

      {/* Middle — identity + status */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-lg font-semibold tracking-tight">
            {viewerRole === "caregiver"
              ? (booking.gig?.service_category?.name ?? "Gig")
              : booking.caregiver.name}
          </p>
          <StatusPill status={booking.status} />
        </div>

        {viewerRole === "caregiver" ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            Near {booking.address_neighbourhood}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1 italic">
            {booking.gig?.service_category?.name ?? "Gig"} &middot;{" "}
            {formatHours(booking.duration_minutes)}
          </p>
        )}

        <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-foreground/80">
          {viewerRole === "family" && (
            <>
              <div className="inline-flex items-center gap-1.5 text-[13px]">
                <BadgeCheck className="size-3.5 text-success" strokeWidth={2} />
                <span>Basic Verified</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[13px] font-mono tabular-nums">
                <Sparkles className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                <span>Rank #{booking.match_rank}</span>
              </div>
            </>
          )}
          {booking.status === "pending_caregiver" && (
            <Countdown deadline={booking.response_deadline_at} />
          )}
        </dl>
      </div>

      {/* Right column — price + CTA */}
      <div className="flex flex-col items-start gap-3 border-t border-border/50 pt-4 sm:items-end sm:border-0 sm:pt-0">
        <p className="font-mono text-sm tabular-nums">
          <span className="text-lg font-semibold">
            {formatCents(
              viewerRole === "caregiver" ? booking.caregiver_payout_cents : booking.subtotal_cents,
            )}
          </span>
          <span className="text-muted-foreground">
            {viewerRole === "caregiver" ? " earnings" : " total"}
          </span>
        </p>
        <RowActions booking={booking} viewerRole={viewerRole} onChanged={onChanged} />
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const tone = statusTone(status);
  const styles: Record<ReturnType<typeof statusTone>, string> = {
    pending: "bg-accent/10 text-accent ring-accent/30",
    positive: "bg-success/10 text-success ring-success/30",
    warning: "bg-muted text-foreground/70 ring-foreground/15",
    neutral: "bg-muted text-foreground/70 ring-foreground/15",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ring-1",
        styles[tone],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Row actions
 * ───────────────────────────────────────────────────────────── */

function RowActions({
  booking,
  viewerRole,
  onChanged,
}: {
  booking: Booking;
  viewerRole: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  async function handle(action: "accept" | "decline") {
    setBusy(action);
    try {
      if (action === "accept") {
        await acceptBooking(booking.id);
      } else {
        await declineBooking(booking.id);
      }
      onChanged();
    } catch {
      setBusy(null);
    }
  }

  const isCaregiver = viewerRole === "caregiver";
  const canRespond = isCaregiver && booking.status === "pending_caregiver" && !booking.is_expired;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`/bookings/${booking.id}`}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/80 underline decoration-dotted decoration-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
      >
        Open <ArrowRight className="size-3.5" />
      </Link>
      {canRespond && (
        <>
          <button
            type="button"
            onClick={() => handle("decline")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-mono tracking-[0.12em] uppercase text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> Decline
          </button>
          <button
            type="button"
            onClick={() => handle("accept")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "accept" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.25} />
            )}
            Accept
          </button>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Countdown + empty + skeleton + error
 * ───────────────────────────────────────────────────────────── */

function Countdown({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState(() => diffLabel(deadline));

  useEffect(() => {
    const id = setInterval(() => setLabel(diffLabel(deadline)), 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  const overdue = label.startsWith("-");
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] tabular-nums ring-1",
        overdue
          ? "bg-destructive/10 text-destructive ring-destructive/30"
          : "bg-primary/[0.06] text-primary ring-primary/20",
      )}
    >
      <CalendarClock className="size-3" />
      <span>{overdue ? "overdue" : `respond in ${label}`}</span>
    </div>
  );
}

function diffLabel(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "-0m";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function LoadingRows() {
  return (
    <div className="mt-10 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40 ring-1 ring-border/50" />
      ))}
    </div>
  );
}

function EmptyState({ tab, role }: { tab: Tab; role?: "family" | "caregiver" }) {
  const copy: Record<Tab, { title: string; sub: string; href: string; cta: string }> = {
    upcoming: {
      title: role === "caregiver" ? "No open offers." : "No bookings awaiting a response.",
      sub:
        role === "caregiver"
          ? "Make sure your gigs are published so families find you in the marketplace."
          : "Browse the marketplace and pick a gig from a caregiver who fits.",
      href: role === "caregiver" ? "/me/gigs" : "/marketplace",
      cta: role === "caregiver" ? "Manage my gigs" : "Browse marketplace",
    },
    active: {
      title: "Nothing in progress.",
      sub: "A booking enters this tab during the visit window itself.",
      href: "/bookings?tab=upcoming",
      cta: "See upcoming",
    },
    past: {
      title: "No history yet.",
      sub: "Completed visits and cancellations land here.",
      href: role === "caregiver" ? "/me/gigs" : "/marketplace",
      cta: role === "caregiver" ? "Manage my gigs" : "Browse marketplace",
    },
  };

  const c = copy[tab];

  return (
    <section className="mt-14 rounded-2xl border border-dashed border-foreground/25 bg-card/60 p-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarClock className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">{c.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{c.sub}</p>
      <Link href={c.href} className="mt-6 inline-block">
        <Button>{c.cta}</Button>
      </Link>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-12 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
      {message}
    </div>
  );
}
