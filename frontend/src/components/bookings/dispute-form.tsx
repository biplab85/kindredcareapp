"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type DisputeReasonCode, openDispute } from "@/lib/bookings";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Dispute form — family files a formal complaint within the 48h
 * window after check-out. Freezes the caregiver payout pending
 * admin review.
 *
 * Matches the post-PR-#120 card pattern: tone-coded pill + inline
 * panel. Accent-toned because filing a dispute is a destructive-
 * adjacent action (freezes money, paints the caregiver in admin's
 * queue) — but not panic-tier red.
 * ───────────────────────────────────────────────────────────── */

const REASON_OPTIONS: { code: DisputeReasonCode; label: string; hint: string }[] = [
  { code: "no_show", label: "Caregiver didn't show up", hint: "They never arrived for the visit." },
  { code: "late_arrival", label: "Arrived too late to help", hint: "Late enough that the visit was useless." },
  { code: "early_leave", label: "Left early", hint: "Cut the visit short before the booked time." },
  { code: "scope_creep", label: "Refused to help with what we booked", hint: "Wouldn't do the agreed-on tasks." },
  { code: "quality", label: "Care quality was poor", hint: "Concerns about how they treated the recipient." },
  { code: "safety", label: "Safety concern", hint: "Something unsafe happened during the visit." },
  { code: "property_damage", label: "Property damage", hint: "They damaged something in the home." },
  { code: "theft", label: "Suspected theft", hint: "We believe something is missing." },
  { code: "fraud", label: "Suspected fraud", hint: "Falsified check-in or other deception." },
  { code: "other", label: "Something else", hint: "Pick this if nothing above fits." },
];

export function DisputeForm({
  bookingId,
  onCancel,
  onFiled,
}: {
  bookingId: number;
  onCancel: () => void;
  onFiled: () => void;
}) {
  const [reasonCode, setReasonCode] = useState<DisputeReasonCode | null>(null);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = reasonCode !== null && description.trim().length >= 20 && !busy;

  async function submit() {
    if (!reasonCode) return;
    if (description.trim().length < 20) {
      toast.error("Please describe what happened in at least 20 characters.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await openDispute(bookingId, {
        reason_code: reasonCode,
        description: description.trim(),
      });
      toast.success("Report filed. Admin will review and reach out.");
      onFiled();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't file your report. Try again in a moment.";
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Report a problem with this visit"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-8">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <AlertCircle className="size-4 text-accent" strokeWidth={2} />
          Report a problem
        </h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close report form"
          className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Filing a report pauses the caregiver&rsquo;s payout while admin reviews. You have{" "}
          <span className="font-semibold text-foreground">48 hours from check-out</span> to file.
          You can still confirm the visit later if it&rsquo;s resolved.
        </p>

        <div>
          <p className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
            What happened?
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {REASON_OPTIONS.map((opt) => (
              <li key={opt.code}>
                <button
                  type="button"
                  onClick={() => setReasonCode(opt.code)}
                  disabled={busy}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
                    reasonCode === opt.code
                      ? "border-accent/50 bg-accent/[0.06]"
                      : "border-border bg-card hover:border-foreground/30 hover:bg-muted/30",
                    "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                  <span className="text-[11px] leading-relaxed text-muted-foreground">{opt.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label
            htmlFor="dispute-description"
            className="text-[11px] font-semibold tracking-wide text-foreground uppercase"
          >
            Tell us what happened
          </label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            At least 20 characters. Be specific — times, what was said, what was missing. This goes
            to admin only, not the caregiver.
          </p>
          <Textarea
            id="dispute-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={busy}
            placeholder="E.g., Caregiver said they'd be 10 min late but never showed. We tried calling but no answer."
            className="mt-2"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {description.trim().length}/2000
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={onCancel} variant="ghost" disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" strokeWidth={2.25} />
            )}
            File report
          </Button>
        </div>
      </div>
    </section>
  );
}
