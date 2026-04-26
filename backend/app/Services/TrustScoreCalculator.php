<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRecord;

/**
 * Composes a 0-100 Trust Score from the signals described in
 * mvp-requirements.md §4.6.
 *
 *   - Verification completeness   40%
 *   - Client reviews              30%   (Phase 11 — neutral 100 until then)
 *   - Reliability                 20%   (Phase 8 — neutral 100 until then)
 *   - Tenure                      10%   (capped at 365 days on platform)
 *
 * Computed on demand rather than stored, so verification transitions
 * and future review writes are reflected instantly. Phase 11 will
 * swap the review/reliability defaults in without touching callers.
 */
class TrustScoreCalculator
{
    private const WEIGHT_VERIFICATION = 40;

    private const WEIGHT_REVIEWS = 30;

    private const WEIGHT_RELIABILITY = 20;

    private const WEIGHT_TENURE = 10;

    private const TENURE_CAP_DAYS = 365;

    /** Below this review count we surface the "New" badge + use neutral-100 for score. */
    public const NEW_REVIEW_THRESHOLD = 3;

    /**
     * @return array{
     *   score: int,
     *   components: array{
     *     verification: int,
     *     reviews: int,
     *     reliability: int,
     *     tenure: int
     *   },
     *   is_new: bool
     * }
     */
    public function breakdown(CaregiverProfile $profile): array
    {
        $profile->loadMissing('user.verificationRecords');
        /** @var User $user */
        $user = $profile->user;

        $verification = $this->verificationScore($user);
        $reviews = $this->reviewScore($user);
        $reliability = $this->reliabilityScore($user);
        $tenure = $this->tenureScore($profile);

        $weighted = ($verification * self::WEIGHT_VERIFICATION
            + $reviews * self::WEIGHT_REVIEWS
            + $reliability * self::WEIGHT_RELIABILITY
            + $tenure * self::WEIGHT_TENURE) / 100;

        return [
            'score' => (int) round($weighted),
            'components' => [
                'verification' => $verification,
                'reviews' => $reviews,
                'reliability' => $reliability,
                'tenure' => $tenure,
            ],
            'is_new' => $this->reviewCount($user) < 3,
        ];
    }

    public function scoreFor(CaregiverProfile $profile): int
    {
        return $this->breakdown($profile)['score'];
    }

    private function verificationScore(User $user): int
    {
        $cleared = $user->verificationRecords
            ->whereIn('check_type', VerificationRecord::ALL_CHECK_TYPES)
            ->where('status', VerificationRecord::STATUS_CLEARED)
            ->count();

        $total = count(VerificationRecord::ALL_CHECK_TYPES);

        return (int) round(($cleared / $total) * 100);
    }

    /**
     * Reviews contribute once a caregiver has 3+ visible ratings (mvp-
     * requirements §4.6: "New" label for caregivers with <3 reviews).
     * Below the threshold, stay neutral-100 so matching doesn't penalise
     * newcomers who simply haven't accumulated yet.
     *
     * Star scale (1–5) maps to a 0–100 signal via × 20 (5 stars = 100).
     */
    private function reviewScore(User $user): int
    {
        $visible = Review::query()
            ->forRatee($user->id)
            ->visible()
            ->get(['stars']);

        if ($visible->count() < self::NEW_REVIEW_THRESHOLD) {
            return 100;
        }

        $avg = (float) $visible->avg('stars');

        return (int) round(max(0, min(100, $avg * 20)));
    }

    /**
     * Reliability: combination of on-time check-ins and completion rate.
     * Needs at least one visit on record to compute — until then, neutral
     * 100 so fresh caregivers don't get penalised for having no history.
     *
     *   - On-time rate:   visits where the caregiver checked in within
     *                     the 200m + on-schedule envelope.
     *   - Completion rate: completed visits / (completed + caregiver-
     *                      cancelled + no-show).
     *
     * The average of the two, × 100.
     */
    private function reliabilityScore(User $user): int
    {
        $totalVisits = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->whereIn('status', [
                Booking::STATUS_COMPLETED,
                Booking::STATUS_CANCELLED_CAREGIVER,
                Booking::STATUS_NO_SHOW,
            ])
            ->count();

        if ($totalVisits === 0) {
            return 100;
        }

        $completed = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->where('status', Booking::STATUS_COMPLETED)
            ->count();

        $completionRate = $completed / $totalVisits;

        // On-time: among completed visits, how many checked in before the
        // scheduled start (with a generous 5-minute tolerance).
        $onTimeEligible = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->where('status', Booking::STATUS_COMPLETED)
            ->whereNotNull('check_in_at')
            ->get(['check_in_at', 'scheduled_start']);

        if ($onTimeEligible->isEmpty()) {
            return (int) round($completionRate * 100);
        }

        $onTime = $onTimeEligible->filter(fn ($b) => $b->check_in_at->lessThanOrEqualTo($b->scheduled_start->copy()->addMinutes(5)))->count();
        $onTimeRate = $onTime / $onTimeEligible->count();

        return (int) round((($completionRate + $onTimeRate) / 2) * 100);
    }

    private function tenureScore(CaregiverProfile $profile): int
    {
        $createdAt = $profile->user->created_at;
        if ($createdAt === null) {
            return 0;
        }

        $days = min(self::TENURE_CAP_DAYS, $createdAt->diffInDays(now()));

        return (int) round(($days / self::TENURE_CAP_DAYS) * 100);
    }

    private function reviewCount(User $user): int
    {
        return Review::query()->forRatee($user->id)->visible()->count();
    }
}
