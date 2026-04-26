"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, FileWarning, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  incidentSeverityBlurb,
  incidentSeverityLabel,
  incidentTypeBlurb,
  incidentTypeLabel,
  type IncidentSeverity,
  type IncidentType,
  submitIncident,
} from "@/lib/safety";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Incident report — dialog-based form. Triggered from the live
 * log and the visit summary. Either party may file; admin
 * queues it. Evidence uploads arrive in Phase 15.
 * ───────────────────────────────────────────────────────────── */

type Phase = "form" | "submitting" | "submitted" | "error";

const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 2000;

export function IncidentReportTrigger({
  bookingId,
  variant = "link",
}: {
  bookingId: number;
  variant?: "link" | "ghost-button";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          variant === "link" ? (
            <button
              type="button"
              className={cn(
                "group inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase",
                "text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline",
              )}
            />
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Flag className="size-3.5" />
              File a report
            </Button>
          )
        }
      >
        {variant === "link" && (
          <>
            <Flag className="size-3 opacity-70 transition-opacity group-hover:opacity-100" />
            Something happened? File a report
          </>
        )}
      </DialogTrigger>

      <DialogContent
        className="w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-3xl bg-card p-0 ring-0 sm:max-w-xl"
        showCloseButton
      >
        <IncidentFormBody bookingId={bookingId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function IncidentFormBody({ bookingId, onDone }: { bookingId: number; onDone: () => void }) {
  const titleId = useId();
  const descriptionId = useId();

  const [type, setType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submitting = phase === "submitting";
  const valid =
    type !== null &&
    description.trim().length >= MIN_DESCRIPTION &&
    description.trim().length <= MAX_DESCRIPTION;

  async function submit() {
    if (!valid || submitting || type === null) return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await submitIncident(bookingId, {
        type,
        severity,
        description: description.trim(),
        evidence_paths: [],
      });
      setPhase("submitted");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn’t file the report. Try again in a moment.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  if (phase === "submitted") {
    return <SubmittedView onDone={onDone} />;
  }

  return (
    <div className="relative">
      {/* Paper wash — matches the host page */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/[0.03] via-card to-card" />

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <FileWarning className="size-3.5 text-accent" strokeWidth={2} />
          Report — § 15
        </div>

        <DialogTitle
          id={titleId}
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          What <span className="italic text-accent">happened?</span>
        </DialogTitle>

        <DialogDescription id={descriptionId} className="mt-2 text-sm leading-relaxed">
          Admin reviews every report within 24 hours &mdash; sooner if it&rsquo;s high or critical.
          Be specific; your words go straight to the admin queue.
        </DialogDescription>

        <div className="my-6 border-t-2 border-dashed border-accent/15" />

        {/* Type picker */}
        <fieldset disabled={submitting} className="space-y-3">
          <legend className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Type
          </legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {INCIDENT_TYPES.map((t) => (
              <TypeCard key={t} type={t} selected={type === t} onPick={() => setType(t)} />
            ))}
          </div>
        </fieldset>

        {/* Severity */}
        <fieldset disabled={submitting} className="mt-7 space-y-3">
          <legend className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Severity
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {INCIDENT_SEVERITIES.map((s) => (
              <SeverityChip
                key={s}
                severity={s}
                selected={severity === s}
                onPick={() => setSeverity(s)}
              />
            ))}
          </div>
          <p
            className={cn(
              "font-mono text-[11px] tracking-[0.14em] uppercase tabular-nums",
              severity === "critical" ? "text-accent" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {incidentSeverityBlurb(severity)}
          </p>
        </fieldset>

        {/* Description */}
        <div className="mt-7">
          <label
            htmlFor="incident-description"
            className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            <span className="h-px w-6 bg-foreground/30" />
            Describe it
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={MAX_DESCRIPTION}
            disabled={submitting}
            placeholder="Walk admin through what happened, when, and who was involved."
            className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none ring-accent/30 transition-shadow focus:ring-2 disabled:opacity-60"
          />
          <p
            className={cn(
              "mt-1 text-right font-mono text-[10px] tracking-[0.14em] uppercase tabular-nums",
              description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION
                ? "text-accent"
                : "text-muted-foreground",
            )}
          >
            {description.trim().length < MIN_DESCRIPTION
              ? `${MIN_DESCRIPTION - description.trim().length} more characters`
              : `${description.length} / ${MAX_DESCRIPTION}`}
          </p>
        </div>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMsg}
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-dashed border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={onDone} variant="ghost" disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!valid || submitting}
            className={cn(
              "sm:min-w-[10rem]",
              severity === "critical" && "bg-accent text-accent-foreground hover:bg-accent/90",
            )}
            size="lg"
          >
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <Flag className="size-4" strokeWidth={2.25} />
            )}
            {submitting ? "Filing…" : "File report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Type card — clickable blurb tile, two-column on sm+
 * ───────────────────────────────────────────────────────────── */

function TypeCard({
  type,
  selected,
  onPick,
}: {
  type: IncidentType;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn(
        "relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-all",
        "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
        selected
          ? "border-accent/60 bg-accent/[0.05] ring-1 ring-accent/30"
          : "border-border/60 bg-background/40 hover:border-foreground/30 hover:bg-background/80",
      )}
    >
      <p className="text-sm font-semibold tracking-tight">{incidentTypeLabel(type)}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        {incidentTypeBlurb(type)}
      </p>
      {selected && (
        <span
          aria-hidden
          className="absolute top-3 right-3 grid size-4 place-items-center rounded-full bg-accent text-accent-foreground"
        >
          <CheckCircle2 className="size-3" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Severity chip — four pills, critical is full accent-red
 * ───────────────────────────────────────────────────────────── */

function SeverityChip({
  severity,
  selected,
  onPick,
}: {
  severity: IncidentSeverity;
  selected: boolean;
  onPick: () => void;
}) {
  const isCritical = severity === "critical";
  const tone =
    severity === "low"
      ? "muted"
      : severity === "medium"
        ? "warn"
        : severity === "high"
          ? "strong"
          : "critical";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-center transition-all",
        "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
        !selected &&
          "border-border/60 bg-background/40 text-foreground/70 hover:border-foreground/30",
        selected && tone === "muted" && "border-border bg-muted text-foreground",
        selected &&
          tone === "warn" &&
          "border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/20",
        selected &&
          tone === "strong" &&
          "border-accent/40 bg-accent/10 text-accent ring-1 ring-accent/25",
        selected &&
          tone === "critical" &&
          "border-accent bg-accent text-accent-foreground ring-2 ring-accent/40",
      )}
    >
      <p className="font-mono text-[11px] tracking-[0.18em] uppercase">
        {incidentSeverityLabel(severity)}
      </p>
      {isCritical && selected && <p className="mt-0.5 text-[10px] font-medium">⚠ urgent</p>}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Submitted — confirmation panel
 * ───────────────────────────────────────────────────────────── */

function SubmittedView({ onDone }: { onDone: () => void }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-success/[0.05] via-card to-card" />
      <div className="relative p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/25">
          <CheckCircle2 className="size-7" strokeWidth={2} />
        </span>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-success/40" />
          Filed
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Report <span className="italic text-success">filed.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Admin will review within 24 hours &mdash; sooner if the severity warranted it.
          You&rsquo;ll see the outcome in your notifications.
        </p>
        <Button onClick={onDone} className="mt-7" size="lg">
          Close
        </Button>
      </div>
    </div>
  );
}
