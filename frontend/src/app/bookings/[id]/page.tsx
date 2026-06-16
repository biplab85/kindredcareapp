"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  Loader2,
  type LucideIcon,
  MapPin,
  MapPinOff,
  MessageCircle,
  Navigation,
  PlayCircle,
  Star,
  StopCircle,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { IncidentReportTrigger } from "@/components/bookings/incident-form";
import { MessagesBlock } from "@/components/bookings/messages-block";
import { ArrivalReportCard } from "@/components/bookings/arrival-report-card";
import { CaregiverArrivalResponseCard } from "@/components/bookings/caregiver-arrival-response-card";
import { DisputeForm } from "@/components/bookings/dispute-form";
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
  DISPUTE_WINDOW_HOURS,
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
import { EASTERN_TZ } from "@/lib/eastern-time";

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
  // Lifted out of FloatingMessages so the inline "Messages" button in
  // PartyBlock can open the same floating panel — single source of
  // truth for whether the chat is open.
  const [messagesOpen, setMessagesOpen] = useState(false);

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
    <>
      <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Link
          href="/bookings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>

        <DetailHeader booking={booking} role={role} />

        {/* Caregiver-only respond panel — visible while the offer is open
            and unexpired. Previously the accept/decline controls only
            existed on the /bookings list page, so a caregiver who
            deep-linked into the detail (from email, notification, magic
            link) had to back out to take action. */}
        {role === "caregiver" && booking.status === "pending_caregiver" && !booking.is_expired && (
          <OfferRespondPanel booking={booking} onChanged={reload} />
        )}

        <ArrivalBanner booking={booking} role={role} />

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
          <div className="space-y-6">
            <ReceiptBlock booking={booking} role={role} />
            <VisitBlock booking={booking} role={role} onChanged={reload} />
            {/* Inline messages card hidden (kept mounted) — chat now lives in the floating panel. */}
            <div className="hidden">
              <MessagesBlock bookingId={booking.id} />
            </div>
            <FamilyConfirmBlock booking={booking} role={role} onChanged={reload} />
            <RatingPromptBlock booking={booking} />
            <PartyBlock
              booking={booking}
              role={role}
              onOpenMessages={() => setMessagesOpen(true)}
            />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <TimelineBlock booking={booking} role={role} onChanged={reload} />
          </aside>
        </div>
      </div>

      <FloatingMessages bookingId={booking.id} open={messagesOpen} setOpen={setMessagesOpen} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Floating messages — a bottom-right launcher that opens the
 * existing Messages card in a floating panel with a close button.
 * The inline Messages card stays exactly where it is.
 * ───────────────────────────────────────────────────────────── */

