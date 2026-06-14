"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  type LucideIcon,
  Mail,
  MapPin,
  MapPinOff,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Star,
  TimerReset,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminMessage,
  type ArrivalReportSummary,
  type BookingDetail,
  type DisputeSummary,
  formatDollars,
  getAdminBooking,
  hideMessage,
  paymentStatusLabel,
  paymentTone,
  refundBooking,
  resetCheckIn,
  resolveArrivalReport,
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
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/admin/bookings"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to bookings
      </Link>

      {state === "loading" && <Skeleton />}
      {state === "error" && <ErrorCard onRetry={reload} />}
      {state === "ready" && data && <Body data={data} onMutated={reload} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared primitives
 * ───────────────────────────────────────────────────────────── */

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" strokeWidth={2} />
          </span>
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-success/10 text-success",
        tone === "alarm" && "bg-accent/10 text-accent",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {children}
    </span>
  );
}

function FlagPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
      <Flag className="size-3" strokeWidth={2.25} />
      Flagged
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────
 * Body
 * ───────────────────────────────────────────────────────────── */

function Body({ data, onMutated }: { data: BookingDetail; onMutated: () => void }) {
  const openDispute = data.disputes.find((d) => d.status === "open" || d.status === "under_review");
  const canRefund = canBookingRefund(data);

  return (
    <div className="space-y-6">
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

      <VisitEvidencePanel data={data} onMutated={onMutated} />

      {data.arrival_reports.length > 0 && (
        <ArrivalReportsPanel reports={data.arrival_reports} onMutated={onMutated} />
      )}

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
 * Header — hero card
 * ───────────────────────────────────────────────────────────── */

function BookingHeader({ data }: { data: BookingDetail }) {
  const tone = statusTone(data.status);
  const pTone = paymentTone(data.payment_status);
  const start = data.scheduled_start ? new Date(data.scheduled_start) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-xs font-medium tabular-nums text-muted-foreground/70">
              Booking #{String(data.id).padStart(5, "0")}
            </span>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              <span>{data.family?.name ?? "Family"}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={2} />
              <span>{data.caregiver?.name ?? "Caregiver"}</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{statusLabel(data.status)}</Pill>
            <Pill tone={pTone}>{paymentStatusLabel(data.payment_status)}</Pill>
            {data.flagged_at && <FlagPill />}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-3">
          {start && (
            <DetailTile
              icon={CalendarDays}
              label="When"
              value={start.toLocaleString("en-CA", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            />
          )}
          <DetailTile icon={TimerReset} label="Duration" value={`${data.duration_minutes} min`} />
          {data.address && <DetailTile icon={MapPin} label="Address" value={data.address} />}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Open-dispute callout
 * ───────────────────────────────────────────────────────────── */

function OpenDisputeCallout({ dispute }: { dispute: DisputeSummary }) {
  return (
    <section className="rounded-xl border border-accent/40 bg-accent/[0.05] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <ShieldAlert className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
            Open dispute
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
            Filed by {dispute.reporter.name} ·{" "}
            <span className="text-accent capitalize">{dispute.reason_code.replace(/_/g, " ")}</span>
          </h3>
          <p className="mt-2 rounded-lg border border-accent/20 bg-card/60 px-3 py-2 text-sm leading-relaxed text-foreground/85">
            {dispute.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
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
    <section className="rounded-xl border border-primary/30 bg-primary/[0.03] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <DollarSign className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
            Refund
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
            Make them whole.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Issuing a refund flips the payment status and lands on the audit trail. If a dispute is
            open, the same action resolves it.
          </p>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Mode
            </p>
            <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("full")}
                aria-pressed={mode === "full"}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "full"
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border"
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
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "partial"
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border"
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
                className="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
              >
                Amount (CAD, max {formatDollars(subtotalCents)})
              </label>
              <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  id="partial-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={partialDollars}
                  onChange={(e) => setPartialDollars(e.target.value)}
                  className="w-32 bg-transparent text-sm tabular-nums outline-none"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label
              htmlFor="refund-reason"
              className="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Reason (5–500 chars · audit trail)
            </label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="No-show confirmed via GPS log. Refunding in full per policy."
              className="min-h-[80px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">{reason.length}/500</p>
            <Button
              onClick={onSubmit}
              disabled={busy || reason.trim().length < 5}
              size="sm"
              className="cursor-pointer"
            >
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
    <Panel icon={ClipboardList} title="Parties">
      <div className="space-y-3">
        {data.family && (
          <PartyBlock label="Family" name={data.family.name} email={data.family.email} />
        )}
        {data.caregiver && (
          <PartyBlock label="Caregiver" name={data.caregiver.name} email={data.caregiver.email} />
        )}
      </div>
    </Panel>
  );
}

function PartyBlock({ label, name, email }: { label: string; name: string; email: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-sm font-semibold tracking-tight text-foreground">{name}</p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3" strokeWidth={2} />
          {email}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Payment panel
 * ───────────────────────────────────────────────────────────── */

function PaymentPanel({ data }: { data: BookingDetail }) {
  return (
    <Panel icon={DollarSign} title="Payment">
      <dl className="space-y-2.5">
        <Money label="Subtotal" cents={data.subtotal_cents} />
        <Money label="Platform fee" cents={data.platform_fee_cents} />
        {data.caregiver_payout_cents !== null && (
          <Money label="Caregiver payout" cents={data.caregiver_payout_cents} emphasis />
        )}
      </dl>
    </Panel>
  );
}

function Money({ label, cents, emphasis }: { label: string; cents: number; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-t border-border/50 pt-2.5 first:border-t-0 first:pt-0">
      <dt
        className={cn(
          "text-sm",
          emphasis ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasis
            ? "text-lg font-bold text-foreground"
            : "text-sm font-semibold text-foreground/80",
        )}
      >
        {formatDollars(cents)}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visit evidence panel
 * ───────────────────────────────────────────────────────────── */

function VisitEvidencePanel({
  data,
  onMutated,
}: {
  data: BookingDetail;
  onMutated: () => void;
}) {
  const checkIn = data.check_in.at ? new Date(data.check_in.at) : null;
  const checkOut = data.check_out.at ? new Date(data.check_out.at) : null;

  return (
    <Panel icon={MapPin} title="Visit evidence">
      <div className="grid gap-3 sm:grid-cols-2">
        <CheckTimeBlock
          label="Check-in"
          time={checkIn}
          lat={data.check_in.lat}
          lng={data.check_in.lng}
          resettable={{ bookingId: data.id, onMutated }}
        />
        <CheckTimeBlock
          label="Check-out"
          time={checkOut}
          lat={data.check_out.lat}
          lng={data.check_out.lng}
        />
      </div>

      {data.flag_reasons && data.flag_reasons.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Auto-flagged
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.flag_reasons.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent capitalize ring-1 ring-accent/20"
              >
                <Flag className="size-3" strokeWidth={2.25} />
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.tasks_completed && data.tasks_completed.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Tasks completed
          </p>
          <ul className="space-y-1.5">
            {data.tasks_completed.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground/85">
                <ClipboardCheck className="size-4 shrink-0 text-success" strokeWidth={2} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.caregiver_notes && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Caregiver notes
          </p>
          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground/85">
            {data.caregiver_notes}
          </p>
        </div>
      )}

      {data.panic_alerts.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
            Panic alerts
          </p>
          <ul className="space-y-2">
            {data.panic_alerts.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/[0.04] p-3 text-sm"
              >
                <AlertOctagon className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
                <div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {p.status} · {p.silent ? "silent" : "audible"} ·{" "}
                    {p.triggered_at ? new Date(p.triggered_at).toLocaleString("en-CA") : "—"}
                  </p>
                  {p.resolution_note && (
                    <p className="mt-0.5 text-foreground/80">{p.resolution_note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.incident_reports.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-foreground/70 uppercase">
            Incident reports
          </p>
          <ul className="space-y-2">
            {data.incident_reports.map((i) => (
              <li key={i.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                <p className="text-xs text-muted-foreground capitalize">
                  {i.severity} · {i.type.replace(/_/g, " ")} · {i.status}
                </p>
                <p className="mt-0.5 text-foreground/85">{i.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.reviews.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Reviews
          </p>
          <ul className="space-y-2">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-3.5",
                        i < r.stars ? "fill-accent text-accent" : "text-muted-foreground/30",
                      )}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                {r.body && <p className="mt-1.5 text-foreground/80">{r.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function CheckTimeBlock({
  label,
  time,
  lat,
  lng,
  resettable,
}: {
  label: string;
  time: Date | null;
  lat: number | null;
  lng: number | null;
  /**
   * Admin-only — when present, the block shows a Reset affordance that
   * clears the check-in entirely (booking returns to `confirmed`, the
   * caregiver's Start visit button comes back). Reserved for check-in.
   */
  resettable?: { bookingId: number; onMutated: () => void };
}) {
  const hasGps = lat !== null && lng !== null;
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        {resettable && time && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold tracking-wide text-foreground uppercase hover:border-accent/40 hover:bg-accent/[0.04] hover:text-accent"
          >
            Reset
          </button>
        )}
      </div>
      {time ? (
        <>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            {time.toLocaleString("en-CA", {
              timeZone: "America/Toronto",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <MapPin className="size-3" strokeWidth={2} />
            {hasGps ? `${lat?.toFixed(4)}, ${lng?.toFixed(4)}` : "GPS unavailable"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not yet</p>
      )}
      {resettable && time && confirming && (
        <ResetCheckInForm
          bookingId={resettable.bookingId}
          onCancel={() => setConfirming(false)}
          onDone={() => {
            setConfirming(false);
            resettable.onMutated();
          }}
        />
      )}
    </div>
  );
}

function ResetCheckInForm({
  bookingId,
  onCancel,
  onDone,
}: {
  bookingId: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) {
      toast.error("Add a short reason (at least 5 characters).");
      return;
    }
    setBusy(true);
    try {
      await resetCheckIn(bookingId, { reason: reason.trim() });
      toast.success("Check-in reset. Caregiver must check in again.");
      onDone();
    } catch {
      toast.error("Couldn't reset. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-accent/30 bg-accent/[0.04] p-3">
      <p className="text-[12px] leading-relaxed text-foreground">
        This clears the GPS check-in entirely and returns the booking to{" "}
        <span className="font-semibold">awaiting check-in</span>. The caregiver will see the Start
        visit button again and must GPS check-in from the actual address.
      </p>

      <div>
        <label
          htmlFor="check-in-reset-reason"
          className="text-[11px] font-semibold tracking-wide text-foreground uppercase"
        >
          Reason
        </label>
        <textarea
          id="check-in-reset-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="What evidence supports this reset? (logged to audit trail)"
          disabled={busy}
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} variant="ghost" size="sm" disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={busy}
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Reset check-in
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Messages panel
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
    <Panel
      icon={MessageSquare}
      title="Messages"
      action={
        flaggedCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
            <Flag className="size-3" strokeWidth={2.25} />
            {flaggedCount} need attention
          </span>
        ) : undefined
      }
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <MessageSquare className="size-6 text-muted-foreground/60" strokeWidth={1.75} />
          <p className="mt-2 text-sm text-muted-foreground">No messages yet on this booking.</p>
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
    </Panel>
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
        "rounded-xl border p-4",
        tone === "hidden" && "border-foreground/30 bg-foreground/[0.03] opacity-90",
        tone === "redacted" && "border-accent/30 bg-accent/[0.03]",
        tone === "neutral" && "border-border/70 bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {initialsOf(message.sender.name)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {message.sender.name}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground capitalize">
                {message.sender.role}
                {created &&
                  ` · ${created.toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}`}
              </span>
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{message.body}</p>
          </div>
        </div>

        {message.is_hidden ? (
          <Button
            onClick={onUnhide}
            disabled={busy}
            variant="outline"
            size="sm"
            className="cursor-pointer"
          >
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
            className="cursor-pointer"
          >
            <EyeOff className="size-3.5" strokeWidth={2} />
            Hide
          </Button>
        )}
      </div>

      {message.redactions && message.redactions.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/60 bg-card/60 p-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Redactor caught
          </p>
          <ul className="mt-2 space-y-1">
            {message.redactions.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="font-semibold tracking-wide text-foreground/60 uppercase">
                  {r.kind.replace(/_/g, " ")}
                </span>
                <span className="text-foreground/85">{r.original}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message.is_hidden && message.hidden_reason && (
        <div className="mt-3 rounded-lg border border-foreground/15 bg-foreground/[0.04] p-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Hidden — reason
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">{message.hidden_reason}</p>
        </div>
      )}

      {showHideForm && (
        <div className="mt-3 rounded-lg border border-accent/30 bg-accent/[0.04] p-3">
          <label
            htmlFor={`hide-reason-${message.id}`}
            className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase"
          >
            Reason (5–255 chars · audit trail)
          </label>
          <textarea
            id={`hide-reason-${message.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Off-platform contact attempt; recipient reported."
            className="mt-2 min-h-[60px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">{reason.length}/255</p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowHideForm(false);
                  setReason("");
                }}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={onHide}
                disabled={busy || reason.trim().length < 5}
                variant="destructive"
                size="sm"
                className="cursor-pointer"
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
    <Panel icon={ShieldAlert} title="Dispute history">
      <ul className="space-y-3">
        {disputes.map((d) => (
          <li key={d.id}>
            <DisputeCard dispute={d} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeSummary }) {
  const isOpen = dispute.status === "open" || dispute.status === "under_review";
  const created = dispute.created_at ? new Date(dispute.created_at) : null;
  const resolved = dispute.resolved_at ? new Date(dispute.resolved_at) : null;

  return (
    <article
      className={cn(
        "rounded-xl border p-4",
        isOpen ? "border-accent/40 bg-accent/[0.03]" : "border-border/70 bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone={isOpen ? "alarm" : "good"}>
          <span className="capitalize">{dispute.status.replace(/_/g, " ")}</span>
        </Pill>
        <span className="text-xs font-semibold text-foreground/70 capitalize">
          {dispute.reason_code.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        Filed by {dispute.reporter.name}
        {created &&
          ` · ${created.toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`}
      </p>

      <p className="mt-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm leading-relaxed text-foreground/85">
        {dispute.description}
      </p>

      {!isOpen && dispute.resolution_code && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success/[0.05] p-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
            Resolution
          </p>
          <p className="mt-1 text-sm text-foreground/85">
            <span className="font-medium capitalize">
              {dispute.resolution_code.replace(/_/g, " ")}
            </span>
            {dispute.resolution_refund_cents !== null && dispute.resolution_refund_cents > 0 && (
              <>
                {" · "}
                <span className="font-semibold tabular-nums">
                  {formatDollars(dispute.resolution_refund_cents)} refunded
                </span>
              </>
            )}
            {resolved && (
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                {resolved.toLocaleString("en-CA", { month: "short", day: "numeric" })}
              </span>
            )}
          </p>
          {dispute.resolution_note && (
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">
              {dispute.resolution_note}
            </p>
          )}
          {dispute.resolver && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
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
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-xl border border-border bg-card/60" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/60" />
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load this booking.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again or head back to the ledger.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onRetry} size="sm" className="cursor-pointer">
          <RefreshCw className="size-3.5" strokeWidth={2} />
          Retry
        </Button>
        <Link href="/admin/bookings">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Arrival reports — family-side reports plus the resolve panel
 * for any that are still open.
 * ───────────────────────────────────────────────────────────── */

function ArrivalReportsPanel({
  reports,
  onMutated,
}: {
  reports: ArrivalReportSummary[];
  onMutated: () => void;
}) {
  return (
    <Panel icon={MapPinOff} title="Arrival reports">
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id}>
            <ArrivalReportRow report={r} onMutated={onMutated} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ArrivalReportRow({
  report,
  onMutated,
}: {
  report: ArrivalReportSummary;
  onMutated: () => void;
}) {
  const isOpen = report.status === "open" || report.status === "acknowledged";
  const reasonLabel =
    report.reason_code === "not_yet_arrived"
      ? "Caregiver hasn't arrived"
      : "Caregiver checked in but family disputes presence";
  const created = report.created_at ? new Date(report.created_at) : null;
  const resolved = report.resolved_at ? new Date(report.resolved_at) : null;

  return (
    <article
      className={cn(
        "rounded-xl border p-4",
        isOpen ? "border-primary/40 bg-primary/[0.03]" : "border-border/70 bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone={isOpen ? "alarm" : "good"}>
          <span className="capitalize">{report.status.replace(/_/g, " ")}</span>
        </Pill>
        <span className="text-xs font-semibold text-foreground/70">{reasonLabel}</span>
      </div>

      {created && (
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          Filed{" "}
          {created.toLocaleString("en-CA", {
            timeZone: "America/Toronto",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {resolved &&
            ` · resolved ${resolved.toLocaleString("en-CA", {
              timeZone: "America/Toronto",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`}
        </p>
      )}

      {report.description && (
        <p className="mt-3 rounded-lg bg-card/60 px-3 py-2 text-sm leading-relaxed text-foreground/85 ring-1 ring-border/60">
          {report.description}
        </p>
      )}

      {report.admin_notes && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/70">Admin note:</span> {report.admin_notes}
        </p>
      )}

      {isOpen && <ArrivalReportResolveControls reportId={report.id} onMutated={onMutated} />}
    </article>
  );
}

function ArrivalReportResolveControls({
  reportId,
  onMutated,
}: {
  reportId: number;
  onMutated: () => void;
}) {
  const [resolution, setResolution] = useState<
    "resolved_arrived" | "resolved_no_show" | "resolved_false_report" | null
  >(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!resolution) return;
    setBusy(true);
    try {
      await resolveArrivalReport(reportId, {
        resolution,
        admin_notes: adminNotes.trim() || undefined,
      });
      const successMessage = {
        resolved_arrived: "Marked as arrived. Visit continues.",
        resolved_no_show: "No-show confirmed. Hold released, family notified.",
        resolved_false_report: "Closed as false report.",
      }[resolution];
      toast.success(successMessage);
      onMutated();
    } catch {
      toast.error("Couldn't resolve. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-primary/30 bg-card/60 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-foreground uppercase">Resolve</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ResolutionChip
          icon={CheckCircle2}
          label="Arrived"
          hint="Caregiver showed up"
          active={resolution === "resolved_arrived"}
          tone="good"
          onClick={() => setResolution("resolved_arrived")}
        />
        <ResolutionChip
          icon={Clock}
          label="No-show"
          hint="Confirm no-show, release hold"
          active={resolution === "resolved_no_show"}
          tone="alarm"
          onClick={() => setResolution("resolved_no_show")}
        />
        <ResolutionChip
          icon={XCircle}
          label="False report"
          hint="No issue, close out"
          active={resolution === "resolved_false_report"}
          tone="neutral"
          onClick={() => setResolution("resolved_false_report")}
        />
      </div>

      <textarea
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Admin notes (optional) — context, who you spoke to, what they said"
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      />

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!resolution || busy} size="sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Resolve
        </Button>
      </div>
    </div>
  );
}

function ResolutionChip({
  icon: Icon,
  label,
  hint,
  active,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  active: boolean;
  tone: "good" | "alarm" | "neutral";
  onClick: () => void;
}) {
  const activeRing =
    tone === "good"
      ? "border-success/50 bg-success/[0.06]"
      : tone === "alarm"
        ? "border-accent/50 bg-accent/[0.06]"
        : "border-foreground/40 bg-muted/40";
  const activeIcon =
    tone === "good" ? "text-success" : tone === "alarm" ? "text-accent" : "text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active
          ? activeRing
          : "border-border/60 bg-card hover:border-foreground/30 hover:bg-muted/30",
        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("size-4", active ? activeIcon : "text-muted-foreground")} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">{hint}</span>
    </button>
  );
}
