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
 * Panic button — caregiver safety escape hatch on a live visit.
 *
 * Flow:
 *   idle → armed (first tap, shows confirm + silent toggle)
 *        → firing (after confirm; tries for GPS then POSTs)
 *        → sent  (success: pulsing HELP INCOMING card)
 *        → already-active (backend returned 409 with existing alert)
 *
 * Heart-red (accent) vocabulary throughout. Discoverability wins over
 * subtlety; this is a dedicated section, never a dropdown.
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
        "We couldn’t reach the server. Try again — or call 911 directly.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  if (phase === "sent" && alert) {
    return <HelpIncomingCard alert={alert} />;
  }

  return (
    <section
      aria-label="Emergency"
      className="relative overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/[0.04] via-card to-card"
    >
      {/* Warning-tape top strip — subtle but unmistakable */}
      <div
        aria-hidden
        className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,theme(colors.accent)_0_8px,theme(colors.accent/0.25)_8px_16px)]"
      />

      <div className="space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <ShieldAlert className="size-3.5 text-accent" strokeWidth={2} />
          Emergency — § 14
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Something <span className="italic text-accent">not right?</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            One tap alerts the Kindred safety team. They&rsquo;ll call you back within minutes and
            loop in emergency services if the situation calls for it.
          </p>
        </div>

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

        <p className="border-t border-dashed border-accent/20 pt-4 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-muted-foreground uppercase">
          Life-threatening emergency? <span className="text-accent">Call 911 first</span>, then use
          this.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Idle — big inviting (but not scary) CTA
 * ───────────────────────────────────────────────────────────── */

function IdleView({ onArm }: { onArm: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onArm}
        className={cn(
          "group relative inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground",
          "shadow-[0_6px_18px_-6px_theme(colors.accent/0.55)] transition-all",
          "hover:scale-[1.02] hover:shadow-[0_10px_28px_-8px_theme(colors.accent/0.6)]",
          "active:scale-100",
          "focus-visible:ring-3 focus-visible:ring-accent/40 focus-visible:outline-none",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl bg-accent/20 blur-md transition-opacity group-hover:opacity-80"
        />
        <Siren className="size-5" strokeWidth={2.25} />
        Call for help
      </button>
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        One-tap + confirm
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Armed — confirm step with silent-mode toggle
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
    <div className="space-y-4 rounded-2xl border border-accent/40 bg-accent/[0.04] p-5">
      <div className="flex items-start gap-3">
        <AlertOctagon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-accent">Send the alert?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Admin is paged instantly. This is NOT for general questions &mdash; use the support chat
            for anything non-urgent.
          </p>
        </div>
      </div>

      {/* Silent-mode toggle — styled as a proper switchable chip */}
      <button
        type="button"
        role="switch"
        aria-checked={silent}
        onClick={onToggleSilent}
        disabled={firing}
        className={cn(
          "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors",
          silent
            ? "border-foreground/40 bg-foreground/5"
            : "border-border/60 bg-background/60 hover:border-foreground/30",
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
            <span className="text-sm font-medium">Silent mode</span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              No audible tone on admin side
            </span>
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            silent ? "bg-foreground" : "bg-border/80",
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
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {errorMsg}
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onCancel} variant="ghost" disabled={firing}>
          Never mind
        </Button>
        <Button
          onClick={onFire}
          disabled={firing}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
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
 * Sent — HELP INCOMING pulse card
 * ───────────────────────────────────────────────────────────── */

function HelpIncomingCard({ alert }: { alert: AlertLike }) {
  const triggered = new Date(alert.triggered_at);
  const isAcknowledged = alert.status === "acknowledged";

  return (
    <section
      aria-label="Help is on the way"
      aria-live="assertive"
      role="status"
      className="relative overflow-hidden rounded-3xl border-2 border-accent/50 bg-accent/[0.05]"
    >
      {/* Ambient pulse */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-[pulse_3s_ease-in-out_infinite] bg-[radial-gradient(circle_at_20%_10%,theme(colors.accent/0.18),transparent_55%)]"
      />
      {/* Top tape */}
      <div
        aria-hidden
        className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,theme(colors.accent)_0_8px,theme(colors.accent/0.4)_8px_16px)]"
      />

      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-accent uppercase">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative size-2.5 rounded-full bg-accent" />
          </span>
          Alert live — § 14b
        </div>

        <h2 className="mt-4 text-3xl leading-[1.02] font-semibold tracking-tight sm:text-4xl">
          <span className="italic text-accent">Help is</span> on the way.
        </h2>

        <p className="mt-3 max-w-lg text-sm leading-relaxed text-foreground/85">
          {isAcknowledged
            ? "An admin has picked up your alert and is on the line with emergency services. Stay on this screen so we can reach you."
            : "We&rsquo;ve paged the on-call admin. Expect a callback in minutes — keep this screen open and your phone close."}
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-5 border-t-2 border-dashed border-accent/25 pt-5 sm:grid-cols-3">
          <Stat
            label="Triggered"
            value={triggered.toLocaleTimeString("en-CA", {
              hour: "numeric",
              minute: "2-digit",
            })}
          />
          <Stat label="Status" value={isAcknowledged ? "Acknowledged" : "Dispatched"} />
          <Stat label="Mode" value={alert.silent ? "Silent" : "Audible"} />
        </dl>

        {isAcknowledged && (
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-success/10 p-4 ring-1 ring-success/30">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.25} />
            <p className="text-sm leading-relaxed text-success">
              <span className="font-semibold">An admin is on it.</span> They&rsquo;ll reach you
              shortly.
            </p>
          </div>
        )}

        <p className="mt-6 border-t border-dashed border-accent/20 pt-4 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-muted-foreground uppercase">
          If you&rsquo;re in immediate danger, <span className="text-accent">call 911</span>.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}
