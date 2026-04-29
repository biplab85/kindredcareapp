import api from "@/lib/api";
import type { ServiceCategory } from "@/lib/service-categories";

/**
 * Caregiver-owned gig listing (Fiverr direction). Carries the productized
 * service offering. Visit specifics live on the booking row that's
 * created when a family books one of these.
 */
export type GigStatus = "draft" | "published" | "paused";

export interface GigCaregiverSummary {
  user_id: number;
  profile_id: number;
  display_name: string;
  photo_url: string | null;
  years_of_experience: number | null;
  languages: string[];
}

export interface Gig {
  id: number;
  title: string;
  status: GigStatus;
  description: string;
  tasks_included: string[];
  hourly_rate_cents: number;
  hourly_rate_dollars: number;
  photo_url: string | null;
  published_at: string | null;
  service_category?: ServiceCategory;
  caregiver?: GigCaregiverSummary;
  created_at: string;
  updated_at: string;
}

export interface CreateGigPayload {
  service_category_id: number;
  title: string;
  hourly_rate_dollars: number;
  description: string;
  tasks_included?: string[];
  photo?: File | null;
  status?: GigStatus;
}

export type UpdateGigPayload = Partial<CreateGigPayload>;

interface SingleGigResponse {
  data: Gig;
}

interface GigListResponse {
  data: Gig[];
}

/**
 * Build a multipart payload. Optional photo rides as a real File; arrays
 * use Laravel's bracket notation. Booleans flatten to "1"/"0".
 */
function buildGigFormData(payload: CreateGigPayload | UpdateGigPayload): FormData {
  const fd = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (key === "photo" && value instanceof File) {
      fd.append("photo", value);
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        fd.append(`${key}[]`, String(item));
      });
      continue;
    }

    if (typeof value === "boolean") {
      fd.append(key, value ? "1" : "0");
      continue;
    }

    fd.append(key, String(value));
  }

  return fd;
}

export async function createGig(payload: CreateGigPayload): Promise<Gig> {
  const res = await api.post<SingleGigResponse>("/api/gigs", buildGigFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** Family-side marketplace browse. Caller can filter by category slug. */
export async function listGigs(category?: string): Promise<Gig[]> {
  const res = await api.get<GigListResponse>("/api/gigs", {
    params: category ? { category } : undefined,
  });
  return res.data.data;
}

/** Caregiver dashboard — own listings across every status. */
export async function listMyGigs(): Promise<Gig[]> {
  const res = await api.get<GigListResponse>("/api/me/gigs");
  return res.data.data;
}

export async function getGig(id: number): Promise<Gig> {
  const res = await api.get<SingleGigResponse>(`/api/gigs/${id}`);
  return res.data.data;
}

export async function updateGig(id: number, payload: UpdateGigPayload): Promise<Gig> {
  const fd = buildGigFormData(payload);
  fd.append("_method", "PATCH");
  const res = await api.post<SingleGigResponse>(`/api/gigs/${id}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export async function deleteGig(id: number): Promise<void> {
  await api.delete(`/api/gigs/${id}`);
}