function FloatingMessages({
  bookingId,
  open,
  setOpen,
}: {
  bookingId: number;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <>
      {open && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 fixed right-4 bottom-24 z-50 w-[min(380px,calc(100vw-2rem))] duration-200 sm:right-6">
          <MessagesBlock bookingId={bookingId} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close messages" : "Open messages"}
        aria-expanded={open}
        className="fixed right-4 bottom-6 z-50 grid size-12 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-100 sm:right-6"
      >
        {open ? (
          <X className="size-5" strokeWidth={2.25} />
        ) : (
          <MessageCircle className="size-5" strokeWidth={2} />
        )}
      </button>
    </>
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
    pending: "bg-accent/10 text-accent ring-accent/30",
    positive: "bg-success/10 text-success ring-success/30",
    warning: "bg-muted text-muted-foreground ring-border",
    neutral: "bg-muted text-muted-foreground ring-border",
  };

  const start = new Date(booking.scheduled_start);

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
          accentClass[tone],
        )}
      >
        <span className="size-1.5 rounded-full bg-current opacity-70" />
        {statusLabel(booking.status)}
      </span>

      <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {start.toLocaleDateString("en-CA", {
          timeZone: EASTERN_TZ,
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </h1>

      <span className="text-sm text-muted-foreground">
        {start.toLocaleTimeString("en-CA", {
          timeZone: EASTERN_TZ,
          hour: "numeric",
          minute: "2-digit",
        })}
        {" · "}
        {formatHours(booking.duration_minutes)}
        {role === "family" &&
          booking.fallback_queue_size > 0 &&
          booking.status === "pending_caregiver" && (
            <>
              {" · "}
              <span className="tabular-nums">
                {booking.fallback_queue_size} caregiver
                {booking.fallback_queue_size === 1 ? "" : "s"} on standby
              </span>
            </>
          )}
      </span>

      <span className="ml-auto text-xs font-medium text-muted-foreground">
        Booking ID{" "}
        <span className="font-semibold text-foreground tabular-nums">
          #{String(booking.id).padStart(5, "0")}
        </span>
      </span>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Offer respond panel — caregiver-only, visible while the
 * booking is pending and unexpired. The list-page row has
 * compact accept/decline; this is the deep-link equivalent
 * so a caregiver landing here from email/notification has
 * the action right there.
 * ───────────────────────────────────────────────────────────── */

function OfferRespondPanel({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    try {
      if (action === "accept") {
        await acceptBooking(booking.id);
      } else {
        await declineBooking(booking.id);
      }
      onChanged();
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't submit that response. Try again in a moment.";
      setError(message);
      setBusy(null);
    }
  }

  const deadline = new Date(booking.response_deadline_at);
  const deadlineCopy = deadline.toLocaleString("en-CA", {
    timeZone: EASTERN_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const total = formatCents(booking.subtotal_cents);
  const payout = formatCents(booking.caregiver_payout_cents);

  return (
    <section
      aria-label="Respond to booking offer"
      className="mt-5 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-primary/30 px-5 py-3 sm:px-7">
        <span className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">
          New offer
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          Respond by {deadlineCopy}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            A family booked you for this visit.
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground tabular-nums">{total}</span> total
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>
              You receive{" "}
              <span className="font-semibold text-foreground tabular-nums">{payout}</span>
            </span>
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Paid for the time you actually work, up to the booked amount.
          </p>
          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/[0.06] px-3 py-2 text-xs text-destructive ring-1 ring-destructive/20">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => handle("decline")}
            disabled={busy !== null}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {busy === "decline" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Decline
          </Button>
          <Button
            size="lg"
            onClick={() => handle("accept")}
            disabled={busy !== null}
            className="cursor-pointer bg-success text-success-foreground hover:bg-success/90"
          >
            {busy === "accept" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" strokeWidth={2.25} />
            )}
            Accept
          </Button>
        </div>
      </div>
    </section>
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
      className="mt-6 rounded-xl border border-success/30 bg-success/5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
          {live && <span className="absolute inset-0 animate-ping rounded-full bg-success/30" />}
          <Check className="relative size-4" strokeWidth={2.5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            {caregiverName} arrived at{" "}
            <span className="tabular-nums">
              {checkIn.toLocaleTimeString("en-CA", {
                timeZone: EASTERN_TZ,
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-success/80 uppercase">
            {live ? "Visit in progress" : "Visit recorded"}
          </p>
        </div>
      </div>
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
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Order of service</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-border">
          Receipt
        </span>
      </div>

      {/* Card content */}
      <div className="px-6 py-6 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow
            icon={Tag}
            label="Service"
            value={booking.gig?.service_category?.name ?? "Gig"}
          />
          <DetailRow
            icon={Calendar}
            label="When"
            value={new Date(booking.scheduled_start).toLocaleString("en-CA", {
              timeZone: EASTERN_TZ,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
          <DetailRow icon={Timer} label="Duration" value={formatHours(booking.duration_minutes)} />
          <DetailRow
            icon={MapPin}
            label={booking.address_full ? "Address" : "Neighbourhood"}
            value={booking.address_full ?? booking.address_neighbourhood}
          />
        </div>

        <div className="mt-5 rounded-xl bg-muted/30 p-4 ring-1 ring-border/60">
          <dl className="space-y-2.5 text-sm">
            <Line label="Rate" value={`${formatCents(booking.hourly_rate_cents)} / hour`} tabular />
            <Line label="Subtotal" value={formatCents(booking.subtotal_cents)} tabular />
            <Line
              label="Platform fee (7.5%)"
              value={`− ${formatCents(booking.platform_fee_cents)}`}
              tabular
              muted
            />
          </dl>
        </div>
      </div>

      {/* Card footer */}
      <div className="border-t border-border bg-muted/30 px-6 py-5 sm:px-8">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-muted-foreground">Caregiver payout</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {formatCents(booking.caregiver_payout_cents)}
          </p>
        </div>

        <PaymentStatusNote booking={booking} role={role} />
      </div>
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
          ? "Visit captured. Payout transfers after the 48-hour hold."
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
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm",
          tabular ? "tabular-nums" : "",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      </div>
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
  const isFamily = role === "family";

  // Family-side "Caregiver hasn't arrived" surfaces only after the
  // scheduled start has passed AND the caregiver still hasn't checked
  // in. Snapshot now at mount — React 19 rejects Date.now() in render
  // bodies, and second-precision drift over a single visit doesn't
  // matter for this soft UI gate.
  const [nowMs] = useState(() => Date.now());
  const scheduledStartMs = new Date(booking.scheduled_start).getTime();
  const arrivalWindowOpen =
    status === "confirmed" && !booking.visit.check_in_at && nowMs > scheduledStartMs;

  if (status === "confirmed" && isCaregiver) {
    return (
      <>
        <PanicButton bookingId={booking.id} existingAlert={booking.active_panic_alert ?? null} />
        {booking.active_arrival_report && (
          <CaregiverArrivalResponseCard
            bookingId={booking.id}
            report={booking.active_arrival_report}
            onChanged={onChanged}
          />
        )}
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
        {booking.active_arrival_report && (
          <CaregiverArrivalResponseCard
            bookingId={booking.id}
            report={booking.active_arrival_report}
            onChanged={onChanged}
          />
        )}
        <VisitLiveLog booking={booking} onChanged={onChanged} />
      </>
    );
  }

  if (status === "in_progress" && role === "family") {
    return (
      <>
        <VisitInProgressWatch booking={booking} />
        {/* Family-side arrival report for the in-progress dispute case:
            caregiver checked in (GPS recorded) but family says they're
            not actually at the address. Admin gets paged with the GPS
            evidence inline. */}
        <ArrivalReportCard bookingId={booking.id} reason="not_at_site_despite_checkin" />
      </>
    );
  }

  // Confirmed + family + past start + no check-in → "caregiver hasn't arrived"
  if (isFamily && arrivalWindowOpen) {
    return <ArrivalReportCard bookingId={booking.id} reason="not_yet_arrived" />;
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
      className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8"
    >
      {/* Radar tint — visible only while locating */}
      {phase === "locating" && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,theme(colors.primary/0.1),transparent_65%)]"
        />
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
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
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
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
      className="relative overflow-hidden rounded-xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-success/30 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
            Visit — live
          </p>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {elapsedMin < 60
            ? `${elapsedMin} min elapsed`
            : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m elapsed`}
        </p>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        {/* Task checklist */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              <ClipboardList className="size-3.5" />
              What you&rsquo;re covering
            </div>
            <SaveIndicator state={saveState} />
          </div>

          {allTasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
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
                      <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">
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
            className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            A note for the family
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
        <div className="border-t-2 border-success/30 pt-6">
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

          <div className="mt-5 border-t border-border/60 pt-4">
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
  return (
    <p className={cn("text-[11px] font-semibold tracking-[0.1em] uppercase", tone)}>{label}</p>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit: In-progress watch (family, passive)
 * ───────────────────────────────────────────────────────────── */

function VisitInProgressWatch({ booking }: { booking: Booking }) {
  const tasks = booking.visit.tasks_completed ?? [];
  const defaultTasks = booking.gig?.service_category?.default_tasks ?? [];

  return (
    <>
      {/* Both parties need the safety escalation during an active visit.
          The caregiver-side branches above already render PanicButton;
          the family had no equivalent — so a family seeing something
          alarming had no in-app way to summon admin. */}
      <PanicButton bookingId={booking.id} existingAlert={booking.active_panic_alert ?? null} />

      <section
        aria-label="Visit in progress"
        className="rounded-xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card p-6 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
              <span className="relative size-2.5 rounded-full bg-success" />
            </span>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
              Visit — in progress
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {booking.caregiver.name.split(" ")[0]} is with your loved one right now. We&rsquo;ll send
          a summary the moment the visit wraps up.
        </p>

        {(tasks.length > 0 || defaultTasks.length > 0) && (
          <div className="mt-6 rounded-2xl bg-background/60 p-4 ring-1 ring-border/40">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
    </>
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
      className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
          <ClipboardList className="size-4" strokeWidth={2} />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Visit log</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCell
          label="Checked in"
          tone="text-success"
          value={
            checkIn
              ? checkIn.toLocaleTimeString("en-CA", {
                  timeZone: EASTERN_TZ,
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"
          }
        />
        <StatCell
          label="Checked out"
          tone="text-primary"
          value={
            checkOut
              ? checkOut.toLocaleTimeString("en-CA", {
                  timeZone: EASTERN_TZ,
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"
          }
        />
        <StatCell
          label="Actual"
          tone="text-accent"
          value={
            actualMinutes !== null
              ? actualMinutes < 60
                ? `${actualMinutes} min`
                : `${Math.floor(actualMinutes / 60)}h ${actualMinutes % 60}m`
              : "—"
          }
        />
        <StatCell
          label="Booked"
          tone="text-[oklch(0.55_0.16_295)]"
          value={formatHours(booking.duration_minutes)}
        />
      </div>

      {displayTasks.length > 0 && (
        <>
          <div className="my-5 border-t border-border/60" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
          <div className="my-5 border-t border-border/60" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Note from the caregiver
            </p>
            <p className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
              {visit.caregiver_notes}
            </p>
          </div>
        </>
      )}

      {visit.is_flagged && visit.flag_reasons.length > 0 && (
        <FlagPill reasons={visit.flag_reasons} />
      )}

      {role !== "admin" && (
        <div className="mt-7 border-t border-border/60 pt-5">
          <IncidentReportTrigger bookingId={booking.id} />
        </div>
      )}
    </section>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className={cn("text-[11px] font-semibold tracking-[0.12em] uppercase", tone)}>{label}</p>
      <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{value}</p>
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

function PartyBlock({
  booking,
  role,
  onOpenMessages,
}: {
  booking: Booking;
  role: string;
  onOpenMessages: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="border-b border-border px-6 py-4 sm:px-8">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {role === "caregiver" ? "The gig" : "The caregiver"}
        </h2>
      </div>

      {/* Card content */}
      <div className="px-6 py-6 sm:px-8">
        {role === "caregiver" ? (
          <div className="space-y-3">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {booking.gig?.service_category?.name ?? "Gig"}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {booking.gig?.description}
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground/80 ring-1 ring-border/60">
              <MapPin className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span>{booking.address_full ?? booking.address_neighbourhood}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-5">
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
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {booking.caregiver.hourly_rate !== null
                  ? `$${booking.caregiver.hourly_rate.toFixed(2)} / hour`
                  : "—"}
              </p>
              <p className="mt-2.5 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border">
                Rank #{booking.match_rank}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="border-t border-border bg-muted/30 px-6 py-4 sm:px-8">
        <button
          type="button"
          onClick={onOpenMessages}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary"
        >
          <MessageCircle className="size-4" />
          Messages
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Timeline
 * ───────────────────────────────────────────────────────────── */

function TimelineBlock({
  booking,
  role,
  onChanged,
}: {
  booking: Booking;
  role: "family" | "caregiver" | "admin";
  onChanged: () => void;
}) {
  const events = buildTimeline(booking);
  const [cancelling, setCancelling] = useState(false);

  const canCancel =
    (role === "family" || role === "caregiver") &&
    (booking.status === "pending_caregiver" || booking.status === "confirmed");

  // Snapshot "now" at mount so render stays pure; the 24h fee-cutoff copy
  // doesn't need per-second accuracy — the backend is the source of truth.
  const [nowMs] = useState(() => Date.now());
  const feeRetained =
    role === "family" && (new Date(booking.scheduled_start).getTime() - nowMs) / 3_600_000 < 24;

  async function handleCancel() {
    if (cancelling) return;
    const note = feeRetained
      ? " You're within 24 hours of the visit, so the platform fee is retained."
      : "";
    if (!window.confirm(`Cancel this booking?${note}`)) return;
    setCancelling(true);
    try {
      await cancelBooking(booking.id);
      onChanged();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Timeline</h2>
      </div>

      {/* Card content */}
      <div className="px-6 py-5">
        <ol className="space-y-4">
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
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{e.meta}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Card footer */}
      {canCancel && (
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <Button
            onClick={handleCancel}
            disabled={cancelling}
            variant="outline"
            className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            {cancelling ? "Cancelling…" : "Cancel booking"}
          </Button>
        </div>
      )}
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
      timeZone: EASTERN_TZ,
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
 * States
 * ───────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-14 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
        <div className="h-80 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
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
  const [reporting, setReporting] = useState(false);

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

  // When the family taps "Report a problem" we swap this block for the
  // dispute form — same column slot, no modal, scrolls into view.
  if (reporting && !isConfirmed) {
    return (
      <DisputeForm
        bookingId={booking.id}
        onCancel={() => setReporting(false)}
        onFiled={() => {
          setReporting(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <section
      aria-label="Confirm this visit"
      className="rounded-xl border border-success/30 bg-success/[0.04] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
          <CheckCircle2 className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          {isConfirmed ? (
            <>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
                Confirmed
              </p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                Visit confirmed.
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                You released the {payout} payout on {formatLongTime(confirmedAt!)}. Thanks — your
                caregiver will see the funds on their next payout cycle.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                <CheckCircle2 className="size-3" strokeWidth={2.5} />
                Payout released early
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
                Confirm visit
              </p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                Was this visit all good?
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Confirming releases the {payout} payout to your caregiver right away instead of
                waiting on the 48-hour hold. You can still open a dispute within the 48-hour window
                either way.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  onClick={() => setReporting(true)}
                  disabled={busy}
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-muted-foreground hover:bg-accent/[0.06] hover:text-accent"
                >
                  <AlertCircle className="size-3.5" strokeWidth={2.25} />
                  Report a problem
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  size="sm"
                  className="cursor-pointer bg-success text-success-foreground hover:bg-success/90"
                >
                  <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                  {busy ? "Confirming…" : "Confirm visit"}
                </Button>
              </div>

              <DisputeWindowCountdown checkOutAt={booking.visit.check_out_at} className="mt-3" />

              {errorMsg !== null && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/30 bg-destructive/[0.04] px-3 py-2 text-sm text-destructive"
                >
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DisputeWindowCountdown({
  checkOutAt,
  className,
}: {
  checkOutAt: string | null;
  className?: string;
}) {
  // Snapshot now once — the 48h window is precise to the minute, not the
  // millisecond, and a live tick would need useSyncExternalStore per
  // CLAUDE.md. The page already reloads on common state changes.
  const [nowMs] = useState(() => Date.now());

  if (!checkOutAt) return null;
  const deadline = new Date(checkOutAt).getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
  const remainingMs = deadline - nowMs;
  if (remainingMs <= 0) return null;

  const remainingMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  const label = hours >= 1 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60",
        className,
      )}
    >
      <Clock className="size-3" strokeWidth={2} />
      {label} left to confirm or report
    </p>
  );
}

function formatLongTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: EASTERN_TZ,
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
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      {/* Soft corner glow for depth — matches the elevated visit panels */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-[radial-gradient(circle,theme(colors.primary/0.14),transparent_70%)]"
      />

      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-dashed border-primary/30 px-6 py-3.5 sm:px-8">
        <span className="h-px w-6 bg-primary/40" />
        <span className="text-[11px] font-semibold tracking-[0.22em] text-primary uppercase">
          Your turn
        </span>
      </div>

      {/* Body */}
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4 sm:gap-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Star className="size-7" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              A word on how it went?
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Your rating lands on the other party&rsquo;s profile once both of you have weighed in,
              or automatically after seven days — whichever comes first. Honest is what helps.
            </p>
          </div>
        </div>

        {/* Star picker — set into a subtle inset, like the receipt panels */}
        <div className="mt-6 rounded-2xl bg-background/60 p-5 ring-1 ring-border/50 sm:p-6">
          <StarPicker value={stars} onChange={setStars} disabled={submitting} />
        </div>

        <div className="mt-5">
          <label
            htmlFor="review-body"
            className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            A note (optional)
          </label>
          <textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What stood out? Anything the next person should know?"
            disabled={submitting}
            className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-3 text-sm leading-relaxed outline-none ring-primary/30 transition-shadow focus:ring-2 disabled:opacity-60"
          />
          <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">
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
      </div>

      {/* Footer actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
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
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
                  filled ? "fill-[#079400] stroke-[#079400]" : "fill-transparent stroke-border",
                  filled && hover === n && "drop-shadow-[0_0_8px_#07940066]",
                )}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase tabular-nums"
        aria-live="polite"
      >
        {display > 0 ? (
          <>
            <span className="text-foreground">{display}</span> of 5 ·{" "}
            <span className="text-foreground/70">{labels[display - 1]}</span>
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
      className="relative overflow-hidden rounded-xl border border-success/25 bg-gradient-to-br from-success/[0.05] via-card to-card p-6 sm:p-8"
    >
      <div className="flex items-start gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/25">
          <CheckCircle2 className="size-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Thanks for weighing in.
          </h2>
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
      className="rounded-xl border border-border/70 bg-card/50 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
