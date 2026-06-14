import api from "@/lib/api";

export type ArrivalReportReason = "not_yet_arrived" | "not_at_site_despite_checkin";

export interface ArrivalReport {
  id: number;
  booking_id: number;
  reason_code: ArrivalReportReason;
  description: string | null;
  status: "open" | "acknowledged" | "resolved_arrived" | "resolved_no_show" | "resolved_false_report";
  created_at: string | null;
}

interface StoreResponse {
  report: ArrivalReport;
}

interface ConflictResponse {
  message: string;
  report: ArrivalReport;
}

/**
 * Family files an arrival report on a booking. Backend returns 201 on
 * success and 409 if there's already an open report (payload includes
 * the existing report so callers can render the post-report state
 * without re-creating).
 */
export async function fileArrivalReport(
  bookingId: number,
  payload: { reason_code: ArrivalReportReason; description?: string },
): Promise<ArrivalReport> {
  const res = await api.post<StoreResponse>(
    `/api/bookings/${bookingId}/arrival-reports`,
    payload,
  );
  return res.data.report;
}

export function isAlreadyOpenError(
  err: unknown,
): err is { response: { status: 409; data: ConflictResponse } } {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 409
  );
}
