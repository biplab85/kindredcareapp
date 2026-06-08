import api from "@/lib/api";
import type { CertificationStatus } from "@/lib/certifications";

export interface AdminCertification {
  id: number;
  name: string;
  issuer: string | null;
  year: number | null;
  status: CertificationStatus;
  has_document: boolean;
  expires_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  caregiver_profile?: {
    user?: {
      id: number;
      name: string;
      email: string;
      phone?: string | null;
    } | null;
  } | null;
  reviewer?: {
    id: number;
    name: string;
  } | null;
}

export interface AdminCertificationListResponse {
  data: AdminCertification[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export type AdminCertStatusFilter = CertificationStatus | "all";

export async function listAdminCertifications(params: {
  status?: AdminCertStatusFilter;
  per_page?: number;
}): Promise<AdminCertificationListResponse> {
  const res = await api.get<AdminCertificationListResponse>("/api/admin/certifications", {
    params,
  });
  return res.data;
}

export interface AdminCertificationDetail {
  certification: AdminCertification;
  document_url: string | null;
}

export async function getAdminCertification(id: number): Promise<AdminCertificationDetail> {
  const res = await api.get<AdminCertificationDetail>(`/api/admin/certifications/${id}`);
  return res.data;
}

export async function verifyAdminCertification(
  id: number,
  expiresAt?: string | null,
): Promise<AdminCertification> {
  const res = await api.post<{ certification: AdminCertification }>(
    `/api/admin/certifications/${id}/verify`,
    expiresAt ? { expires_at: expiresAt } : {},
  );
  return res.data.certification;
}

export async function rejectAdminCertification(
  id: number,
  reason: string,
): Promise<AdminCertification> {
  const res = await api.post<{ certification: AdminCertification }>(
    `/api/admin/certifications/${id}/reject`,
    { rejection_reason: reason },
  );
  return res.data.certification;
}
