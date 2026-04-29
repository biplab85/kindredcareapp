"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await api.get<{ user: { caregiver_profile?: { availability?: unknown } } }>(
          "/api/me",
        );
        const raw = res.data.user.caregiver_profile?.availability;
        setWeek(parseAvailability(raw));
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
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Availability · § 12
          </div>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            When you&rsquo;re
            <br />
            <span className="font-normal italic text-primary">open for visits</span>.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
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
