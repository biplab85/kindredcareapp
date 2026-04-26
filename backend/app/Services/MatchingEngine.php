<?php

namespace App\Services;

use App\Http\Resources\CaregiverGigResource;
use App\Models\CaregiverProfile;
use App\Models\Gig;
use App\Models\User;
use App\Models\VerificationRecord;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Rule-based matching per mvp-requirements.md §4.5.
 *
 * 1. Hard filters eliminate any caregiver who cannot perform the gig.
 * 2. Weighted scoring ranks the survivors:
 *      distance    30%
 *      trust       30%
 *      overlap     20%   (languages + interests)
 *      availability 10%   (schedule fit quality)
 *      rate        10%   (how close to the family's budget)
 *
 * Top 10 are returned with every component exposed for transparency
 * (useful on the family-facing UI and in admin debugging).
 *
 * The ML feedback loop (§4.5.5 in platform-workflow.md) is deferred to
 * v1.1; the architecture here is deliberately dumb so it can be swapped.
 */
class MatchingEngine
{
    private const MAX_RESULTS = 10;

    private const OPERATING_TIMEZONE = 'America/Toronto';

    private const WEIGHTS = [
        'distance' => 30,
        'trust' => 30,
        'overlap' => 20,
        'availability' => 10,
        'rate' => 10,
    ];

    public function __construct(private readonly TrustScoreCalculator $trust) {}

    /**
     * @return array{
     *   matches: array<int, array<string, mixed>>,
     *   pool_size: int,
     *   qualifying: int,
     * }
     */
    public function matchesFor(Gig $gig): array
    {
        $candidates = $this->candidatePool($gig);

        $qualifying = $candidates->filter(fn (CaregiverProfile $c) => $this->passesHardFilters($c, $gig));

        $scored = $qualifying->map(fn (CaregiverProfile $c) => $this->scoreCandidate($c, $gig))
            ->sortByDesc('match_score')
            ->take(self::MAX_RESULTS)
            ->values();

        return [
            'matches' => $scored->all(),
            'pool_size' => $candidates->count(),
            'qualifying' => $qualifying->count(),
        ];
    }

    /**
     * SQL-level narrowing. Anything we can express as a cheap database
     * predicate belongs here — PHP filtering is reserved for per-row
     * computation that can't ride along in the query.
     *
     * @return Collection<int, CaregiverProfile>
     */
    private function candidatePool(Gig $gig): Collection
    {
        return CaregiverProfile::query()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereHas('services', fn ($q) => $q->where('service_categories.id', $gig->service_category_id))
            ->whereHas('user', fn ($q) => $q->where('role', 'caregiver')->where('status', '!=', 'suspended'))
            ->with(['user.verificationRecords', 'services'])
            ->get();
    }

    private function passesHardFilters(CaregiverProfile $profile, Gig $gig): bool
    {
        /** @var User|null $user */
        $user = $profile->user;
        if (! $user) {
            return false;
        }

        if (! $this->isFullyVerified($user)) {
            return false;
        }

        if (! $this->withinTravelRadius($profile, $gig)) {
            return false;
        }

        if (! $this->rateWithinBudget($profile, $gig)) {
            return false;
        }

        if (! $this->genderMatches($user, $gig)) {
            return false;
        }

        if (! $this->languageMatches($profile, $gig)) {
            return false;
        }

        if (! $this->availableAt($profile, $gig)) {
            return false;
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function scoreCandidate(CaregiverProfile $profile, Gig $gig): array
    {
        $trust = $this->trust->breakdown($profile);
        $distanceKm = CaregiverGigResource::haversineKm(
            (float) $profile->latitude,
            (float) $profile->longitude,
            (float) $gig->latitude,
            (float) $gig->longitude,
        );

        $components = [
            'distance' => $this->distanceScore($distanceKm, $profile->travel_radius_km),
            'trust' => $trust['score'],
            'overlap' => $this->overlapScore($profile, $gig),
            'availability' => $this->availabilityFitScore($profile, $gig),
            'rate' => $this->rateAlignmentScore($profile, $gig),
        ];

        $weighted = 0;
        foreach (self::WEIGHTS as $key => $weight) {
            $weighted += $components[$key] * $weight;
        }
        $matchScore = (int) round($weighted / 100);

        return [
            'profile' => $profile,
            'distance_km' => round($distanceKm, 1),
            'match_score' => $matchScore,
            'match_components' => $components,
            'trust_components' => $trust['components'],
            'trust_is_new' => $trust['is_new'],
        ];
    }

    /* ──────────── hard filters ──────────── */

    private function isFullyVerified(User $user): bool
    {
        $clearedTypes = $user->verificationRecords
            ->whereIn('check_type', VerificationRecord::ALL_CHECK_TYPES)
            ->where('status', VerificationRecord::STATUS_CLEARED)
            ->pluck('check_type')
            ->unique();

        return $clearedTypes->count() === count(VerificationRecord::ALL_CHECK_TYPES);
    }

    private function withinTravelRadius(CaregiverProfile $profile, Gig $gig): bool
    {
        if (! $profile->latitude || ! $profile->longitude) {
            return false;
        }

        $km = CaregiverGigResource::haversineKm(
            (float) $profile->latitude,
            (float) $profile->longitude,
            (float) $gig->latitude,
            (float) $gig->longitude,
        );

        return $km <= (int) $profile->travel_radius_km;
    }

    private function rateWithinBudget(CaregiverProfile $profile, Gig $gig): bool
    {
        $rateMax = $gig->preferences['rate_max'] ?? null;
        if ($rateMax === null) {
            return true;
        }

        return (float) $profile->hourly_rate <= (float) $rateMax;
    }

    private function genderMatches(User $user, Gig $gig): bool
    {
        $required = $gig->preferences['gender'] ?? null;
        if ($required === null || $required === 'any') {
            return true;
        }

        return $user->gender === $required;
    }

    private function languageMatches(CaregiverProfile $profile, Gig $gig): bool
    {
        $required = $gig->preferences['language'] ?? null;
        if (! $required) {
            return true;
        }

        $spoken = collect($profile->languages ?? [])
            ->map(fn ($lang) => strtolower((string) $lang))
            ->all();

        return in_array(strtolower($required), $spoken, true);
    }

    /**
     * MVP rule: caregivers without an availability calendar are treated as
     * always available. When a calendar is set, we require the gig window
     * to sit inside one of that weekday's ranges. This matches the
     * onboarding fallback in ProfileCompletionService.
     *
     * Both sides are compared in the platform's operating timezone: gigs
     * are stored as UTC, caregivers set availability as local wall-clock
     * times ("08:00–17:00" means 8 a.m. local). MVP is Durham-only, so
     * hardcoding Toronto is correct; v1.2 expansion to BC/AB will need a
     * per-region lookup.
     */
    private function availableAt(CaregiverProfile $profile, Gig $gig): bool
    {
        $availability = $profile->availability;
        if (! is_array($availability) || $availability === []) {
            return true;
        }

        $weekly = $availability['weekly'] ?? null;
        if (! is_array($weekly) || $weekly === []) {
            return true;
        }

        $startLocal = $gig->scheduled_start->copy()->setTimezone(self::OPERATING_TIMEZONE);
        $endLocal = $gig->scheduled_end->copy()->setTimezone(self::OPERATING_TIMEZONE);

        $weekday = $this->weekdayKey($startLocal);
        $ranges = $weekly[$weekday] ?? null;
        if (! is_array($ranges) || $ranges === []) {
            return false;
        }

        $start = $this->minutesSinceMidnight($startLocal);
        $end = $this->minutesSinceMidnight($endLocal);

        foreach ($ranges as $range) {
            if (! is_array($range)) {
                continue;
            }
            $rangeStart = $this->parseMinutes($range['start'] ?? null);
            $rangeEnd = $this->parseMinutes($range['end'] ?? null);
            if ($rangeStart === null || $rangeEnd === null) {
                continue;
            }
            if ($start >= $rangeStart && $end <= $rangeEnd) {
                return true;
            }
        }

        return false;
    }

    /* ──────────── component scoring ──────────── */

    private function distanceScore(float $distanceKm, int $radiusKm): int
    {
        if ($radiusKm <= 0) {
            return 0;
        }
        // Linear falloff inside the radius. 0 km = 100, radius edge = 0.
        $ratio = 1 - min(1.0, $distanceKm / $radiusKm);

        return (int) round($ratio * 100);
    }

    private function overlapScore(CaregiverProfile $profile, Gig $gig): int
    {
        $languageSignal = $this->languageSignal($profile, $gig);
        $interestSignal = $this->interestSignal($profile, $gig);

        // 70% language (the more load-bearing comfort signal for seniors),
        // 30% interest overlap.
        return (int) round($languageSignal * 0.7 + $interestSignal * 0.3);
    }

    private function languageSignal(CaregiverProfile $profile, Gig $gig): int
    {
        $spoken = collect($profile->languages ?? [])
            ->map(fn ($lang) => strtolower((string) $lang));

        if ($spoken->isEmpty()) {
            return 50; // neutral — unknown languages shouldn't penalise hard
        }

        $required = $gig->preferences['language'] ?? null;
        if ($required && $spoken->contains(strtolower($required))) {
            return 100;
        }

        // Some language data is better than none.
        return 60;
    }

    private function interestSignal(CaregiverProfile $profile, Gig $gig): int
    {
        $caregiverInterests = collect($profile->interests ?? [])
            ->map(fn ($i) => strtolower((string) $i));

        // The MVP gig schema doesn't carry care-recipient interests in the
        // preferences blob yet; the care_recipient relation does. If we
        // can't read either, return a neutral 50.
        $recipient = $gig->careRecipient;
        $recipientList = $recipient !== null && is_array($recipient->interests)
            ? $recipient->interests
            : [];
        $recipientInterests = collect($recipientList)
            ->map(fn ($i) => strtolower((string) $i));

        if ($caregiverInterests->isEmpty() || $recipientInterests->isEmpty()) {
            return 50;
        }

        $overlap = $caregiverInterests->intersect($recipientInterests)->count();
        $max = max(1, $recipientInterests->count());

        return (int) round(min(1.0, $overlap / $max) * 100);
    }

    /**
     * Phase 6 placeholder at a neutral 80. Phase 7/8 will swap this for
     * booking-adjacency + weekly-hours logic once those tables exist.
     */
    private function availabilityFitScore(CaregiverProfile $profile, Gig $gig): int
    {
        if (empty($profile->availability)) {
            return 60;
        }

        return 80;
    }

    private function rateAlignmentScore(CaregiverProfile $profile, Gig $gig): int
    {
        $rateMax = $gig->preferences['rate_max'] ?? null;
        $rate = (float) $profile->hourly_rate;

        if ($rateMax === null) {
            return 80; // no budget signal — neutral-positive
        }

        $budget = (float) $rateMax;
        if ($budget <= 0) {
            return 0;
        }

        // Exact-budget caregivers score 100; under-budget keeps 100 + no penalty
        // because the family already signalled willingness to pay more; rate
        // over budget would already have been eliminated by the hard filter.
        if ($rate <= $budget) {
            $headroom = ($budget - $rate) / $budget;

            // Gentle nudge: a caregiver burning far less than budget gets
            // slightly higher marks since families typically appreciate value.
            return (int) round(90 + min(10.0, $headroom * 10));
        }

        return 0;
    }

    /* ──────────── helpers ──────────── */

    private function weekdayKey(CarbonInterface $time): string
    {
        // Carbon ->format('D') returns Mon, Tue, ... We want mon, tue, ...
        return strtolower($time->format('D'));
    }

    private function minutesSinceMidnight(CarbonInterface $time): int
    {
        return $time->hour * 60 + $time->minute;
    }

    private function parseMinutes(?string $hhmm): ?int
    {
        if (! $hhmm || ! preg_match('/^(\d{1,2}):(\d{2})$/', $hhmm, $m)) {
            return null;
        }
        $h = (int) $m[1];
        $mn = (int) $m[2];
        if ($h < 0 || $h > 24 || $mn < 0 || $mn > 59) {
            return null;
        }

        return $h * 60 + $mn;
    }
}
