<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\ArrivalReport;
use App\Models\Booking;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin resolution surface for ArrivalReport. The family-side filing
 * lives in ArrivalReportController (top-level); this controller is the
 * triage end where admin marks reports resolved and (for resolved_no_show)
 * triggers the BookingService::markNoShow flow to release the Stripe
 * hold and flip the booking.
 */
class ArrivalReportController extends Controller
{
    public function __construct(
        private readonly AdminAuditLogger $auditLogger,
        private readonly BookingService $bookings,
    ) {}

    public function resolve(Request $request, ArrivalReport $arrivalReport): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        if (! in_array($arrivalReport->status, ArrivalReport::OPEN_STATUSES, true)) {
            return response()->json(['message' => 'This arrival report is already resolved.'], 422);
        }

        $validated = $request->validate([
            'resolution' => ['required', 'string', 'in:resolved_arrived,resolved_no_show,resolved_false_report'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $resolution = $validated['resolution'];
        $adminNotes = $validated['admin_notes'] ?? null;

        $arrivalReport = DB::transaction(function () use ($arrivalReport, $admin, $resolution, $adminNotes) {
            $arrivalReport->update([
                'status' => $resolution,
                'resolved_by' => $admin->id,
                'resolved_at' => now(),
                'admin_notes' => $adminNotes,
            ]);

            // resolved_no_show short-circuits the 30-min cron: mark the
            // booking no_show immediately, release the Stripe hold, notify
            // both parties via the existing BookingCancelled notification.
            // Pass forceByAdmin so markNoShow bypasses its threshold check.
            if ($resolution === ArrivalReport::STATUS_RESOLVED_NO_SHOW
                && $arrivalReport->booking->status === Booking::STATUS_CONFIRMED) {
                $this->bookings->markNoShow($arrivalReport->booking, forceByAdmin: true);
            }

            $this->auditLogger->record(
                admin: $admin,
                action: 'arrival_report.'.$resolution,
                targetType: AdminAuditLog::TARGET_ARRIVAL_REPORT,
                targetId: $arrivalReport->id,
                metadata: [
                    'booking_id' => $arrivalReport->booking_id,
                    'reason_code' => $arrivalReport->reason_code,
                ],
                reason: $adminNotes,
            );

            return $arrivalReport->fresh();
        });

        return response()->json(['report' => $arrivalReport]);
    }
}
