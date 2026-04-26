<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\TrustScoreCalculator;
use Illuminate\Http\JsonResponse;

/**
 * Admin dashboard analytics. Returns the counts the admin surface
 * needs to render its metric row + the next-action callouts.
 *
 * Phase 14.4 layers average rating + Trust Score distribution on top of
 * the Phase 9 baseline so the dashboard can show the platform's quality
 * pulse next to its volume numbers.
 */
class AnalyticsController extends Controller
{
    public function __construct(private readonly TrustScoreCalculator $trust) {}

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

        // Quality pulse: average platform-wide rating + Trust Score histogram.
        $ratingStats = Review::query()
            ->whereNotNull('visible_at')
            ->selectRaw('COUNT(*) as count, AVG(stars) as avg_stars')
            ->first();

        $ratingCount = $ratingStats !== null ? (int) ($ratingStats->getAttribute('count') ?? 0) : 0;
        $ratingAvgRaw = $ratingStats?->getAttribute('avg_stars');

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
                'ratings' => [
                    'count' => $ratingCount,
                    'average_stars' => $ratingAvgRaw !== null ? round((float) $ratingAvgRaw, 2) : null,
                ],
                'trust_score' => $this->trustScoreDistribution(),
                'as_of' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Trust Score histogram across active caregivers. Buckets line up with
     * mvp-requirements.md §4.6 — "New" caregivers (under 3 reviews) sit in
     * a separate group so the buckets themselves track only ranked staff.
     *
     * @return array{
     *   total: int,
     *   new: int,
     *   buckets: array<int, array{label: string, min: int, max: int, count: int}>,
     *   average: int|null,
     * }
     */
    private function trustScoreDistribution(): array
    {
        // Active caregivers only — suspended/deleted shouldn't influence the
        // pulse number admins use to decide whether to ramp acquisition.
        $profiles = CaregiverProfile::query()
            ->whereHas('user', fn ($q) => $q->where('role', 'caregiver')->where('status', 'active'))
            ->with('user.verificationRecords')
            ->get();

        $buckets = [
            ['label' => '0–40 · Building', 'min' => 0, 'max' => 40, 'count' => 0],
            ['label' => '41–60 · Promising', 'min' => 41, 'max' => 60, 'count' => 0],
            ['label' => '61–80 · Trusted', 'min' => 61, 'max' => 80, 'count' => 0],
            ['label' => '81–100 · Top tier', 'min' => 81, 'max' => 100, 'count' => 0],
        ];

        $newCount = 0;
        $rankedSum = 0;
        $rankedCount = 0;

        foreach ($profiles as $profile) {
            $breakdown = $this->trust->breakdown($profile);
            if ($breakdown['is_new']) {
                $newCount++;

                continue;
            }
            $score = $breakdown['score'];
            $rankedSum += $score;
            $rankedCount++;

            foreach ($buckets as &$bucket) {
                if ($score >= $bucket['min'] && $score <= $bucket['max']) {
                    $bucket['count']++;
                    break;
                }
            }
            unset($bucket);
        }

        return [
            'total' => $profiles->count(),
            'new' => $newCount,
            'buckets' => $buckets,
            'average' => $rankedCount > 0 ? (int) round($rankedSum / $rankedCount) : null,
        ];
    }
}
