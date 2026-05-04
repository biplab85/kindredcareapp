"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";
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
 * bookings laid out on an old appointment-book week grid.
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
    <div className="relative">
      {/* Paper wash — matches the Phase 6/7 editorial family */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/bookings"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>

        <ScheduleHeader weekLabel={weekLabel} />

        <WeekNav
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

        <Legend />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function ScheduleHeader({ weekLabel }: { weekLabel: string }) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            Your week,{" "}
            <span className="font-normal italic text-primary">ink-stamped and pencilled in.</span>
          </h1>

          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Confirmed visits are inked. Pending offers are in pencil — they&rsquo;ll firm up once
            you accept. Cancelled and declined visits stay here for the record.
          </p>

          <p className="mt-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {weekLabel}
          </p>
        </div>

        <Link href="/caregiver/availability">
          <Button variant="outline" className="h-11">
            Manage availability
          </Button>
        </Link>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Week nav
 * ───────────────────────────────────────────────────────────── */

function WeekNav({
  weekStart,
  onChange,
  onJumpToToday,
}: {
  weekStart: Date;
  onChange: (d: Date) => void;
  onJumpToToday: () => void;
}) {
  return (
    <nav
      aria-label="Week navigation"
      className="mt-10 flex flex-wrap items-center justify-between gap-3 border-y border-border/60 py-3"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(shiftWeek(weekStart, -1))}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Previous week"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(shiftWeek(weekStart, 1))}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Next week"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onJumpToToday}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground"
      >
        <CalendarDays className="size-3.5" />
        Jump to this week
      </button>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Grid
 * ───────────────────────────────────────────────────────────── */

function WeekGrid({ days, bookings }: { days: Date[]; bookings: Booking[] }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-px md:rounded-2xl md:bg-border/60 md:p-[1px] md:ring-1 md:ring-border/60">
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
  const weekday = day.toLocaleDateString("en-CA", { weekday: "short" }).toLowerCase();
  const dayNum = day.getDate();

  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col bg-card p-3 md:min-h-[260px]",
        "first:md:rounded-l-2xl last:md:rounded-r-2xl",
        isToday && "bg-primary/[0.05]",
      )}
    >
      <header className="mb-3 flex items-baseline justify-between border-b border-border/50 pb-2">
        <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {weekday}
        </span>
        <span
          className={cn(
            "font-mono text-xl font-semibold tabular-nums",
            isToday ? "text-primary" : "text-foreground/80",
          )}
        >
          {dayNum}
        </span>
      </header>

      {bookings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <span className="text-[11px] italic text-muted-foreground/60">nothing scheduled</span>
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
 * Booking block — inked for confirmed, pencilled for pending
 * ───────────────────────────────────────────────────────────── */

function BookingBlock({ booking }: { booking: Booking }) {
  const tone = statusTone(booking.status);
  const start = new Date(booking.scheduled_start);
  const end = new Date(booking.scheduled_end);
  const timeLabel =
    start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }) +
    " — " +
    end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

  const wrapperClass = cn(
    "group block rounded-lg p-2.5 text-left text-xs transition-all hover:-translate-y-0.5",
    tone === "positive" &&
      "bg-success/10 ring-1 ring-success/40 text-success hover:shadow-[0_6px_20px_-6px_rgba(29,143,96,0.35)]",
    tone === "pending" &&
      "border border-dashed border-accent/60 bg-accent/[0.04] text-accent/90 hover:bg-accent/10",
    tone === "warning" &&
      "bg-muted text-muted-foreground line-through decoration-[1.5px] hover:no-underline hover:bg-muted/70",
    tone === "neutral" && "bg-muted text-muted-foreground",
  );

  return (
    <Link href={`/bookings/${booking.id}`} className={wrapperClass}>
      <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums tracking-tight opacity-90">
        <Clock className="size-3 shrink-0" strokeWidth={1.75} />
        {timeLabel}
      </div>
      <p className="mt-1 line-clamp-1 text-[13px] font-semibold tracking-tight text-foreground">
        {booking.gig?.service_category?.name ?? "Visit"}
      </p>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="size-3 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{booking.address_neighbourhood}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase ring-1",
            tone === "positive" && "bg-success/15 text-success ring-success/40",
            tone === "pending" && "bg-accent/15 text-accent ring-accent/40",
            tone === "warning" && "bg-foreground/10 text-muted-foreground ring-foreground/15",
            tone === "neutral" && "bg-foreground/10 text-muted-foreground ring-foreground/15",
          )}
        >
          {statusLabel(booking.status)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-foreground/80">
          {formatCents(booking.caregiver_payout_cents)}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
        <BadgeCheck className="size-2.5 text-success" strokeWidth={2.25} />
        {formatHours(booking.duration_minutes)}
      </p>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Legend + states
 * ───────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <footer className="mt-12 grid gap-3 rounded-2xl border border-border/40 bg-card/60 p-5 sm:grid-cols-3">
      <LegendItem
        label="Confirmed"
        hint="ink-stamped — the visit is on"
        swatch="bg-success/10 ring-success/40"
      />
      <LegendItem
        label="Pending offer"
        hint="pencilled — awaiting your reply"
        swatch="border border-dashed border-accent/60 bg-accent/[0.04]"
      />
      <LegendItem
        label="Past / cancelled"
        hint="for the record"
        swatch="bg-muted ring-foreground/15"
      />
    </footer>
  );
}

function LegendItem({ label, hint, swatch }: { label: string; hint: string; swatch: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("size-6 shrink-0 rounded-md ring-1", swatch)} />
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] italic text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="mt-8 grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-border/60 p-[1px] ring-1 ring-border/60">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex min-h-[220px] animate-pulse flex-col gap-2 bg-muted/40 p-3">
          <div className="h-3 w-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted/60" />
          <div className="h-10 rounded bg-muted/60" />
        </div>
      ))}
      <div className="col-span-7 flex items-center justify-center py-3 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        Laying out the week…
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-12 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
      <p>{message}</p>
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

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = weekStart.toLocaleDateString("en-CA", opts);
  const e = end.toLocaleDateString("en-CA", opts);
  const year = end.getFullYear();
  return `${s} — ${e}, ${year}`;
}
