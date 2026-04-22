<?php

namespace App\Services;

use App\Models\CaregiverProfile;
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
     * Reviews arrive in Phase 11. Until the reviews table exists, assume
     * neutral 100 so new caregivers aren't penalised for platform immaturity.
     */
    private function reviewScore(User $user): int
    {
        return 100;
    }

    /**
     * Reliability = on-time rate + completion rate. Starts at 100 until
     * Phase 8 bookings + EVV produce signal.
     */
    private function reliabilityScore(User $user): int
    {
        return 100;
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
        // Will reflect real counts once the reviews table ships in Phase 11.
        return 0;
    }
}
