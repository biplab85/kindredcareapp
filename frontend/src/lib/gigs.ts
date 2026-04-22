import api from "@/lib/api";
import type { ServiceCategory } from "@/lib/service-categories";

export type GigStatus = "open" | "matched" | "booked" | "completed" | "cancelled";

export type PostingMode = "matched" | "open";

export interface GigPreferences {
  gender?: "male" | "female" | "any" | null;
  language?: string | null;
  rate_max?: number | null;
}

export interface RecurrencePattern {
  days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  end_date?: string | null;
}

export interface Gig {
  id: number;
  status: GigStatus;
  posting_mode: PostingMode;
  description: string;
  location_address: string;
  latitude: number;
  longitude: number;
  scheduled_start: string;
  scheduled_end: string;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  preferences: GigPreferences;
  photo_url: string | null;
  service_category?: ServiceCategory;
  care_recipient?: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGigPayload {
  service_category_id: number;
  care_recipient_id?: number | null;
  description: string;
  location_address: string;
  latitude: number;
  longitude: number;
  scheduled_start: string;
  scheduled_end: string;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  preferences?: GigPreferences | null;
  posting_mode?: PostingMode;
  photo?: File | null;
}

export type UpdateGigPayload = Partial<
  Pick<
    CreateGigPayload,
    | "description"
    | "scheduled_start"
    | "scheduled_end"
    | "is_recurring"
    | "recurrence_pattern"
    | "preferences"
    | "photo"
  >
>;

interface SingleGigResponse {
  data: Gig;
}

interface GigListResponse {
  data: Gig[];
}

function buildGigFormData(payload: CreateGigPayload | UpdateGigPayload): FormData {
  const fd = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (key === "photo" && value instanceof File) {
      fd.append("photo", value);
      continue;
    }

    if (typeof value === "object") {
      // recurrence_pattern and preferences are nested objects — flatten with bracket notation.
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        if (innerValue === undefined || innerValue === null) continue;

        if (Array.isArray(innerValue)) {
          innerValue.forEach((item) => {
            fd.append(`${key}[${innerKey}][]`, String(item));
          });
        } else {
          fd.append(`${key}[${innerKey}]`, String(innerValue));
        }
      }
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

export async function listGigs(status?: GigStatus): Promise<Gig[]> {
  const res = await api.get<GigListResponse>("/api/gigs", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
}

export async function getGig(id: number): Promise<Gig> {
  const res = await api.get<SingleGigResponse>(`/api/gigs/${id}`);
  return res.data.data;
}

export async function updateGig(id: number, payload: UpdateGigPayload): Promise<Gig> {
  // Laravel accepts _method=PATCH as a work-around for multipart form posts.
  const fd = buildGigFormData(payload);
  fd.append("_method", "PATCH");
  const res = await api.post<SingleGigResponse>(`/api/gigs/${id}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export async function cancelGig(id: number): Promise<Gig> {
  const res = await api.patch<SingleGigResponse>(`/api/gigs/${id}/cancel`);
  return res.data.data;
}

export async function deleteGig(id: number): Promise<void> {
  await api.delete(`/api/gigs/${id}`);
}

export interface CaregiverMatch {
  id: number;
  user_id: number;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  hourly_rate: number;
  years_of_experience: number;
  languages: string[];
  interests: string[];
  travel_radius_km: number;
  distance_km: number;
  match_score: number;
  match_components: {
    distance: number;
    trust: number;
    overlap: number;
    availability: number;
    rate: number;
  };
  trust_score: number;
  trust_is_new: boolean;
}

export interface MatchesResponse {
  data: CaregiverMatch[];
  meta: {
    pool_size: number;
    qualifying: number;
    returned: number;
  };
}

export async function fetchGigMatches(id: number): Promise<MatchesResponse> {
  const res = await api.post<MatchesResponse>(`/api/gigs/${id}/matches`);
  return res.data;
}
