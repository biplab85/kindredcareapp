<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\User;
use App\Notifications\BookingCancelled;
use App\Notifications\BookingConfirmed;
use App\Notifications\BookingDeclined;
use App\Notifications\BookingExpired;
use App\Notifications\BookingOffered;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * State machine for Phase 7 booking lifecycle.
 *
 *   pending_caregiver
 *        │
 *   ┌────┼────────────────────────┐
 *   ▼    ▼                        ▼
 *  confirmed  declined/expired  cancelled_by_family
 *        │         │
 *        │         └─► cascade → next caregiver (new pending_caregiver)
 *        ▼
 *   in_progress  (Phase 8 check-in transitions here)
 *        │
 *        ▼
 *   completed    (Phase 8 check-out)
 *
 * Payment transitions are stub-only until Phase 9 swaps in Stripe. The
 * state machine here is deliberately the same shape so nothing but the
 * adapter needs to change later.
 */
class BookingService
{
    /**
     * Create the first booking in a cascade from the Phase 6 matches list.
     *
     * @param  array<int, int>  $rankedCaregiverIds  user_ids in rank order,
     *                                               starting with the one being booked first.
     *
     * @throws ValidationException
     */
    public function createFromMatch(
        Gig $gig,
        FamilyProfile $family,
        int $caregiverUserId,
        array $rankedCaregiverIds,
    ): Booking {
        $this->assertFamilyOwnsGig($gig, $family);
        $this->assertGigIsBookable($gig);
        $this->assertNoActiveBookingForGig($gig);

        $rank = $this->rankOf($caregiverUserId, $rankedCaregiverIds);
        $remainingQueue = $this->queueAfter($caregiverUserId, $rankedCaregiverIds);

        return DB::transaction(function () use ($gig, $family, $caregiverUserId, $rank, $remainingQueue) {
            $booking = $this->spawnOffer(
                gig: $gig,
                family: $family,
                caregiverUserId: $caregiverUserId,
                matchRank: $rank,
                fallbackQueue: $remainingQueue,
            );

            if ($gig->status === Gig::STATUS_OPEN) {
                $gig->update(['status' => Gig::STATUS_MATCHED]);
            }

            $this->notifyCaregiverOfOffer($booking);

            return $booking;
        });
    }

    public function accept(Booking $booking, User $actor): Booking
    {
        $this->assertCaregiverOwnsBooking($booking, $actor);

        if (! $booking->isPending()) {
            throw ValidationException::withMessages([
                'status' => 'This offer is no longer pending.',
            ]);
        }

        if ($booking->isExpired()) {
            // Block rather than silently re-open; the scheduler will clean up.
            throw ValidationException::withMessages([
                'status' => 'This offer has expired.',
            ]);
        }

        return DB::transaction(function () use ($booking) {
            $booking->update([
                'status' => Booking::STATUS_CONFIRMED,
                'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
                'responded_at' => now(),
            ]);

            $booking->gig->update(['status' => Gig::STATUS_BOOKED]);

            $this->notifyFamilyOfConfirmation($booking->fresh(['gig.serviceCategory', 'caregiver']));

            return $booking->fresh();
        });
    }

    /**
     * Caregiver declines. Cascades to the next-ranked caregiver if any
     * remain; otherwise the gig returns to matched/open and the family is
     * told the search continues.
     */
    public function decline(Booking $booking, User $actor, ?string $reason = null): ?Booking
    {
        $this->assertCaregiverOwnsBooking($booking, $actor);

        if (! $booking->isPending()) {
            throw ValidationException::withMessages([
                'status' => 'This offer is no longer pending.',
            ]);
        }

        return DB::transaction(function () use ($booking, $reason) {
            $this->closeOffer($booking, Booking::STATUS_DECLINED, $reason);

            return $this->cascadeToNext($booking->fresh(), 'declined');
        });
    }

