<?php

namespace App\Http\Controllers;

use App\Models\ArrivalReport;
use App\Models\Booking;
use App\Models\User;
use App\Notifications\ArrivalReportFiled;
use App\Notifications\CaregiverArrivalPing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Family-side arrival reports — the middle-severity channel between
 * the panic button (real-time safety) and BookingDispute (post-visit
 * money). The family taps "Caregiver hasn't arrived" or "Caregiver
 * isn't here" and admin gets paged via the standard mail+database
 * notification stack; the caregiver also gets a soft nudge.
 */
class ArrivalReportController extends Controller
{
    public function store(Request $request, Booking $booking): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Only the family that booked may file an arrival report. Caregivers
        // and admins use other tools.
        if ($booking->familyProfile->user_id !== $user->id) {
            return response()->json(['message' => 'Only the family that booked this visit can file an arrival report.'], 403);
        }

        // The two reason codes correspond to two distinct booking states.
        // Validate that the booking is actually in the right state for the
        // reason being reported — guards against UI bugs sending the wrong
        // reason and against stale clients.
        $validated = $request->validate([
            'reason_code' => ['required', 'string', 'in:'.implode(',', ArrivalReport::REASON_CODES)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $reason = $validated['reason_code'];

        if ($reason === ArrivalReport::REASON_NOT_YET_ARRIVED) {
            if ($booking->status !== Booking::STATUS_CONFIRMED) {
                return response()->json(['message' => 'This booking isn\'t awaiting check-in.'], 422);
            }
            if ($booking->check_in_at !== null) {
                return response()->json(['message' => 'The caregiver has already checked in.'], 422);
            }
            if (now()->lessThan($booking->scheduled_start)) {
                return response()->json(['message' => 'The visit hasn\'t started yet.'], 422);
            }
        }

        if ($reason === ArrivalReport::REASON_NOT_AT_SITE_DESPITE_CHECKIN) {
            if ($booking->status !== Booking::STATUS_IN_PROGRESS) {
                return response()->json(['message' => 'This booking isn\'t in progress.'], 422);
            }
        }

        // One open report per booking — prevents the family from spamming
        // admin with the same complaint. They can file again only after the
        // previous one is resolved.
        $existing = ArrivalReport::where('booking_id', $booking->id)
            ->whereIn('status', ArrivalReport::OPEN_STATUSES)
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'An arrival report is already open on this booking.',
                'report' => $existing,
            ], 409);
        }

        $report = DB::transaction(function () use ($booking, $user, $validated, $reason) {
            $report = ArrivalReport::create([
                'booking_id' => $booking->id,
                'reporter_user_id' => $user->id,
                'reason_code' => $reason,
                'description' => $validated['description'] ?? null,
                'status' => ArrivalReport::STATUS_OPEN,
            ]);

            // Fan out to admins (medium severity — mail + in-app, no real-time
            // page like PanicTriggered uses).
            $admins = User::where('role', 'admin')->where('status', 'active')->get();
            Notification::send($admins, new ArrivalReportFiled($report));

            // Soft ping to the caregiver.
            $booking->caregiver->notify(new CaregiverArrivalPing($report));

            return $report;
        });

        return response()->json(['report' => $report], 201);
    }
}
