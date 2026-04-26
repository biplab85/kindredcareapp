import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror backend resources in
 *   app/Http/Resources/PanicAlertResource.php
 *   app/Http/Resources/IncidentReportResource.php
 * ───────────────────────────────────────────────────────────── */

export type PanicAlertStatus = "active" | "acknowledged" | "resolved";

export interface PanicAlert {
  id: number;
  booking_id: number;
  caregiver: {
    id: number;
    name: string | null;
  };
  triggered_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  silent: boolean;
  status: PanicAlertStatus;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export type IncidentType =
  | "safety"
  | "abuse"
  | "property_damage"
  | "neglect"
  | "scope_violation"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface IncidentReport {
  id: number;
  booking_id: number;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  evidence_paths: string[];
  status: IncidentStatus;
  reporter: {
    id: number;
    name: string | null;
  };
  assigned_to: number | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

/* ─────────────────────────────────────────────────────────────
 * Enum constants — exported so forms can iterate and label.
 * ───────────────────────────────────────────────────────────── */

export const INCIDENT_TYPES: IncidentType[] = [
  "safety",
  "abuse",
  "property_damage",
  "neglect",
  "scope_violation",
  "other",
];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];

export function incidentTypeLabel(type: IncidentType): string {
  switch (type) {
    case "safety":
      return "Safety concern";
    case "abuse":
      return "Abuse or harassment";
    case "property_damage":
      return "Property damage";
    case "neglect":
      return "Neglect";
    case "scope_violation":
      return "Outside scope of visit";
    case "other":
      return "Something else";
  }
}

export function incidentTypeBlurb(type: IncidentType): string {
  switch (type) {
    case "safety":
      return "Unsafe conditions, accidents, or close calls.";
    case "abuse":
      return "Verbal, emotional, or physical mistreatment.";
    case "property_damage":
      return "Damaged, broken, or lost property.";
    case "neglect":
      return "Care needs were not met.";
    case "scope_violation":
      return "Tasks outside what was booked.";
    case "other":
      return "Anything that doesn’t fit above.";
  }
}

export function incidentSeverityLabel(severity: IncidentSeverity): string {
  switch (severity) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
  }
}

export function incidentSeverityBlurb(severity: IncidentSeverity): string {
  switch (severity) {
    case "low":
      return "Minor — worth a note.";
    case "medium":
      return "Concerning — review within a week.";
    case "high":
      return "Serious — admin reviews today.";
    case "critical":
      return "Urgent — immediate action.";
  }
}

/* ─────────────────────────────────────────────────────────────
 * API calls
 * ───────────────────────────────────────────────────────────── */

export interface TriggerPanicPayload {
  bookingId: number;
  latitude?: number | null;
  longitude?: number | null;
  silent?: boolean;
}

export interface TriggerPanicResult {
  alert: PanicAlert;
  /**
   * `true` when the backend returned 409 because an alert was already
   * active for this booking. The UI should flip to the confirmation state
   * without double-dipping.
   */
  alreadyActive: boolean;
}

/**
 * Fire the panic button. Backend accepts the request with or without GPS
 * coordinates; we forward whatever the browser gave us (or nothing).
 *
 * Resolves with `{ alert, alreadyActive }` whether the backend returned
 * 201 (new alert) or 409 (existing active alert). Any other status is
 * re-thrown so the caller can show an error.
 */
export async function triggerPanic(payload: TriggerPanicPayload): Promise<TriggerPanicResult> {
  try {
    const res = await api.post<{ data: PanicAlert }>("/api/emergency/panic", {
      booking_id: payload.bookingId,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      silent: payload.silent ?? false,
    });
    return { alert: res.data.data, alreadyActive: false };
  } catch (err) {
    const response = (err as { response?: { status?: number; data?: { data?: PanicAlert } } })
      ?.response;
    if (response?.status === 409 && response.data?.data) {
      return { alert: response.data.data, alreadyActive: true };
    }
    throw err;
  }
}

export interface SafetyAckResponse {
  booking_id: number;
  safety_acknowledged_at: string | null;
}

export async function acknowledgeSafety(bookingId: number): Promise<SafetyAckResponse> {
  const res = await api.post<{ data: SafetyAckResponse }>(`/api/bookings/${bookingId}/safety-ack`);
  return res.data.data;
}

export interface SubmitIncidentPayload {
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  evidence_paths?: string[];
}

export async function submitIncident(
  bookingId: number,
  payload: SubmitIncidentPayload,
): Promise<IncidentReport> {
  const res = await api.post<{ data: IncidentReport }>(`/api/bookings/${bookingId}/incidents`, {
    type: payload.type,
    severity: payload.severity,
    description: payload.description,
    evidence_paths: payload.evidence_paths ?? [],
  });
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Best-effort GPS capture for panic. Swallows permission denials
 * (so the alert still fires) and returns null coords in that case.
 * ───────────────────────────────────────────────────────────── */

export function tryGetCoarseLocation(timeoutMs = 4_000): Promise<{
  latitude: number | null;
  longitude: number | null;
}> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }
    const done = (lat: number | null, lng: number | null) =>
      resolve({ latitude: lat, longitude: lng });

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        done(null, null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        done(position.coords.latitude, position.coords.longitude);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        done(null, null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
