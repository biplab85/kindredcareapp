import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\BookingController.
 * ───────────────────────────────────────────────────────────── */

export type BookingStatus =
  | "pending_caregiver"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled_by_family"
  | "cancelled_by_caregiver"
  | "no_show";

export type PaymentStatus =
  | "not_required"
  | "authorized_stub"
  | "captured_stub"
  | "released_stub"
  | "refunded_stub"
  | "authorized"
  | "captured"
  | "released"
  | "refunded"
  | "held_pending_dispute";

export type DisputeStatus = "open" | "under_review" | "resolved" | "dismissed";

export type DisputeResolutionCode =
  | "full_refund"
  | "partial_refund"
  | "release_to_caregiver"
  | "no_action";

export interface BookingPartySummary {
  id: number;
  name: string;
  email: string;
  family_profile_id?: number;
}

export interface BookingCard {
  id: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  caregiver_payout_cents: number | null;
  address: string | null;
  caregiver: BookingPartySummary | null;
  family: BookingPartySummary | null;
  flagged_at: string | null;
}

export interface DisputeSummary {
  id: number;
  reason_code: string;
  description: string;
  status: DisputeStatus;
  evidence_paths: string[] | null;
  resolution_code: DisputeResolutionCode | null;
  resolution_refund_cents: number | null;
  resolution_note: string | null;
  created_at: string | null;
  resolved_at: string | null;
  reporter: { id: number; name: string; email: string; role: string };
  resolver: { id: number; name: string; email: string; role: string } | null;
}

export interface AdminMessage {
  id: number;
  sender: { id: number; name: string; role: string };
  body: string;
  redactions: Array<{ kind: string; original: string; replacement: string }> | null;
  redaction_count: number;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  created_at: string | null;
}

export interface BookingDetail extends BookingCard {
  gig: {
    id: number;
    title: string | null;
    description: string | null;
  };
  check_in: { at: string | null; lat: number | null; lng: number | null };
  check_out: { at: string | null; lat: number | null; lng: number | null };
  tasks_completed: string[] | null;
  caregiver_notes: string | null;
  flag_reasons: string[] | null;
  panic_alerts: Array<{
    id: number;
    status: string;
    silent: boolean;
    triggered_at: string | null;
    resolution_note: string | null;
  }>;
  incident_reports: Array<{
    id: number;
    type: string;
    severity: string;
    status: string;
    description: string;
    created_at: string | null;
  }>;
  reviews: Array<{
    id: number;
    rater_user_id: number;
    ratee_user_id: number;
    stars: number;
    body: string | null;
  }>;
  disputes: DisputeSummary[];
  messages: AdminMessage[];
}

export interface BookingListResponse {
  data: BookingCard[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface BookingListQuery {
  q?: string;
  status?: string;
  payment_status?: string;
  from?: string;
  to?: string;
  caregiver_user_id?: number;
  family_profile_id?: number;
  has_dispute?: boolean;
  page?: number;
  per_page?: number;
}

/* ─────────────────────────────────────────────────────────────
 * API
 * ───────────────────────────────────────────────────────────── */

export async function getAdminBookings(query: BookingListQuery = {}): Promise<BookingListResponse> {
  const params: Record<string, string | number> = {};
  if (query.q) params.q = query.q;
  if (query.status) params.status = query.status;
  if (query.payment_status) params.payment_status = query.payment_status;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.caregiver_user_id) params.caregiver_user_id = query.caregiver_user_id;
  if (query.family_profile_id) params.family_profile_id = query.family_profile_id;
  if (query.has_dispute) params.has_dispute = 1;
  if (query.page) params.page = query.page;
  if (query.per_page) params.per_page = query.per_page;

  const res = await api.get<BookingListResponse>("/api/admin/bookings", { params });
  return res.data;
}

export async function getAdminBooking(id: number | string): Promise<BookingDetail> {
  const res = await api.get<{ data: BookingDetail }>(`/api/admin/bookings/${id}`);
  return res.data.data;
}

export interface RefundPayload {
  reason: string;
  amount_cents?: number;
  dispute_id?: number;
  resolution_code?: DisputeResolutionCode;
}

export async function refundBooking(id: number, payload: RefundPayload): Promise<BookingCard> {
  const res = await api.post<{ data: BookingCard }>(`/api/admin/bookings/${id}/refund`, payload);
  return res.data.data;
}

export async function hideMessage(messageId: number, reason: string): Promise<void> {
  await api.patch(`/api/admin/messages/${messageId}/hide`, { reason });
}

export async function unhideMessage(messageId: number): Promise<void> {
  await api.patch(`/api/admin/messages/${messageId}/unhide`);
}

/* ─────────────────────────────────────────────────────────────
 * Labels + tone
 * ───────────────────────────────────────────────────────────── */

export function statusLabel(s: BookingStatus | string): string {
  return s.replace(/_/g, " ");
}

export function paymentStatusLabel(p: PaymentStatus | string): string {
  return p.replace(/_/g, " ");
}

export type StatusTone = "neutral" | "warn" | "alarm" | "good";

export function statusTone(status: BookingStatus | string): StatusTone {
  if (status === "completed") return "good";
  if (status === "in_progress" || status === "confirmed") return "neutral";
  if (
    status === "no_show" ||
    status === "declined" ||
    status === "expired" ||
    status === "cancelled_by_family" ||
    status === "cancelled_by_caregiver"
  ) {
    return "warn";
  }
  return "neutral";
}

export function paymentTone(payment: PaymentStatus | string): StatusTone {
  if (payment === "held_pending_dispute") return "alarm";
  if (payment === "refunded" || payment === "refunded_stub") return "warn";
  if (payment === "released" || payment === "released_stub") return "good";
  return "neutral";
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
