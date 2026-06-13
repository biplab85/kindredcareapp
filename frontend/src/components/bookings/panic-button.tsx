"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  Siren,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingActivePanicAlert } from "@/lib/bookings";
import { type PanicAlert, triggerPanic, tryGetCoarseLocation } from "@/lib/safety";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Panic button — caregiver + family safety escape hatch on a
 * live visit. Three phases:
 *
 *   idle → armed (first tap → confirm + silent toggle)
 *        → firing (after confirm; geolocation then POST)
 *        → sent  (success: "Help on the way" panel)
 *        → already-active (backend returned 409 with existing alert)
 *
 * Design matches the post-PR-#120 Card primitive used across the
 * booking page — same rounded-2xl shell, same header treatment.
 * Heart-red (accent) only appears on the CTA + tone-coded phase
 * panels; the card chrome stays neutral so the component sits in
 * the stack rather than fighting it.
 * ───────────────────────────────────────────────────────────── */

type Phase = "idle" | "armed" | "firing" | "sent" | "error";

type AlertLike = PanicAlert | BookingActivePanicAlert;

export function PanicButton({
  bookingId,
  existingAlert,
}: {
  bookingId: number;
  /**
   * If the booking already has an active/acknowledged panic on the
   * server, pass it in so we skip straight to the confirmation state.
   */
  existingAlert?: BookingActivePanicAlert | null;
}) {
  const [phase, setPhase] = useState<Phase>(existingAlert ? "sent" : "idle");
  const [silent, setSilent] = useState(false);
  const [alert, setAlert] = useState<AlertLike | null>(existingAlert ?? null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disarm = useCallback(() => {
    if (phase === "armed" || phase === "error") {
      setPhase("idle");
      setErrorMsg(null);
    }
  }, [phase]);

  async function fire() {
    setPhase("firing");
    setErrorMsg(null);
    try {
      const coords = await tryGetCoarseLocation();
      const result = await triggerPanic({
        bookingId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        silent,
      });
      setAlert(result.alert);
      setPhase("sent");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "We couldn't reach the server. Try again — or call 911 directly.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  // Right-side eyebrow pill that shifts tone across phases — same
  // pill shape used throughout /bookings/[id] for status.
  const eyebrow = (() => {
    if (phase === "sent")
      return {
        label: "Live",
        className:
          "bg-accent text-accent-foreground ring-accent/40 animate-pulse",
      };
    if (phase === "armed" || phase === "firing" || phase === "error")
      return { label: "Confirm", className: "bg-accent/10 text-accent ring-accent/20" };
    return {
      label: "Safety",
      className: "bg-muted text-muted-foreground ring-border",
    };
  })();

  if (phase === "sent" && alert) {
    return <HelpIncomingCard alert={alert} />;
  }

  return (
    <section
      aria-label="Emergency"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Card header — matches every other block on this page */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <ShieldAlert className="size-4 text-accent" strokeWidth={2} />
          Emergency
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1",
            eyebrow.className,
          )}
        >
          {eyebrow.label}
        </span>
      </div>

      {/* Card body */}
      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          One tap alerts the KindredCare safety team. They&rsquo;ll call you back within minutes and
          loop in emergency services if the situation calls for it.
        </p>

        {phase === "idle" && <IdleView onArm={() => setPhase("armed")} />}

        {(phase === "armed" || phase === "firing" || phase === "error") && (
          <ArmedView
            phase={phase}
            silent={silent}
            onToggleSilent={() => setSilent((s) => !s)}
            onCancel={disarm}
            onFire={fire}
            errorMsg={errorMsg}
          />
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/60">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Life-threatening emergency? <span className="font-semibold text-accent">Call 911 first</span>,
            then use this button.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Idle — CTA-only, no chrome around it
 * ───────────────────────────────────────────────────────────── */

function IdleView({ onArm }: { onArm: () => void }) {
  return (
    <Button
      onClick={onArm}
      size="lg"
      className="bg-accent text-accent-foreground shadow-sm hover:bg-accent/90"
    >
      <Siren className="size-4" strokeWidth={2.25} />
      Call for help
    </Button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Armed — inline confirmation panel + silent toggle
 * ───────────────────────────────────────────────────────────── */

function ArmedView({
  phase,
  silent,
  onToggleSilent,
  onCancel,
  onFire,
  errorMsg,
}: {
  phase: Phase;
  silent: boolean;
  onToggleSilent: () => void;
  onCancel: () => void;
  onFire: () => void;
  errorMsg: string | null;
}) {
  const firing = phase === "firing";

  return (
    <div className="space-y-4 rounded-xl border border-accent/30 bg-accent/[0.04] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertOctagon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">Send the alert?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Admin is paged instantly. Use the chat for anything non-urgent.
          </p>
        </div>
      </div>

      {/* Silent-mode toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={silent}
        onClick={onToggleSilent}
        disabled={firing}
        className={cn(
          "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors",
          silent ? "border-foreground/30" : "border-border hover:border-foreground/20",
          firing && "pointer-events-none opacity-70",
          "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
        )}
      >
        <span className="flex items-center gap-2.5">
          {silent ? (
            <VolumeX className="size-4 text-foreground" strokeWidth={2} />
          ) : (
            <Volume2 className="size-4 text-muted-foreground" strokeWidth={2} />
          )}
          <span className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Silent mode</span>
            <span className="text-[11px] text-muted-foreground">No audible tone on admin side</span>
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            silent ? "bg-foreground" : "bg-border",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 translate-x-0.5 rounded-full bg-background shadow transition-transform",
              silent && "translate-x-4",
            )}
          />
        </span>
      </button>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onCancel} variant="ghost" disabled={firing}>
          Never mind
        </Button>
        <Button
          onClick={onFire}
          disabled={firing}
          size="lg"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {firing ? (
            <span className="size-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground" />
          ) : (
            <Siren className="size-4" strokeWidth={2.25} />
          )}
          {firing ? "Sending…" : phase === "error" ? "Try again" : "Send alert now"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sent — "Help on the way" panel
 * ───────────────────────────────────────────────────────────── */

function HelpIncomingCard({ alert }: { alert: AlertLike }) {
  const triggered = new Date(alert.triggered_at);
  const triggeredTime = triggered.toLocaleTimeString("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  });
  const isAcknowledged = alert.status === "acknowledged";

  return (
    <section
      aria-label="Help is on the way"
      aria-live="assertive"
      role="status"
      className="overflow-hidden rounded-2xl border border-accent/40 bg-card shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative size-2.5 rounded-full bg-accent" />
          </span>
          Alert live
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1",
            isAcknowledged
              ? "bg-success/10 text-success ring-success/30"
              : "bg-accent text-accent-foreground ring-accent/40",
          )}
        >
          {isAcknowledged ? "Acknowledged" : "Dispatched"}
        </span>
      </div>

      {/* Card body */}
      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="max-w-lg text-sm leading-relaxed text-foreground">
          {isAcknowledged
            ? "An admin has picked up your alert and is on the line with emergency services. Stay on this screen so we can reach you."
            : "We've paged the on-call admin. Expect a callback in minutes — keep this screen open and your phone close."}
        </p>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Triggered" value={triggeredTime} />
          <Stat label="Status" value={isAcknowledged ? "Acknowledged" : "Dispatched"} />
          <Stat label="Mode" value={alert.silent ? "Silent" : "Audible"} />
        </dl>

        {isAcknowledged && (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/[0.06] p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.25} />
            <p className="text-sm leading-relaxed text-success">
              <span className="font-semibold">An admin is on it.</span> They&rsquo;ll reach you
              shortly.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/60">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            In immediate danger? <span className="font-semibold text-accent">Call 911</span>.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
