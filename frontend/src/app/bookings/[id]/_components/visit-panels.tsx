"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ClipboardList,
  MapPinOff,
  Navigation,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncidentReportTrigger } from "@/components/bookings/incident-form";
import {
  type Booking,
  checkInBooking,
  checkOutBooking,
  type GeoCoords,
  requestGeolocation,
  updateBookingTasks,
} from "@/lib/bookings";
import { cn } from "@/lib/utils";

/**
 * Shared caregiver-visit panels. Used by both the booking detail page
 * (/bookings/[id]) and the focused visit landing page (/visits/[id])
 * that the magic-link email points at — keeping a single source of
 * truth for the check-in / live-log / check-out flow.
 */

export function VisitStartPanel({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: () => void;
}) {
  type Phase = "idle" | "locating" | "submitting" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function start() {
    setPhase("locating");
    setErrorMsg(null);
    try {
      const coords = await requestGeolocation();
      setPhase("submitting");
      await checkInBooking(booking.id, coords);
      onChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Check-in failed.");
      setPhase("error");
    }
  }

  const [nowMs] = useState(() => Date.now());
  const start_time = new Date(booking.scheduled_start);
  const minutesToStart = (start_time.getTime() - nowMs) / 60_000;
  const tooEarly = minutesToStart > 30;
  const working = phase === "locating" || phase === "submitting";

  return (
    <section
      aria-label="Start visit"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8"
    >
      {phase === "locating" && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,theme(colors.primary/0.1),transparent_65%)]"
        />
      )}

      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-primary/40" />
        Visit — § 11
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span
            className={cn(
              "grid size-16 place-items-center rounded-2xl ring-1 transition-all",
              phase === "locating"
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-primary/10 text-primary ring-primary/20",
            )}
          >
            {phase === "locating" && (
              <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/15" />
            )}
            {phase === "submitting" ? (
              <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : phase === "error" ? (
              <MapPinOff className="size-7" strokeWidth={1.75} />
            ) : (
              <Navigation className="size-7" strokeWidth={1.75} />
            )}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {phase === "locating"
              ? "Finding you…"
              : phase === "submitting"
                ? "Logging your arrival…"
                : "Ready to start the visit?"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {phase === "locating"
              ? "Your browser is checking your location. Please allow access when prompted."
              : phase === "submitting"
                ? "Almost there. We're recording the check-in."
                : tooEarly
                  ? "You can start any time, but the visit is still a while away. The family will be notified the moment you check in."
                  : "Tap to capture your GPS and notify the family that you've arrived. The address becomes final-final after this."}
          </p>

          {phase === "error" && errorMsg && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {errorMsg}
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <Button
              onClick={start}
              disabled={working}
              size="lg"
              className="group relative overflow-hidden"
            >
              <PlayCircle className="size-4" strokeWidth={2.25} />
              {phase === "error" ? "Try again" : "Start visit"}
            </Button>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              GPS required
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function VisitLiveLog({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: () => void;
}) {
  const defaultTasks = useMemo<string[]>(
    () => booking.gig?.service_category?.default_tasks ?? [],
    [booking.gig?.service_category?.default_tasks],
  );

  const allTasks = useMemo(() => {
    const existing = booking.visit.tasks_completed ?? [];
    const seen = new Set(defaultTasks);
    const extras = existing.filter((t) => !seen.has(t));
    return [...defaultTasks, ...extras];
  }, [defaultTasks, booking.visit.tasks_completed]);

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(booking.visit.tasks_completed ?? []),
  );
  const [notes, setNotes] = useState(booking.visit.caregiver_notes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  type EndPhase = "idle" | "locating" | "submitting" | "error";
  const [endPhase, setEndPhase] = useState<EndPhase>("idle");
  const [endError, setEndError] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  function scheduleAutosave(nextTasks: Set<string>, nextNotes: string) {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      updateBookingTasks(booking.id, {
        tasks_completed: [...nextTasks],
        caregiver_notes: nextNotes || null,
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
  }

  function toggleTask(task: string) {
    const next = new Set(checked);
    if (next.has(task)) next.delete(task);
    else next.add(task);
    setChecked(next);
    scheduleAutosave(next, notes);
  }

  function changeNotes(value: string) {
    setNotes(value);
    scheduleAutosave(checked, value);
  }

  async function endVisit() {
    setEndPhase("locating");
    setEndError(null);
    try {
      const coords: GeoCoords = await requestGeolocation();
      setEndPhase("submitting");
      await checkOutBooking(booking.id, {
        ...coords,
        tasks_completed: [...checked],
        caregiver_notes: notes || null,
      });
      onChanged();
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Check-out failed.");
      setEndPhase("error");
    }
  }

  const working = endPhase === "locating" || endPhase === "submitting";
  const checkIn = booking.visit.check_in_at ? new Date(booking.visit.check_in_at) : null;
  // Elapsed counter freezes at mount — a live tick would need
  // useSyncExternalStore per CLAUDE.md; acceptable for MVP.
  const [nowAtMount] = useState(() => Date.now());
  const elapsedMin = checkIn
    ? Math.max(0, Math.floor((nowAtMount - checkIn.getTime()) / 60_000))
    : 0;

  return (
    <section
      aria-label="Live visit log"
      className="relative overflow-hidden rounded-3xl border border-success/30 bg-gradient-to-br from-success/[0.04] via-card to-card"
    >
      <div className="flex items-center justify-between border-b border-dashed border-success/30 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          <p className="font-mono text-[11px] tracking-[0.22em] text-success uppercase">
            Visit — live
          </p>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {elapsedMin < 60
            ? `${elapsedMin} min elapsed`
            : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m elapsed`}
        </p>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              <ClipboardList className="size-3.5" />
              What you&rsquo;re covering
            </div>
            <SaveIndicator state={saveState} />
          </div>

          {allTasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground italic">
              No task suggestions for this category. Use the notes below to describe what you helped
              with.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {allTasks.map((task, i) => {
                const isChecked = checked.has(task);
                return (
                  <li key={task}>
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        "hover:bg-success/5",
                      )}
                    >
                      <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-px grid size-5 shrink-0 place-items-center rounded-[5px] border transition-all",
                          isChecked
                            ? "scale-100 border-success bg-success text-success-foreground"
                            : "scale-95 border-border/80 bg-background group-hover:border-success/60",
                        )}
                      >
                        {isChecked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          isChecked
                            ? "text-foreground"
                            : "text-foreground/80 group-hover:text-foreground",
                        )}
                      >
                        {task}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <label
            htmlFor="caregiver-notes"
            className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            <span className="h-px w-6 bg-foreground/30" />A note for the family
          </label>
          <textarea
            id="caregiver-notes"
            value={notes}
            onChange={(e) => changeNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Anything they'd want to know — mood, what you did, something for next time."
            className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none ring-primary/30 transition-shadow focus:ring-2"
          />
        </div>

        <div className="border-t-2 border-dashed border-success/30 pt-6">
          {endError && (
            <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {endError}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-muted-foreground">
              Ending the visit captures the payment and sends the family a summary.
            </p>
            <Button
              onClick={endVisit}
              disabled={working}
              size="lg"
              variant="default"
              className="sm:shrink-0"
            >
              {working ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <StopCircle className="size-4" strokeWidth={2.25} />
              )}
              {endPhase === "locating"
                ? "Finding you…"
                : endPhase === "submitting"
                  ? "Closing out…"
                  : "End visit"}
            </Button>
          </div>

          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <IncidentReportTrigger bookingId={booking.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Couldn't save — retrying";
  const tone =
    state === "saving"
      ? "text-muted-foreground"
      : state === "saved"
        ? "text-success"
        : "text-accent";
  return <p className={cn("font-mono text-[10px] tracking-[0.16em] uppercase", tone)}>{label}</p>;
}
