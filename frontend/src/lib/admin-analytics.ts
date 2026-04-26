import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\AnalyticsController.
 * ───────────────────────────────────────────────────────────── */

export interface AnalyticsTrustBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface AnalyticsResponse {
  data: {
    users: {
      family: number;
      caregiver: number;
      admin: number;
    };
    verifications: {
      pending_review: number;
      flagged: number;
    };
    bookings: {
      pending_offers: number;
      active: number;
      completed_all_time: number;
    };
    revenue_this_month: {
      visits: number;
      gmv_cents: number;
      commission_cents: number;
    };
    ratings: {
      count: number;
      average_stars: number | null;
    };
    trust_score: {
      total: number;
      new: number;
      buckets: AnalyticsTrustBucket[];
      average: number | null;
    };
    as_of: string;
  };
}

export type Analytics = AnalyticsResponse["data"];

export async function getAdminAnalytics(): Promise<Analytics> {
  const res = await api.get<AnalyticsResponse>("/api/admin/analytics");
  return res.data.data;
}
