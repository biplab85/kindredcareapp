import api from "@/lib/api";

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

export type BookingPaymentStatus =
  | "not_required"
  | "authorized_stub"
  | "captured_stub"
  | "released_stub"
  | "refunded_stub";

export type BookingStatusFilter = "upcoming" | "active" | "past" | "all" | BookingStatus;

export interface BookingCaregiverCard {
  id: number;
  name: string;
  photo_url: string | null;
  hourly_rate: number | null;
}

export interface BookingGigCard {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  service_category: {
    id: number;
    name: string;
    slug: string;
    default_tasks: string[];
  } | null;
}

export type VisitFlagReason = "check_in_far" | "check_out_far" | "short_duration";

export interface BookingVisit {
  check_in_at: string | null;
  check_in_distance_m: number | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_at: string | null;
  check_out_distance_m: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  tasks_completed: string[];
  caregiver_notes: string | null;
  is_flagged: boolean;
  flag_reasons: VisitFlagReason[];
}

export interface BookingActivePanicAlert {
  id: number;
  triggered_at: string;
  silent: boolean;
  status: "active" | "acknowledged" | "resolved";
  acknowledged_at: string | null;
}

export interface Booking {
  id: number;
  gig_id: number;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  match_rank: number;
  fallback_queue_size: number;
  scheduled_start: string;
  scheduled_end: string;
  response_deadline_at: string;
  is_expired: boolean;
  responded_at: string | null;
  cancelled_at: string | null;
  cancelled_by: "family" | "caregiver" | "system" | null;
  cancellation_reason: string | null;
  duration_minutes: number;
  hourly_rate_cents: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  caregiver_payout_cents: number;
  address_neighbourhood: string;
  address_full: string | null;
  caregiver: BookingCaregiverCard;
  gig?: BookingGigCard;
  visit: BookingVisit;
  safety_acknowledged_at?: string | null;
  active_panic_alert?: BookingActivePanicAlert | null;
  created_at: string;
  updated_at: string;
}

interface SingleBookingResponse {
  data: Booking;
}

interface ListBookingsResponse {
  data: Booking[];
}

export interface CreateBookingPayload {
  gig_id: number;
  caregiver_user_id: number;
  ranked_caregiver_ids: number[];
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const res = await api.post<SingleBookingResponse>("/api/bookings", payload);
  return res.data.data;
}

export async function listBookings(status?: BookingStatusFilter): Promise<Booking[]> {
  const res = await api.get<ListBookingsResponse>("/api/bookings", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
}

export async function getBooking(id: number): Promise<Booking> {
  const res = await api.get<SingleBookingResponse>(`/api/bookings/${id}`);
  return res.data.data;
}

export async function acceptBooking(id: number): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/accept`);
  return res.data.data;
}

export async function declineBooking(id: number, reason?: string): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/decline`, { reason });
  return res.data.data;
}

export async function cancelBooking(id: number, reason?: string): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/cancel`, { reason });
  return res.data.data;
}

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

export async function checkInBooking(id: number, coords: GeoCoords): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/check-in`, coords);
  return res.data.data;
}

export interface CheckOutPayload extends GeoCoords {
  tasks_completed?: string[];
  caregiver_notes?: string | null;
}

export async function checkOutBooking(id: number, payload: CheckOutPayload): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/check-out`, payload);
  return res.data.data;
}

export interface UpdateTasksPayload {
  tasks_completed: string[];
  caregiver_notes?: string | null;
}

export async function updateBookingTasks(
  id: number,
  payload: UpdateTasksPayload,
): Promise<Booking> {
  const res = await api.patch<SingleBookingResponse>(`/api/bookings/${id}/tasks`, payload);
  return res.data.data;
}

/**
 * Promise wrapper around navigator.geolocation. Resolves with lat/lng on
 * success; rejects with a human-readable reason when the user denies
 * permission or GPS is unavailable (so the UI can offer a retry/fallback).
 */
export function requestGeolocation(timeoutMs = 10_000): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location services are not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => {
        const msg =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Turn it on in your browser to check in."
            : error.code === error.POSITION_UNAVAILABLE
              ? "We couldn't determine your location right now. Try again in a moment."
              : error.code === error.TIMEOUT
                ? "Locating took too long. Try again outside or with a stronger signal."
                : "Location lookup failed.";
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

export function flagReasonLabel(reason: VisitFlagReason): string {
  switch (reason) {
    case "check_in_far":
      return "Check-in location was far from the visit address";
    case "check_out_far":
      return "Check-out location was far from the visit address";
    case "short_duration":
      return "Visit was much shorter than booked";
  }
}

/* ─────────────────────────────────────────────────────────────
 * Booking draft — sessionStorage bridge between the matches page
 * and the confirm page. Carries the ranked queue so the cascade
 * logic has the full list even after the confirm page reloads.
 * ───────────────────────────────────────────────────────────── */

const DRAFT_KEY_PREFIX = "kindredcare-booking-draft";

export interface BookingDraft {
  gigId: number;
  primaryCaregiverUserId: number;
  rankedCaregiverIds: number[];
  createdAt: number;
}

function draftKey(gigId: number): string {
  return `${DRAFT_KEY_PREFIX}:${gigId}`;
}

export function saveBookingDraft(draft: BookingDraft): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(draftKey(draft.gigId), JSON.stringify(draft));
  } catch {
    // Quota or disabled storage — silently drop. Confirm page has a fallback.
  }
}

export function loadBookingDraft(gigId: number): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(gigId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingDraft;
    if (parsed.gigId !== gigId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearBookingDraft(gigId: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(draftKey(gigId));
  } catch {
    // ignore
  }
}

/* ─────────────────────────────────────────────────────────────
 * Display helpers
 * ───────────────────────────────────────────────────────────── */

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h.toFixed(1)} hrs`;
}

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending_caregiver":
      return "Awaiting caregiver";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "expired":
      return "Offer expired";
    case "cancelled_by_family":
      return "Cancelled — family";
    case "cancelled_by_caregiver":
      return "Cancelled — caregiver";
    case "no_show":
      return "No-show";
  }
}

export function statusTone(status: BookingStatus): "pending" | "positive" | "warning" | "neutral" {
  switch (status) {
    case "pending_caregiver":
      return "pending";
    case "confirmed":
    case "in_progress":
    case "completed":
      return "positive";
    case "declined":
    case "expired":
    case "cancelled_by_family":
    case "cancelled_by_caregiver":
    case "no_show":
      return "warning";
    default:
      return "neutral";
  }
}
