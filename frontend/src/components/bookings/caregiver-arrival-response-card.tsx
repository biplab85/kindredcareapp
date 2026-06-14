"use client";

import { useState } from "react";
import { AlertCircle, Check, Clock, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acknowledgeArrivalReport,
  type BookingActiveArrivalReport,
} from "@/lib/bookings";
import { EASTERN_TZ } from "@/lib/eastern-time";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Caregiver-side response surface when an open ArrivalReport
 * exists on the booking. Two affordances:
 *
 *   1. "I'm on my way" with an ETA chip → PATCH acknowledge
 *      with eta_minutes; family + admin get notified.
 *   2. "I'm here now" → also acknowledges (no ETA), then the
 *      page-level VisitStartPanel below this card carries the
 *      actual GPS check-in.
 *
 * Matches the post-PR-#120 card pattern: rounded-2xl border
 * border-border bg-card shadow-sm shell, h2 + tone-coded pill
 * header. Primary tone — keeps accent reserved for PanicButton.
 *
 * Hides itself the moment the report is acknowledged so the
 * caregiver doesn't see stale UI.
 * ───────────────────────────────────────────────────────────── */

const ETA_OPTIONS = [5, 10, 15, 20, 30, 45] as const;
type EtaOption = (typeof ETA_OPTIONS)[number];

export function CaregiverArrivalResponseCard({
  bookingId,
  report,
  onChanged,
}: {
  bookingId: number;
  report: BookingActiveArrivalReport;
  onChanged: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "submitting" | "error">("idle");
  const [eta, setEta] = useState<EtaOption | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Once acknowledged, render a quiet read-only confirmation so the
  // caregiver knows their response landed but isn't pestered to
  // re-respond.
  if (report.status === "acknowledged") {
    return <AcknowledgedSummary report={report} />;
  }

  async function submit(etaMinutes: number | null) {
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await acknowledgeArrivalReport(
        bookingId,
        report.id,
        etaMinutes === null ? {} : { eta_minutes: etaMinutes },
      );
      onChanged();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't send your response. Try again in a moment.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  const submitting = phase === "submitting";
  const isFakeCheckIn = report.reason_code === "not_at_site_despite_checkin";

  return (
    <section
      aria-label="Family is asking about your arrival"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <Navigation className="size-4 text-primary" strokeWidth={2} />
          {isFakeCheckIn ? "Family says you're not at the address" : "Family is asking about you"}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/20">
          Respond
        </span>
      </div>

      {/* Body */}
      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {isFakeCheckIn
            ? "Your check-in registered but the family says you're not actually at the door. If this is a mistake, send admin a quick note via Messages — otherwise let them know your ETA."
            : "The family is wondering where you are. Pick an ETA below and they'll hear from us right away — or hit \"I'm here now\" to head straight to check-in."}
        </p>

        {report.description && (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Family note
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/85">{report.description}</p>
          </div>
        )}

        {/* ETA chips — primary tinted active state */}
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
            Estimated time
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ETA_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setEta(minutes)}
                disabled={submitting}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  eta === minutes
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/[0.04]",
                  submitting && "opacity-60",
                  "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                )}
              >
                <Clock className="size-3.5" strokeWidth={2.25} />
                {minutes} min
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onClick={() => submit(null)}
            variant="ghost"
            disabled={submitting}
            className="text-foreground hover:bg-success/[0.06] hover:text-success"
          >
            <Check className="size-4" strokeWidth={2.25} />
            I&rsquo;m here now
          </Button>
          <Button
            onClick={() => submit(eta)}
            disabled={submitting || eta === null}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Navigation className="size-4" strokeWidth={2.25} />
            )}
            I&rsquo;m on my way{eta !== null ? ` — ${eta} min` : ""}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/60">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Need to explain in detail? Use{" "}
            <span className="font-semibold text-foreground">Messages</span> in the people card
            below.
          </p>
        </div>
      </div>
    </section>
  );
}

function AcknowledgedSummary({ report }: { report: BookingActiveArrivalReport }) {
  const etaLabel = report.eta_at
    ? new Date(report.eta_at).toLocaleTimeString("en-CA", {
        timeZone: EASTERN_TZ,
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      aria-label="Arrival response sent"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <Check className="size-4 text-success" strokeWidth={2.25} />
          Response sent
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-success uppercase ring-1 ring-success/30">
          Acknowledged
        </span>
      </div>
      <div className="px-6 py-6 sm:px-8">
        <p className="text-sm leading-relaxed text-foreground">
          {etaLabel
            ? `The family knows you're on your way — ETA ${etaLabel}.`
            : "The family knows you're heading to check in now."}
        </p>
      </div>
    </section>
  );
}
