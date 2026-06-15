"use client";

import { useState } from "react";
import { AlertCircle, Clock, Loader2, MapPinOff, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type ArrivalReport,
  type ArrivalReportReason,
  fileArrivalReport,
  isAlreadyOpenError,
} from "@/lib/arrival-reports";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Arrival report card — family-side middle path between PanicButton
 * (real-time safety) and BookingDispute (post-visit money). Two
 * trigger states drive copy + reason_code:
 *
 *   confirmed + past start + no check-in → "Caregiver hasn't arrived"
 *   in_progress + family disputes        → "Caregiver isn't here"
 *
 * Phases: idle → confirming (description + send) → sent.
 *
 * Matches the post-PR-#120 card pattern: rounded-2xl border border-
 * border bg-card shadow-sm shell, h2 + tone pill header, primary
 * (trust blue) tone — accent stays reserved for PanicButton.
 * ───────────────────────────────────────────────────────────── */

type Phase = "idle" | "confirming" | "sending" | "sent" | "error";

interface Props {
  bookingId: number;
  /** Which scenario the family is reporting on. Drives copy + the reason_code sent. */
  reason: ArrivalReportReason;
}

export function ArrivalReportCard({ bookingId, reason }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<ArrivalReport | null>(null);

  const copy = COPY_BY_REASON[reason];

  async function submit() {
    setPhase("sending");
    setErrorMsg(null);
    try {
      const report = await fileArrivalReport(bookingId, {
        reason_code: reason,
        description: description.trim() || undefined,
      });
      setSubmittedReport(report);
      setPhase("sent");
    } catch (err) {
      if (isAlreadyOpenError(err)) {
        setSubmittedReport(err.response.data.report);
        setPhase("sent");
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't file the report. Try again in a moment.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  if (phase === "sent" && submittedReport) {
    return <ReportSentCard reason={reason} />;
  }

  return (
    <section
      aria-label={copy.cardLabel}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <copy.icon className="size-4 text-primary" strokeWidth={2} />
          {copy.title}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/20">
          Concern
        </span>
      </div>

      {/* Body */}
      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

        {(phase === "confirming" || phase === "sending" || phase === "error") && (
          <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.04] p-4 sm:p-5">
            <div>
              <label
                htmlFor="arrival-description"
                className="text-sm font-semibold text-foreground"
              >
                Add detail (optional)
              </label>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {copy.descriptionHint}
              </p>
              <Textarea
                id="arrival-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={copy.descriptionPlaceholder}
                disabled={phase === "sending"}
                className="mt-2"
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={() => {
                  if (phase !== "sending") {
                    setPhase("idle");
                    setErrorMsg(null);
                  }
                }}
                variant="ghost"
                disabled={phase === "sending"}
              >
                Never mind
              </Button>
              <Button
                onClick={submit}
                disabled={phase === "sending"}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {phase === "sending" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" strokeWidth={2.25} />
                )}
                {phase === "sending" ? "Sending…" : phase === "error" ? "Try again" : "Notify admin"}
              </Button>
            </div>
          </div>
        )}

        {phase === "idle" && (
          <Button
            onClick={() => setPhase("confirming")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <copy.icon className="size-4" strokeWidth={2.25} />
            {copy.cta}
          </Button>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/60">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Immediate safety concern? Use{" "}
            <span className="font-semibold text-accent">Emergency</span> above instead.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sent state — admin + caregiver have been notified
 * ───────────────────────────────────────────────────────────── */

function ReportSentCard({ reason }: { reason: ArrivalReportReason }) {
  const copy = COPY_BY_REASON[reason];

  return (
    <section
      aria-label="Arrival report sent"
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <MessageSquare className="size-4 text-primary" strokeWidth={2} />
          {copy.title}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-success uppercase ring-1 ring-success/30">
          Reported
        </span>
      </div>

      <div className="space-y-4 px-6 py-6 sm:px-8">
        <p className="text-sm leading-relaxed text-foreground">{copy.sentBody}</p>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
            Admin received the report and will reach out shortly.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
            Your caregiver was sent a soft nudge to check in or message you.
          </li>
        </ul>

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/60">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Immediate safety concern? Use{" "}
            <span className="font-semibold text-accent">Emergency</span> above.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Copy per scenario
 * ───────────────────────────────────────────────────────────── */

const COPY_BY_REASON: Record<
  ArrivalReportReason,
  {
    title: string;
    cta: string;
    body: string;
    sentBody: string;
    descriptionHint: string;
    descriptionPlaceholder: string;
    cardLabel: string;
    icon: typeof Clock;
  }
> = {
  not_yet_arrived: {
    title: "Caregiver hasn't arrived",
    cta: "Notify admin & caregiver",
    body: "Past your scheduled start time with no check-in? Let us know and we'll page admin and nudge your caregiver. Use this if you've been waiting more than a few minutes — no need for an emergency.",
    sentBody:
      "Thanks for flagging this. We'll work on getting your caregiver moving and the situation resolved.",
    descriptionHint:
      "Anything admin should know? E.g., spoke to them yesterday and they confirmed, or no contact at all.",
    descriptionPlaceholder: "Optional — leave blank if nothing to add.",
    cardLabel: "Report caregiver not yet arrived",
    icon: Clock,
  },
  not_at_site_despite_checkin: {
    title: "Caregiver isn't here",
    cta: "Notify admin & caregiver",
    body: "Your caregiver checked in but isn't actually at the door. Admin will pull the GPS data and contact both sides — we'll get to the bottom of it.",
    sentBody:
      "Admin received the report and will review the GPS evidence + reach out to both you and your caregiver.",
    descriptionHint:
      "Anything admin should know? E.g., view from the door, when you last expected them, etc.",
    descriptionPlaceholder: "Optional — leave blank if nothing to add.",
    cardLabel: "Report caregiver not at site",
    icon: MapPinOff,
  },
};