    /**
     * Called by the scheduler for any offer whose deadline has passed.
     * Same cascade behaviour as decline, but with closing status=expired.
     */
    public function expireOffer(Booking $booking): ?Booking
    {
        if (! $booking->isPending()) {
            return null;
        }

        return DB::transaction(function () use ($booking) {
            $this->closeOffer($booking, Booking::STATUS_EXPIRED, 'Offer window elapsed.');

            return $this->cascadeToNext($booking->fresh(), 'expired');
        });
    }

    /**
     * Cancel a pending or confirmed booking.
     *
     * - Family cancelling <24h before start = no refund (fee retained stub).
     * - Caregiver cancelling a confirmed booking always releases the auth.
     */
    public function cancel(Booking $booking, User $actor, ?string $reason = null): Booking
    {
        if (! $booking->isCancellable()) {
            throw ValidationException::withMessages([
                'status' => 'This booking cannot be cancelled from its current state.',
            ]);
        }

        $byFamily = $this->actorIsFamilyOwner($booking, $actor);
        $byCaregiver = $actor->id === $booking->caregiver_user_id;

        if (! $byFamily && ! $byCaregiver) {
            throw ValidationException::withMessages([
                'status' => 'You are not a party to this booking.',
            ]);
        }

        $status = $byFamily ? Booking::STATUS_CANCELLED_FAMILY : Booking::STATUS_CANCELLED_CAREGIVER;
        $by = $byFamily ? Booking::CANCELLED_BY_FAMILY : Booking::CANCELLED_BY_CAREGIVER;

        $feeRetained = $byFamily && $this->insideFreeCancelWindow($booking);

        return DB::transaction(function () use ($booking, $status, $by, $reason, $feeRetained) {
            $booking->update([
                'status' => $status,
                'cancelled_at' => now(),
                'cancelled_by' => $by,
                'cancellation_reason' => $reason,
                'payment_status' => $this->cancelledPaymentStatus($booking, $feeRetained),
            ]);

            // Returning the gig to OPEN lets the family re-run matching or
            // book a different caregiver. MVP keeps the gig around so all
            // history is visible in the family dashboard.
            $gig = $booking->gig;
            if (in_array($gig->status, [Gig::STATUS_MATCHED, Gig::STATUS_BOOKED], true)) {
                $gig->update(['status' => Gig::STATUS_OPEN]);
            }

            $this->notifyCancellation($booking->fresh(['gig.serviceCategory', 'caregiver', 'familyProfile.user']), $by);

            return $booking->fresh();
        });
    }

    /* ──────────── helpers ──────────── */

