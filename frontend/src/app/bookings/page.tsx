"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Check,
  Clock,
  Eye,
  History,
  Inbox,
  LayoutGrid,
  Loader2,
  type LucideIcon,
  MapPin,
  MoreVertical,
  Sparkles,
  Table,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { EASTERN_TZ } from "@/lib/eastern-time";

type Tab = "upcoming" | "active" | "past";
type ViewMode = "grid" | "table";

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
  const [view, setView] = useState<ViewMode>("grid");
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
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <BookingsHeader
        role={role}
        count={bookings?.length ?? null}
        loading={bookings === null && !error}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <TabBar tab={tab} onChange={setTab} />
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      {error ? (
        <ErrorBanner message={error} />
      ) : bookings === null ? (
        <LoadingRows />
      ) : bookings.length === 0 ? (
        <EmptyState tab={tab} role={role} />
      ) : view === "table" ? (
        <BookingsTable bookings={bookings} viewerRole={role ?? "family"} onChanged={load} />
      ) : (
        <ol className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingRow booking={booking} viewerRole={role ?? "family"} onChanged={load} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header + tabs
 * ───────────────────────────────────────────────────────────── */

function BookingsHeader({
  role,
  count,
  loading,
}: {
  role?: "family" | "caregiver";
  count: number | null;
  loading: boolean;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
        {role === "caregiver" ? "Offers & visits" : "Your bookings"}
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {role === "caregiver"
          ? "New offers arrive with a response window. Accept to confirm, decline to pass the offer to the next-ranked caregiver."
          : "Every offer you send appears here. If the caregiver declines, the cascade moves on automatically."}{" "}
        {loading ? (
          <span
            role="status"
            aria-label="Loading count"
            className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted align-[-0.15em]"
          />
        ) : count !== null ? (
          <span
            key={count}
            className="font-medium tabular-nums text-foreground/80 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
          >
            {count} in this view.
          </span>
        ) : null}
      </p>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.value === tab),
  );
  return (
    <div
      role="tablist"
      aria-label="Booking status"
      className="relative inline-flex rounded-xl border border-border bg-muted/40 p-1"
    >
      {/* Sliding active background — animates between equal-width tabs. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-24 rounded-lg bg-card shadow-xs ring-1 ring-border transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {TABS.map((t) => {
        const active = tab === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative z-10 w-24 cursor-pointer rounded-lg py-1.5 text-center text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { value: ViewMode; label: string; icon: LucideIcon }[] = [
    { value: "grid", label: "Grid view", icon: LayoutGrid },
    { value: "table", label: "Table view", icon: Table },
  ];
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex gap-1 rounded-xl border border-border bg-muted/40 p-1"
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

/* ─────────────────────────────────────────────────────────────
 * Table view
 * ───────────────────────────────────────────────────────────── */

function BookingsTable({
  bookings,
  viewerRole,
  onChanged,
}: {
  bookings: Booking[];
  viewerRole: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const isCaregiver = viewerRole === "caregiver";
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>When</th>
              <th className={th}>{isCaregiver ? "Service" : "Caregiver"}</th>
              <th className={th}>Status</th>
              <th className={th}>Duration</th>
              <th className={cn(th, "text-right")}>{isCaregiver ? "Earnings" : "Total"}</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingTableRow
                key={booking.id}
                booking={booking}
                viewerRole={viewerRole}
                onChanged={onChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingTableRow({
  booking,
  viewerRole,
  onChanged,
}: {
  booking: Booking;
  viewerRole: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const start = new Date(booking.scheduled_start);
  const dateShort = start.toLocaleDateString("en-CA", { timeZone: EASTERN_TZ, month: "short", day: "numeric" });
  const time = start.toLocaleTimeString("en-CA", { timeZone: EASTERN_TZ, hour: "numeric", minute: "2-digit" });

  const isCaregiver = viewerRole === "caregiver";
  const isPending = booking.status === "pending_caregiver";
  const primary = isCaregiver
    ? (booking.gig?.service_category?.name ?? "Gig")
    : booking.caregiver.name;
  const photo = !isCaregiver ? resolvePhotoUrl(booking.caregiver.photo_url) : null;
  const initials = initialsOf(booking.caregiver.name);

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5 whitespace-nowrap">
        <span className="font-medium text-foreground">{dateShort}</span>
        <span className="text-muted-foreground"> · {time}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {!isCaregiver &&
            (photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </span>
            ))}
          <div className="min-w-0">
            <Link
              href={`/bookings/${booking.id}`}
              className="block truncate font-medium text-sidebar-primary transition-colors hover:underline"
            >
              {primary}
            </Link>
            {isCaregiver && (
              <span className="text-[12px] text-muted-foreground">
                Near {booking.address_neighbourhood}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={booking.status} />
          {isPending && <Countdown deadline={booking.response_deadline_at} />}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
        {formatHours(booking.duration_minutes)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
        {formatCents(isCaregiver ? booking.caregiver_payout_cents : booking.subtotal_cents)}
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <div className="flex justify-end">
          <RowActionsMenu booking={booking} viewerRole={viewerRole} onChanged={onChanged} />
        </div>
      </td>
    </tr>
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
  const weekday = start.toLocaleDateString("en-CA", { timeZone: EASTERN_TZ, weekday: "short" });
  const dayNum = start.toLocaleDateString("en-CA", { timeZone: EASTERN_TZ, day: "numeric" });
  const month = start.toLocaleDateString("en-CA", { timeZone: EASTERN_TZ, month: "short" }).toUpperCase();
  const time = start.toLocaleTimeString("en-CA", { timeZone: EASTERN_TZ, hour: "numeric", minute: "2-digit" });

  const isCaregiver = viewerRole === "caregiver";
  const isPending = booking.status === "pending_caregiver";
  const needsResponse = isCaregiver && isPending && !booking.is_expired;

  const primary = isCaregiver
    ? (booking.gig?.service_category?.name ?? "Gig")
    : booking.caregiver.name;
  const photo = !isCaregiver ? resolvePhotoUrl(booking.caregiver.photo_url) : null;
  const initials = initialsOf(booking.caregiver.name);

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_rgba(10,14,40,0.25)] sm:p-5",
        needsResponse ? "border-accent/40 ring-1 ring-accent/15" : "border-border",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        {/* Date chip */}
        <div className="flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-muted/40 py-2.5 text-center">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {weekday}
          </span>
          <span className="text-2xl leading-none font-bold tabular-nums text-foreground">
            {dayNum}
          </span>
          <span className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {month}
          </span>
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {!isCaregiver &&
              (photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials}
                </span>
              ))}
            <Link
              href={`/bookings/${booking.id}`}
              className="truncate text-[15px] font-semibold tracking-tight text-sidebar-primary transition-colors hover:underline"
            >
              {primary}
            </Link>
            <StatusPill status={booking.status} />
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} />
              {time} · {formatHours(booking.duration_minutes)}
            </span>
            {isCaregiver ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" strokeWidth={1.75} />
                Near {booking.address_neighbourhood}
              </span>
            ) : (
              <span>{booking.gig?.service_category?.name ?? "Gig"}</span>
            )}
          </p>

          {(!isCaregiver || isPending) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {!isCaregiver && (
                <>
                  <span className="inline-flex items-center gap-1 text-[12px] text-foreground/70">
                    <BadgeCheck className="size-3.5 text-success" strokeWidth={2} />
                    Basic Verified
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground tabular-nums">
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                    Rank #{booking.match_rank}
                  </span>
                </>
              )}
              {isPending && <Countdown deadline={booking.response_deadline_at} />}
            </div>
          )}
        </div>

        {/* Right — price + actions */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border/60 pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
          <p className="text-left tabular-nums sm:text-right">
            <span className="text-[11px] font-medium text-muted-foreground">
              {isCaregiver ? "Earnings: " : "Total: "}
            </span>
            <span className="text-base font-semibold text-foreground">
              {formatCents(isCaregiver ? booking.caregiver_payout_cents : booking.subtotal_cents)}
            </span>
          </p>
          <RowActions booking={booking} viewerRole={viewerRole} onChanged={onChanged} />
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const tone = statusTone(status);
  const styles: Record<ReturnType<typeof statusTone>, string> = {
    pending: "bg-accent/10 text-accent ring-accent/30",
    positive: "bg-success/10 text-success ring-success/30",
    warning: "bg-muted text-muted-foreground ring-border",
    neutral: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canRespond && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handle("decline")}
            disabled={busy !== null}
            className="h-9 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => handle("accept")}
            disabled={busy !== null}
            className="h-9 cursor-pointer bg-success text-success-foreground hover:bg-success/90"
          >
            {busy === "accept" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.25} />
            )}
            Accept
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Booking actions"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-36">
          <DropdownMenuItem
            render={<Link href={`/bookings/${booking.id}`} />}
            className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
          >
            <Eye className="size-4" />
            View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Kebab (3-dot) action menu used by the table view — same trigger + no-bg
 * hover treatment as the dashboard "Up next" card menu. Open + (for a
 * caregiver's live offer) Accept / Decline.
 */
function RowActionsMenu({
  booking,
  viewerRole,
  onChanged,
}: {
  booking: Booking;
  viewerRole: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const isCaregiver = viewerRole === "caregiver";
  const canRespond = isCaregiver && booking.status === "pending_caregiver" && !booking.is_expired;

  async function handle(action: "accept" | "decline") {
    try {
      if (action === "accept") {
        await acceptBooking(booking.id);
      } else {
        await declineBooking(booking.id);
      }
      onChanged();
    } catch {
      // Surfaced elsewhere; keep the menu interaction quiet on failure.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Booking actions"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        <DropdownMenuItem
          render={<Link href={`/bookings/${booking.id}`} />}
          className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
        >
          <Eye className="size-4" />
          View
        </DropdownMenuItem>
        {canRespond && (
          <>
            <DropdownMenuItem
              onClick={() => handle("accept")}
              className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
            >
              <Check className="size-4" strokeWidth={2.25} />
              Accept
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => handle("decline")}
              className="cursor-pointer gap-2"
            >
              <X className="size-4" />
              Decline
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1",
        overdue
          ? "bg-destructive/10 text-destructive ring-destructive/30"
          : "bg-primary/10 text-primary ring-primary/20",
      )}
    >
      <CalendarClock className="size-3" />
      <span>{overdue ? "Overdue" : `Respond in ${label}`}</span>
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
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyState({ tab, role }: { tab: Tab; role?: "family" | "caregiver" }) {
  const copy: Record<
    Tab,
    { title: string; sub: string; href: string; cta: string; icon: LucideIcon; tone: string }
  > = {
    upcoming: {
      title: role === "caregiver" ? "No open offers." : "No bookings awaiting a response.",
      sub:
        role === "caregiver"
          ? "Make sure your gigs are published so families find you in the marketplace."
          : "Browse the marketplace and pick a gig from a caregiver who fits.",
      href: role === "caregiver" ? "/me/gigs" : "/marketplace",
      cta: role === "caregiver" ? "Manage my gigs" : "Browse marketplace",
      icon: Inbox,
      tone: "bg-primary/10 text-primary ring-primary/20",
    },
    active: {
      title: "Nothing in progress.",
      sub: "A booking enters this tab during the visit window itself.",
      href: "/bookings?tab=upcoming",
      cta: "See upcoming",
      icon: Activity,
      tone: "bg-accent/10 text-accent ring-accent/20",
    },
    past: {
      title: "No history yet.",
      sub: "Completed visits and cancellations land here.",
      href: role === "caregiver" ? "/me/gigs" : "/marketplace",
      cta: role === "caregiver" ? "Manage my gigs" : "Browse marketplace",
      icon: History,
      tone: "bg-success/10 text-success ring-success/20",
    },
  };

  const c = copy[tab];
  const Icon = c.icon;

  return (
    <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
      <div
        className={cn(
          "mx-auto flex size-12 items-center justify-center rounded-2xl ring-1",
          c.tone,
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground">{c.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{c.sub}</p>
      <Link href={c.href} className="mt-6 inline-block">
        <Button className="cursor-pointer">{c.cta}</Button>
      </Link>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
      {message}
    </div>
  );
}

function initialsOf(name: string | undefined): string {
  if (!name) return "·";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

// Photo paths come back as a full URL (seeded placeholders) or a relative
// public-disk path (uploads). Resolve the relative case through the API origin.
function resolvePhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/storage/${path.replace(/^\/+/, "")}`;
}
