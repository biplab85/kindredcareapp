"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Star,
  TimerReset,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminMessage,
  type BookingDetail,
  type DisputeSummary,
  formatDollars,
  getAdminBooking,
  hideMessage,
  paymentStatusLabel,
  paymentTone,
  refundBooking,
  statusLabel,
  type StatusTone,
  statusTone,
  unhideMessage,
} from "@/lib/admin-bookings";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminBookingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Booking detail">
        <DetailView id={id} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

function DetailView({ id }: { id: string }) {
  const [data, setData] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const next = await getAdminBooking(id);
      setData(next);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await getAdminBooking(id);
        if (!alive) return;
        setData(next);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

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

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <BackLink />
        {state === "loading" && <Skeleton />}
        {state === "error" && <ErrorCard onRetry={reload} />}
        {state === "ready" && data && <Body data={data} onMutated={reload} />}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/bookings"
      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Back to bookings
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Body
 * ───────────────────────────────────────────────────────────── */

function Body({ data, onMutated }: { data: BookingDetail; onMutated: () => void }) {
  const openDispute = data.disputes.find((d) => d.status === "open" || d.status === "under_review");
  const canRefund = canBookingRefund(data);

  return (
    <div className="mt-6 space-y-10">
      <BookingHeader data={data} />

      {openDispute && <OpenDisputeCallout dispute={openDispute} />}

      {canRefund && (
        <RefundPanel
          bookingId={data.id}
          subtotalCents={data.subtotal_cents}
          openDisputeId={openDispute?.id ?? null}
          onDone={onMutated}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PartiesPanel data={data} />
        <PaymentPanel data={data} />
      </div>

      <VisitEvidencePanel data={data} />

      <MessagesPanel messages={data.messages} onMutated={onMutated} />

      {data.disputes.length > 0 && <DisputesPanel disputes={data.disputes} />}
    </div>
  );
}

function canBookingRefund(data: BookingDetail): boolean {
  return [
    "captured",
    "captured_stub",
    "released",
    "released_stub",
    "held_pending_dispute",
  ].includes(data.payment_status);
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function BookingHeader({ data }: { data: BookingDetail }) {
  const tone = statusTone(data.status);
  const pTone = paymentTone(data.payment_status);
  const start = data.scheduled_start ? new Date(data.scheduled_start) : null;

  return (
    <header className="mt-6">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        <span>Booking #{String(data.id).padStart(5, "0")}</span>
        <span className="text-foreground/30">— § 38</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        {data.family?.name ?? "Family"}{" "}
        <span className="font-normal italic text-muted-foreground">to</span>{" "}
        {data.caregiver?.name ?? "Caregiver"}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Pill tone={tone}>{statusLabel(data.status)}</Pill>
        <Pill tone={pTone}>{paymentStatusLabel(data.payment_status)}</Pill>
        {data.flagged_at && (
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
            <Flag className="size-2.5" strokeWidth={2.25} />
            Flagged
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {start && (
          <span className="inline-flex items-center gap-1.5 font-mono normal-case tracking-[0.05em] tabular-nums">
            <CalendarDays className="size-3" strokeWidth={2} />
            {start.toLocaleString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
        <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
        <span className="inline-flex items-center gap-1 font-mono normal-case tracking-[0.05em] tabular-nums">
          <TimerReset className="size-3" strokeWidth={2} />
          {data.duration_minutes} min
        </span>
        {data.address && (
          <>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5 normal-case tracking-[0.05em]">
              <MapPin className="size-3" strokeWidth={2} />
              <span className="text-foreground/70">{data.address}</span>
            </span>
          </>
        )}
      </div>
    </header>
  );
}

function Pill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "good" && "border border-success/40 bg-success/[0.07] text-success",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Open-dispute callout banner
 * ───────────────────────────────────────────────────────────── */

function OpenDisputeCallout({ dispute }: { dispute: DisputeSummary }) {
  return (
    <section className="rounded-2xl border border-accent/50 bg-accent/[0.05] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
          <ShieldAlert className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
            Open dispute
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <span className="font-normal italic">Filed by</span> {dispute.reporter.name}{" "}
            <span className="text-muted-foreground">·</span>{" "}
            <span className="font-mono text-base text-accent">
              {dispute.reason_code.replace(/_/g, " ")}
            </span>
          </h3>
          <blockquote className="mt-3 border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-foreground/85 italic">
            &ldquo;{dispute.description}&rdquo;
          </blockquote>
          <p className="mt-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Resolve by issuing a refund below, or dismiss after investigation.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Refund panel
 * ───────────────────────────────────────────────────────────── */

function RefundPanel({
  bookingId,
  subtotalCents,
  openDisputeId,
  onDone,
}: {
  bookingId: number;
  subtotalCents: number;
  openDisputeId: number | null;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialDollars, setPartialDollars] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    let amountCents: number | undefined;
    if (mode === "partial") {
      const parsed = parseFloat(partialDollars);
      if (Number.isNaN(parsed) || parsed <= 0) {
        toast.error("Enter a valid partial amount.");
        return;
      }
      amountCents = Math.round(parsed * 100);
      if (amountCents > subtotalCents) {
        toast.error("Partial refund can't exceed the visit subtotal.");
        return;
      }
    }
    setBusy(true);
    try {
      await refundBooking(bookingId, {
        amount_cents: amountCents,
        reason: reason.trim(),
        dispute_id: openDisputeId ?? undefined,
      });
      toast.success(mode === "full" ? "Full refund issued." : "Partial refund issued.");
      onDone();
    } catch {
      toast.error("Couldn't issue refund. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-primary/15 text-primary">
          <DollarSign className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">Refund</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <span className="font-normal italic">Make them whole.</span>
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Issuing a refund flips the payment status and lands on the audit trail. If a dispute is
            open, the same action resolves it.
          </p>

          <div className="mt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Mode
            </p>
            <div className="mt-2 inline-flex rounded-full border border-border/70 bg-background p-1">
              <button
                type="button"
                onClick={() => setMode("full")}
                aria-pressed={mode === "full"}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  mode === "full"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Full · {formatDollars(subtotalCents)}
              </button>
              <button
                type="button"
                onClick={() => setMode("partial")}
                aria-pressed={mode === "partial"}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  mode === "partial"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Partial
              </button>
            </div>
          </div>

          {mode === "partial" && (
            <div className="mt-4">
              <label
                htmlFor="partial-amount"
                className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
              >
                Amount (CAD, max {formatDollars(subtotalCents)})
              </label>
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
                <span className="font-mono text-sm text-muted-foreground">$</span>
                <input
                  id="partial-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={partialDollars}
                  onChange={(e) => setPartialDollars(e.target.value)}
                  className="w-32 bg-transparent font-mono text-sm tabular-nums outline-none"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label
              htmlFor="refund-reason"
              className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
            >
              Reason (5-500 chars · audit trail)
            </label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="No-show confirmed via GPS log. Refunding in full per policy."
              className="mt-2 min-h-[72px] w-full resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {reason.length}/500
            </p>
            <Button onClick={onSubmit} disabled={busy || reason.trim().length < 5} size="sm">
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <DollarSign className="size-3.5" strokeWidth={2} />
              )}
              Issue refund
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Parties panel
 * ───────────────────────────────────────────────────────────── */

function PartiesPanel({ data }: { data: BookingDetail }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <ClipboardList className="size-3.5" strokeWidth={2} />
        Parties
        <span className="text-foreground/30">— § 39</span>
      </div>

      <div className="space-y-4">
        {data.family && (
          <PartyBlock label="Family" name={data.family.name} email={data.family.email} />
        )}
        {data.caregiver && (
          <PartyBlock label="Caregiver" name={data.caregiver.name} email={data.caregiver.email} />
        )}
      </div>
    </section>
  );
}

function PartyBlock({ label, name, email }: { label: string; name: string; email: string }) {
  return (
    <div className="border-t border-dashed border-border/50 pt-3 first:border-t-0 first:pt-0">
      <p className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight">{name}</p>
      <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <Mail className="size-3" strokeWidth={2} />
        {email}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Payment panel
 * ───────────────────────────────────────────────────────────── */

function PaymentPanel({ data }: { data: BookingDetail }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <DollarSign className="size-3.5" strokeWidth={2} />
        Payment
        <span className="text-foreground/30">— § 40</span>
      </div>

      <ul className="space-y-2">
        <Money label="Subtotal" cents={data.subtotal_cents} />
        <Money label="Platform fee" cents={data.platform_fee_cents} />
        {data.caregiver_payout_cents !== null && (
          <Money label="Caregiver payout" cents={data.caregiver_payout_cents} emphasis />
        )}
      </ul>
    </section>
  );
}

function Money({ label, cents, emphasis }: { label: string; cents: number; emphasis?: boolean }) {
  return (
    <li className="flex items-baseline justify-between border-t border-dashed border-border/50 pt-2 first:border-t-0 first:pt-0">
      <span
        className={cn(
          "font-mono text-[10px] tracking-[0.22em] uppercase",
          emphasis ? "text-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-base tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground/80",
        )}
      >
        {formatDollars(cents)}
      </span>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit evidence panel — GPS, tasks, panic, incidents, reviews
 * ───────────────────────────────────────────────────────────── */

function VisitEvidencePanel({ data }: { data: BookingDetail }) {
  const checkIn = data.check_in.at ? new Date(data.check_in.at) : null;
  const checkOut = data.check_out.at ? new Date(data.check_out.at) : null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Visit evidence
        <span className="text-foreground/30">— § 41</span>
      </div>

      <article className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        {/* Check-in / check-out */}
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckTimeBlock
            label="Check-in"
            time={checkIn}
            lat={data.check_in.lat}
            lng={data.check_in.lng}
          />
          <CheckTimeBlock
            label="Check-out"
            time={checkOut}
            lat={data.check_out.lat}
            lng={data.check_out.lng}
          />
        </div>

        {/* Flags */}
        {data.flag_reasons && data.flag_reasons.length > 0 && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Auto-flagged
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.flag_reasons.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-foreground/70 uppercase"
                >
                  <Flag className="size-2.5" strokeWidth={2.25} />
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {data.tasks_completed && data.tasks_completed.length > 0 && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Tasks completed
            </p>
            <ul className="mt-2 space-y-1">
              {data.tasks_completed.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground/85">
                  <ClipboardCheck className="size-3.5 text-success" strokeWidth={2} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Caregiver notes */}
        {data.caregiver_notes && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Caregiver notes
            </p>
            <blockquote className="mt-2 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{data.caregiver_notes}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Panic alerts */}
        {data.panic_alerts.length > 0 && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
              Panic alerts
            </p>
            <ul className="mt-2 space-y-2">
              {data.panic_alerts.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <AlertOctagon className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={2} />
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                      {p.status} · {p.silent ? "silent" : "audible"} ·{" "}
                      {p.triggered_at ? new Date(p.triggered_at).toLocaleString("en-CA") : "—"}
                    </p>
                    {p.resolution_note && (
                      <p className="mt-0.5 text-foreground/80 italic">{p.resolution_note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Incident reports */}
        {data.incident_reports.length > 0 && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-foreground/70 uppercase">
              Incident reports
            </p>
            <ul className="mt-2 space-y-2">
              {data.incident_reports.map((i) => (
                <li key={i.id} className="text-sm">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    {i.severity} · {i.type.replace(/_/g, " ")} · {i.status}
                  </p>
                  <p className="mt-0.5 text-foreground/85">{i.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reviews */}
        {data.reviews.length > 0 && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Reviews
            </p>
            <ul className="mt-2 space-y-2">
              {data.reviews.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3",
                          i < r.stars ? "fill-primary text-primary" : "text-muted-foreground/30",
                        )}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  {r.body && (
                    <blockquote className="mt-1 border-l-2 border-foreground/20 pl-3 text-foreground/80 italic">
                      &ldquo;{r.body}&rdquo;
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </section>
  );
}

function CheckTimeBlock({
  label,
  time,
  lat,
  lng,
}: {
  label: string;
  time: Date | null;
  lat: number | null;
  lng: number | null;
}) {
  const hasGps = lat !== null && lng !== null;
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      {time ? (
        <>
          <p className="mt-1 font-mono text-sm tabular-nums">
            {time.toLocaleString("en-CA", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground tabular-nums">
            <MapPin className="size-3" strokeWidth={2} />
            {hasGps ? `${lat?.toFixed(4)}, ${lng?.toFixed(4)}` : "GPS unavailable"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground italic">Not yet</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Messages panel — full thread + per-message moderation actions
 * ───────────────────────────────────────────────────────────── */

function MessagesPanel({
  messages,
  onMutated,
}: {
  messages: AdminMessage[];
  onMutated: () => void;
}) {
  const flaggedCount = messages.filter((m) => m.redaction_count > 0 || m.is_hidden).length;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Messages
        <span className="text-foreground/30">— § 43</span>
        {flaggedCount > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-foreground/70 normal-case tracking-[0.05em]">
            <Flag className="size-2.5" strokeWidth={2.25} />
            {flaggedCount} need attention
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 px-5 py-8 text-center">
          <MessageSquare className="mx-auto size-6 text-muted-foreground/60" strokeWidth={1.75} />
          <p className="mt-2 text-sm text-muted-foreground italic">
            No messages yet on this booking.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id}>
              <AdminMessageCard message={m} onMutated={onMutated} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminMessageCard({
  message,
  onMutated,
}: {
  message: AdminMessage;
  onMutated: () => void;
}) {
  const [showHideForm, setShowHideForm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const created = message.created_at ? new Date(message.created_at) : null;

  async function onHide() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    setBusy(true);
    try {
      await hideMessage(message.id, reason.trim());
      toast.success("Message hidden.");
      setShowHideForm(false);
      setReason("");
      onMutated();
    } catch {
      toast.error("Couldn't hide. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onUnhide() {
    setBusy(true);
    try {
      await unhideMessage(message.id);
      toast.success("Message restored.");
      onMutated();
    } catch {
      toast.error("Couldn't restore. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const tone = message.is_hidden ? "hidden" : message.redaction_count > 0 ? "redacted" : "neutral";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5",
        tone === "hidden" && "border-foreground/30 bg-foreground/[0.03] opacity-80",
        tone === "redacted" && "border-foreground/15 bg-foreground/[0.02]",
        tone === "neutral" && "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
            <span className="text-foreground/80">{message.sender.name}</span>
            <span className="text-foreground/50"> · {message.sender.role}</span>
            {created && (
              <span className="text-foreground/50">
                {" · "}
                {created.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{message.body}</p>
        </div>

        {message.is_hidden ? (
          <Button onClick={onUnhide} disabled={busy} variant="outline" size="sm">
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Eye className="size-3.5" strokeWidth={2} />
            )}
            Restore
          </Button>
        ) : (
          <Button
            onClick={() => setShowHideForm((s) => !s)}
            variant="outline"
            size="sm"
            disabled={busy}
          >
            <EyeOff className="size-3.5" strokeWidth={2} />
            Hide
          </Button>
        )}
      </div>

      {/* Redaction details — admin sees what the redactor caught */}
      {message.redactions && message.redactions.length > 0 && (
        <div className="mt-3 rounded-xl border border-foreground/15 bg-background/50 p-3">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Redactor caught
          </p>
          <ul className="mt-2 space-y-1">
            {message.redactions.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono tracking-[0.16em] text-foreground/60 uppercase">
                  {r.kind.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-foreground/85">{r.original}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hidden-state metadata */}
      {message.is_hidden && message.hidden_reason && (
        <div className="mt-3 rounded-xl border border-foreground/15 bg-foreground/[0.04] p-3">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Hidden — reason
          </p>
          <blockquote className="mt-1 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
            &ldquo;{message.hidden_reason}&rdquo;
          </blockquote>
        </div>
      )}

      {/* Inline hide form */}
      {showHideForm && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[0.04] p-3">
          <label
            htmlFor={`hide-reason-${message.id}`}
            className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase"
          >
            Reason (5-255 chars · audit trail)
          </label>
          <textarea
            id={`hide-reason-${message.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Off-platform contact attempt; recipient reported."
            className="mt-2 min-h-[60px] w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-accent/60"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {reason.length}/255
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowHideForm(false);
                  setReason("");
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={onHide}
                disabled={busy || reason.trim().length < 5}
                variant="destructive"
                size="sm"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <EyeOff className="size-3.5" strokeWidth={2} />
                )}
                Confirm hide
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Disputes panel
 * ───────────────────────────────────────────────────────────── */

function DisputesPanel({ disputes }: { disputes: DisputeSummary[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Dispute history
        <span className="text-foreground/30">— § 42</span>
      </div>

      <ul className="space-y-3">
        {disputes.map((d) => (
          <li key={d.id}>
            <DisputeCard dispute={d} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeSummary }) {
  const isOpen = dispute.status === "open" || dispute.status === "under_review";
  const created = dispute.created_at ? new Date(dispute.created_at) : null;
  const resolved = dispute.resolved_at ? new Date(dispute.resolved_at) : null;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5",
        isOpen ? "border-accent/40 bg-accent/[0.03]" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Pill tone={isOpen ? "alarm" : "good"}>{dispute.status.replace(/_/g, " ")}</Pill>
            <span className="font-mono text-[10px] tracking-[0.22em] text-foreground/70 uppercase">
              {dispute.reason_code.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
            Filed by {dispute.reporter.name}
            {created &&
              ` · ${created.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
      </div>

      <blockquote className="mt-3 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
        &ldquo;{dispute.description}&rdquo;
      </blockquote>

      {!isOpen && dispute.resolution_code && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success/[0.05] p-3">
          <p className="font-mono text-[10px] tracking-[0.22em] text-success uppercase">
            Resolution
          </p>
          <p className="mt-1 text-sm">
            <span className="font-mono">{dispute.resolution_code.replace(/_/g, " ")}</span>
            {dispute.resolution_refund_cents !== null && dispute.resolution_refund_cents > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular-nums">
                  {formatDollars(dispute.resolution_refund_cents)} refunded
                </span>
              </>
            )}
            {resolved && (
              <span className="ml-2 font-mono text-[10px] text-muted-foreground tabular-nums">
                {resolved.toLocaleString("en-CA", { month: "short", day: "numeric" })}
              </span>
            )}
          </p>
          {dispute.resolution_note && (
            <blockquote className="mt-2 border-l-2 border-success/40 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{dispute.resolution_note}&rdquo;
            </blockquote>
          )}
          {dispute.resolver && (
            <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
              By {dispute.resolver.name}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skeleton + error
 * ───────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="h-14 w-3/4 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        <div className="h-48 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-6 rounded-2xl border border-accent/40 bg-accent/[0.04] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight">
            Couldn&apos;t load this booking.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again or head back to the ledger.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
            <Link href="/admin/bookings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
