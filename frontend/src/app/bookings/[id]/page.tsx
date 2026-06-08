"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  MapPin,
  MapPinOff,
  MessageCircle,
  Navigation,
  PlayCircle,
  Star,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { IncidentReportTrigger } from "@/components/bookings/incident-form";
import { MessagesBlock } from "@/components/bookings/messages-block";
import { PanicButton } from "@/components/bookings/panic-button";
import { SafetyGate } from "@/components/bookings/safety-gate";
import { useAuthStore } from "@/lib/auth";
import {
  acceptBooking,
  type Booking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  declineBooking,
  flagReasonLabel,
  formatCents,
  formatHours,
  type GeoCoords,
  getBooking,
  requestGeolocation,
  statusLabel,
  statusTone,
  updateBookingTasks,
  type VisitFlagReason,
} from "@/lib/bookings";
import { getPendingReviews, submitReview } from "@/lib/reviews";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["family", "caregiver"]}>
      <DashboardShell pageTitle="Booking detail">
        <BookingDetailView bookingId={Number(id)} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

function BookingDetailView({ bookingId }: { bookingId: number }) {
  const { user } = useAuthStore();
  const role = user?.role as "family" | "caregiver" | "admin" | undefined;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<"notfound" | "generic" | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getBooking(bookingId);
      setBooking(data);
      setError(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 || status === 404 ? "notfound" : "generic");
    }
  }, [bookingId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getBooking(bookingId);
        if (!alive) return;
        setBooking(data);
        setError(null);
      } catch (err) {
        if (!alive) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 403 || status === 404 ? "notfound" : "generic");
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookingId]);

  if (error === "notfound") {
    return (
      <ErrorScreen
        title="We couldn't find that booking."
        sub="It may have been cancelled, or you may not have access."
      />
    );
  }
  if (error === "generic") {
    return <ErrorScreen title="Something went sideways." sub="Refresh in a moment." />;
  }
  if (!booking || !role) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Link
          href="/bookings"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>

        <DetailHeader booking={booking} role={role} />

        <ArrivalBanner booking={booking} role={role} />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
          <div className="space-y-6">
            <ReceiptBlock booking={booking} role={role} />
            <VisitBlock booking={booking} role={role} onChanged={reload} />
            <MessagesBlock bookingId={booking.id} />
            <FamilyConfirmBlock booking={booking} role={role} onChanged={reload} />
            <RatingPromptBlock booking={booking} />
            <PartyBlock booking={booking} role={role} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <TimelineBlock booking={booking} />
            <ActionBlock booking={booking} role={role} onChanged={reload} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function DetailHeader({
  booking,
  role,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
}) {
  const tone = statusTone(booking.status);
  const accentClass: Record<typeof tone, string> = {
    pending: "text-accent",
    positive: "text-success",
    warning: "text-muted-foreground",
    neutral: "text-muted-foreground",
  };

  const start = new Date(booking.scheduled_start);

  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
          <span className={cn("font-normal italic", accentClass[tone])}>
            {statusLabel(booking.status)}.
          </span>
        </h1>
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          #{String(booking.id).padStart(5, "0")}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {start.toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        {" · "}
        {start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
        {" · "}
        {formatHours(booking.duration_minutes)}
        {role === "family" &&
          booking.fallback_queue_size > 0 &&
          booking.status === "pending_caregiver" && (
            <>
              {" · "}
              <span className="font-mono tabular-nums">
                {booking.fallback_queue_size} caregiver
                {booking.fallback_queue_size === 1 ? "" : "s"} on standby
              </span>
            </>
          )}
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Arrival banner — family-only, fires once check_in_at is set
 * ───────────────────────────────────────────────────────────── */

function ArrivalBanner({ booking, role }: { booking: Booking; role: string }) {
  if (role !== "family") return null;
  if (!booking.visit.check_in_at) return null;

  const checkIn = new Date(booking.visit.check_in_at);
  const live = booking.status === "in_progress";
  const caregiverName = booking.caregiver.name.split(" ")[0] ?? booking.caregiver.name;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-6 overflow-hidden rounded-2xl border border-success/30 bg-success/5"
    >
      <div className="flex items-center gap-4 px-5 py-3 sm:px-6">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
          {live && <span className="absolute inset-0 animate-ping rounded-full bg-success/30" />}
          <Check className="relative size-4" strokeWidth={2.5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold tracking-tight">
            {caregiverName} arrived at{" "}
            <span className="font-mono tabular-nums">
              {checkIn.toLocaleTimeString("en-CA", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
          <p className="font-mono text-[10px] tracking-[0.22em] text-success/80 uppercase">
            {live ? "Visit in progress" : "Visit recorded"}
          </p>
        </div>
      </div>
      {/* Perforated "stamp" bottom edge */}
      <div
        aria-hidden
        className="h-1.5 w-full bg-[radial-gradient(circle_at_6px_50%,theme(colors.background)_3px,transparent_3.5px)] bg-[length:12px_100%]"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Receipt block
 * ───────────────────────────────────────────────────────────── */

function ReceiptBlock({
  booking,
  role,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
}) {
  return (
    <section
      aria-label="Receipt"
      className="relative rounded-3xl border border-border/60 bg-card p-6 sm:p-8"
    >
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Order of service
      </div>

      <dl className="mt-6 space-y-3 text-sm">
        <Line label="Service" value={booking.gig?.service_category?.name ?? "Gig"} />
        <Line
          label="When"
          value={new Date(booking.scheduled_start).toLocaleString("en-CA", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        />
        <Line label="Duration" value={formatHours(booking.duration_minutes)} />
        <Line
          label={booking.address_full ? "Address" : "Neighbourhood"}
          value={booking.address_full ?? booking.address_neighbourhood}
        />
      </dl>

      <div className="my-8 border-t-2 border-dashed border-border/60" />

      <dl className="space-y-3 text-sm">
        <Line label="Rate" value={`${formatCents(booking.hourly_rate_cents)} / hour`} tabular />
        <Line label="Subtotal" value={formatCents(booking.subtotal_cents)} tabular />
        <Line
          label="Platform fee (7.5%)"
          value={`− ${formatCents(booking.platform_fee_cents)}`}
          tabular
          muted
        />
      </dl>

      <div className="my-6 border-t border-border/60" />

      <div className="flex items-baseline justify-between font-mono tabular-nums">
        <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          Caregiver payout
        </p>
        <p className="text-3xl font-semibold">{formatCents(booking.caregiver_payout_cents)}</p>
      </div>

      <PaymentStatusNote booking={booking} role={role} />
    </section>
  );
}

function PaymentStatusNote({
  booking,
  role,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
}) {
  const message = paymentStatusMessage(booking, role);
  if (!message) return null;

  const tone = paymentStatusTone(booking.payment_status);
  const toneClass = {
    info: "border-primary/25 bg-primary/[0.04] text-foreground/80",
    warning: "border-accent/30 bg-accent/[0.06] text-accent",
    success: "border-success/30 bg-success/[0.06] text-success",
    muted: "border-border/60 bg-muted/30 text-muted-foreground",
  }[tone];

  return (
    <p className={cn("mt-5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed", toneClass)}>
      {message}
    </p>
  );
}

function paymentStatusMessage(
  booking: Booking,
  role: "family" | "caregiver" | "admin",
): string | null {
  const total = `$${(booking.subtotal_cents / 100).toFixed(2)}`;
  const isFamily = role === "family";
  const isCaregiver = role === "caregiver";

  switch (booking.payment_status) {
    case "not_required":
      return isFamily
        ? "No charge yet. Your card will be authorized when the caregiver accepts."
        : null;

    case "authorized":
      return isFamily
        ? `${total} hold placed on your card. We charge it when the visit ends.`
        : isCaregiver
          ? "The family's card is authorized. Funds release at check-out."
          : null;

    case "captured":
      return isFamily
        ? `${total} charged to your card.`
        : isCaregiver
          ? "Visit captured. Payout transfers after the 24-hour hold."
          : null;

    case "released":
      return isFamily ? "Hold released — no charge." : null;

    case "refunded":
      return isFamily
        ? `${total} was charged and refunded.`
        : "This visit was refunded to the family.";

    case "held_pending_dispute":
      return isFamily
        ? `${total} charged. Funds are held while we review a dispute.`
        : "Funds held pending dispute resolution.";

    // Stub statuses appear when STRIPE_SECRET isn't configured. The state
    // machine ran but no real money moved; surface that honestly.
    case "authorized_stub":
    case "captured_stub":
    case "released_stub":
    case "refunded_stub":
      return "Stripe is not configured — this booking is running on the dev stub channel, no real card was used.";

    default:
      return null;
  }
}

function paymentStatusTone(status: string): "info" | "warning" | "success" | "muted" {
  if (status === "captured" || status === "released") return "success";
  if (status === "held_pending_dispute" || status === "refunded") return "warning";
  if (status.endsWith("_stub")) return "muted";
  return "info";
}

function Line({
  label,
  value,
  tabular,
  muted,
}: {
  label: string;
  value: string;
  tabular?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm",
          tabular ? "font-mono tabular-nums" : "",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit block — composite: pre-visit start, live log, summary
 * ───────────────────────────────────────────────────────────── */

function VisitBlock({
  booking,
  role,
  onChanged,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const { status } = booking;
  const isCaregiver = role === "caregiver";

  if (status === "confirmed" && isCaregiver) {
    return (
      <>
        <PanicButton bookingId={booking.id} existingAlert={booking.active_panic_alert ?? null} />
        {booking.safety_acknowledged_at ? (
          <VisitStartPanel booking={booking} onChanged={onChanged} />
        ) : (
          <SafetyGate bookingId={booking.id} onAcknowledged={onChanged} />
        )}
      </>
    );
  }

  if (status === "in_progress" && isCaregiver) {
    return (
      <>
        <PanicButton bookingId={booking.id} existingAlert={booking.active_panic_alert ?? null} />
        <VisitLiveLog booking={booking} onChanged={onChanged} />
      </>
    );
  }

  if (status === "in_progress" && role === "family") {
    return <VisitInProgressWatch booking={booking} />;
  }

  if (status === "completed") {
    return <VisitSummary booking={booking} role={role} />;
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
 * Visit: Start panel (caregiver, confirmed)
 * ───────────────────────────────────────────────────────────── */

function VisitStartPanel({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  type Phase = "idle" | "locating" | "submitting" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function start() {
    setPhase("locating");
    setErrorMsg(null);
    try {
      const coords = await requestGeolocation();
      setPhase("submitting");
      await checkInBooking(booking.id, coords);
      onChanged();
      // Parent re-render will unmount this panel.
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Check-in failed.");
      setPhase("error");
    }
  }

  // Snapshot "now" at mount so render stays pure. Freshness isn't important
  // here — the backend accepts any time and this is just a soft UI hint.
  const [nowMs] = useState(() => Date.now());
  const start_time = new Date(booking.scheduled_start);
  const minutesToStart = (start_time.getTime() - nowMs) / 60_000;
  const tooEarly = minutesToStart > 30;
  const working = phase === "locating" || phase === "submitting";

  return (
    <section
      aria-label="Start visit"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8"
    >
      {/* Radar tint — visible only while locating */}
      {phase === "locating" && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,theme(colors.primary/0.1),transparent_65%)]"
        />
      )}

      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-primary/40" />
        Visit — § 11
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span
            className={cn(
              "grid size-16 place-items-center rounded-2xl ring-1 transition-all",
              phase === "locating"
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-primary/10 text-primary ring-primary/20",
            )}
          >
            {phase === "locating" && (
              <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/15" />
            )}
            {phase === "submitting" ? (
              <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : phase === "error" ? (
              <MapPinOff className="size-7" strokeWidth={1.75} />
            ) : (
              <Navigation className="size-7" strokeWidth={1.75} />
            )}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {phase === "locating"
              ? "Finding you…"
              : phase === "submitting"
                ? "Logging your arrival…"
                : "Ready to start the visit?"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {phase === "locating"
              ? "Your browser is checking your location. Please allow access when prompted."
              : phase === "submitting"
                ? "Almost there. We're recording the check-in."
                : tooEarly
                  ? "You can start any time, but the visit is still a while away. The family will be notified the moment you check in."
                  : "Tap to capture your GPS and notify the family that you've arrived. The address becomes final-final after this."}
          </p>

          {phase === "error" && errorMsg && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {errorMsg}
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <Button
              onClick={start}
              disabled={working}
              size="lg"
              className="group relative overflow-hidden"
            >
              <PlayCircle className="size-4" strokeWidth={2.25} />
              {phase === "error" ? "Try again" : "Start visit"}
            </Button>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              GPS required
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit: Live log (caregiver, in_progress)
 * ───────────────────────────────────────────────────────────── */

type SaveState = "idle" | "saving" | "saved" | "error";

function VisitLiveLog({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const defaultTasks = useMemo<string[]>(
    () => booking.gig?.service_category?.default_tasks ?? [],
    [booking.gig?.service_category?.default_tasks],
  );

  // Merge default tasks with any previously-logged custom ones, so the
  // caregiver sees every task that was ever ticked even if the category's
  // defaults changed. Stable order: defaults first, then anything extra.
  const allTasks = useMemo(() => {
    const existing = booking.visit.tasks_completed ?? [];
    const seen = new Set(defaultTasks);
    const extras = existing.filter((t) => !seen.has(t));
    return [...defaultTasks, ...extras];
  }, [defaultTasks, booking.visit.tasks_completed]);

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(booking.visit.tasks_completed ?? []),
  );
  const [notes, setNotes] = useState(booking.visit.caregiver_notes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  type EndPhase = "idle" | "locating" | "submitting" | "error";
  const [endPhase, setEndPhase] = useState<EndPhase>("idle");
  const [endError, setEndError] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  function scheduleAutosave(nextTasks: Set<string>, nextNotes: string) {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      updateBookingTasks(booking.id, {
        tasks_completed: [...nextTasks],
        caregiver_notes: nextNotes || null,
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
  }

  function toggleTask(task: string) {
    const next = new Set(checked);
    if (next.has(task)) next.delete(task);
    else next.add(task);
    setChecked(next);
    scheduleAutosave(next, notes);
  }

  function changeNotes(value: string) {
    setNotes(value);
    scheduleAutosave(checked, value);
  }

  async function endVisit() {
    setEndPhase("locating");
    setEndError(null);
    try {
      const coords: GeoCoords = await requestGeolocation();
      setEndPhase("submitting");
      await checkOutBooking(booking.id, {
        ...coords,
        tasks_completed: [...checked],
        caregiver_notes: notes || null,
      });
      onChanged();
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Check-out failed.");
      setEndPhase("error");
    }
  }

  const working = endPhase === "locating" || endPhase === "submitting";
  const checkIn = booking.visit.check_in_at ? new Date(booking.visit.check_in_at) : null;
  // Snapshot "now" once. The elapsed counter freezes at mount — acceptable
  // for MVP; a live tick would need useSyncExternalStore per CLAUDE.md.
  const [nowAtMount] = useState(() => Date.now());
  const elapsedMin = checkIn
    ? Math.max(0, Math.floor((nowAtMount - checkIn.getTime()) / 60_000))
    : 0;

  return (
    <section
      aria-label="Live visit log"
      className="relative overflow-hidden rounded-3xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-dashed border-success/30 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          <p className="font-mono text-[11px] tracking-[0.22em] text-success uppercase">
            Visit — live
          </p>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {elapsedMin < 60
            ? `${elapsedMin} min elapsed`
            : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m elapsed`}
        </p>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        {/* Task checklist */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              <ClipboardList className="size-3.5" />
              What you&rsquo;re covering
            </div>
            <SaveIndicator state={saveState} />
          </div>

          {allTasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground italic">
              No task suggestions for this category. Use the notes below to describe what you helped
              with.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {allTasks.map((task, i) => {
                const isChecked = checked.has(task);
                return (
                  <li key={task}>
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        "hover:bg-success/5",
                      )}
                    >
                      <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-px grid size-5 shrink-0 place-items-center rounded-[5px] border transition-all",
                          isChecked
                            ? "scale-100 border-success bg-success text-success-foreground"
                            : "scale-95 border-border/80 bg-background group-hover:border-success/60",
                        )}
                      >
                        {isChecked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          isChecked
                            ? "text-foreground"
                            : "text-foreground/80 group-hover:text-foreground",
                        )}
                      >
                        {task}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="caregiver-notes"
            className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            <span className="h-px w-6 bg-foreground/30" />A note for the family
          </label>
          <textarea
            id="caregiver-notes"
            value={notes}
            onChange={(e) => changeNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Anything they'd want to know — mood, what you did, something for next time."
            className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none ring-primary/30 transition-shadow focus:ring-2"
          />
        </div>

        {/* End visit CTA */}
        <div className="border-t-2 border-dashed border-success/30 pt-6">
          {endError && (
            <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {endError}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-muted-foreground">
              Ending the visit captures the payment and sends the family a summary.
            </p>
            <Button
              onClick={endVisit}
              disabled={working}
              size="lg"
              variant="default"
              className="sm:shrink-0"
            >
              {working ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <StopCircle className="size-4" strokeWidth={2.25} />
              )}
              {endPhase === "locating"
                ? "Finding you…"
                : endPhase === "submitting"
                  ? "Closing out…"
                  : "End visit"}
            </Button>
          </div>

          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <IncidentReportTrigger bookingId={booking.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Couldn't save — retrying";
  const tone =
    state === "saving"
      ? "text-muted-foreground"
      : state === "saved"
        ? "text-success"
        : "text-accent";
  return <p className={cn("font-mono text-[10px] tracking-[0.16em] uppercase", tone)}>{label}</p>;
}

/* ─────────────────────────────────────────────────────────────
 * Visit: In-progress watch (family, passive)
 * ───────────────────────────────────────────────────────────── */

function VisitInProgressWatch({ booking }: { booking: Booking }) {
  const tasks = booking.visit.tasks_completed ?? [];
  const defaultTasks = booking.gig?.service_category?.default_tasks ?? [];

  return (
    <section
      aria-label="Visit in progress"
      className="rounded-3xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card p-6 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          <p className="font-mono text-[11px] tracking-[0.22em] text-success uppercase">
            Visit — in progress
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {booking.caregiver.name.split(" ")[0]} is with your loved one right now. We&rsquo;ll send a
        summary the moment the visit wraps up.
      </p>

      {(tasks.length > 0 || defaultTasks.length > 0) && (
        <div className="mt-6 rounded-2xl bg-background/60 p-4 ring-1 ring-border/40">
          <p className="mb-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Progress so far
          </p>
          <ul className="space-y-1.5 text-sm">
            {(defaultTasks.length > 0 ? defaultTasks : tasks).map((task) => {
              const done = tasks.includes(task);
              return (
                <li key={task} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 place-items-center rounded-[4px] border",
                      done
                        ? "border-success bg-success text-success-foreground"
                        : "border-border/70 bg-background",
                    )}
                  >
                    {done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className={cn(done ? "text-foreground" : "text-muted-foreground/70")}>
                    {task}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit: Summary (completed)
 * ───────────────────────────────────────────────────────────── */

function VisitSummary({
  booking,
  role,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
}) {
  const { visit } = booking;
  const checkIn = visit.check_in_at ? new Date(visit.check_in_at) : null;
  const checkOut = visit.check_out_at ? new Date(visit.check_out_at) : null;
  const actualMinutes =
    checkIn && checkOut
      ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000))
      : null;

  const tasks = visit.tasks_completed ?? [];
  const defaultTasks = booking.gig?.service_category?.default_tasks ?? [];
  // Merge defaults + anything custom the caregiver ticked. Defaults retain
  // their order; unticked defaults show line-through, custom extras always
  // count as done (they're in tasks_completed by definition).
  const defaultSet = new Set(defaultTasks);
  const extras = tasks.filter((t) => !defaultSet.has(t));
  const displayTasks = [
    ...defaultTasks.map((t) => ({ label: t, done: tasks.includes(t) })),
    ...extras.map((t) => ({ label: t, done: true })),
  ];

  return (
    <section
      aria-label="Visit summary"
      className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8"
    >
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Visit log — § 12
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCell
          label="Checked in"
          value={
            checkIn
              ? checkIn.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
              : "—"
          }
        />
        <StatCell
          label="Checked out"
          value={
            checkOut
              ? checkOut.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
              : "—"
          }
        />
        <StatCell
          label="Actual"
          value={
            actualMinutes !== null
              ? actualMinutes < 60
                ? `${actualMinutes} min`
                : `${Math.floor(actualMinutes / 60)}h ${actualMinutes % 60}m`
              : "—"
          }
        />
        <StatCell label="Booked" value={formatHours(booking.duration_minutes)} />
      </div>

      {displayTasks.length > 0 && (
        <>
          <div className="my-7 border-t border-dashed border-border/60" />
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Tasks
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {displayTasks.map((task) => (
                <li key={task.label} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 grid size-4 place-items-center rounded-[4px] border",
                      task.done
                        ? "border-success bg-success text-success-foreground"
                        : "border-border/70 bg-background text-muted-foreground",
                    )}
                  >
                    {task.done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "leading-relaxed",
                      task.done ? "text-foreground" : "text-muted-foreground/70 line-through",
                    )}
                  >
                    {task.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {visit.caregiver_notes && (
        <>
          <div className="my-7 border-t border-dashed border-border/60" />
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Note from the caregiver
            </p>
            <blockquote className="mt-3 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-foreground/90 italic">
              &ldquo;{visit.caregiver_notes}&rdquo;
            </blockquote>
          </div>
        </>
      )}

      {visit.is_flagged && visit.flag_reasons.length > 0 && (
        <FlagPill reasons={visit.flag_reasons} />
      )}

      {role !== "admin" && (
        <div className="mt-7 border-t border-dashed border-border/60 pt-5">
          <IncidentReportTrigger bookingId={booking.id} />
        </div>
      )}
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl tabular-nums">{value}</p>
    </div>
  );
}

function FlagPill({ reasons }: { reasons: VisitFlagReason[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent">Flagged for admin review</p>
          <ul className="mt-2 space-y-1 text-xs text-accent/90">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/70" />
                <span>{flagReasonLabel(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Party block (caregiver card / family card)
 * ───────────────────────────────────────────────────────────── */

function PartyBlock({ booking, role }: { booking: Booking; role: string }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        {role === "caregiver" ? "The gig" : "The caregiver"}
      </div>

      {role === "caregiver" ? (
        <div className="mt-5 space-y-2 text-sm">
          <p className="text-lg font-semibold tracking-tight">
            {booking.gig?.service_category?.name ?? "Gig"}
          </p>
          <p className="text-muted-foreground italic">&ldquo;{booking.gig?.description}&rdquo;</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
            <MapPin className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <span>{booking.address_full ?? booking.address_neighbourhood}</span>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="relative size-20 overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60">
              {booking.caregiver.photo_url ? (
                <Image
                  src={booking.caregiver.photo_url}
                  alt={booking.caregiver.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {initials(booking.caregiver.name)}
                </div>
              )}
            </div>
            <span
              title="Basic Verified"
              className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-background"
            >
              <BadgeCheck className="size-4" strokeWidth={2.25} />
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-lg font-semibold tracking-tight">{booking.caregiver.name}</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
              {booking.caregiver.hourly_rate !== null
                ? `$${booking.caregiver.hourly_rate.toFixed(2)} / hour`
                : "—"}
            </p>
            <p className="mt-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Rank #{booking.match_rank}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled
        title="Messaging arrives in Phase 10"
        className="mt-6 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
      >
        <MessageCircle className="size-4" />
        Messages
        <span className="ml-1 font-mono text-[9px] tracking-[0.14em] uppercase opacity-70">
          soon
        </span>
      </button>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Timeline
 * ───────────────────────────────────────────────────────────── */

function TimelineBlock({ booking }: { booking: Booking }) {
  const events = buildTimeline(booking);
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Timeline
      </div>

      <ol className="mt-5 space-y-4">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              {e.state === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={2} />
              ) : e.state === "active" ? (
                <span className="relative flex size-4 shrink-0 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                  <span className="relative size-2.5 rounded-full bg-primary" />
                </span>
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/40" strokeWidth={1.5} />
              )}
              {i < events.length - 1 && (
                <span
                  className={cn(
                    "mt-1 w-px flex-1",
                    e.state === "done" ? "bg-success/40" : "bg-border/60",
                  )}
                  style={{ minHeight: "1.5rem" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  e.state === "pending" && "text-muted-foreground",
                )}
              >
                {e.title}
              </p>
              {e.meta && (
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground uppercase">
                  {e.meta}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type TimelineEvent = {
  title: string;
  meta: string | null;
  state: "done" | "active" | "pending";
};

function buildTimeline(booking: Booking): TimelineEvent[] {
  const fmtMeta = (d: Date) =>
    d.toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const created = new Date(booking.created_at);
  const responded = booking.responded_at ? new Date(booking.responded_at) : null;
  const cancelled = booking.cancelled_at ? new Date(booking.cancelled_at) : null;
  const checkIn = booking.visit.check_in_at ? new Date(booking.visit.check_in_at) : null;
  const checkOut = booking.visit.check_out_at ? new Date(booking.visit.check_out_at) : null;

  const base: TimelineEvent[] = [
    {
      title: "Offer sent to caregiver",
      meta: fmtMeta(created),
      state: "done",
    },
  ];

  if (
    booking.status === "cancelled_by_family" ||
    booking.status === "cancelled_by_caregiver" ||
    cancelled
  ) {
    base.push({
      title: `Cancelled by ${booking.cancelled_by ?? "system"}`,
      meta: cancelled ? fmtMeta(cancelled) : null,
      state: "done",
    });
    return base;
  }

  if (booking.status === "declined" || booking.status === "expired") {
    base.push({
      title: booking.status === "declined" ? "Caregiver declined" : "Offer expired",
      meta: responded ? fmtMeta(responded) : null,
      state: "done",
    });
    base.push({
      title: "Passed to next caregiver",
      meta: null,
      state: "done",
    });
    return base;
  }

  base.push({
    title: booking.status === "pending_caregiver" ? "Awaiting response" : "Caregiver confirmed",
    meta: responded ? fmtMeta(responded) : null,
    state:
      booking.status === "pending_caregiver"
        ? "active"
        : booking.status === "confirmed" ||
            booking.status === "in_progress" ||
            booking.status === "completed"
          ? "done"
          : "pending",
  });

  base.push({
    title: checkIn ? "Visit started" : "Check in at the visit",
    meta: checkIn ? fmtMeta(checkIn) : null,
    state: checkIn ? "done" : booking.status === "confirmed" ? "active" : "pending",
  });

  base.push({
    title: checkOut ? "Visit complete" : "Visit wraps up",
    meta: checkOut ? fmtMeta(checkOut) : null,
    state: checkOut ? "done" : booking.status === "in_progress" ? "active" : "pending",
  });

  return base;
}

/* ─────────────────────────────────────────────────────────────
 * Actions
 * ───────────────────────────────────────────────────────────── */

function ActionBlock({
  booking,
  role,
  onChanged,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "decline" | "cancel">("idle");

  async function run(action: "accept" | "decline" | "cancel") {
    setBusy(action);
    try {
      if (action === "accept") await acceptBooking(booking.id);
      else if (action === "decline") await declineBooking(booking.id, reason || undefined);
      else await cancelBooking(booking.id, reason || undefined);
      setMode("idle");
      setReason("");
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const isCaregiver = role === "caregiver";
  const isFamily = role === "family";
  const canRespond = isCaregiver && booking.status === "pending_caregiver" && !booking.is_expired;
  const canCancel =
    (isFamily || isCaregiver) &&
    (booking.status === "pending_caregiver" || booking.status === "confirmed");

  // Snapshot "now" at mount so render stays pure. The 24h cutoff copy doesn't
  // need per-second accuracy — the backend is the source of truth on cancel.
  const [nowMs] = useState(() => Date.now());
  const hoursToStart = useMemo(
    () => (new Date(booking.scheduled_start).getTime() - nowMs) / 3_600_000,
    [booking.scheduled_start, nowMs],
  );
  const feeRetained = isFamily && hoursToStart < 24;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Actions
      </div>

      {mode === "idle" && (
        <div className="mt-5 flex flex-col gap-2">
          {canRespond && (
            <>
              <Button
                onClick={() => run("accept")}
                disabled={busy !== null}
                size="lg"
                className="w-full"
              >
                {busy === "accept" ? "…" : <Check className="size-4" strokeWidth={2.25} />}
                Accept this offer
              </Button>
              <Button
                onClick={() => setMode("decline")}
                disabled={busy !== null}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <X className="size-4" />
                Decline
              </Button>
            </>
          )}

          {canCancel && (
            <Button
              onClick={() => setMode("cancel")}
              disabled={busy !== null}
              variant="outline"
              size="lg"
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Cancel booking
            </Button>
          )}

          {!canRespond && !canCancel && (
            <p className="text-sm text-muted-foreground italic">
              No actions available for this state.
            </p>
          )}
        </div>
      )}

      {mode === "decline" && (
        <ReasonForm
          title="Decline this offer?"
          description="If you decline, the booking moves on to the next ranked caregiver automatically."
          ctaLabel="Confirm decline"
          tone="warning"
          reason={reason}
          onReasonChange={setReason}
          busy={busy === "decline"}
          onConfirm={() => run("decline")}
          onCancel={() => {
            setMode("idle");
            setReason("");
          }}
        />
      )}

      {mode === "cancel" && (
        <ReasonForm
          title="Cancel this booking?"
          description={
            feeRetained
              ? `You're cancelling less than ${Math.max(0, Math.floor(hoursToStart))}h before the visit — the platform fee will be retained.`
              : "You're outside the 24-hour free-cancel window. No fee is retained."
          }
          ctaLabel="Confirm cancellation"
          tone="destructive"
          reason={reason}
          onReasonChange={setReason}
          busy={busy === "cancel"}
          onConfirm={() => run("cancel")}
          onCancel={() => {
            setMode("idle");
            setReason("");
          }}
        />
      )}

      {booking.cancellation_reason && mode === "idle" && (
        <div className="mt-5 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="mb-1 font-mono text-[10px] tracking-[0.16em] uppercase">Reason given</p>
          <p className="italic">&ldquo;{booking.cancellation_reason}&rdquo;</p>
        </div>
      )}
    </section>
  );
}

function ReasonForm({
  title,
  description,
  ctaLabel,
  tone,
  reason,
  onReasonChange,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  tone: "warning" | "destructive";
  reason: string;
  onReasonChange: (s: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-start gap-2">
        <AlertCircle
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "destructive" ? "text-destructive" : "text-accent",
          )}
        />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <textarea
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        rows={3}
        maxLength={255}
        placeholder="Reason (optional)"
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none ring-primary/30 transition-shadow focus:ring-2"
      />

      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant={tone === "destructive" ? "destructive" : "default"}
          className="flex-1"
        >
          {busy ? "…" : ctaLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy} variant="outline">
          Never mind
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Loading booking
      </div>
      <div className="h-14 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
        <div className="h-80 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
      </div>
    </div>
  );
}

function ErrorScreen({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
      <Link href="/bookings" className="mt-6 inline-block">
        <Button variant="outline">
          <Clock className="size-4" />
          Back to bookings
        </Button>
      </Link>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

/* ─────────────────────────────────────────────────────────────
 * Family confirm — fast-path payout release
 *
 * The default flow is silence-as-consent: caregiver gets paid 24 h
 * after check-out unless the family disputes within 48 h. This block
 * is a courtesy lever for engaged families — pressing the button
 * pulls payout_at forward to now so the next ReleasePayouts tick
 * transfers the funds. Hidden in every state where it would be
 * misleading (caregiver viewer, payout already moved, dispute open).
 * ───────────────────────────────────────────────────────────── */

function FamilyConfirmBlock({
  booking,
  role,
  onChanged,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (role !== "family") return null;
  if (booking.status !== "completed") return null;
  if (booking.payment_status === "held_pending_dispute") return null;

  const confirmedAt = booking.visit.family_confirmed_at;
  const isConfirmed = confirmedAt !== null;
  const payout = formatCents(booking.caregiver_payout_cents);

  async function handleConfirm() {
    setBusy(true);
    setErrorMsg(null);
    try {
      await confirmBooking(booking.id);
      onChanged();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't record the confirmation. Try again in a moment.";
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Confirm this visit"
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8",
        isConfirmed ? "border-success/35" : "border-success/25",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-success/50" />
        Closing the loop — § 12
      </div>

      {isConfirmed ? (
        <>
          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight sm:text-3xl">
            <span className="italic text-success">Visit confirmed.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            You released the {payout} payout on {formatLongTime(confirmedAt!)}. Thanks — your
            caregiver will see the funds on their next payout cycle.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/[0.06] px-3 py-1 text-[11px] tracking-[0.18em] text-success uppercase">
            <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
            Payout released early
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight sm:text-3xl">
            Was this visit <span className="italic text-success">all good?</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Confirming releases the {payout} payout to your caregiver right away instead of waiting
            on the 24-hour hold. You still have 48 hours to open a dispute either way.
          </p>

          <div className="my-7 border-t-2 border-dashed border-success/20" />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleConfirm}
              disabled={busy}
              className="border-success/40 text-success hover:bg-success/[0.08] hover:text-success focus-visible:ring-success/30"
            >
              <CheckCircle2 className="size-4" strokeWidth={2.25} />
              {busy ? "Confirming…" : "Yes, this visit happened as described"}
            </Button>
            <p className="text-[11px] tracking-[0.18em] text-muted-foreground/80 uppercase">
              Optional · skip and the payout still releases at the 24 h mark
            </p>
          </div>

          {errorMsg !== null && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.04] px-4 py-2 text-sm text-destructive"
            >
              {errorMsg}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function formatLongTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─────────────────────────────────────────────────────────────
 * Rating prompt — post-visit, each party rates the other
 *
 * Visibility rules:
 *   - Booking must be completed
 *   - This booking must still appear in the current user's
 *     `pending reviews` list (ie. they haven't reviewed yet)
 *   - After successful submit, we flip to a local "thanks" state
 *     so the card doesn't vanish mid-interaction
 * ───────────────────────────────────────────────────────────── */

type PromptPhase = "checking" | "prompt" | "submitting" | "thanks" | "skipped" | "hidden";

/**
 * Outer gate: only mount the stateful inner component when the booking is
 * actually eligible for a review. This keeps all hooks inside
 * {@link RatingPromptInner} unconditional (react-hooks/rules-of-hooks),
 * while avoiding a dead setState-in-effect against a prop that won't change.
 */
function RatingPromptBlock({ booking }: { booking: Booking }) {
  if (booking.status !== "completed") return null;
  return <RatingPromptInner booking={booking} />;
}

function RatingPromptInner({ booking }: { booking: Booking }) {
  const [phase, setPhase] = useState<PromptPhase>("checking");
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount, hit the pending-reviews endpoint once. If this booking is in
  // the list, the current user still owes their half — show the prompt.
  // Otherwise they've already reviewed and we render nothing. Same
  // let-alive pattern as every other load on this page.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pending = await getPendingReviews();
        if (!alive) return;
        const owesReview = pending.some((row) => row.booking_id === booking.id);
        setPhase(owesReview ? "prompt" : "hidden");
      } catch {
        if (!alive) return;
        // If the lookup fails we'd rather hide than double-prompt. The
        // caregiver can re-visit later and try again.
        setPhase("hidden");
      }
    })();
    return () => {
      alive = false;
    };
  }, [booking.id]);

  async function handleSubmit() {
    if (stars < 1) return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await submitReview(booking.id, {
        stars,
        body: body.trim() === "" ? null : body.trim(),
      });
      setPhase("thanks");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't submit your review. Try again in a moment.";
      setErrorMsg(msg);
      setPhase("prompt");
    }
  }

  if (phase === "checking" || phase === "hidden") {
    return null;
  }

  if (phase === "thanks") {
    return <ThanksCard />;
  }

  if (phase === "skipped") {
    return <SkippedCard onUndo={() => setPhase("prompt")} />;
  }

  const submitting = phase === "submitting";

  return (
    <section
      aria-label="Rate this visit"
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8"
    >
      {/* Corner bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 size-32 rotate-6 rounded-full bg-primary/[0.05] blur-3xl"
      />

      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-primary/40" />
        Your turn — § 13
      </div>

      <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight sm:text-3xl">
        A word on <span className="italic text-primary">how it went?</span>
      </h2>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Your rating lands on the other party&rsquo;s profile once both of you have weighed in, or
        automatically after seven days — whichever comes first. Honest is what helps.
      </p>

      <div className="my-7 border-t-2 border-dashed border-primary/20" />

      <StarPicker value={stars} onChange={setStars} disabled={submitting} />

      <div className="mt-7">
        <label
          htmlFor="review-body"
          className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase"
        >
          <span className="h-px w-6 bg-foreground/30" />A note (optional)
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What stood out? Anything the next person should know?"
          disabled={submitting}
          className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none ring-primary/30 transition-shadow focus:ring-2 disabled:opacity-60"
        />
        <p className="mt-1 text-right font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
          {body.length} / 2000
        </p>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {errorMsg}
          </p>
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={() => setPhase("skipped")}
          disabled={submitting}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          Maybe later
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={stars < 1 || submitting}
          size="lg"
          className="sm:min-w-[12rem]"
        >
          {submitting ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Star className="size-4" strokeWidth={2.25} />
          )}
          {submitting ? "Sending…" : "Send your review"}
        </Button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Star picker — keyboard-navigable radio group with hover preview
 * ───────────────────────────────────────────────────────────── */

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  const labels = ["Dreadful", "Not great", "Fine", "Really good", "Exceptional"];

  function onKey(e: React.KeyboardEvent<HTMLButtonElement>, current: number) {
    if (disabled) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, current - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, current + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(1);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(5);
    }
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        How many stars?
      </p>
      <div
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHover(0)}
        className="mt-4 inline-flex items-center gap-2"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              disabled={disabled}
              tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
              onClick={() => onChange(n)}
              onMouseEnter={() => !disabled && setHover(n)}
              onFocus={() => !disabled && setHover(n)}
              onBlur={() => setHover(0)}
              onKeyDown={(e) => onKey(e, value || 1)}
              className={cn(
                "group rounded-md p-1 outline-none transition-transform",
                "focus-visible:ring-2 focus-visible:ring-primary/50",
                !disabled && "hover:scale-110 active:scale-100",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Star
                className={cn(
                  "size-9 transition-all",
                  filled ? "fill-accent stroke-accent" : "fill-transparent stroke-border",
                  filled && hover === n && "drop-shadow-[0_0_8px_theme(colors.accent/0.4)]",
                )}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase tabular-nums"
        aria-live="polite"
      >
        {display > 0 ? (
          <>
            <span className="text-foreground">{display}</span> of 5 ·{" "}
            <span className="italic">{labels[display - 1]}</span>
          </>
        ) : (
          <span>Tap a star or use arrow keys</span>
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Post-submit confirmation
 * ───────────────────────────────────────────────────────────── */

function ThanksCard() {
  return (
    <section
      aria-label="Review sent"
      className="relative overflow-hidden rounded-3xl border border-success/25 bg-gradient-to-br from-success/[0.05] via-card to-card p-6 sm:p-8"
    >
      <div className="flex items-start gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/25">
          <CheckCircle2 className="size-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-success/40" />
            Received
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Thanks for weighing in.</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Your review lands on their profile once your counterpart rates too, or automatically
            after seven days. Either way — it counts toward their Trust Score from now.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Maybe-later card — kept on-screen so the prompt's spot doesn't
 * collapse; user can undo if they change their mind.
 * ───────────────────────────────────────────────────────────── */

function SkippedCard({ onUndo }: { onUndo: () => void }) {
  return (
    <section
      aria-label="Review deferred"
      className="rounded-3xl border border-dashed border-border/70 bg-card/50 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            No review yet
          </p>
          <p className="mt-1 text-sm text-foreground/80">
            We&rsquo;ll nudge you again — or it&rsquo;ll close on its own after seven days.
          </p>
        </div>
        <Button onClick={onUndo} variant="outline" size="sm">
          Actually, I&rsquo;ll do it now
        </Button>
      </div>
    </section>
  );
}
