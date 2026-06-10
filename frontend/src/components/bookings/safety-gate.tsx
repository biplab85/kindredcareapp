"use client";

import { useState } from "react";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acknowledgeSafety } from "@/lib/safety";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Pre-visit safety gate — three-checkbox ritual the caregiver
 * completes before the Start Visit GPS capture. Matches the
 * editorial vocabulary of the host page: § kicker, italic
 * display headline, mono row-numbering, primary-tinted card.
 * ───────────────────────────────────────────────────────────── */

const CHECKS: readonly string[] = [
  "I’ve confirmed the address and have arrived on-site.",
  "I’ve identified myself to the family member.",
  "I know how to reach Kindred support if something goes sideways.",
];

type Phase = "idle" | "submitting" | "error";

export function SafetyGate({
  bookingId,
  onAcknowledged,
}: {
  bookingId: number;
  onAcknowledged: () => void;
}) {
  const [ticked, setTicked] = useState<boolean[]>(() => CHECKS.map(() => false));
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allTicked = ticked.every(Boolean);
  const submitting = phase === "submitting";

  function toggle(i: number) {
    if (submitting) return;
    setTicked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function submit() {
    if (!allTicked || submitting) return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await acknowledgeSafety(bookingId);
      onAcknowledged();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn’t save that just now — try again in a moment.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  return (
    <section
      aria-label="Pre-visit safety checklist"
      className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-primary/15 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ShieldCheck className="size-5" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Safety check</h2>
            <p className="text-xs text-muted-foreground">Before you start the visit</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary ring-1 ring-primary/20">
          {ticked.filter(Boolean).length}/{CHECKS.length}
        </span>
      </div>

      {/* Card content */}
      <div className="px-6 py-6 sm:px-8">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          A quick three-step ritual so the timeline has an audit trail and you&rsquo;ve got support
          on speed dial if anything feels off.
        </p>

        <ul className="mt-5 space-y-2">
          {CHECKS.map((label, i) => {
            const isTicked = ticked[i];
            return (
              <li key={i}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isTicked}
                  onClick={() => toggle(i)}
                  disabled={submitting}
                  className={cn(
                    "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
                    "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                    isTicked ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]",
                    submitting && "pointer-events-none opacity-70",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition-all",
                      isTicked
                        ? "scale-100 border-primary bg-primary text-primary-foreground"
                        : "scale-95 border-border/80 bg-background group-hover:border-primary/50",
                    )}
                  >
                    {isTicked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-relaxed transition-colors",
                      isTicked
                        ? "text-foreground"
                        : "text-foreground/80 group-hover:text-foreground",
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMsg}
            </p>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="border-t border-border bg-muted/30 px-6 py-4 sm:px-8">
        <Button
          onClick={submit}
          disabled={!allTicked || submitting}
          size="lg"
          className="h-12 w-full text-base shadow-sm"
        >
          {submitting ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <ShieldCheck className="size-4" strokeWidth={2.25} />
          )}
          {submitting ? "Logging…" : "Acknowledge & proceed"}
        </Button>
      </div>
    </section>
  );
}
