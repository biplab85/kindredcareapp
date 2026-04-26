import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Caregiver annual statement (T4A Box 048)
 * ───────────────────────────────────────────────────────────── */

export interface StatementResponse {
  data: {
    year: number;
    year_start: string;
    year_end: string;
    caregiver: {
      name: string;
      email: string;
      postal_code: string | null;
    };
    totals: {
      gross_cents: number;
      fee_cents: number;
      net_cents: number;
      visits: number;
    };
    t4a: {
      box_048_cents: number;
      threshold_cents: number;
      over_threshold: boolean;
    };
    generated_at: string;
  };
}

export async function getAnnualStatement(year: number): Promise<StatementResponse["data"]> {
  const res = await api.get<StatementResponse>(`/api/me/earnings/statement/${year}`);
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Admin revenue report — period-bucketed time series
 * ───────────────────────────────────────────────────────────── */

export type RevenuePeriod = "daily" | "weekly" | "monthly";

export interface RevenueBucket {
  bucket: string;
  label: string;
  visits: number;
  gmv_cents: number;
  commission_cents: number;
  refunds_cents: number;
  net_cents: number;
  /** Map of service_category_id → visit count (per-bucket breakdown). */
  categories: Record<string, number>;
}

export interface RevenueTotals {
  visits: number;
  gmv_cents: number;
  commission_cents: number;
  refunds_cents: number;
  net_cents: number;
  /** Map of service_category_id → visit count across the whole window. */
  categories: Record<string, number>;
}

export interface RevenuePriorPeriod {
  from: string;
  to: string;
  totals: RevenueTotals;
}

export interface ServiceCategoryRef {
  id: number;
  slug: string;
  name: string;
}

export interface RevenueResponse {
  data: {
    period: RevenuePeriod;
    from: string;
    to: string;
    series: RevenueBucket[];
    totals: RevenueTotals;
    prior_period: RevenuePriorPeriod;
    categories: ServiceCategoryRef[];
  };
}

export interface RevenueQuery {
  period?: RevenuePeriod;
  from?: string;
  to?: string;
}

export async function getAdminRevenue(query: RevenueQuery = {}): Promise<RevenueResponse["data"]> {
  const res = await api.get<RevenueResponse>("/api/admin/revenue", { params: query });
  return res.data.data;
}
