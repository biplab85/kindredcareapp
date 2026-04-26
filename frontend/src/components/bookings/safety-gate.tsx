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
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.05] via-card to-card p-6 sm:p-8"
    >
      {/* Corner bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />
        Safety check — § 11a
      </div>

      <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight sm:text-3xl">
        Before you <span className="italic text-primary">start&hellip;</span>
      </h2>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        A quick three-step ritual so the timeline has an audit trail and you&rsquo;ve got support on
        speed dial if anything feels off.
      </p>

      <div className="my-7 border-t-2 border-dashed border-primary/20" />

      <ul className="space-y-1.5">
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
                  "group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                  "hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                  isTicked && "bg-primary/[0.04]",
                  submitting && "pointer-events-none opacity-70",
                )}
              >
                <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-5 shrink-0 place-items-center rounded-[5px] border transition-all",
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
                    isTicked ? "text-foreground" : "text-foreground/80 group-hover:text-foreground",
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

      <div className="mt-7 flex items-center gap-3">
        <Button onClick={submit} disabled={!allTicked || submitting} size="lg">
          {submitting ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <ShieldCheck className="size-4" strokeWidth={2.25} />
          )}
          {submitting ? "Logging…" : "Acknowledge & proceed"}
        </Button>
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase tabular-nums">
          {ticked.filter(Boolean).length} / {CHECKS.length}
        </span>
      </div>
    </section>
  );
}
