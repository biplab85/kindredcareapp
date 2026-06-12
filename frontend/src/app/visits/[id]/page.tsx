"use client";

import { use, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SafetyGate } from "@/components/bookings/safety-gate";
import { type Booking, getBooking } from "@/lib/bookings";
import {
  VisitLiveLog,
  VisitStartPanel,
} from "@/app/bookings/[id]/_components/visit-panels";

/**
 * Focused visit landing page — the magic-link email drops caregivers
 * here, not on the full /bookings/[id] page. No DashboardShell, no
 * sidebar; just the address (so they know whose door they're at) and
 * the single status-appropriate panel for the moment they're in.
 */
export default function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bookingId = Number(id);

  return (
    <AuthGuard roles={["caregiver"]}>
      <VisitView bookingId={bookingId} />
    </AuthGuard>
  );
}

function VisitView({ bookingId }: { bookingId: number }) {
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

  if (Number.isNaN(bookingId) || error === "notfound") {
    return (
      <Centered>
        <p className="text-xl font-semibold tracking-tight">We couldn&rsquo;t find that visit.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been cancelled, or the link is for an account you&rsquo;re not signed in to.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.22em] text-primary uppercase hover:text-primary/80"
        >
          Back to dashboard <ArrowUpRight className="size-3" strokeWidth={2.5} />
        </Link>
      </Centered>
    );
  }

  if (error === "generic") {
    return (
      <Centered>
        <p className="text-xl font-semibold tracking-tight">Something went sideways.</p>
        <p className="mt-2 text-sm text-muted-foreground">Refresh in a moment.</p>
      </Centered>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const start = new Date(booking.scheduled_start);
  const startCopy = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="relative min-h-screen">
      {/* Paper wash — same atmosphere as the booking detail page, scoped to this screen */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/0.04),transparent_55%)]"
      />

      <div className="mx-auto max-w-2xl px-4 pt-5 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
        {/* Top strip — brand on the left, escape hatch on the right */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            aria-label="KindredCare home"
            className="inline-flex items-center rounded-full bg-background px-3 py-1.5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] ring-1 ring-border/60 transition-shadow hover:shadow-[0_2px_8px_rgba(10,14,40,0.06)]"
          >
            <Image
              src="/logo.png"
              alt="KindredCare"
              width={180}
              height={40}
              priority
              className="h-5 w-auto sm:h-6"
            />
          </Link>
          <Link
            href={`/bookings/${booking.id}`}
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Full booking
            <ArrowUpRight className="size-3" strokeWidth={2.5} />
          </Link>
        </div>

        {/* Editorial § marker */}
        <p className="mt-5 font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          Visit — § {booking.id.toString().padStart(3, "0")}
        </p>

        {/* "Whose door am I at" anchor */}
        <div className="mt-3 rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            You&rsquo;re visiting
          </p>
          <h1 className="mt-2 text-2xl leading-[1.15] font-semibold tracking-tight sm:text-3xl">
            {booking.address_neighbourhood || "Your scheduled visit"}
          </h1>
          {booking.address_full && (
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-foreground/80">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
              <span>{booking.address_full}</span>
            </p>
          )}
          <p className="mt-2 flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            <Clock className="size-3.5" strokeWidth={1.75} />
            {startCopy}
          </p>
        </div>

        {/* The single status-appropriate panel. Safety gate runs before
            the start panel — caregivers can't check in until they
            acknowledge the briefing. The flag travels with the booking
            record so once cleared it stays cleared. */}
        <div className="mt-6">
          {booking.status === "confirmed" &&
            (booking.safety_acknowledged_at ? (
              <VisitStartPanel booking={booking} onChanged={reload} />
            ) : (
              <SafetyGate bookingId={booking.id} onAcknowledged={reload} />
            ))}
          {booking.status === "in_progress" && (
            <VisitLiveLog booking={booking} onChanged={reload} />
          )}
          {booking.status === "completed" && <VisitCompleteCard booking={booking} />}
          {booking.status !== "confirmed" &&
            booking.status !== "in_progress" &&
            booking.status !== "completed" && <NotActiveCard booking={booking} />}
        </div>
      </div>
    </div>
  );
}

function VisitCompleteCard({ booking }: { booking: Booking }) {
  return (
    <section
      aria-label="Visit complete"
      className="rounded-3xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/30">
          <CheckCircle2 className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Visit closed out — <span className="italic font-normal">thank you</span>.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The family received your summary and the payout is queued. You can review the receipt
            and any rating they leave on the full booking page.
          </p>
          <Link
            href={`/bookings/${booking.id}`}
            className="mt-5 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.22em] text-primary uppercase hover:text-primary/80"
          >
            See receipt & summary
            <ArrowUpRight className="size-3" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function NotActiveCard({ booking }: { booking: Booking }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        Visit not active
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">
        This booking isn&rsquo;t in a state you can start.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Current status:{" "}
        <span className="font-mono text-[12px] tracking-wider">{booking.status}</span>. Head to the
        full booking page to see what&rsquo;s going on or to message the family.
      </p>
      <Link
        href={`/bookings/${booking.id}`}
        className="mt-5 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.22em] text-primary uppercase hover:text-primary/80"
      >
        Open full booking
        <ArrowUpRight className="size-3" strokeWidth={2.5} />
      </Link>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">{children}</div>
    </div>
  );
}
