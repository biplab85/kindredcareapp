import api from "@/lib/api";
import type {
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  PanicAlert,
  PanicAlertStatus,
} from "@/lib/safety";

/* Re-export for single-import convenience on the admin page. */
export type {
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  PanicAlert,
  PanicAlertStatus,
};

export type QueueFilter = "open" | "resolved";

/* ─────────────────────────────────────────────────────────────
 * Panic alerts
 * ───────────────────────────────────────────────────────────── */

export async function getPanicAlerts(status?: QueueFilter): Promise<PanicAlert[]> {
  const res = await api.get<{ data: PanicAlert[] }>("/api/admin/panic-alerts", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
}

export async function acknowledgePanic(id: number): Promise<PanicAlert> {
  const res = await api.patch<{ data: PanicAlert }>(`/api/admin/panic-alerts/${id}/acknowledge`);
  return res.data.data;
}

export async function resolvePanic(id: number, note?: string): Promise<PanicAlert> {
  const res = await api.patch<{ data: PanicAlert }>(`/api/admin/panic-alerts/${id}/resolve`, {
    note: note ?? null,
  });
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Incident reports
 * ───────────────────────────────────────────────────────────── */

export async function getIncidents(status?: QueueFilter): Promise<IncidentReport[]> {
  const res = await api.get<{ data: IncidentReport[] }>("/api/admin/incidents", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
}

export type IncidentAdminAction = "assign" | "resolve" | "dismiss";

export interface IncidentUpdatePayload {
  assignee_user_id?: number;
  note?: string;
}

export async function updateIncident(
  id: number,
  action: IncidentAdminAction,
  payload: IncidentUpdatePayload = {},
): Promise<IncidentReport> {
  const body: Record<string, unknown> = { action };
  if (payload.assignee_user_id !== undefined) {
    body.assignee_user_id = payload.assignee_user_id;
  }
  if (payload.note !== undefined) {
    body.note = payload.note;
  }
  const res = await api.patch<{ data: IncidentReport }>(`/api/admin/incidents/${id}`, body);
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Labels
 * ───────────────────────────────────────────────────────────── */

export function panicStatusLabel(status: PanicAlertStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
  }
}

export function incidentStatusLabel(status: IncidentStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "investigating":
      return "Investigating";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
  }
}

/* Ordering helpers so the page can keep the sort logic declarative. */

const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const INCIDENT_STATUS_ORDER: Record<IncidentStatus, number> = {
  open: 0,
  investigating: 1,
  resolved: 2,
  dismissed: 3,
};

export function sortIncidents(list: IncidentReport[]): IncidentReport[] {
  return [...list].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const stat = INCIDENT_STATUS_ORDER[a.status] - INCIDENT_STATUS_ORDER[b.status];
    if (stat !== 0) return stat;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const PANIC_STATUS_ORDER: Record<PanicAlertStatus, number> = {
  active: 0,
  acknowledged: 1,
  resolved: 2,
};

export function sortPanics(list: PanicAlert[]): PanicAlert[] {
  return [...list].sort((a, b) => {
    const stat = PANIC_STATUS_ORDER[a.status] - PANIC_STATUS_ORDER[b.status];
    if (stat !== 0) return stat;
    return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
  });
}
