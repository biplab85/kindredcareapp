import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\AuditLogController.
 * ───────────────────────────────────────────────────────────── */

export type AuditTargetType =
  | "user"
  | "verification_record"
  | "panic_alert"
  | "incident_report"
  | "booking";

export interface AuditAdminSummary {
  id: number;
  name: string;
  email: string;
  role: "family" | "caregiver" | "admin";
}

export interface AuditLogEntry {
  id: number;
  action: string;
  target_type: AuditTargetType | null;
  target_id: number | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  created_at: string | null;
  admin: AuditAdminSummary | null;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface AuditLogQuery {
  action?: string;
  target_type?: AuditTargetType;
  target_id?: number;
  admin_user_id?: number;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export async function getAuditLog(query: AuditLogQuery = {}): Promise<AuditLogResponse> {
  const params: Record<string, string | number> = {};
  if (query.action) params.action = query.action;
  if (query.target_type) params.target_type = query.target_type;
  if (query.target_id) params.target_id = query.target_id;
  if (query.admin_user_id) params.admin_user_id = query.admin_user_id;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.page) params.page = query.page;
  if (query.per_page) params.per_page = query.per_page;

  const res = await api.get<AuditLogResponse>("/api/admin/audit-log", { params });
  return res.data;
}

/* ─────────────────────────────────────────────────────────────
 * Action vocabulary — used for the filter dropdown and labels.
 * ───────────────────────────────────────────────────────────── */

export const ACTION_LABELS: Record<string, string> = {
  "user.suspended": "User suspended",
  "user.reactivated": "User reactivated",
  "user.deleted": "User deleted",
  "verification.approved": "Verification approved",
  "verification.rejected": "Verification rejected",
  "panic.acknowledged": "Panic acknowledged",
  "panic.resolved": "Panic resolved",
  "incident.assigned": "Incident assigned",
  "incident.resolved": "Incident resolved",
  "incident.dismissed": "Incident dismissed",
  "booking.refunded": "Booking refunded",
  "booking.dispute_resolved": "Dispute resolved",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[_.]/g, " ");
}

export function targetTypeLabel(type: AuditTargetType | null): string {
  if (!type) return "—";
  return type.replace(/_/g, " ");
}

/** Tone classification used for the per-row tinting on the timeline. */
export function actionTone(action: string): "neutral" | "warn" | "alarm" | "good" {
  if (action.startsWith("panic.")) return action === "panic.resolved" ? "good" : "alarm";
  if (action === "user.suspended" || action === "user.deleted") return "alarm";
  if (action === "user.reactivated") return "good";
  if (action === "verification.approved") return "good";
  if (action === "verification.rejected") return "warn";
  if (action.startsWith("incident.")) {
    return action === "incident.resolved" || action === "incident.dismissed" ? "good" : "warn";
  }
  if (action === "booking.refunded") return "warn";
  return "neutral";
}