    /**
     * @param  array<int, int>  $fallbackQueue
     */
    private function spawnOffer(
        Gig $gig,
        FamilyProfile $family,
        int $caregiverUserId,
        int $matchRank,
        array $fallbackQueue,
    ): Booking {
        $caregiver = $this->loadCaregiver($caregiverUserId);
        $rateCents = $this->centsFromRate($caregiver->hourly_rate);
        $minutes = $this->durationMinutes($gig);
        [$subtotal, $fee, $payout] = $this->priceBreakdown($rateCents, $minutes);

        /** @var Booking $booking */
        $booking = Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiverUserId,
            'family_profile_id' => $family->id,
            'match_rank' => $matchRank,
            'fallback_queue' => $fallbackQueue,
            'status' => Booking::STATUS_PENDING_CAREGIVER,
            'payment_status' => Booking::PAYMENT_NOT_REQUIRED,
            'hourly_rate_cents' => $rateCents,
            'duration_minutes' => $minutes,
            'subtotal_cents' => $subtotal,
            'platform_fee_cents' => $fee,
            'caregiver_payout_cents' => $payout,
            'scheduled_start' => $gig->scheduled_start,
            'scheduled_end' => $gig->scheduled_end,
            'address_full' => $gig->location_address,
            'address_neighbourhood' => $this->neighbourhoodFor($gig),
            'response_deadline_at' => $this->computeResponseDeadline($gig),
        ]);

        return $booking;
    }

    private function cascadeToNext(Booking $closed, string $previousOutcome): ?Booking
    {
        $queue = $closed->fallback_queue ?? [];

        while ($queue !== []) {
            $next = (int) array_shift($queue);

            if ($next === $closed->caregiver_user_id) {
                continue;
            }

            try {
                $caregiver = $this->loadCaregiver($next);
            } catch (ModelNotFoundException) {
                continue;
            }

            $newBooking = $this->spawnOffer(
                gig: $closed->gig,
                family: $closed->familyProfile,
                caregiverUserId: $caregiver->user_id,
                matchRank: $closed->match_rank + 1,
                fallbackQueue: $queue,
            );

            if ($closed->gig->status === Gig::STATUS_OPEN) {
                $closed->gig->update(['status' => Gig::STATUS_MATCHED]);
            }

            $this->notifyCaregiverOfOffer($newBooking);
            $this->notifyFamilyOfDecline($closed->fresh(['gig.serviceCategory', 'caregiver']), $previousOutcome, $newBooking);

            return $newBooking;
        }

        // Nothing left to try — unwind gig state and tell the family.
        if ($closed->gig->status === Gig::STATUS_MATCHED) {
            $closed->gig->update(['status' => Gig::STATUS_OPEN]);
        }

        $this->notifyFamilyOfExhaustion($closed->fresh(['gig.serviceCategory', 'caregiver']), $previousOutcome);

        return null;
    }

    private function closeOffer(Booking $booking, string $closingStatus, ?string $reason): void
    {
        $booking->update([
            'status' => $closingStatus,
            'responded_at' => now(),
            'cancellation_reason' => $reason,
        ]);
    }

    private function computeResponseDeadline(Gig $gig): CarbonImmutable
    {
        $now = CarbonImmutable::now();
        $hoursUntilStart = $now->diffInHours($gig->scheduled_start, absolute: false);

        if ($hoursUntilStart <= Booking::ON_DEMAND_THRESHOLD_HOURS) {
            return $now->addMinutes(Booking::RESPONSE_WINDOW_ON_DEMAND_MINUTES);
        }

        $scheduledDeadline = $now->addHours(Booking::RESPONSE_WINDOW_SCHEDULED_HOURS);

        // Never extend past the gig start itself.
        return $scheduledDeadline->greaterThan($gig->scheduled_start)
            ? CarbonImmutable::instance($gig->scheduled_start)
            : $scheduledDeadline;
    }

    private function durationMinutes(Gig $gig): int
    {
        return (int) max(0, $gig->scheduled_start->diffInMinutes($gig->scheduled_end, absolute: true));
    }

    private function centsFromRate(string|float|int $rate): int
    {
        return (int) round(((float) $rate) * 100);
    }

    /**
     * @return array{0:int,1:int,2:int} [subtotal, platform_fee, caregiver_payout]
     */
    private function priceBreakdown(int $rateCents, int $minutes): array
    {
        $subtotal = (int) round($rateCents * $minutes / 60);
        $fee = (int) round($subtotal * Booking::PLATFORM_FEE_BPS / 10000);
        $payout = $subtotal - $fee;

        return [$subtotal, $fee, $payout];
    }

    private function neighbourhoodFor(Gig $gig): string
    {
        // MVP: the location_address already includes the city; for the
        // caregiver-facing placeholder we just strip the street. Anything
        // beyond this is Mapbox reverse-geocoding territory (v1.1).
        $parts = array_map('trim', explode(',', $gig->location_address));
        if (count($parts) >= 2) {
            return implode(', ', array_slice($parts, 1));
        }

        return 'Durham Region';
    }

    private function loadCaregiver(int $userId): CaregiverProfile
    {
        return CaregiverProfile::query()
            ->where('user_id', $userId)
            ->with('user')
            ->firstOrFail();
    }

    /**
     * @param  array<int, int>  $rankedCaregiverIds
     */
    private function rankOf(int $caregiverUserId, array $rankedCaregiverIds): int
    {
        $idx = array_search($caregiverUserId, $rankedCaregiverIds, true);

        return $idx === false ? 1 : ($idx + 1);
    }

    /**
     * @param  array<int, int>  $rankedCaregiverIds
     * @return array<int, int>
     */
    private function queueAfter(int $caregiverUserId, array $rankedCaregiverIds): array
    {
        $idx = array_search($caregiverUserId, $rankedCaregiverIds, true);
        if ($idx === false) {
            return [];
        }

        return array_slice($rankedCaregiverIds, $idx + 1);
    }

    private function insideFreeCancelWindow(Booking $booking): bool
    {
        return now()->diffInHours($booking->scheduled_start, absolute: false) < Booking::FAMILY_FREE_CANCEL_HOURS;
    }

    private function cancelledPaymentStatus(Booking $booking, bool $feeRetained): string
    {
        if ($booking->payment_status === Booking::PAYMENT_NOT_REQUIRED) {
            return Booking::PAYMENT_NOT_REQUIRED;
        }

        return $feeRetained
            ? Booking::PAYMENT_CAPTURED_STUB  // inside <24h: family forfeits the fee
            : Booking::PAYMENT_RELEASED_STUB;
    }

    private function assertFamilyOwnsGig(Gig $gig, FamilyProfile $family): void
    {
        if ($gig->family_profile_id !== $family->id) {
            throw ValidationException::withMessages([
                'gig_id' => 'This gig does not belong to your family profile.',
            ]);
        }
    }

    private function assertGigIsBookable(Gig $gig): void
    {
        if (! in_array($gig->status, [Gig::STATUS_OPEN, Gig::STATUS_MATCHED], true)) {
            throw ValidationException::withMessages([
                'gig_id' => 'This gig is no longer open for booking.',
            ]);
        }

        if ($gig->scheduled_start->isPast()) {
            throw ValidationException::withMessages([
                'gig_id' => 'This gig has already started or finished.',
            ]);
        }
    }

    private function assertNoActiveBookingForGig(Gig $gig): void
    {
        $exists = Booking::query()
            ->where('gig_id', $gig->id)
            ->active()
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'gig_id' => 'This gig already has a booking in progress.',
            ]);
        }
    }

    private function assertCaregiverOwnsBooking(Booking $booking, User $actor): void
    {
        if ($actor->id !== $booking->caregiver_user_id) {
            throw ValidationException::withMessages([
                'status' => 'You are not the caregiver on this booking.',
            ]);
        }
    }

    private function actorIsFamilyOwner(Booking $booking, User $actor): bool
    {
        $profile = $actor->familyProfile;

        return $profile !== null && $profile->id === $booking->family_profile_id;
    }

    /* ──────────── notifications ──────────── */

    private function notifyCaregiverOfOffer(Booking $booking): void
    {
        $booking->caregiver->notify(new BookingOffered($booking));
    }

    private function notifyFamilyOfConfirmation(Booking $booking): void
    {
        $this->familyUserFor($booking)->notify(new BookingConfirmed($booking));
    }

    private function notifyFamilyOfDecline(Booking $closed, string $outcome, Booking $nextBooking): void
    {
        $this->familyUserFor($closed)->notify(new BookingDeclined($closed, $outcome, $nextBooking));
    }

    private function notifyFamilyOfExhaustion(Booking $closed, string $outcome): void
    {
        $this->familyUserFor($closed)->notify(new BookingExpired($closed, $outcome));
    }

    private function notifyCancellation(Booking $booking, string $cancelledBy): void
    {
        if ($cancelledBy === Booking::CANCELLED_BY_FAMILY) {
            $booking->caregiver->notify(new BookingCancelled($booking, $cancelledBy));

            return;
        }

        $this->familyUserFor($booking)->notify(new BookingCancelled($booking, $cancelledBy));
    }

    /**
     * Family profile → user resolution with a safety net: if the caller
     * didn't eager-load the profile, we fetch it explicitly. Cascade-delete
     * on the FK guarantees the row exists while the booking does.
     */
    private function familyUserFor(Booking $booking): User
    {
        $profile = $booking->relationLoaded('familyProfile') && $booking->familyProfile->relationLoaded('user')
            ? $booking->familyProfile
            : FamilyProfile::query()->with('user')->findOrFail($booking->family_profile_id);

        return $profile->user;
    }
}
