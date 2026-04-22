<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\User;
use App\Models\VerificationRecord;
use Illuminate\Http\JsonResponse;

/**
 * Admin dashboard analytics. Returns the counts the admin surface
 * needs to render its metric row + the next-action callouts.
 *
 * Full Phase 14 analytics (heatmaps, booking-trend charts, retention
 * cohorts) will layer on top of this endpoint.
 */
class AnalyticsController extends Controller
{
    public function index(): JsonResponse
    {
        $monthStart = now()->startOfMonth();

        // User counts by role (active accounts only — suspended users drop out).
        $usersByRole = User::query()
            ->where('status', '!=', 'suspended')
            ->selectRaw('role, COUNT(*) as count')
            ->groupBy('role')
            ->pluck('count', 'role');

        // Verification backlog — the admin's most common triage surface.
        $pendingVerifications = VerificationRecord::query()
            ->where('status', VerificationRecord::STATUS_PENDING_REVIEW)
            ->count();

        $flaggedVerifications = VerificationRecord::query()
            ->where('status', VerificationRecord::STATUS_FLAGGED)
            ->count();

        // Booking state snapshot.
        $activeBookings = Booking::query()->active()->count();
        $pendingOffers = Booking::query()->pending()->count();
        $completedBookings = Booking::query()
            ->where('status', Booking::STATUS_COMPLETED)
            ->count();

        // This month's transaction + commission totals. Only count completed
        // visits so the numbers reflect realised revenue, not offers in flight.
        $monthlyCompleted = Booking::query()
            ->where('status', Booking::STATUS_COMPLETED)
            ->where('scheduled_start', '>=', $monthStart)
            ->selectRaw('COUNT(*) as visits, COALESCE(SUM(subtotal_cents), 0) as gmv, COALESCE(SUM(platform_fee_cents), 0) as commission')
            ->first();

        return response()->json([
            'data' => [
                'users' => [
                    'family' => (int) ($usersByRole['family'] ?? 0),
                    'caregiver' => (int) ($usersByRole['caregiver'] ?? 0),
                    'admin' => (int) ($usersByRole['admin'] ?? 0),
                ],
                'verifications' => [
                    'pending_review' => $pendingVerifications,
                    'flagged' => $flaggedVerifications,
                ],
                'bookings' => [
                    'pending_offers' => $pendingOffers,
                    'active' => $activeBookings,
                    'completed_all_time' => $completedBookings,
                ],
                'revenue_this_month' => [
                    'visits' => (int) ($monthlyCompleted->visits ?? 0),
                    'gmv_cents' => (int) ($monthlyCompleted->gmv ?? 0),
                    'commission_cents' => (int) ($monthlyCompleted->commission ?? 0),
                ],
                'as_of' => now()->toIso8601String(),
            ],
        ]);
    }
}
