import api from "@/lib/api";
import type { ServiceCategory } from "@/lib/service-categories";

/**
 * Caregiver-owned gig listing (Fiverr direction). Carries the productized
 * service offering. Visit specifics live on the booking row that's
 * created when a family books one of these.
 */
export type GigStatus = "draft" | "published" | "paused";

/** Single time window in the caregiver's weekly schedule (24-hour HH:MM). */
export interface AvailabilityRange {
  start: string;
  end: string;
}

/** Matcher-shaped weekly map. Days the caregiver hasn't set are absent or empty. */
export interface AvailabilityWeekly {
  mon?: AvailabilityRange[];
  tue?: AvailabilityRange[];
  wed?: AvailabilityRange[];
  thu?: AvailabilityRange[];
  fri?: AvailabilityRange[];
  sat?: AvailabilityRange[];
  sun?: AvailabilityRange[];
}

export interface GigCaregiverSummary {
  user_id: number;
  profile_id: number;
  display_name: string;
  photo_url: string | null;
  years_of_experience: number | null;
  languages: string[];
  /** Whole `availability` JSON column — null/missing = always available. */
  availability: { weekly?: AvailabilityWeekly } | null;
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
  /** Present only when the request specified ?recipient_id=. 0–100. */
  match_score?: number | null;
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

/**
 * All published gigs from a single caregiver, by user_id (matches the
 * /caregivers/{id} route param). Powers the "Services offered" section
 * on the public caregiver profile.
 */
export async function listGigsByCaregiver(caregiverUserId: number | string): Promise<Gig[]> {
  const res = await api.get<GigListResponse>("/api/gigs", {
    params: { caregiver_id: caregiverUserId },
  });
  return res.data.data;
}

/**
 * Published gigs ranked for one of the authed family's recipients via
 * MatchingEngine::gigsForRecipient. Each row in the response carries a
 * `match_score` 0–100 that the marketplace card surfaces as a badge.
 * Server sorts by score descending — caller shouldn't re-sort.
 */
export async function listGigsForRecipient(recipientId: number, rateMax?: number): Promise<Gig[]> {
  const params: Record<string, number> = { recipient_id: recipientId };
  if (rateMax !== undefined) params.rate_max = rateMax;
  const res = await api.get<GigListResponse>("/api/gigs", { params });
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

/** A live booking slot on a caregiver's calendar — used to hard-block conflicts in the booking form. */
export interface BookedWindow {
  scheduled_start: string;
  scheduled_end: string;
  status: string;
}

export interface CaregiverAvailabilitySnapshot {
  windows: BookedWindow[];
  /** ISO date strings (YYYY-MM-DD) — caregiver-marked off days. */
  off_dates: string[];
}

/**
 * Fetch the caregiver's already-taken booking windows AND per-date off
 * overrides. Defaults to today..+90 days; backend caps at 180.
 */
export async function listCaregiverBookedWindows(
  userId: number,
  options: { from?: string; to?: string } = {},
): Promise<CaregiverAvailabilitySnapshot> {
  const params: Record<string, string> = {};
  if (options.from) params.from = options.from;
  if (options.to) params.to = options.to;

  const res = await api.get<CaregiverAvailabilitySnapshot>(
    `/api/caregivers/${userId}/booked-windows`,
    { params },
  );
  return {
    windows: res.data.windows ?? [],
    off_dates: res.data.off_dates ?? [],
  };
}
