<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Annual earnings statement for caregivers — formatted for T4A Box 048
 * ("Fees for services") filing. Returns structured data only; the frontend
 * renders a print-to-PDF layout.
 *
 * Platform fees charged by KindredCare are NOT a business expense the CRA
 * cares about in Box 048 — the gross earnings line is what the caregiver
 * reports. We surface both numbers anyway so the caregiver sees the full
 * picture when they print.
 */
class EarningsStatementController extends Controller
{
    public function show(Request $request, int $year): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        if ($year < 2024 || $year > (int) now()->format('Y') + 1) {
            return response()->json(['message' => 'Statement year is out of range.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $yearStart = now()->setYear($year)->startOfYear();
        $yearEnd = now()->setYear($year)->endOfYear();

        $bookings = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->whereIn('payment_status', [
                Booking::PAYMENT_CAPTURED,
                Booking::PAYMENT_CAPTURED_STUB,
                // Held-pending-dispute still counts as earned — the dispute
                // only freezes the transfer, not the earning itself. Admin
                // resolution in Phase 14 will back-adjust if a refund lands.
                Booking::PAYMENT_HELD_PENDING_DISPUTE,
            ])
            ->whereBetween('check_out_at', [$yearStart, $yearEnd])
            ->get();

        $grossCents = (int) $bookings->sum('subtotal_cents');
        $feeCents = (int) $bookings->sum('platform_fee_cents');
        $netCents = (int) $bookings->sum('caregiver_payout_cents');
        $visits = $bookings->count();

        // T4A triggers at >$500/year gross (per Income Tax Act s. 153 / Reg 200).
        // Caregivers under the threshold can still download — the statement
        // helps with personal bookkeeping — but the hint flips.
        $t4aThresholdCents = 50_000;

        return response()->json([
            'data' => [
                'year' => $year,
                'year_start' => $yearStart->toIso8601String(),
                'year_end' => $yearEnd->toIso8601String(),
                'caregiver' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'postal_code' => $user->caregiverProfile?->postal_code,
                ],
                'totals' => [
                    'gross_cents' => $grossCents,
                    'fee_cents' => $feeCents,
                    'net_cents' => $netCents,
                    'visits' => $visits,
                ],
                't4a' => [
                    // Box 048 — "Fees for services". Gross earnings before
                    // platform fees. This is what the caregiver reports.
                    'box_048_cents' => $grossCents,
                    'threshold_cents' => $t4aThresholdCents,
                    'over_threshold' => $grossCents > $t4aThresholdCents,
                ],
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
