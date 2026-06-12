"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertOctagon,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Siren,
  Sparkles,
  UserCheck,
  UserMinus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { SlideTabs } from "@/components/ui/slide-tabs";
import { useAuthStore } from "@/lib/auth";
import {
  acknowledgePanic,
  getIncidents,
  getPanicAlerts,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentStatus,
  incidentStatusLabel,
  type PanicAlert,
  type PanicAlertStatus,
  type QueueFilter,
  panicStatusLabel,
  resolvePanic,
  sortIncidents,
  sortPanics,
  updateIncident,
} from "@/lib/admin-safety";
import { incidentSeverityLabel, incidentTypeLabel } from "@/lib/safety";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminSafetyPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Safety">
        <SafetyQueueView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view — two independently-loaded queues (panic + incident)
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

interface Queue<T> {
  state: LoadState;
  filter: QueueFilter;
  list: T[];
  openCount: number;
}

const initialQueue = <T,>(): Queue<T> => ({
  state: "loading",
  filter: "open",
  list: [],
  openCount: 0,
});

const FILTER_TABS: { value: QueueFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

function SafetyQueueView() {
  const [panic, setPanic] = useState<Queue<PanicAlert>>(() => initialQueue<PanicAlert>());
  const [incident, setIncident] = useState<Queue<IncidentReport>>(() =>
    initialQueue<IncidentReport>(),
  );

  const reloadPanic = useCallback(async (filter: QueueFilter) => {
    setPanic((q) => ({ ...q, state: "loading", filter }));
    try {
      const list = await getPanicAlerts(filter);
      const openCount = filter === "open" ? list.length : (await getPanicAlerts("open")).length;
      setPanic({ state: "ready", filter, list: sortPanics(list), openCount });
    } catch {
      setPanic((q) => ({ ...q, state: "error" }));
    }
  }, []);

  const reloadIncident = useCallback(async (filter: QueueFilter) => {
    setIncident((q) => ({ ...q, state: "loading", filter }));
    try {
      const list = await getIncidents(filter);
      const openCount = filter === "open" ? list.length : (await getIncidents("open")).length;
      setIncident({ state: "ready", filter, list: sortIncidents(list), openCount });
    } catch {
      setIncident((q) => ({ ...q, state: "error" }));
    }
  }, []);

  // Initial mount — fetch both independently so one slow endpoint doesn't
  // block the other from rendering. `let alive = true` per React 19 rules.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [panicList, incidentList] = await Promise.all([
          getPanicAlerts("open"),
          getIncidents("open"),
        ]);
        if (!alive) return;
        setPanic({
          state: "ready",
          filter: "open",
          list: sortPanics(panicList),
          openCount: panicList.length,
        });
        setIncident({
          state: "ready",
          filter: "open",
          list: sortIncidents(incidentList),
          openCount: incidentList.length,
        });
      } catch {
        if (!alive) return;
        setPanic((q) => ({ ...q, state: "error" }));
        setIncident((q) => ({ ...q, state: "error" }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openTotal = panic.openCount + incident.openCount;

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        openTotal={openTotal}
        panicOpen={panic.openCount}
        incidentOpen={incident.openCount}
      />

      <section className="mt-8 space-y-4">
        <QueueHeader
          sectionLabel="Panic alerts"
          accent="accent"
          icon={Siren}
          openCount={panic.openCount}
          filter={panic.filter}
          loading={panic.state === "loading"}
          onFilter={(f) => void reloadPanic(f)}
          onRefresh={() => void reloadPanic(panic.filter)}
        />
        <PanicList queue={panic} onChanged={() => void reloadPanic(panic.filter)} />
      </section>

      <section className="mt-10 space-y-4">
        <QueueHeader
          sectionLabel="Incident reports"
          accent="primary"
          icon={ShieldAlert}
          openCount={incident.openCount}
          filter={incident.filter}
          loading={incident.state === "loading"}
          onFilter={(f) => void reloadIncident(f)}
          onRefresh={() => void reloadIncident(incident.filter)}
        />
        <IncidentList queue={incident} onChanged={() => void reloadIncident(incident.filter)} />
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Page header
 * ───────────────────────────────────────────────────────────── */

function PageHeader({
  openTotal,
  panicOpen,
  incidentOpen,
}: {
  openTotal: number;
  panicOpen: number;
  incidentOpen: number;
}) {
  const calm = openTotal === 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
          Safety
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {calm
            ? "No active panic alerts, no open incidents. A quiet shift — the best kind."
            : "Active panic alerts surface first. Work them top-down; expand any incident for context."}
          {!calm && (
            <>
              {" "}
              <span className="font-medium tabular-nums text-foreground/80">{panicOpen}</span> panic
              · <span className="font-medium tabular-nums text-foreground/80">{incidentOpen}</span>{" "}
              incident
            </>
          )}
        </p>
      </div>

      <span
        aria-live="polite"
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums shadow-[0_1px_2px_rgba(10,14,40,0.04)]",
          calm
            ? "border-success/30 bg-success/10 text-success"
            : "border-accent/30 bg-accent/10 text-accent",
        )}
      >
        {calm ? (
          <CheckCircle2 className="size-4" strokeWidth={2.25} />
        ) : (
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative size-2 rounded-full bg-accent" />
          </span>
        )}
        {openTotal} open
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Section header — icon tile + sliding Open/Resolved tabs + refresh
 * ───────────────────────────────────────────────────────────── */

function QueueHeader({
  sectionLabel,
  accent,
  icon: Icon,
  openCount,
  filter,
  loading,
  onFilter,
  onRefresh,
}: {
  sectionLabel: string;
  accent: "accent" | "primary";
  icon: typeof Siren;
  openCount: number;
  filter: QueueFilter;
  loading: boolean;
  onFilter: (f: QueueFilter) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            accent === "accent" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{sectionLabel}</h2>
        {openCount > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              accent === "accent" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary",
            )}
          >
            {openCount} open
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SlideTabs
          ariaLabel={`${sectionLabel} filter`}
          value={filter}
          options={FILTER_TABS}
          onChange={onFilter}
          tabWidthClass="w-[88px]"
        />
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh queue"
          className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Panic queue list
 * ───────────────────────────────────────────────────────────── */

function PanicList({ queue, onChanged }: { queue: Queue<PanicAlert>; onChanged: () => void }) {
  if (queue.state === "loading") {
    return <QueueSkeleton rows={2} />;
  }
  if (queue.state === "error") {
    return <QueueErrorCard onRetry={onChanged} />;
  }
  if (queue.list.length === 0) {
    return (
      <EmptyQueue
        accent="success"
        headline="Quiet shift"
        body="No active panic alerts."
        icon={CheckCircle2}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {queue.list.map((alert) => (
        <li key={alert.id}>
          <PanicCard alert={alert} onChanged={onChanged} isOpenTab={queue.filter === "open"} />
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Panic card
 * ───────────────────────────────────────────────────────────── */

type PanicActionPhase = "idle" | "acknowledging" | "resolving";

function PanicCard({
  alert,
  onChanged,
  isOpenTab,
}: {
  alert: PanicAlert;
  onChanged: () => void;
  isOpenTab: boolean;
}) {
  const [phase, setPhase] = useState<PanicActionPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResolveNote, setShowResolveNote] = useState(false);
  const [note, setNote] = useState("");

  const triggered = new Date(alert.triggered_at);
  const caregiverName = alert.caregiver.name ?? `Caregiver #${alert.caregiver.id}`;
  const isActive = alert.status === "active";
  const isResolved = alert.status === "resolved";
  const hasGps = alert.gps_lat !== null && alert.gps_lng !== null;

  async function runAcknowledge() {
    setPhase("acknowledging");
    setErrorMsg(null);
    try {
      await acknowledgePanic(alert.id);
      toast.success(`Acknowledged · alert #${alert.id}`);
      onChanged();
    } catch (err) {
      setErrorMsg(extractError(err, "Couldn't acknowledge — try again."));
      setPhase("idle");
    }
  }

  async function runResolve() {
    setPhase("resolving");
    setErrorMsg(null);
    try {
      await resolvePanic(alert.id, note.trim() || undefined);
      toast.success(`Resolved · alert #${alert.id}`);
      setShowResolveNote(false);
      setNote("");
      onChanged();
    } catch (err) {
      setErrorMsg(extractError(err, "Couldn't resolve — try again."));
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-colors",
        isActive ? "border-accent/40 bg-accent/[0.03]" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            isResolved ? "bg-success/10 text-success" : "bg-accent/10 text-accent",
          )}
        >
          <Siren className="size-5" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {caregiverName}
            </h3>
            <PanicStatusPill status={alert.status} />
            {alert.silent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                <VolumeX className="size-3" strokeWidth={2.25} />
                Silent
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                <Volume2 className="size-3" strokeWidth={2.25} />
                Audible
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
              {triggered.toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="font-medium tabular-nums text-muted-foreground/70">
              Booking #{String(alert.booking_id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            {hasGps ? (
              <span className="inline-flex items-center gap-1 tabular-nums text-success">
                <MapPin className="size-3.5" strokeWidth={2} />
                {(alert.gps_lat ?? 0).toFixed(4)}, {(alert.gps_lng ?? 0).toFixed(4)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
                GPS denied
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/admin/bookings/${alert.booking_id}`}
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          View booking ↗
        </Link>
      </div>

      {alert.resolution_note && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Resolution note
          </p>
          <p className="rounded-lg border border-success/25 bg-success/[0.05] px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
            {alert.resolution_note}
          </p>
        </div>
      )}

      {errorMsg && <InlineError message={errorMsg} />}

      {isOpenTab && !isResolved && (
        <div className="mt-4 border-t border-border/60 pt-4">
          {!showResolveNote ? (
            <div className="flex flex-wrap items-center gap-2">
              {isActive && (
                <Button
                  onClick={runAcknowledge}
                  disabled={busy}
                  size="sm"
                  className="cursor-pointer bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {phase === "acknowledging" ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground" />
                  ) : (
                    <BookmarkCheck className="size-3.5" strokeWidth={2.25} />
                  )}
                  Acknowledge
                </Button>
              )}
              <Button
                onClick={() => setShowResolveNote(true)}
                disabled={busy}
                size="sm"
                variant="outline"
                className="cursor-pointer"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                Resolve
              </Button>
              {alert.acknowledged_at && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Ack&rsquo;d{" "}
                  {new Date(alert.acknowledged_at).toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          ) : (
            <ResolveNoteForm
              busy={phase === "resolving"}
              note={note}
              onNoteChange={setNote}
              onConfirm={runResolve}
              onCancel={() => {
                setShowResolveNote(false);
                setNote("");
                setErrorMsg(null);
              }}
            />
          )}
        </div>
      )}
    </article>
  );
}

function PanicStatusPill({ status }: { status: PanicAlertStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
        <span className="relative flex size-1.5 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/70" />
          <span className="relative size-1.5 rounded-full bg-accent" />
        </span>
        {panicStatusLabel(status)}
      </span>
    );
  }
  if (status === "acknowledged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
        <BookmarkCheck className="size-3" strokeWidth={2.25} />
        {panicStatusLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
      <CheckCircle2 className="size-3" strokeWidth={2.25} />
      {panicStatusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Incident queue list
 * ───────────────────────────────────────────────────────────── */

function IncidentList({
  queue,
  onChanged,
}: {
  queue: Queue<IncidentReport>;
  onChanged: () => void;
}) {
  if (queue.state === "loading") {
    return <QueueSkeleton rows={3} />;
  }
  if (queue.state === "error") {
    return <QueueErrorCard onRetry={onChanged} />;
  }
  if (queue.list.length === 0) {
    return (
      <EmptyQueue
        accent="primary"
        headline="Good days happen"
        body="No open incidents."
        icon={Sparkles}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {queue.list.map((incident) => (
        <li key={incident.id}>
          <IncidentCard
            incident={incident}
            onChanged={onChanged}
            isOpenTab={queue.filter === "open"}
          />
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Incident card
 * ───────────────────────────────────────────────────────────── */

type IncidentActionPhase = "idle" | "assigning" | "resolving" | "dismissing";

function IncidentCard({
  incident,
  onChanged,
  isOpenTab,
}: {
  incident: IncidentReport;
  onChanged: () => void;
  isOpenTab: boolean;
}) {
  const { user } = useAuthStore();
  const adminUserId = user?.id ?? null;

  const [phase, setPhase] = useState<IncidentActionPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState<null | "resolve" | "dismiss">(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);

  const reporterName = incident.reporter.name ?? `User #${incident.reporter.id}`;
  const created = new Date(incident.created_at);
  const canAct = isOpenTab && (incident.status === "open" || incident.status === "investigating");
  const descriptionNeedsExpand = incident.description.length > 180;
  const isCritical = incident.severity === "critical";

  async function runAssign() {
    if (!adminUserId) {
      setErrorMsg("Your admin session looks stale — sign in again.");
      return;
    }
    setPhase("assigning");
    setErrorMsg(null);
    try {
      await updateIncident(incident.id, "assign", { assignee_user_id: adminUserId });
      toast.success(`Assigned · incident #${incident.id}`);
      onChanged();
    } catch (err) {
      setErrorMsg(extractError(err, "Couldn't assign — try again."));
      setPhase("idle");
    }
  }

  async function runNoteAction(action: "resolve" | "dismiss") {
    setPhase(action === "resolve" ? "resolving" : "dismissing");
    setErrorMsg(null);
    try {
      await updateIncident(incident.id, action, { note: note.trim() || undefined });
      toast.success(
        `${action === "resolve" ? "Resolved" : "Dismissed"} · incident #${incident.id}`,
      );
      setNoteMode(null);
      setNote("");
      onChanged();
    } catch (err) {
      setErrorMsg(
        extractError(
          err,
          action === "resolve" ? "Couldn't resolve — try again." : "Couldn't dismiss — try again.",
        ),
      );
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-colors",
        isCritical ? "border-accent/40 bg-accent/[0.03]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            isCritical ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary",
          )}
        >
          {isCritical ? (
            <AlertOctagon className="size-5" strokeWidth={2} />
          ) : (
            <ShieldAlert className="size-5" strokeWidth={2} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Filed by {reporterName}
            </h3>
            <SeverityPill severity={incident.severity} />
            <IncidentStatusPill status={incident.status} />
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {incidentTypeLabel(incident.type)}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium tabular-nums text-muted-foreground/70">
              Booking #{String(incident.booking_id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
              {created.toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {incident.assigned_to && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1 tabular-nums text-primary">
                  <UserCheck className="size-3.5" strokeWidth={2} />
                  admin #{incident.assigned_to}
                </span>
              </>
            )}
          </div>
        </div>

        <Link
          href={`/admin/bookings/${incident.booking_id}`}
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          View booking ↗
        </Link>
      </div>

      {/* Description */}
      <div className="mt-4 border-t border-border/60 pt-4">
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          What happened
        </p>
        <p
          className={cn(
            "text-sm leading-relaxed text-foreground/85",
            !expanded && descriptionNeedsExpand && "line-clamp-2",
          )}
        >
          {incident.description}
        </p>
        {descriptionNeedsExpand && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3.5" strokeWidth={2} />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" strokeWidth={2} />
                Read more
              </>
            )}
          </button>
        )}
      </div>

      {incident.resolution_note && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Resolution note
          </p>
          <p className="rounded-lg border border-success/25 bg-success/[0.05] px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
            {incident.resolution_note}
          </p>
        </div>
      )}

      {errorMsg && <InlineError message={errorMsg} />}

      {canAct && (
        <div className="mt-4 border-t border-border/60 pt-4">
          {noteMode === null ? (
            <div className="flex flex-wrap items-center gap-2">
              {!incident.assigned_to ? (
                <Button onClick={runAssign} disabled={busy} size="sm" className="cursor-pointer">
                  {phase === "assigning" ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <UserCheck className="size-3.5" strokeWidth={2.25} />
                  )}
                  Assign to me
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary tabular-nums">
                  <UserCheck className="size-3" strokeWidth={2.25} />
                  Assigned · admin #{incident.assigned_to}
                </span>
              )}
              <Button
                onClick={() => setNoteMode("resolve")}
                disabled={busy}
                size="sm"
                variant="outline"
                className="cursor-pointer"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                Resolve
              </Button>
              <Button
                onClick={() => setNoteMode("dismiss")}
                disabled={busy}
                size="sm"
                variant="ghost"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <UserMinus className="size-3.5" strokeWidth={2.25} />
                Dismiss
              </Button>
            </div>
          ) : (
            <NoteAction
              title={noteMode === "resolve" ? "Resolve this report" : "Dismiss this report"}
              description={
                noteMode === "resolve"
                  ? "Leave a note for the audit trail — what was done."
                  : "Explain why this report doesn't warrant further action."
              }
              ctaLabel={noteMode === "resolve" ? "Confirm resolve" : "Confirm dismiss"}
              destructive={noteMode === "dismiss"}
              busy={phase === "resolving" || phase === "dismissing"}
              note={note}
              onNoteChange={setNote}
              onConfirm={() => void runNoteAction(noteMode)}
              onCancel={() => {
                setNoteMode(null);
                setNote("");
                setErrorMsg(null);
              }}
            />
          )}
        </div>
      )}
    </article>
  );
}

function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  const toneMap: Record<IncidentStatus, { cls: string; icon: React.ReactNode }> = {
    open: {
      cls: "bg-accent/10 text-accent",
      icon: (
        <span className="relative flex size-1.5 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
          <span className="relative size-1.5 rounded-full bg-accent" />
        </span>
      ),
    },
    investigating: {
      cls: "bg-primary/10 text-primary",
      icon: <AlertOctagon className="size-3" strokeWidth={2.25} />,
    },
    resolved: {
      cls: "bg-success/10 text-success",
      icon: <CheckCircle2 className="size-3" strokeWidth={2.25} />,
    },
    dismissed: {
      cls: "bg-muted text-muted-foreground ring-1 ring-border",
      icon: <X className="size-3" strokeWidth={2.25} />,
    },
  };
  const tone = toneMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone.cls,
      )}
    >
      {tone.icon}
      {incidentStatusLabel(status)}
    </span>
  );
}

function SeverityPill({ severity }: { severity: IncidentSeverity }) {
  const variants: Record<IncidentSeverity, string> = {
    low: "bg-muted text-muted-foreground ring-1 ring-border",
    medium: "bg-primary/10 text-primary",
    high: "bg-accent/10 text-accent",
    critical: "bg-accent text-accent-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        variants[severity],
      )}
    >
      {severity === "critical" && <AlertOctagon className="size-3" strokeWidth={2.5} />}
      {incidentSeverityLabel(severity)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Inline note forms + error
 * ───────────────────────────────────────────────────────────── */

function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/[0.05] p-3 text-sm text-accent">
      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      {message}
    </p>
  );
}

const NOTE_TEXTAREA_CLASS =
  "w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-60";

function ResolveNoteForm({
  busy,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  note: string;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Resolution note — optional
      </p>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={busy}
        placeholder="What was done, who was contacted, outcome."
        className={NOTE_TEXTAREA_CLASS}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={onCancel}
          disabled={busy}
          variant="ghost"
          size="sm"
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          size="sm"
          className="cursor-pointer bg-success text-success-foreground hover:bg-success/90"
        >
          {busy ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-success-foreground/40 border-t-success-foreground" />
          ) : (
            <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
          )}
          Confirm resolve
        </Button>
      </div>
    </div>
  );
}

function NoteAction({
  title,
  description,
  ctaLabel,
  destructive,
  busy,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  destructive: boolean;
  busy: boolean;
  note: string;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={busy}
        placeholder="Note for the audit trail."
        className={NOTE_TEXTAREA_CLASS}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={onCancel}
          disabled={busy}
          variant="ghost"
          size="sm"
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          size="sm"
          variant={destructive ? "outline" : "default"}
          className={cn(
            "cursor-pointer",
            destructive && "text-muted-foreground hover:text-foreground",
          )}
        >
          {busy ? (
            <span
              className={cn(
                "size-3.5 animate-spin rounded-full border-2",
                destructive
                  ? "border-foreground/30 border-t-foreground"
                  : "border-primary-foreground/30 border-t-primary-foreground",
              )}
            />
          ) : destructive ? (
            <UserMinus className="size-3.5" strokeWidth={2.25} />
          ) : (
            <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
          )}
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty, loading, and error states
 * ───────────────────────────────────────────────────────────── */

function EmptyQueue({
  accent,
  headline,
  body,
  icon: Icon,
}: {
  accent: "success" | "primary";
  headline: string;
  body: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <span
        className={cn(
          "grid size-14 place-items-center rounded-2xl",
          accent === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">{headline}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function QueueSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-busy="true"
          className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-5"
        >
          <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/30 bg-accent/[0.04] px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-6" strokeWidth={1.75} />
      </span>
      <h3 className="mt-3 text-base font-semibold tracking-tight text-foreground">
        Couldn&rsquo;t load the queue.
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A hiccup on our end. Try again in a moment.
      </p>
      <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function extractError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : fallback;
}
