import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\VerificationController + the underlying
 * VerificationRecord model.
 * ───────────────────────────────────────────────────────────── */

export type VerificationStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "cleared"
  | "flagged"
  | "rejected";

export type VerificationCheckType = "identity" | "cpic" | "aml" | "reference";

export interface VerificationListItem {
  id: number;
  check_type: VerificationCheckType | string;
  status: VerificationStatus;
  updated_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export interface VerificationListResponse {
  data: VerificationListItem[];
  total: number;
  current_page?: number;
  last_page?: number;
}

export interface VerificationDetail {
  id: number;
  check_type: VerificationCheckType | string;
  status: VerificationStatus;
  provider: string | null;
  provider_reference_id: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  updated_at: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    gender: string | null;
    caregiver_profile: {
      bio: string | null;
      hourly_rate: string | null;
      years_of_experience: number | null;
      services?: Array<{ name: string }>;
    } | null;
  };
  reviewer: { name: string } | null;
}

export interface VerificationDetailResponse {
  verification: VerificationDetail;
  document_urls: Record<string, string>;
}

/* ─────────────────────────────────────────────────────────────
 * API
 * ───────────────────────────────────────────────────────────── */

export type StatusFilter = VerificationStatus | "all";

export async function getVerifications(status: StatusFilter): Promise<VerificationListResponse> {
  const res = await api.get<{
    data: VerificationListItem[];
    total: number;
    current_page: number;
    last_page: number;
  }>(`/api/admin/verifications`, { params: { status } });
  return res.data;
}

export async function getVerification(id: number | string): Promise<VerificationDetailResponse> {
  const res = await api.get<VerificationDetailResponse>(`/api/admin/verifications/${id}`);
  return res.data;
}

export async function approveVerification(id: number, adminNotes?: string): Promise<void> {
  await api.post(`/api/admin/verifications/${id}/approve`, {
    admin_notes: adminNotes ?? null,
  });
}

export async function rejectVerification(
  id: number,
  rejectionReason: string,
  adminNotes?: string,
): Promise<void> {
  await api.post(`/api/admin/verifications/${id}/reject`, {
    rejection_reason: rejectionReason,
    admin_notes: adminNotes ?? null,
  });
}

/* ─────────────────────────────────────────────────────────────
 * Labels
 * ───────────────────────────────────────────────────────────── */

export function checkTypeLabel(type: string): string {
  switch (type) {
    case "identity":
      return "Identity (Veriff)";
    case "cpic":
      return "CPIC";
    case "aml":
      return "AML / sanctions";
    case "reference":
      return "Reference";
    default:
      return type.replace(/_/g, " ");
  }
}

export function statusLabel(status: VerificationStatus | string): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "pending_review":
      return "Pending review";
    case "cleared":
      return "Cleared";
    case "flagged":
      return "Flagged";
    case "rejected":
      return "Rejected";
    default:
      return status.replace(/_/g, " ");
  }
}

export type StatusTone = "neutral" | "warn" | "alarm" | "good";

export function statusTone(status: VerificationStatus | string): StatusTone {
  if (status === "cleared") return "good";
  if (status === "flagged") return "alarm";
  if (status === "rejected") return "warn";
  if (status === "pending_review" || status === "in_progress") return "neutral";
  return "neutral";
}
