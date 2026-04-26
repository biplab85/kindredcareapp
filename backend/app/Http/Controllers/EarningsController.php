<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Caregiver earnings rollup for /caregiver/earnings.
 *
 * The page's shape (per mvp-requirements §4.9 + build-plan §9.2):
 *   - Lifetime total
 *   - This month + this year totals
 *   - Pending payouts (captured but not yet transferred)
 *   - Per-booking history list
 *
 * All money is in cents (same as the rest of the booking schema) so the
 * frontend formatters don't have to care about rounding.
 */
class EarningsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        $bookings = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->whereIn('payment_status', [
                Booking::PAYMENT_CAPTURED,
                Booking::PAYMENT_CAPTURED_STUB,
                Booking::PAYMENT_HELD_PENDING_DISPUTE,
            ])
            ->with(['gig.serviceCategory'])
            ->orderByDesc('check_out_at')
            ->get();

        $now = now();
        $monthStart = $now->copy()->startOfMonth();
        $yearStart = $now->copy()->startOfYear();

        $lifetime = 0;
        $thisMonth = 0;
        $thisYear = 0;
        $pending = 0;
        $history = [];

        foreach ($bookings as $booking) {
            $payout = $booking->caregiver_payout_cents;
            $lifetime += $payout;

            if ($booking->check_out_at && $booking->check_out_at->greaterThanOrEqualTo($monthStart)) {
                $thisMonth += $payout;
            }
            if ($booking->check_out_at && $booking->check_out_at->greaterThanOrEqualTo($yearStart)) {
                $thisYear += $payout;
            }

            $status = $this->payoutStatus($booking);
            if ($status === 'pending' || $status === 'held') {
                $pending += $payout;
            }

            $history[] = [
                'booking_id' => $booking->id,
                'service' => $booking->gig->serviceCategory->name,
                'check_out_at' => $booking->check_out_at?->toIso8601String(),
                'subtotal_cents' => $booking->subtotal_cents,
                'platform_fee_cents' => $booking->platform_fee_cents,
                'caregiver_payout_cents' => $payout,
                'payout_status' => $status,
                'payout_at' => $booking->payout_at?->toIso8601String(),
                'payout_transferred_at' => $booking->payout_transferred_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'data' => [
                'totals' => [
                    'lifetime_cents' => $lifetime,
                    'this_month_cents' => $thisMonth,
                    'this_year_cents' => $thisYear,
                    'pending_cents' => $pending,
                ],
                'history' => $history,
            ],
        ]);
    }

    private function payoutStatus(Booking $booking): string
    {
        if ($booking->payment_status === Booking::PAYMENT_HELD_PENDING_DISPUTE) {
            return 'held';
        }
        if ($booking->payout_transferred_at !== null) {
            return 'released';
        }

        return 'pending';
    }
}
