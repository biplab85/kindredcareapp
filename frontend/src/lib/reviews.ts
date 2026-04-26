import api from "@/lib/api";

export type FlagReason = "inappropriate" | "retaliatory" | "harassment" | "false" | "other";

export const FLAG_REASONS: FlagReason[] = [
  "inappropriate",
  "retaliatory",
  "harassment",
  "false",
  "other",
];

export interface Review {
  id: number;
  booking_id: number;
  stars: number;
  body: string | null;
  submitted_at: string;
  visible_at: string | null;
  is_visible: boolean;
  flagged_at: string | null;
  hidden_at: string | null;
  rater: {
    id: number;
    name: string | null;
  };
  ratee: {
    id: number;
  };
}

export interface SubmitReviewPayload {
  stars: number;
  body?: string | null;
}

export async function submitReview(
  bookingId: number,
  payload: SubmitReviewPayload,
): Promise<Review> {
  const res = await api.post<{ data: Review }>(`/api/bookings/${bookingId}/review`, payload);
  return res.data.data;
}

export interface UserReviewsResponse {
  data: Review[];
  meta: {
    count: number;
    average_stars: number | null;
  };
}

export async function getUserReviews(userId: number): Promise<UserReviewsResponse> {
  const res = await api.get<UserReviewsResponse>(`/api/users/${userId}/reviews`);
  return res.data;
}

export interface PendingReviewRow {
  booking_id: number;
  check_out_at: string | null;
  service: string;
  caregiver_name: string;
}

export async function getPendingReviews(): Promise<PendingReviewRow[]> {
  const res = await api.get<{ data: PendingReviewRow[] }>("/api/me/reviews/pending");
  return res.data.data;
}

export async function flagReview(reviewId: number, reason: FlagReason): Promise<Review> {
  const res = await api.post<{ data: Review }>(`/api/reviews/${reviewId}/flag`, {
    flag_reason: reason,
  });
  return res.data.data;
}

/* Display helpers */

export function flagReasonLabel(reason: FlagReason): string {
  switch (reason) {
    case "inappropriate":
      return "Inappropriate content";
    case "retaliatory":
      return "Retaliatory / unfair";
    case "harassment":
      return "Harassment";
    case "false":
      return "False or misleading";
    case "other":
      return "Something else";
  }
}
