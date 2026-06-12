/**
 * Canada-time helpers. KindredCare serves Ontario only — every datetime
 * picker should accept input as Eastern time regardless of where the
 * user's browser is sitting, and every render should display Eastern
 * regardless of locale. Browser-locale interpretation produces silent
 * off-by-hours bugs the moment anyone tests from a non-Eastern timezone.
 *
 * Storage is UTC end-to-end (frontend `.toISOString()`, backend Carbon
 * casts) — this module only affects the boundary between humans and
 * timestamps.
 */

// Source of truth for "what timezone do all date pickers and displays
// operate in". Backend has the matching APP_TIMEZONE env var. Default
// stays America/Toronto for the Ontario MVP — flip via env without
// touching code if KindredCare expands to another region.
export const EASTERN_TZ = process.env.NEXT_PUBLIC_TIMEZONE || "America/Toronto";

/**
 * Build a Date that represents `{dateStr}T{timeStr}` as Eastern time,
 * regardless of the browser's locale. The returned Date is the correct
 * UTC instant — `.toISOString()` on it yields the right wire value.
 *
 * Handles EST/EDT automatically by reading the offset Eastern is using
 * on that specific date.
 *
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:mm"
 */
export function easternDateTime(dateStr: string, timeStr: string): Date {
  // Probe Eastern's offset at the rough target instant. We pass a naive
  // local Date; Intl reports what Eastern was running at that wall-clock
  // moment, which is what we want for DST boundaries.
  const probe = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(probe.getTime())) return probe;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(probe);

  const offset =
    parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") ?? "-05:00";

  return new Date(`${dateStr}T${timeStr}:00${offset}`);
}

/**
 * "Now" expressed as an Eastern wall-clock Date. Useful for "must be
 * future" client-side checks that should compare against Eastern, not
 * browser-local.
 */
export function easternNow(): Date {
  return new Date();
}

/**
 * Format an ISO date string (or Date) for display in Eastern time.
 * Defaults to a friendly long form; pass `options` to override.
 */
export function formatEastern(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-CA", { ...options, timeZone: EASTERN_TZ });
}

/**
 * Today as `YYYY-MM-DD` in Eastern time — for clamping `<input type="date">`
 * `min` attributes so families can't pick yesterday from a future-locale
 * browser.
 */
export function easternTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}
