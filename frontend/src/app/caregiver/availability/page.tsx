"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface OverrideRow {
  id: number;
  date: string; // YYYY-MM-DD
  note: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * Caregiver-only weekly availability editor.
 *
 * The matcher (`MatchingEngine::availableAt`) reads
 * `caregiver_profile.availability.weekly[day]` as an array of
 * { start, end } ranges in the platform's operating timezone.
 * This page writes that exact shape so the matcher honours it.
 *
 * MVP rule: a caregiver with no availability rows is treated as
 * "always available" — the warning copy below makes that explicit
 * so it isn't a footgun.
 * ───────────────────────────────────────────────────────────── */

const DAYS = [
  { slug: "mon", short: "Mon", full: "Monday" },
  { slug: "tue", short: "Tue", full: "Tuesday" },
  { slug: "wed", short: "Wed", full: "Wednesday" },
  { slug: "thu", short: "Thu", full: "Thursday" },
  { slug: "fri", short: "Fri", full: "Friday" },
  { slug: "sat", short: "Sat", full: "Saturday" },
  { slug: "sun", short: "Sun", full: "Sunday" },
] as const;

type DaySlug = (typeof DAYS)[number]["slug"];
type Range = { start: string; end: string };
type WeekState = Record<DaySlug, Range[]>;

const EMPTY_WEEK: WeekState = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

export default function CaregiverAvailabilityPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Availability">
        <AvailabilityView />
      </DashboardShell>
    </AuthGuard>
  );
}

