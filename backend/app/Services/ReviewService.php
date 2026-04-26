<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Review;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * State machine for Phase 11 post-visit reviews.
 *
 *   submitted (visible_at = null)
 *        │
 *   ┌────┴──────────────────────────┐
 *   │                               │
 *   counterparty                    7 days since
 *   also rated                      booking.check_out_at
 *   (mutual-rated)                  (time-released)
 *        │                               │
 *        └──────────► visible_at = now ◄─┘
 *
 *   Hidden (admin-set) short-circuits visibility regardless.
 *   Flagged (user-set) queues for admin review but stays visible.
 */
class ReviewService
{
    /** How long until an un-mutual-rated review surfaces on its own. */
    public const SURFACE_AFTER_DAYS = 7;

    /**
     * Submit a review. Caller is whichever party is on the booking.
     *
     * @throws ValidationException
     */
    public function submit(Booking $booking, User $rater, int $stars, ?string $body = null): Review
    {
        $this->assertRaterIsParty($booking, $rater);
        $this->assertBookingCompleted($booking);

        if ($stars < 1 || $stars > 5) {
            throw ValidationException::withMessages([
                'stars' => 'Rating must be between 1 and 5.',
            ]);
        }

        $rateeId = $this->rateeFor($booking, $rater);

        return DB::transaction(function () use ($booking, $rater, $rateeId, $stars, $body) {
            $existing = Review::query()
                ->where('booking_id', $booking->id)
                ->where('rater_user_id', $rater->id)
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'status' => 'You have already reviewed this visit.',
                ]);
            }

            /** @var Review $review */
            $review = Review::create([
                'booking_id' => $booking->id,
                'rater_user_id' => $rater->id,
                'ratee_user_id' => $rateeId,
                'stars' => $stars,
                'body' => $body,
                'submitted_at' => now(),
            ]);

            // Mutual-rated surfaces immediately. We also flip the
            // counterparty's review to visible on the spot so they don't
            // have to wait for the next scheduler tick.
            $counterpartyReview = Review::query()
                ->where('booking_id', $booking->id)
                ->where('ratee_user_id', $rater->id)
                ->first();

            if ($counterpartyReview) {
                $review->update(['visible_at' => now()]);
                if ($counterpartyReview->visible_at === null) {
                    $counterpartyReview->update(['visible_at' => now()]);
                }
            }

            return $review->fresh();
        });
    }

    /**
     * Flag a review for admin review. Either party on the booking can flag
     * their own or the counterparty's review; the other party is also
     * eligible (the ratee should be able to flag a review about them).
     */
    public function flag(Review $review, User $reporter, string $reason): Review
    {
        $booking = $review->booking;
        $this->assertRaterIsParty($booking, $reporter);

        if (! in_array($reason, Review::FLAG_REASONS, true)) {
            throw ValidationException::withMessages([
                'flag_reason' => 'Unknown flag reason.',
            ]);
        }

        if ($review->flagged_at !== null) {
            // Idempotent — subsequent flags just update the reason so admin
            // sees the latest complaint rationale.
            $review->update(['flag_reason' => $reason]);

            return $review->fresh();
        }

        $review->update([
            'flagged_at' => now(),
            'flagged_by_user_id' => $reporter->id,
            'flag_reason' => $reason,
        ]);

        return $review->fresh();
    }

    /**
     * Surface any submitted-but-still-hidden reviews whose 7-day grace
     * period has elapsed. Called from the ReleaseVisibleReviews scheduler.
     *
     * @return int number of reviews flipped visible
     */
    public function releaseTimeBasedVisibility(): int
    {
        $cutoff = now()->subDays(self::SURFACE_AFTER_DAYS);

        return Review::query()
            ->whereNull('visible_at')
            ->whereNull('hidden_at')
            ->where('submitted_at', '<=', $cutoff)
            ->update(['visible_at' => now()]);
    }

    /* ──────────── guards ──────────── */

    private function assertRaterIsParty(Booking $booking, User $actor): void
    {
        $isCaregiver = $actor->id === $booking->caregiver_user_id;
        $familyProfile = $actor->familyProfile;
        $isFamily = $familyProfile !== null && $familyProfile->id === $booking->family_profile_id;

        if (! $isCaregiver && ! $isFamily) {
            throw ValidationException::withMessages([
                'status' => 'You are not a party to this booking.',
            ]);
        }
    }

    private function assertBookingCompleted(Booking $booking): void
    {
        if (! $booking->isCompleted()) {
            throw ValidationException::withMessages([
                'status' => 'Reviews can only be submitted on completed visits.',
            ]);
        }
    }

    private function rateeFor(Booking $booking, User $rater): int
    {
        if ($rater->id === $booking->caregiver_user_id) {
            // Caregiver rates the family — find the family profile's user_id.
            $booking->loadMissing('familyProfile');

            return (int) $booking->familyProfile->user_id;
        }

        // Family rates the caregiver.
        return $booking->caregiver_user_id;
    }
}
