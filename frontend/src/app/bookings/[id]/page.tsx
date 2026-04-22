"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";
import {
  acceptBooking,
  type Booking,
  cancelBooking,
  declineBooking,
  formatCents,
  formatHours,
  getBooking,
  statusLabel,
  statusTone,
} from "@/lib/bookings";
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

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/bookings"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>

        <DetailHeader booking={booking} role={role} />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
          <div className="space-y-6">
            <ReceiptBlock booking={booking} />
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
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Booking detail
        <span className="text-foreground/30">— § 10</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl">
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
 * Receipt block
 * ───────────────────────────────────────────────────────────── */

function ReceiptBlock({ booking }: { booking: Booking }) {
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

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground italic">
        Payment status:{" "}
        <span className="not-italic">{booking.payment_status.replaceAll("_", " ")}</span>. Real
        Stripe capture lands in Phase 9; this booking is running on the stub channel.
      </p>
    </section>
  );
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
  const created = new Date(booking.created_at);
  const responded = booking.responded_at ? new Date(booking.responded_at) : null;
  const cancelled = booking.cancelled_at ? new Date(booking.cancelled_at) : null;

  const base: TimelineEvent[] = [
    {
      title: "Offer sent to caregiver",
      meta: created.toLocaleString("en-CA", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
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
      meta: cancelled
        ? cancelled.toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null,
      state: "done",
    });
    return base;
  }

  if (booking.status === "declined" || booking.status === "expired") {
    base.push({
      title: booking.status === "declined" ? "Caregiver declined" : "Offer expired",
      meta:
        responded?.toLocaleString("en-CA", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }) ?? null,
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
    meta:
      responded?.toLocaleString("en-CA", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) ?? null,
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
    title: "Check in at the visit",
    meta: null,
    state:
      booking.status === "in_progress" || booking.status === "completed"
        ? "done"
        : booking.status === "confirmed"
          ? "active"
          : "pending",
  });

  base.push({
    title: "Visit complete",
    meta: null,
    state: booking.status === "completed" ? "done" : "pending",
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
    <div className="mx-auto max-w-5xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
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