function AvailabilityView() {
  const [week, setWeek] = useState<WeekState>(EMPTY_WEEK);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const [meRes, ovRes] = await Promise.all([
          api.get<{ user: { caregiver_profile?: { availability?: unknown } } }>("/api/me"),
          api.get<{ overrides: OverrideRow[] }>("/api/me/availability-overrides"),
        ]);
        const raw = meRes.data.user.caregiver_profile?.availability;
        setWeek(parseAvailability(raw));
        setOverrides(ovRes.data.overrides ?? []);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRanges = useMemo(
    () => Object.values(week).reduce((sum, ranges) => sum + ranges.length, 0),
    [week],
  );

  const setDay = (day: DaySlug, ranges: Range[]) => setWeek((prev) => ({ ...prev, [day]: ranges }));

  const toggleDay = (day: DaySlug, on: boolean) => {
    if (on) {
      // First range defaults to a typical 9–5 window; caregiver edits from there.
      setDay(day, [{ start: "09:00", end: "17:00" }]);
    } else {
      setDay(day, []);
    }
  };

  const addRange = (day: DaySlug) => {
    const ranges = week[day];
    // Pick a default that doesn't collide with the last existing range.
    const last = ranges[ranges.length - 1];
    const defaults: Range = last
      ? { start: bumpHour(last.end, 1), end: bumpHour(last.end, 3) }
      : { start: "09:00", end: "17:00" };
    setDay(day, [...ranges, defaults]);
  };

  const removeRange = (day: DaySlug, idx: number) => {
    setDay(
      day,
      week[day].filter((_, i) => i !== idx),
    );
  };

  const updateRange = (day: DaySlug, idx: number, key: "start" | "end", value: string) => {
    setDay(
      day,
      week[day].map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    );
  };

  const markDateOff = async (date: string) => {
    // Optimistic insert; reconcile on server response.
    const optimistic: OverrideRow = { id: -1, date, note: null };
    setOverrides((prev) => [...prev, optimistic].sort((a, b) => a.date.localeCompare(b.date)));
    try {
      const res = await api.post<{ override: OverrideRow }>("/api/me/availability-overrides", {
        date,
      });
      const real = res.data.override;
      setOverrides((prev) =>
        prev.map((o) => (o.id === -1 && o.date === date ? real : o)).filter((o) => o),
      );
      toast.success("Date marked off.");
    } catch {
      // Roll back the optimistic row.
      setOverrides((prev) => prev.filter((o) => !(o.id === -1 && o.date === date)));
      toast.error("Couldn't mark that date off.");
    }
  };

  const unmarkDate = async (date: string) => {
    const found = overrides.find((o) => o.date === date);
    if (!found) return;
    const previous = overrides;
    setOverrides((prev) => prev.filter((o) => o.date !== date));
    try {
      await api.delete(`/api/me/availability-overrides/${found.id}`);
      toast.success("Date restored.");
    } catch {
      setOverrides(previous);
      toast.error("Couldn't restore that date.");
    }
  };

  const handleSave = async () => {
    // Sanity: every range must have start < end.
    for (const day of DAYS) {
      const ranges = week[day.slug];
      for (const r of ranges) {
        if (r.start >= r.end) {
          toast.error(`${day.full}: end time must come after start time.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await api.patch("/api/me/caregiver-profile", {
        availability: { weekly: week },
      });
      toast.success("Availability saved.");
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't save your availability.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&rsquo;t load your availability.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Refresh the page in a moment.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-background to-background" />

      <div className="mx-auto max-w-4xl px-4 pt-10 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/caregiver/schedule"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to schedule
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Availability · § 12
          </div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            When you&rsquo;re{" "}
            <span className="font-normal italic text-primary">open for visits</span>.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Set the days and time ranges you&rsquo;re typically free. Families can only book gigs
            inside one of these windows.
          </p>

          {totalRanges === 0 && (
            <div className="mt-6 rounded-2xl bg-accent/10 px-5 py-4 ring-1 ring-accent/20">
              <p className="text-sm leading-relaxed text-foreground/80">
                <span className="font-semibold text-accent">Heads-up:</span> while no days are set,
                you&rsquo;re treated as <em>always available</em> — every booking window is fair
                game. Add hours below to bound it.
              </p>
            </div>
          )}
        </div>

        {/* Day cards */}
        <ul className="space-y-3">
          {DAYS.map((day) => (
            <DayCard
              key={day.slug}
              dayLabel={day.full}
              ranges={week[day.slug]}
              onToggle={(on) => toggleDay(day.slug, on)}
              onAddRange={() => addRange(day.slug)}
              onRemoveRange={(idx) => removeRange(day.slug, idx)}
              onUpdateRange={(idx, key, value) => updateRange(day.slug, idx, key, value)}
            />
          ))}
        </ul>

        {/* Per-date overrides — month calendar */}
        <MonthCalendarSection
          week={week}
          overrides={overrides}
          onMarkOff={(date) => markDateOff(date)}
          onUnmark={(date) => unmarkDate(date)}
        />

        {/* Save bar */}
        <div className="sticky bottom-4 mt-10 flex items-center justify-end gap-3 rounded-2xl border border-border/60 bg-card/95 px-5 py-3 shadow-sm backdrop-blur">
          <p className="mr-auto font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {totalRanges === 0
              ? "No windows set · always available"
              : `${totalRanges} window${totalRanges === 1 ? "" : "s"} across the week`}
          </p>
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saving}
            className="h-11 bg-accent px-6 text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Save changes
                <Check className="size-4" strokeWidth={2.5} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayCard({
  dayLabel,
  ranges,
  onToggle,
  onAddRange,
  onRemoveRange,
  onUpdateRange,
}: {
  dayLabel: string;
  ranges: Range[];
  onToggle: (on: boolean) => void;
  onAddRange: () => void;
  onRemoveRange: (idx: number) => void;
  onUpdateRange: (idx: number, key: "start" | "end", value: string) => void;
}) {
  const isOn = ranges.length > 0;

  return (
    <li>
      <article
        className={cn(
          "rounded-2xl bg-card px-5 py-4 ring-1 transition-colors sm:px-6",
          isOn ? "ring-primary/30" : "ring-border/60",
        )}
      >
        <div className="flex items-center gap-4">
          <Switch checked={isOn} onCheckedChange={onToggle} />
          <h2
            className={cn(
              "min-w-32 text-base font-semibold tracking-tight",
              !isOn && "text-muted-foreground",
            )}
          >
            {dayLabel}
          </h2>
          {!isOn && (
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Off
            </span>
          )}
        </div>

        {isOn && (
          <div className="mt-4 space-y-3 sm:ml-16">
            {ranges.map((r, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-background/60 px-4 py-3 ring-1 ring-border/40"
              >
                <input
                  type="time"
                  value={r.start}
                  step={900}
                  onChange={(e) => onUpdateRange(idx, "start", e.target.value)}
                  className="rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="time"
                  value={r.end}
                  step={900}
                  onChange={(e) => onUpdateRange(idx, "end", e.target.value)}
                  className="rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveRange(idx)}
                  className="ml-auto h-8 text-muted-foreground hover:text-destructive"
                  aria-label="Remove range"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAddRange} className="h-9">
              <Plus className="size-3.5" />
              Add another window
            </Button>
          </div>
        )}
      </article>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

/**
 * Tolerate both the matcher's expected shape (array of ranges) and
 * the legacy onboarding shape ({ available, start, end } object) so
 * caregivers who set hours during signup don't lose their data.
 */
function parseAvailability(raw: unknown): WeekState {
  if (!raw || typeof raw !== "object") return EMPTY_WEEK;
  const weekly = (raw as { weekly?: unknown }).weekly;
  if (!weekly || typeof weekly !== "object") return EMPTY_WEEK;

  const next: WeekState = { ...EMPTY_WEEK };
  for (const day of DAYS) {
    const value = (weekly as Record<string, unknown>)[day.slug];
    if (Array.isArray(value)) {
      next[day.slug] = value
        .filter(
          (v): v is Range =>
            !!v &&
            typeof v === "object" &&
            typeof (v as Range).start === "string" &&
            typeof (v as Range).end === "string",
        )
        .map((v) => ({ start: v.start, end: v.end }));
    } else if (
      value &&
      typeof value === "object" &&
      "available" in (value as object) &&
      (value as { available: boolean }).available &&
      typeof (value as Record<string, unknown>).start === "string" &&
      typeof (value as Record<string, unknown>).end === "string"
    ) {
      // Legacy onboarding: { available, start, end } → single range.
      next[day.slug] = [
        {
          start: (value as { start: string }).start,
          end: (value as { end: string }).end,
        },
      ];
    }
  }
  return next;
}

/** Bump an HH:MM time by N hours, clamped to 23:59. */
function bumpHour(time: string, hours: number): string {
  const [h, m] = time.split(":").map((s) => Number.parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return "09:00";
  const total = h * 60 + m + hours * 60;
  const clamped = Math.min(total, 23 * 60 + 59);
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────
 * Month calendar — per-date overrides on top of the weekly template.
 *
 * Rules per cell:
 *  - Past day: muted, not interactive
 *  - Override exists: accent-tinted "Off" pill, click to restore
 *  - Weekly template open that weekday: success-tinted "Open", click to mark off
 *  - Weekly template closed (no hours that weekday) AND no override: faint
 *    background "Closed" — caregiver hasn't said they work, no point
 *    marking it off. Click is a no-op.
 *
 * Two-month view: current month + next month. Enough horizon for
 * vacation planning without being overwhelming.
 * ───────────────────────────────────────────────────────────── */

const WEEKDAY_INDEX_TO_DAY: Record<number, DaySlug> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

function MonthCalendarSection({
  week,
  overrides,
  onMarkOff,
  onUnmark,
}: {
  week: WeekState;
  overrides: OverrideRow[];
  onMarkOff: (date: string) => void;
  onUnmark: (date: string) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const overrideByDate = useMemo(() => new Map(overrides.map((o) => [o.date, o])), [overrides]);

  const months = useMemo(() => [anchor, addMonths(anchor, 1)] as const, [anchor]);

  const handleClick = (
    ymd: string,
    isPast: boolean,
    hasOverride: boolean,
    isOpenWeekly: boolean,
  ) => {
    if (isPast) return;
    if (hasOverride) {
      onUnmark(ymd);
    } else if (isOpenWeekly) {
      onMarkOff(ymd);
    } else {
      toast.info("That day is already closed in your weekly schedule.");
    }
  };

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            One-off overrides · § 13
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Days you&rsquo;re taking off.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Tap an open day to mark it off (Eid, vacation, doctor&rsquo;s appointment). Tap an off
            day to restore it. Already-closed days don&rsquo;t need marking — they&rsquo;re already
            off.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
            className="h-9"
            aria-label="Previous month"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(startOfMonth(new Date()))}
            className="h-9"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            className="h-9"
            aria-label="Next month"
          >
            <ArrowLeft className="size-4 rotate-180" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((monthStart) => (
          <article
            key={monthStart.toISOString()}
            className="rounded-2xl bg-card p-5 ring-1 ring-border/60"
          >
            <header className="mb-4 flex items-baseline justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                {monthStart.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
              </h3>
            </header>

            {/* Weekday header row */}
            <div className="mb-2 grid grid-cols-7 gap-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-1 py-1 text-center">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {buildMonthGrid(monthStart).map((cell, idx) => {
                if (cell === null) {
                  return <div key={`spacer-${idx}`} aria-hidden />;
                }
                const ymd = toYmd(cell);
                const isPast = cell < today;
                const isToday = sameDay(cell, today);
                const dayKey = WEEKDAY_INDEX_TO_DAY[cell.getDay()];
                const isOpenWeekly = (week[dayKey]?.length ?? 0) > 0;
                const hasOverride = overrideByDate.has(ymd);

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => handleClick(ymd, isPast, hasOverride, isOpenWeekly)}
                    disabled={isPast}
                    className={cn(
                      "flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-all",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isPast && "cursor-not-allowed opacity-30",
                      !isPast &&
                        hasOverride &&
                        "bg-destructive/10 text-destructive ring-1 ring-destructive/30 hover:bg-destructive/15",
                      !isPast &&
                        !hasOverride &&
                        isOpenWeekly &&
                        "bg-success/10 text-foreground hover:bg-success/15",
                      !isPast &&
                        !hasOverride &&
                        !isOpenWeekly &&
                        "bg-muted/40 text-muted-foreground hover:bg-muted",
                      isToday && "ring-2 ring-primary",
                    )}
                  >
                    <span className="font-mono tabular-nums">{cell.getDate()}</span>
                    {hasOverride && <X className="size-3" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-success/15 ring-1 ring-success/30" />
          Open (per weekly)
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-destructive/15 ring-1 ring-destructive/30" />
          Marked off
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-muted ring-1 ring-border/70" />
          Closed (per weekly)
        </span>
      </div>
    </section>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Build a 7-column grid for the given month, padded with nulls for leading blanks. */
function buildMonthGrid(monthStart: Date): Array<Date | null> {
  const lead = monthStart.getDay(); // 0..6 (Sun..Sat)
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }
  return cells;
}
