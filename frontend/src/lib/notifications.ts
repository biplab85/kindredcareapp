import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror NotificationController.
 * ───────────────────────────────────────────────────────────── */

export type NotificationType =
  | "booking_offered"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_expired"
  | "booking_cancelled"
  | "booking_checked_in"
  | "visit_completed"
  | "shift_reminder"
  | "incident_reported"
  | "panic_triggered"
  | "message_received";

export interface NotificationItem {
  id: string;
  type: NotificationType | string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: { unread: number; total: number };
}

export async function listNotifications(): Promise<NotificationListResponse> {
  const res = await api.get<NotificationListResponse>("/api/notifications");
  return res.data;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await api.patch<{ data: NotificationItem }>(`/api/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/api/notifications/read-all");
}

/* ─────────────────────────────────────────────────────────────
 * Type helpers — render-friendly summaries
 * ───────────────────────────────────────────────────────────── */

export interface NotificationDisplay {
  title: string;
  body: string;
  href: string | null;
}

export function renderNotification(n: NotificationItem): NotificationDisplay {
  const d = n.data as Record<string, string | number>;
  const bookingId = typeof d.booking_id === "number" ? d.booking_id : undefined;
  const bookingHref = bookingId !== undefined ? `/bookings/${bookingId}` : null;

  switch (n.type) {
    case "booking_offered":
      return {
        title: "New booking offer",
        body:
          typeof d.caregiver_name === "string"
            ? `A family has booked you for an upcoming visit.`
            : "A family has booked you for an upcoming visit.",
        href: bookingHref,
      };
    case "booking_confirmed":
      return {
        title: "Booking confirmed",
        body: "Your caregiver accepted the booking.",
        href: bookingHref,
      };
    case "booking_declined":
      return {
        title: "Booking declined",
        body: "Your caregiver declined — we're searching for the next match.",
        href: bookingHref,
      };
    case "booking_expired":
      return {
        title: "Booking offer expired",
        body: "The caregiver didn't respond in time.",
        href: bookingHref,
      };
    case "booking_cancelled":
      return {
        title: "Booking cancelled",
        body: "The visit has been cancelled.",
        href: bookingHref,
      };
    case "booking_checked_in":
      return {
        title: "Caregiver checked in",
        body: "The visit has started.",
        href: bookingHref,
      };
    case "visit_completed":
      return {
        title: "Visit complete",
        body: "Care wrapped up — please leave a review when you can.",
        href: bookingHref,
      };
    case "shift_reminder":
      return {
        title: "Upcoming shift",
        body: "You have a visit coming up — check details and prepare.",
        href: bookingHref,
      };
    case "incident_reported":
      return {
        title: "Incident reported",
        body: "An incident was filed on a booking.",
        href: bookingHref,
      };
    case "panic_triggered":
      return {
        title: "Panic alert",
        body: "Safety alert raised on a visit.",
        href: bookingHref,
      };
    case "message_received":
      return {
        title:
          typeof d.sender_name === "string" ? `New message from ${d.sender_name}` : "New message",
        body: typeof d.preview === "string" ? d.preview : "Open the conversation to read.",
        href: bookingHref,
      };
    default:
      return {
        title: "Notification",
        body: typeof d.preview === "string" ? d.preview : "",
        href: bookingHref,
      };
  }
}
