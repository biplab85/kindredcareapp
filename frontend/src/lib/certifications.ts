import api from "@/lib/api";

export type CertificationStatus =
  | "self_reported"
  | "pending_review"
  | "verified"
  | "rejected"
  | "expired";

export interface Certification {
  id: number;
  name: string;
  issuer: string | null;
  year: number | null;
  status: CertificationStatus;
  has_document: boolean;
  expires_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

interface ListResponse {
  data: Certification[];
}

interface SingleResponse {
  data: Certification;
}

export interface NewCertificationInput {
  name: string;
  issuer?: string | null;
  year?: number | null;
  document?: File | null;
}

export interface UpdateCertificationInput {
  name?: string;
  issuer?: string | null;
  year?: number | null;
}

export async function listCertifications(): Promise<Certification[]> {
  const res = await api.get<ListResponse>("/api/me/certifications");
  return res.data.data;
}

export async function createCertification(input: NewCertificationInput): Promise<Certification> {
  const fd = new FormData();
  fd.append("name", input.name);
  if (input.issuer) fd.append("issuer", input.issuer);
  if (input.year !== null && input.year !== undefined) fd.append("year", String(input.year));
  if (input.document) fd.append("document", input.document);
  const res = await api.post<SingleResponse>("/api/me/certifications", fd);
  return res.data.data;
}

export async function updateCertification(
  id: number,
  input: UpdateCertificationInput,
): Promise<Certification> {
  const res = await api.patch<SingleResponse>(`/api/me/certifications/${id}`, input);
  return res.data.data;
}

export async function uploadCertificationDocument(
  id: number,
  document: File,
): Promise<Certification> {
  const fd = new FormData();
  fd.append("document", document);
  const res = await api.post<SingleResponse>(`/api/me/certifications/${id}/document`, fd);
  return res.data.data;
}

export async function deleteCertification(id: number): Promise<void> {
  await api.delete(`/api/me/certifications/${id}`);
}

/* ─────────────────────────────────────────────────────────────
 * Display helpers — used by both the editor and the profile view.
 * ───────────────────────────────────────────────────────────── */

export function statusLabel(status: CertificationStatus): string {
  switch (status) {
    case "self_reported":
      return "Self-reported";
    case "pending_review":
      return "Pending review";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
  }
}

export function statusTone(
  status: CertificationStatus,
): "muted" | "primary" | "success" | "destructive" | "warning" {
  switch (status) {
    case "self_reported":
      return "muted";
    case "pending_review":
      return "primary";
    case "verified":
      return "success";
    case "rejected":
      return "destructive";
    case "expired":
      return "warning";
  }
}
