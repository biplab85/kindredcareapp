"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type Booking,
  formatCents,
  formatHours,
  listBookings,
  statusLabel,
  statusTone,
} from "@/lib/bookings";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell — caregiver-only view of their confirmed + pending
 * bookings laid out on a weekly calendar grid.
 * ───────────────────────────────────────────────────────────── */

export default function CaregiverSchedulePage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Schedule">
        <ScheduleView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

function ScheduleView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Pull both upcoming offers/confirmations and a recent slice of past
        // visits so the week grid renders a complete picture as caregivers
        // nav back and forth.
        const [upcoming, past] = await Promise.all([
          listBookings("upcoming"),
          listBookings("past"),
        ]);
        if (alive) setBookings([...upcoming, ...past]);
      } catch {
        if (alive) setError("We couldn't load your schedule. Refresh to try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(() => buildWeek(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  return (
    <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/bookings"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to bookings
      </Link>

      <ScheduleHeader />

      {/* Calendar card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <WeekNav
          weekLabel={weekLabel}
          weekStart={weekStart}
          onChange={setWeekStart}
          onJumpToToday={() => setWeekStart(startOfWeek(new Date()))}
        />

        {error ? (
          <ErrorBanner message={error} />
        ) : bookings === null ? (
          <LoadingGrid />
        ) : (
          <WeekGrid days={days} bookings={bookings} />
        )}
      </div>

      <Legend />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function ScheduleHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
          Schedule
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your confirmed and pending visits, laid out by week. Confirmed visits are locked in;
          pending offers firm up once you accept.
        </p>
      </div>

      <Link href="/caregiver/availability">
        <Button variant="outline">
          <CalendarDays className="size-4" />
          Manage availability
        </Button>
      </Link>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Week nav — calendar card header
 * ───────────────────────────────────────────────────────────── */

function WeekNav({
  weekLabel,
  weekStart,
  onChange,
  onJumpToToday,
}: {
  weekLabel: string;
  weekStart: Date;
  onChange: (d: Date) => void;
  onJumpToToday: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => onChange(shiftWeek(weekStart, -1))}
            aria-label="Previous week"
            className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(shiftWeek(weekStart, 1))}
            aria-label="Next week"
            className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground tabular-nums">
          {weekLabel}
        </h2>
      </div>

      <button
        type="button"
        onClick={onJumpToToday}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <CalendarDays className="size-3.5" />
        Today
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Grid
 * ───────────────────────────────────────────────────────────── */

function WeekGrid({ days, bookings }: { days: Date[]; bookings: Booking[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
      {days.map((day) => {
        const dayBookings = bookings.filter((b) =>
          sameCalendarDay(new Date(b.scheduled_start), day),
        );
        const isToday = sameCalendarDay(day, new Date());

        return (
          <DayColumn key={day.toISOString()} day={day} bookings={dayBookings} isToday={isToday} />
        );
      })}
    </div>
  );
}

function DayColumn({
  day,
  bookings,
  isToday,
}: {
  day: Date;
  bookings: Booking[];
  isToday: boolean;
}) {
  const weekday = day.toLocaleDateString("en-CA", { weekday: "short" });
  const dayNum = day.getDate();

  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col p-3 md:min-h-[280px]",
        isToday && "bg-primary/[0.04]",
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{weekday}</span>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
            isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground",
          )}
        >
          {dayNum}
        </span>
      </header>

      {bookings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <span className="text-xs text-muted-foreground/60">No visits</span>
        </div>
      ) : (
        <ol className="space-y-2">
          {bookings
            .slice()
            .sort(
              (a, b) =>
                new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
            )
            .map((b) => (
              <li key={b.id}>
                <BookingBlock booking={b} />
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Booking block — status-coded event chip
 * ───────────────────────────────────────────────────────────── */

function BookingBlock({ booking }: { booking: Booking }) {
  const tone = statusTone(booking.status);
  const start = new Date(booking.scheduled_start);
  const end = new Date(booking.scheduled_end);
  const timeLabel = formatTimeRange(start, end);

  const styles: Record<typeof tone, { wrap: string; bar: string; badge: string; dot: string }> = {
    positive: {
      wrap: "border-success/30 from-success/[0.07] hover:border-success/50",
      bar: "bg-success",
      badge: "bg-success/15 text-success",
      dot: "bg-success",
    },
    pending: {
      wrap: "border-accent/30 from-accent/[0.07] hover:border-accent/50",
      bar: "bg-accent",
      badge: "bg-accent/15 text-accent",
      dot: "bg-accent",
    },
    warning: {
      wrap: "border-border from-muted/60 hover:border-foreground/20",
      bar: "bg-muted-foreground/40",
      badge: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    neutral: {
      wrap: "border-border from-muted/60 hover:border-foreground/20",
      bar: "bg-muted-foreground/40",
      badge: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
  };
  const s = styles[tone];

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-xl border bg-gradient-to-br to-card py-2.5 pr-2.5 pl-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        s.wrap,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", s.bar)} />

      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
          s.badge,
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
        {statusLabel(booking.status)}
      </span>

      <p className="mt-2 line-clamp-1 text-[13px] font-semibold tracking-tight text-foreground">
        {booking.gig?.service_category?.name ?? "Visit"}
      </p>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
        <Clock className="size-3 shrink-0" strokeWidth={2} />
        {timeLabel}
      </div>

      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="size-3 shrink-0" strokeWidth={2} />
        <span className="truncate">{booking.address_neighbourhood}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="shrink-0">{formatHours(booking.duration_minutes)}</span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1 border-t border-border/50 pt-2">
        <span className="text-[13px] font-bold tabular-nums text-foreground">
          {formatCents(booking.caregiver_payout_cents)}
        </span>
        <span className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
          payout
        </span>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Legend + states
 * ───────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      <LegendItem label="Confirmed" swatch="bg-success/15 ring-success/40" />
      <LegendItem label="Pending offer" swatch="bg-accent/15 ring-accent/40" />
      <LegendItem label="Past / cancelled" swatch="bg-muted ring-border" />
    </div>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-3.5 shrink-0 rounded-[4px] ring-1", swatch)} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex min-h-[200px] animate-pulse flex-col gap-3 p-3 md:min-h-[280px]"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-8 rounded bg-muted" />
            <div className="size-7 rounded-full bg-muted" />
          </div>
          <div className="h-20 rounded-lg bg-muted/60" />
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Date helpers (kept local so the calendar is self-contained)
 * ───────────────────────────────────────────────────────────── */

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // Sun=0, Mon=1, …
  const diffToMonday = (day + 6) % 7;
  result.setDate(result.getDate() - diffToMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function shiftWeek(weekStart: Date, delta: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

function buildWeek(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeRange(start: Date, end: Date): string {
  const meridiem = (d: Date) => (d.getHours() < 12 ? "am" : "pm");
  const clock = (d: Date) => {
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes();
    return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
  };
  const sameMeridiem = meridiem(start) === meridiem(end);
  const startLabel = sameMeridiem ? clock(start) : `${clock(start)} ${meridiem(start)}`;
  return `${startLabel}–${clock(end)} ${meridiem(end)}`;
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = weekStart.toLocaleDateString("en-CA", opts);
  const e = end.toLocaleDateString("en-CA", opts);
  const year = end.getFullYear();
  return `${s} — ${e}, ${year}`;
}
