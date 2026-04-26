import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Connect onboarding — caregiver bank + identity verification
 * ───────────────────────────────────────────────────────────── */

export interface ConnectStatus {
  connected: boolean;
  payouts_enabled: boolean;
  onboarded_at: string | null;
}

export interface ConnectStatusResponse {
  data: ConnectStatus;
  meta: { stripe_configured: boolean };
}

export interface ConnectOnboardingLink {
  url: string;
  expires_at: number;
}

export async function getConnectStatus(): Promise<ConnectStatusResponse> {
  const res = await api.get<ConnectStatusResponse>("/api/me/stripe-connect/status");
  return res.data;
}

export async function startConnectOnboarding(): Promise<ConnectOnboardingLink> {
  const res = await api.post<{ data: ConnectOnboardingLink }>("/api/me/stripe-connect/onboarding");
  return res.data.data;
}

export async function refreshConnectStatus(): Promise<ConnectStatus> {
  const res = await api.post<{ data: ConnectStatus }>("/api/me/stripe-connect/refresh");
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Earnings — lifetime / month / year / pending totals + history
 * ───────────────────────────────────────────────────────────── */

export type PayoutStatus = "pending" | "released" | "held";

export interface EarningsTotals {
  lifetime_cents: number;
  this_month_cents: number;
  this_year_cents: number;
  pending_cents: number;
}

export interface EarningsHistoryRow {
  booking_id: number;
  service: string;
  check_out_at: string | null;
  subtotal_cents: number;
  platform_fee_cents: number;
  caregiver_payout_cents: number;
  payout_status: PayoutStatus;
  payout_at: string | null;
  payout_transferred_at: string | null;
}

export interface EarningsResponse {
  data: {
    totals: EarningsTotals;
    history: EarningsHistoryRow[];
  };
}

export async function getEarnings(): Promise<EarningsResponse["data"]> {
  const res = await api.get<EarningsResponse>("/api/me/earnings");
  return res.data.data;
}

/* ─────────────────────────────────────────────────────────────
 * Display helpers
 * ───────────────────────────────────────────────────────────── */

export function payoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "released":
      return "Released";
    case "held":
      return "Held";
  }
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}
