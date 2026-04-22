import api from "@/lib/api";
import type { GigPreferences, RecurrencePattern } from "@/lib/gigs";
import type { ServiceCategory } from "@/lib/service-categories";

export interface Neighbourhood {
  slug: string;
  name: string;
  label: string;
}

export interface CaregiverGig {
  id: number;
  status: "open";
  description: string;
  neighbourhood: Neighbourhood;
  scheduled_start: string;
  scheduled_end: string;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  preferences: GigPreferences;
  service_category?: ServiceCategory;
  created_at: string;
}

export type FeedSort = "soonest" | "nearest";

export interface FeedFilters {
  service?: string;
  sort?: FeedSort;
}

interface FeedResponse {
  data: CaregiverGig[];
}

interface SingleResponse {
  data: CaregiverGig;
}

export async function fetchCaregiverFeed(filters: FeedFilters = {}): Promise<CaregiverGig[]> {
  const params: Record<string, string> = {};
  if (filters.service) params.service = filters.service;
  if (filters.sort === "nearest") params.sort = "nearest";

  const res = await api.get<FeedResponse>("/api/gigs/feed", { params });
  return res.data.data;
}

export async function fetchCaregiverGig(id: number): Promise<CaregiverGig> {
  const res = await api.get<SingleResponse>(`/api/gigs/${id}`);
  return res.data.data;
}
