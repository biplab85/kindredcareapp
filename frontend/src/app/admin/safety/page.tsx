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

function SafetyQueueView() {
  const [panic, setPanic] = useState<Queue<PanicAlert>>(() => initialQueue<PanicAlert>());
  const [incident, setIncident] = useState<Queue<IncidentReport>>(() =>
    initialQueue<IncidentReport>(),
  );

  const reloadPanic = useCallback(async (filter: QueueFilter) => {
    setPanic((q) => ({ ...q, state: "loading", filter }));
    try {
      const list = await getPanicAlerts(filter);
      // Open-count is derived from the "open" list — if we're fetching the
      // resolved tab, we hit the open endpoint afterwards to keep the header
      // counter accurate.
      const openCount = filter === "open" ? list.length : (await getPanicAlerts("open")).length;
      setPanic({
        state: "ready",
        filter,
        list: sortPanics(list),
        openCount,
      });
    } catch {
      setPanic((q) => ({ ...q, state: "error" }));
    }
  }, []);

  const reloadIncident = useCallback(async (filter: QueueFilter) => {
    setIncident((q) => ({ ...q, state: "loading", filter }));
    try {
      const list = await getIncidents(filter);
      const openCount = filter === "open" ? list.length : (await getIncidents("open")).length;
      setIncident({
        state: "ready",
        filter,
        list: sortIncidents(list),
        openCount,
      });
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
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <PageHeader
          openTotal={openTotal}
          panicOpen={panic.openCount}
          incidentOpen={incident.openCount}
        />

        <section className="mt-12 space-y-4">
          <QueueHeader
            sectionLabel="Panic alerts"
            sectionMark="§ 01"
            accent="accent"
            icon={<Siren className="size-3.5 text-accent" strokeWidth={2} />}
            openCount={panic.openCount}
            filter={panic.filter}
            onFilter={(f) => void reloadPanic(f)}
            onRefresh={() => void reloadPanic(panic.filter)}
          />
          <PanicList queue={panic} onChanged={() => void reloadPanic(panic.filter)} />
        </section>

        <section className="mt-14 space-y-4">
          <QueueHeader
            sectionLabel="Incident reports"
            sectionMark="§ 02"
            accent="primary"
            icon={<ShieldAlert className="size-3.5 text-primary" strokeWidth={2} />}
            openCount={incident.openCount}
            filter={incident.filter}
            onFilter={(f) => void reloadIncident(f)}
            onRefresh={() => void reloadIncident(incident.filter)}
          />
          <IncidentList queue={incident} onChanged={() => void reloadIncident(incident.filter)} />
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Page header — display headline + live counters
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
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Safety desk
        <span className="text-foreground/30">— § 00</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl">
          <span className={cn("font-normal italic", calm ? "text-success" : "text-accent")}>
            {calm ? "All clear." : "Safety queue."}
          </span>
        </h1>

        <span
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.22em] uppercase tabular-nums",
            calm
              ? "border-success/30 bg-success/10 text-success"
              : "border-accent/30 bg-accent/10 text-accent",
          )}
        >
          {calm ? (
            <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
          ) : (
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
          )}
          {openTotal} open
        </span>
      </div>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {calm
          ? "No active panic alerts, no open incidents. A quiet shift — the best kind."
          : "Active panic alerts surface first. Work them top-down; tap any incident to expand its context."}
        {!calm && (
          <>
            {" "}
            <span className="font-mono tabular-nums text-foreground/80">{panicOpen}</span> panic ·{" "}
            <span className="font-mono tabular-nums text-foreground/80">{incidentOpen}</span>{" "}
            incident
          </>
        )}
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Section header with tab pills (Open / Resolved)
 * ───────────────────────────────────────────────────────────── */

function QueueHeader({
  sectionLabel,
  sectionMark,
  accent,
  icon,
  openCount,
  filter,
  onFilter,
  onRefresh,
}: {
  sectionLabel: string;
  sectionMark: string;
  accent: "accent" | "primary";
  icon: React.ReactNode;
  openCount: number;
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  onRefresh: () => void;
}) {
  const pillColor =
    accent === "accent" ? "data-[active=true]:text-accent" : "data-[active=true]:text-primary";
  const underline = accent === "accent" ? "bg-accent" : "bg-primary";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        {icon}
        {sectionLabel}
        <span className="text-foreground/30">— {sectionMark}</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label={`${sectionLabel} filter`}
          className="flex items-center gap-0.5 rounded-full border border-border/60 bg-background/60 p-0.5"
        >
          <FilterPill
            value="open"
            active={filter === "open"}
            count={openCount}
            onClick={() => onFilter("open")}
            pillClass={pillColor}
            underlineClass={underline}
          />
          <FilterPill
            value="resolved"
            active={filter === "resolved"}
            // Intentionally hide count on resolved tab — archive can be huge.
            count={null}
            onClick={() => onFilter("resolved")}
            pillClass={pillColor}
            underlineClass={underline}
          />
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh queue"
          className={cn(
            "grid size-8 place-items-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
          )}
        >
          <RefreshCw className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function FilterPill({
  value,
  active,
  count,
  onClick,
  pillClass,
  underlineClass,
}: {
  value: QueueFilter;
  active: boolean;
  count: number | null;
  onClick: () => void;
  pillClass: string;
  underlineClass: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-active={active}
      onClick={onClick}
      className={cn(
        "relative rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
        active ? pillClass : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="relative">
        {value === "open" ? "Open" : "Resolved"}
        {active && (
          <span
            aria-hidden
            className={cn("absolute -bottom-1.5 left-0 h-px w-full", underlineClass)}
          />
        )}
      </span>
      {count !== null && (
        <span
          className={cn("ml-2 tabular-nums transition-colors", active ? "" : "text-foreground/50")}
        >
          · {count}
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Panic queue list
 * ───────────────────────────────────────────────────────────── */

function PanicList({ queue, onChanged }: { queue: Queue<PanicAlert>; onChanged: () => void }) {
  if (queue.state === "loading") {
    return <QueueSkeleton rows={2} tone="accent" />;
  }
  if (queue.state === "error") {
    return <QueueErrorCard onRetry={onChanged} />;
  }
  if (queue.list.length === 0) {
    return (
      <EmptyQueue
        accent="success"
        headline="Quiet shift."
        body="No active panic alerts."
        icon={<CheckCircle2 className="size-6 text-success" strokeWidth={2} />}
      />
    );
  }

  return (
    <ul className="space-y-4">
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
      setErrorMsg(extractError(err, "Couldn’t acknowledge — try again."));
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
      setErrorMsg(extractError(err, "Couldn’t resolve — try again."));
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card transition-colors",
        isActive && "border-accent/50 bg-accent/[0.03]",
        !isActive && !isResolved && "border-accent/30",
        isResolved && "border-border/60",
      )}
    >
      {/* Ambient pulse on active alerts */}
      {isActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,theme(colors.accent/0.12),transparent_60%)]"
        />
      )}

      {/* Perforated left edge — ticket-stub vocab */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="p-5 pl-9 sm:p-6 sm:pl-11">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
                {triggered.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                <span className="text-foreground/80">
                  {triggered.toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <PanicStatusPill status={alert.status} />
              {alert.silent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] uppercase">
                  <VolumeX className="size-2.5" strokeWidth={2.25} />
                  Silent
                </span>
              )}
              {!alert.silent && isActive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/40 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                  <Volume2 className="size-2.5" strokeWidth={2.25} />
                  Audible
                </span>
              )}
            </div>

            <h3 className="mt-2 text-xl font-semibold tracking-tight">{caregiverName}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              <span className="font-mono tabular-nums">
                Booking #{String(alert.booking_id).padStart(5, "0")}
              </span>
              <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
              {hasGps ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <MapPin className="size-3" strokeWidth={2} />
                  <span className="font-mono tracking-[0.12em] normal-case text-success/90 tabular-nums">
                    {(alert.gps_lat ?? 0).toFixed(4)}, {(alert.gps_lng ?? 0).toFixed(4)}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3" strokeWidth={2} />
                  GPS denied
                </span>
              )}
            </p>
          </div>

          <Link
            href={`/bookings/${alert.booking_id}`}
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            View booking ↗
          </Link>
        </div>

        {/* Resolution note on resolved alerts */}
        {alert.resolution_note && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Resolution note
            </p>
            <blockquote className="mt-2 border-l-2 border-success/40 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{alert.resolution_note}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Inline error */}
        {errorMsg && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMsg}
            </p>
          </div>
        )}

        {/* Action bar — only on Open tab */}
        {isOpenTab && !isResolved && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            {!showResolveNote ? (
              <div className="flex flex-wrap items-center gap-2">
                {isActive && (
                  <Button
                    onClick={runAcknowledge}
                    disabled={busy}
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
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
                >
                  <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                  Resolve
                </Button>
                {alert.acknowledged_at && (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
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
      </div>
    </article>
  );
}

function PanicStatusPill({ status }: { status: PanicAlertStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-accent uppercase">
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
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-primary uppercase">
        <BookmarkCheck className="size-2.5" strokeWidth={2.25} />
        {panicStatusLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
      <CheckCircle2 className="size-2.5" strokeWidth={2.25} />
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
    return <QueueSkeleton rows={3} tone="primary" />;
  }
  if (queue.state === "error") {
    return <QueueErrorCard onRetry={onChanged} />;
  }
  if (queue.list.length === 0) {
    return (
      <EmptyQueue
        accent="primary"
        headline="Good days happen."
        body="No open incidents."
        icon={<Sparkles className="size-6 text-primary" strokeWidth={2} />}
      />
    );
  }

  return (
    <ul className="space-y-4">
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
      setErrorMsg(extractError(err, "Couldn’t assign — try again."));
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
          action === "resolve" ? "Couldn’t resolve — try again." : "Couldn’t dismiss — try again.",
        ),
      );
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card transition-colors",
        incident.severity === "critical" && "border-accent/50 bg-accent/[0.03]",
        incident.severity !== "critical" && "border-border/60",
      )}
    >
      {/* Critical shine */}
      {incident.severity === "critical" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,theme(colors.accent/0.12),transparent_55%)]"
        />
      )}

      {/* Perforated left edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="p-5 pl-9 sm:p-6 sm:pl-11">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityPill severity={incident.severity} />
              <IncidentStatusPill status={incident.status} />
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
                {incidentTypeLabel(incident.type)}
              </span>
            </div>

            <h3 className="mt-2 text-xl font-semibold tracking-tight">Filed by {reporterName}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              <span className="font-mono tabular-nums">
                Booking #{String(incident.booking_id).padStart(5, "0")}
              </span>
              <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" strokeWidth={2} />
                <span className="font-mono normal-case tracking-[0.12em] tabular-nums">
                  {created.toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {created.toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              {incident.assigned_to && (
                <>
                  <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                  <span className="inline-flex items-center gap-1 text-primary">
                    <UserCheck className="size-3" strokeWidth={2} />
                    <span className="font-mono normal-case tracking-[0.12em] tabular-nums">
                      Assigned · admin #{incident.assigned_to}
                    </span>
                  </span>
                </>
              )}
            </p>
          </div>

          <Link
            href={`/bookings/${incident.booking_id}`}
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            View booking ↗
          </Link>
        </div>

        {/* Description */}
        <div className="mt-4 border-t border-dashed border-border/60 pt-4">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            What happened
          </p>
          <p
            className={cn(
              "mt-2 text-[14px] leading-relaxed text-foreground/85",
              !expanded && descriptionNeedsExpand && "line-clamp-2",
            )}
          >
            {incident.description}
          </p>
          {descriptionNeedsExpand && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" strokeWidth={2} />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" strokeWidth={2} />
                  Read more
                </>
              )}
            </button>
          )}
        </div>

        {/* Resolution note */}
        {incident.resolution_note && (
          <div className="mt-4 border-t border-dashed border-border/60 pt-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Resolution note
            </p>
            <blockquote className="mt-2 border-l-2 border-success/40 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{incident.resolution_note}&rdquo;
            </blockquote>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMsg}
            </p>
          </div>
        )}

        {canAct && (
          <div className="mt-5 border-t border-dashed border-border/60 pt-4">
            {noteMode === null ? (
              <div className="flex flex-wrap items-center gap-2">
                {!incident.assigned_to ? (
                  <Button onClick={runAssign} disabled={busy} size="sm">
                    {phase === "assigning" ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    ) : (
                      <UserCheck className="size-3.5" strokeWidth={2.25} />
                    )}
                    Assign to me
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-primary uppercase tabular-nums">
                    <UserCheck className="size-3" strokeWidth={2.25} />
                    Assigned · admin #{incident.assigned_to}
                  </span>
                )}
                <Button
                  onClick={() => setNoteMode("resolve")}
                  disabled={busy}
                  size="sm"
                  variant="outline"
                >
                  <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                  Resolve
                </Button>
                <Button
                  onClick={() => setNoteMode("dismiss")}
                  disabled={busy}
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
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
                    : "Explain why this report doesn’t warrant further action."
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
      </div>
    </article>
  );
}

function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  const toneMap: Record<IncidentStatus, { cls: string; icon: React.ReactNode }> = {
    open: {
      cls: "border-accent/40 bg-accent/10 text-accent",
      icon: (
        <span className="relative flex size-1.5 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
          <span className="relative size-1.5 rounded-full bg-accent" />
        </span>
      ),
    },
    investigating: {
      cls: "border-primary/30 bg-primary/10 text-primary",
      icon: <AlertOctagon className="size-2.5" strokeWidth={2.25} />,
    },
    resolved: {
      cls: "border-success/30 bg-success/10 text-success",
      icon: <CheckCircle2 className="size-2.5" strokeWidth={2.25} />,
    },
    dismissed: {
      cls: "border-border/60 bg-muted/40 text-muted-foreground",
      icon: <X className="size-2.5" strokeWidth={2.25} />,
    },
  };
  const tone = toneMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
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
    low: "border-border/60 bg-muted/60 text-muted-foreground",
    medium: "border-primary/30 bg-primary/10 text-primary",
    high: "border-accent/40 bg-accent/10 text-accent",
    critical:
      "border-accent bg-accent text-accent-foreground shadow-[0_2px_10px_-4px_theme(colors.accent/0.6)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.22em] uppercase",
        variants[severity],
      )}
    >
      {severity === "critical" && <AlertOctagon className="size-3" strokeWidth={2.5} />}
      {incidentSeverityLabel(severity)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Inline note forms
 * ───────────────────────────────────────────────────────────── */

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
    <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-background/40 p-4">
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        Resolution note — optional
      </p>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={busy}
        placeholder="What was done, who was contacted, outcome."
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-success/30 transition-shadow focus:ring-2 disabled:opacity-60"
      />
      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          size="sm"
          className="bg-success text-success-foreground hover:bg-success/90"
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
    <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-background/40 p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={busy}
        placeholder="Note for the audit trail."
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-primary/30 transition-shadow focus:ring-2 disabled:opacity-60"
      />
      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          size="sm"
          variant={destructive ? "outline" : "default"}
          className={cn(destructive && "text-muted-foreground hover:text-foreground")}
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
  icon,
}: {
  accent: "success" | "primary";
  headline: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border-2 border-dashed bg-card/50 p-8 text-center sm:p-10",
        accent === "success" ? "border-success/30" : "border-primary/30",
      )}
    >
      <span
        className={cn(
          "mx-auto grid size-14 place-items-center rounded-2xl ring-1",
          accent === "success" ? "bg-success/10 ring-success/25" : "bg-primary/10 ring-primary/25",
        )}
      >
        {icon}
      </span>
      <h3 className="mt-5 text-2xl font-semibold tracking-tight">
        <span className={cn("italic", accent === "success" ? "text-success" : "text-primary")}>
          {headline}
        </span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

function QueueSkeleton({ rows, tone }: { rows: number; tone: "accent" | "primary" }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-busy="true"
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 pl-9 sm:p-6 sm:pl-11"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.15)_1px,transparent_1.5px)] bg-[length:100%_12px]"
          />
          <div className="flex items-center gap-3">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div
              className={cn(
                "h-3 w-16 animate-pulse rounded-full",
                tone === "accent" ? "bg-accent/20" : "bg-primary/20",
              )}
            />
          </div>
          <div className="mt-3 h-5 w-52 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted/70" />
          <div className="mt-2 h-3 w-11/12 animate-pulse rounded bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

function QueueErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight">Couldn&rsquo;t load the queue.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A hiccup on our end. Try again in a moment.
          </p>
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Retry
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function extractError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : fallback;
}
