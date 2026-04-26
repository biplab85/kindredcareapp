import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\AlertsController.
 * ───────────────────────────────────────────────────────────── */

export type AlertKind =
  | "panic"
  | "incident"
  | "dispute"
  | "flagged_booking"
  | "flagged_verification"
  | "flagged_review";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface AlertActor {
  id: number;
  name: string;
  role: string;
}

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  summary: string;
  occurred_at: string | null;
  actor: AlertActor | null;
  target_url: string;
  metadata: Record<string, unknown>;
}

export interface AlertsResponse {
  data: Alert[];
  meta: {
    total: number;
    by_kind: Partial<Record<AlertKind, number>>;
  };
}

export async function getAlerts(kinds?: AlertKind[]): Promise<AlertsResponse> {
  const params: Record<string, string> = {};
  if (kinds && kinds.length > 0) {
    params.kinds = kinds.join(",");
  }
  const res = await api.get<AlertsResponse>("/api/admin/alerts", { params });
  return res.data;
}

/* ─────────────────────────────────────────────────────────────
 * Labels + tone
 * ───────────────────────────────────────────────────────────── */

export const KIND_LABELS: Record<AlertKind, string> = {
  panic: "Panic",
  incident: "Incident",
  dispute: "Dispute",
  flagged_booking: "Flagged visit",
  flagged_verification: "Flagged verification",
  flagged_review: "Flagged review",
};

export type AlertTone = "alarm" | "warn" | "neutral";

export function severityTone(severity: AlertSeverity): AlertTone {
  if (severity === "critical") return "alarm";
  if (severity === "high") return "alarm";
  if (severity === "medium") return "warn";
  return "neutral";
}
