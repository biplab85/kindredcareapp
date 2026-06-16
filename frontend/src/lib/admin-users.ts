import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\UserController.
 * ───────────────────────────────────────────────────────────── */

export type AdminUserRole = "family" | "caregiver" | "admin";
export type AdminUserStatus = "active" | "suspended" | "deleted";

/** Compact card returned by the index endpoint and embedded in show. */
export interface AdminUserCard {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  cleared_checks: number;
  total_checks: number;
}

export interface AdminUserListResponse {
  data: AdminUserCard[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface VerificationRecordSummary {
  id: number;
  check_type: string;
  status: string;
  provider: string | null;
  updated_at: string | null;
}

export interface BookingTally {
  total: number;
  by_status: Record<string, number>;
}

export interface AdminUserDetail extends AdminUserCard {
  date_of_birth: string | null;
  gender: string | null;
  created_at: string | null;
  updated_at: string | null;
  verification_records: VerificationRecordSummary[];
  bookings: {
    as_caregiver: BookingTally;
    as_family: BookingTally;
  };
  ratings: {
    count: number;
    average_stars: number | null;
  };
}

export interface AdminUserListQuery {
  q?: string;
  role?: AdminUserRole;
  status?: AdminUserStatus;
  per_page?: number;
  page?: number;
}

/* ─────────────────────────────────────────────────────────────
 * API
 * ───────────────────────────────────────────────────────────── */

export async function getAdminUsers(
  query: AdminUserListQuery = {},
): Promise<AdminUserListResponse> {
  const params: Record<string, string | number> = {};
  if (query.q) params.q = query.q;
  if (query.role) params.role = query.role;
  if (query.status) params.status = query.status;
  if (query.per_page) params.per_page = query.per_page;
  if (query.page) params.page = query.page;

  const res = await api.get<AdminUserListResponse>("/api/admin/users", { params });
  return res.data;
}

export async function getAdminUser(id: number | string): Promise<AdminUserDetail> {
  const res = await api.get<{ data: AdminUserDetail }>(`/api/admin/users/${id}`);
  return res.data.data;
}

export interface SuspendResponse extends AdminUserCard {
  suspension_reason: string;
}

export async function suspendUser(id: number, reason: string): Promise<SuspendResponse> {
  const res = await api.patch<{ data: SuspendResponse }>(`/api/admin/users/${id}/suspend`, {
    reason,
  });
  return res.data.data;
}

export async function reactivateUser(id: number): Promise<AdminUserCard> {
  const res = await api.patch<{ data: AdminUserCard }>(`/api/admin/users/${id}/reactivate`);
  return res.data.data;
}

export async function markEmailVerified(id: number, reason: string): Promise<AdminUserCard> {
  const res = await api.patch<{ data: AdminUserCard }>(
    `/api/admin/users/${id}/verify-email`,
    { reason },
  );
  return res.data.data;
}

export async function deleteUser(id: number, reason: string): Promise<void> {
  await api.delete(`/api/admin/users/${id}`, { data: { reason } });
}

/* ─────────────────────────────────────────────────────────────
 * Labels
 * ───────────────────────────────────────────────────────────── */

export function roleLabel(role: AdminUserRole): string {
  switch (role) {
    case "family":
      return "Family";
    case "caregiver":
      return "Caregiver";
    case "admin":
      return "Admin";
  }
}

export function statusLabel(status: AdminUserStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "deleted":
      return "Deleted";
  }
}
