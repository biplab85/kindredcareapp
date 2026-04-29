<?php

namespace App\Services;

use App\Http\Resources\CaregiverGigResource;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\User;
use App\Notifications\BookingCancelled;
use App\Notifications\BookingCheckedIn;
use App\Notifications\BookingConfirmed;
use App\Notifications\BookingExpired;
use App\Notifications\BookingOffered;
use App\Notifications\VisitCompleted;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
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
    public function __construct(private readonly StripePaymentService $stripe) {}

    /**
     * Family books a chosen gig. Visit specifics (date/time, address,
     * recipient, notes) come from the family at booking time; the rate
     * is locked from the gig at this moment so later edits to the gig
     * don't change the price the family agreed to.
     *
     * @throws ValidationException
     */
    public function createFromGig(
        Gig $gig,
        FamilyProfile $family,
        int $careRecipientId,
        CarbonImmutable $scheduledStart,
        int $durationMinutes,
        string $addressFull,
        string $addressNeighbourhood,
        ?string $notesFromFamily = null,
    ): Booking {
        $this->assertGigIsBookable($gig);

        return DB::transaction(function () use (
            $gig,
            $family,
            $careRecipientId,
            $scheduledStart,
            $durationMinutes,
            $addressFull,
            $addressNeighbourhood,
            $notesFromFamily,
        ) {
            $booking = $this->spawnOffer(
                gig: $gig,
                family: $family,
                caregiverUserId: $gig->caregiverProfile->user_id,
                careRecipientId: $careRecipientId,
                scheduledStart: $scheduledStart,
                durationMinutes: $durationMinutes,
                addressFull: $addressFull,
                addressNeighbourhood: $addressNeighbourhood,
                notesFromFamily: $notesFromFamily,
            );

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
            // Try the real authorization. If Stripe isn't configured, or the
            // family hasn't attached a method yet, authorize() returns null
            // and we fall through to the stub channel — same shape as Phase 7.
            $intent = $this->stripe->authorizeForBooking($booking->loadMissing('familyProfile.user'));

            $booking->update([
                'status' => Booking::STATUS_CONFIRMED,
                'payment_status' => $intent
                    ? Booking::PAYMENT_AUTHORIZED
                    : Booking::PAYMENT_AUTHORIZED_STUB,
                'stripe_payment_intent_id' => $intent?->id,
                'responded_at' => now(),
            ]);

            // Gig listing status is independent of any individual booking
            // (multiple families may book the same gig at different times).
            // The gig stays "published" regardless.

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
     * Caregiver check-in — moves the booking into an active visit. GPS
     * coordinates are captured once and distance-from-gig is frozen so the
     * anomaly check at check-out doesn't need to recompute haversine twice.
     * A check-in farther than FLAG_RADIUS drops the booking into the admin
     * review queue but still transitions (the visit is happening, after all).
     */
    public function checkIn(Booking $booking, User $actor, float $lat, float $lng): Booking
    {
        $this->assertCaregiverOwnsBooking($booking, $actor);

        if (! $booking->isConfirmed()) {
            throw ValidationException::withMessages([
                'status' => 'Check-in is only available for confirmed bookings.',
            ]);
        }

        $booking->loadMissing('gig');
        $distanceM = $this->metersFromGig($booking, $lat, $lng);

        return DB::transaction(function () use ($booking, $lat, $lng, $distanceM) {
            $booking->update([
                'status' => Booking::STATUS_IN_PROGRESS,
                'check_in_at' => now(),
                'check_in_lat' => $lat,
                'check_in_lng' => $lng,
                'check_in_distance_m' => $distanceM,
            ]);

            $this->evaluateAnomalyFlags($booking->fresh());

            $fresh = $booking->fresh(['gig.serviceCategory', 'caregiver', 'familyProfile.user']);
            $this->familyUserFor($fresh)->notify(new BookingCheckedIn($fresh));

            return $fresh;
        });
    }

    /**
     * Caregiver check-out — closes the visit, captures the stub payment, and
     * accepts the final task list + notes in the same call so the visit
     * summary is atomic (no half-complete rows).
     *
     * @param  array<int, string>  $tasks
     */
    public function checkOut(
        Booking $booking,
        User $actor,
        float $lat,
        float $lng,
        array $tasks = [],
        ?string $notes = null,
    ): Booking {
        $this->assertCaregiverOwnsBooking($booking, $actor);

        if (! $booking->isInProgress()) {
            throw ValidationException::withMessages([
                'status' => 'Check-out requires an in-progress visit.',
            ]);
        }

        $booking->loadMissing('gig');
        $distanceM = $this->metersFromGig($booking, $lat, $lng);

        return DB::transaction(function () use ($booking, $lat, $lng, $distanceM, $tasks, $notes) {
            $completedAt = now();

            // Partial-capture support: if actual duration is shorter than the
            // booked duration, capture only the pro-rated amount. mvp-reqs
            // §4.9 — "handle partial captures if visit was shorter than booked".
            $captureAmount = $this->computeCaptureAmount($booking, $completedAt);

            $booking->update([
                'status' => Booking::STATUS_COMPLETED,
                'check_out_at' => $completedAt,
                'check_out_lat' => $lat,
                'check_out_lng' => $lng,
                'check_out_distance_m' => $distanceM,
                'tasks_completed' => $tasks === [] ? $booking->tasks_completed : $tasks,
                'caregiver_notes' => $notes ?? $booking->caregiver_notes,
            ]);

            $captured = $this->stripe->captureForBooking($booking->fresh(), $captureAmount);
            $booking->update([
                'payment_status' => $captured
                    ? Booking::PAYMENT_CAPTURED
                    : Booking::PAYMENT_CAPTURED_STUB,
                // 24-hour hold before the caregiver payout is released.
                // The ReleasePayouts command polls this timestamp.
                'payout_at' => now()->addHours(Booking::PAYOUT_HOLD_HOURS),
            ]);

            $this->evaluateAnomalyFlags($booking->fresh());

            $fresh = $booking->fresh(['gig.serviceCategory', 'caregiver', 'familyProfile.user']);
            $fresh->caregiver->notify(new VisitCompleted($fresh, forFamily: false));
            $this->familyUserFor($fresh)->notify(new VisitCompleted($fresh, forFamily: true));

            return $fresh;
        });
    }

    /**
     * No-show path — caregiver failed to check in within the threshold
     * after scheduled_start. Called from the HandleNoShows command.
     * Releases the authorization (family isn't charged) and returns the
     * gig to open so the family can re-match.
     */
    public function markNoShow(Booking $booking): ?Booking
    {
        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            return null;
        }

        $threshold = $booking->scheduled_start->copy()->addMinutes(Booking::NO_SHOW_THRESHOLD_MINUTES);
        if (now()->lessThan($threshold)) {
            return null;
        }

        return DB::transaction(function () use ($booking) {
            $this->stripe->cancelAuthorization($booking);

            $booking->update([
                'status' => Booking::STATUS_NO_SHOW,
                'payment_status' => $booking->stripe_payment_intent_id
                    ? Booking::PAYMENT_RELEASED
                    : Booking::PAYMENT_RELEASED_STUB,
                'cancelled_at' => now(),
                'cancelled_by' => Booking::CANCELLED_BY_SYSTEM,
                'cancellation_reason' => 'Caregiver did not check in within '.Booking::NO_SHOW_THRESHOLD_MINUTES.' minutes of the scheduled start.',
            ]);

            // No gig-status mutation under the Fiverr direction — the
            // gig listing remains published; only the booking moves to
            // no-show.

            // Phase 12 will add real notifications for no-show; for now
            // we just lean on the existing cancelled notification so both
            // parties hear about it.
            $this->notifyCancellation(
                $booking->fresh(['gig.serviceCategory', 'caregiver', 'familyProfile.user']),
                Booking::CANCELLED_BY_SYSTEM,
            );

            return $booking->fresh();
        });
    }

    /**
     * Family opens a dispute on a completed booking. Freezes the payment
     * (relevant once the 24-hour payout hold from 9.2 is in place) and
     * creates the dispute row that admin will resolve.
     *
     * @param  array<int, string>  $evidencePaths
     */
    public function openDispute(
        Booking $booking,
        User $reporter,
        string $reasonCode,
        string $description,
        array $evidencePaths = [],
    ): BookingDispute {
        if (! $this->actorIsFamilyOwner($booking, $reporter)) {
            throw ValidationException::withMessages([
                'reporter' => 'Only the family that booked the visit can open a dispute.',
            ]);
        }

        if (! $booking->isCompleted()) {
            throw ValidationException::withMessages([
                'status' => 'Disputes can only be opened on completed visits.',
            ]);
        }

        $deadline = $booking->check_out_at?->copy()->addHours(Booking::DISPUTE_WINDOW_HOURS);
        if (! $deadline || now()->greaterThan($deadline)) {
            throw ValidationException::withMessages([
                'status' => 'The '.Booking::DISPUTE_WINDOW_HOURS.'-hour dispute window has closed for this visit.',
            ]);
        }

        if (! in_array($reasonCode, BookingDispute::REASON_CODES, true)) {
            throw ValidationException::withMessages([
                'reason_code' => 'Unknown dispute reason.',
            ]);
        }

        return DB::transaction(function () use ($booking, $reporter, $reasonCode, $description, $evidencePaths) {
            /** @var BookingDispute $dispute */
            $dispute = BookingDispute::create([
                'booking_id' => $booking->id,
                'reporter_user_id' => $reporter->id,
                'reason_code' => $reasonCode,
                'description' => $description,
                'evidence_paths' => $evidencePaths === [] ? null : $evidencePaths,
                'status' => BookingDispute::STATUS_OPEN,
            ]);

            $booking->update([
                'payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE,
                // Cancels any pending payout — the ReleasePayouts command
                // also skips disputed bookings, but nulling this makes it
                // explicit in the data.
                'payout_at' => null,
            ]);

            // Notification hookup is deferred to Phase 14 (admin dashboard)
            // where the dispute queue surfaces; here we just persist.

            return $dispute;
        });
    }

    /**
     * Intermediate task-log update during an active visit. No status change
     * and no payment side-effects — purely a receipt of progress.
     *
     * @param  array<int, string>  $tasks
     */
    public function logTasks(Booking $booking, User $actor, array $tasks, ?string $notes): Booking
    {
        $this->assertCaregiverOwnsBooking($booking, $actor);

        if (! $booking->isInProgress()) {
            throw ValidationException::withMessages([
                'status' => 'Tasks can only be logged during an in-progress visit.',
            ]);
        }

        $booking->update([
            'tasks_completed' => $tasks,
            'caregiver_notes' => $notes,
        ]);

        return $booking->fresh();
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
            // Sync the Stripe side first — fee-retained cancels capture
            // (full amount kept by platform), free cancels release the auth.
            if ($feeRetained) {
                $this->stripe->captureForBooking($booking);
            } else {
                $this->stripe->cancelAuthorization($booking);
            }

            $booking->update([
                'status' => $status,
                'cancelled_at' => now(),
                'cancelled_by' => $by,
                'cancellation_reason' => $reason,
                'payment_status' => $this->cancelledPaymentStatus($booking, $feeRetained),
            ]);

            // Gig listing status is independent of bookings under the
            // Fiverr direction — the listing stays "published" so other
            // families can still book it.

            $this->notifyCancellation($booking->fresh(['gig.serviceCategory', 'caregiver', 'familyProfile.user']), $by);

            return $booking->fresh();
        });
    }

    /* ──────────── helpers ──────────── */

    private function spawnOffer(
        Gig $gig,
        FamilyProfile $family,
        int $caregiverUserId,
        int $careRecipientId,
        CarbonImmutable $scheduledStart,
        int $durationMinutes,
        string $addressFull,
        string $addressNeighbourhood,
        ?string $notesFromFamily,
    ): Booking {
        $rateCents = (int) $gig->hourly_rate_cents;
        [$subtotal, $fee, $payout] = $this->priceBreakdown($rateCents, $durationMinutes);
        $scheduledEnd = $scheduledStart->addMinutes($durationMinutes);

        /** @var Booking $booking */
        $booking = Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiverUserId,
            'family_profile_id' => $family->id,
            'care_recipient_id' => $careRecipientId,
            'notes_from_family' => $notesFromFamily,
            // Match rank + fallback queue are legacy fields from the
            // shortlist flow. Nothing populates them under the Fiverr
            // direction; default to rank 1 with an empty queue so the
            // existing decline/expire path doesn't try to cascade.
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_PENDING_CAREGIVER,
            'payment_status' => Booking::PAYMENT_NOT_REQUIRED,
            'hourly_rate_cents' => $rateCents,
            'duration_minutes' => $durationMinutes,
            'subtotal_cents' => $subtotal,
            'platform_fee_cents' => $fee,
            'caregiver_payout_cents' => $payout,
            'scheduled_start' => $scheduledStart,
            'scheduled_end' => $scheduledEnd,
            'address_full' => $addressFull,
            'address_neighbourhood' => $addressNeighbourhood,
            'response_deadline_at' => $this->computeResponseDeadline($scheduledStart),
        ]);

        return $booking;
    }

    private function cascadeToNext(Booking $closed, string $previousOutcome): ?Booking
    {
        // Under the Fiverr direction the marketplace browse doesn't
        // produce a ranked queue, so a declined or expired booking
        // doesn't cascade to a fallback caregiver — the family simply
        // picks a different gig from the marketplace. Notify and stop.
        $this->notifyFamilyOfExhaustion(
            $closed->fresh(['gig.serviceCategory', 'caregiver']),
            $previousOutcome,
        );

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

    private function computeResponseDeadline(CarbonImmutable $scheduledStart): CarbonImmutable
    {
        $now = CarbonImmutable::now();
        $hoursUntilStart = $now->diffInHours($scheduledStart, absolute: false);

        if ($hoursUntilStart <= Booking::ON_DEMAND_THRESHOLD_HOURS) {
            return $now->addMinutes(Booking::RESPONSE_WINDOW_ON_DEMAND_MINUTES);
        }

        $scheduledDeadline = $now->addHours(Booking::RESPONSE_WINDOW_SCHEDULED_HOURS);

        // Never extend past the visit start itself.
        return $scheduledDeadline->greaterThan($scheduledStart) ? $scheduledStart : $scheduledDeadline;
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

    private function insideFreeCancelWindow(Booking $booking): bool
    {
        return now()->diffInHours($booking->scheduled_start, absolute: false) < Booking::FAMILY_FREE_CANCEL_HOURS;
    }

    /**
     * Actual vs booked duration → pro-rated capture in cents. Short-visit
     * cases (mvp-reqs §4.9) capture less than the full authorization.
     * Longer-than-booked is capped at subtotal_cents — we don't charge
     * families for over-stay without re-authorization.
     */
    private function computeCaptureAmount(Booking $booking, CarbonInterface $completedAt): int
    {
        if (! $booking->check_in_at || $booking->duration_minutes <= 0) {
            return $booking->subtotal_cents;
        }

        $actualMinutes = (int) $booking->check_in_at->diffInMinutes($completedAt, absolute: true);
        if ($actualMinutes >= $booking->duration_minutes) {
            return $booking->subtotal_cents;
        }

        return (int) round($booking->hourly_rate_cents * $actualMinutes / 60);
    }

    private function metersFromGig(Booking $booking, float $lat, float $lng): int
    {
        $km = CaregiverGigResource::haversineKm(
            $lat,
            $lng,
            (float) $booking->gig->latitude,
            (float) $booking->gig->longitude,
        );

        return (int) round($km * 1000);
    }

    /**
     * Idempotent: recomputes the full flag set from the booking's current
     * check-in/out data, so calling it on any transition is safe. Only
     * writes when the computed set differs from the persisted one, avoiding
     * gratuitous updated_at churn.
     */
    private function evaluateAnomalyFlags(Booking $booking): void
    {
        $reasons = [];

        if (($booking->check_in_distance_m ?? 0) > Booking::CHECK_IN_FLAG_RADIUS_M) {
            $reasons[] = Booking::FLAG_CHECK_IN_FAR;
        }

        if (($booking->check_out_distance_m ?? 0) > Booking::CHECK_IN_FLAG_RADIUS_M) {
            $reasons[] = Booking::FLAG_CHECK_OUT_FAR;
        }

        if ($booking->check_in_at && $booking->check_out_at && $booking->duration_minutes > 0) {
            $actual = (int) $booking->check_in_at->diffInMinutes($booking->check_out_at, absolute: true);
            if ($actual < $booking->duration_minutes * Booking::DURATION_ANOMALY_RATIO) {
                $reasons[] = Booking::FLAG_SHORT_DURATION;
            }
        }

        $current = $booking->flag_reasons ?? [];
        if ($reasons === $current) {
            return;
        }

        $booking->update([
            'flagged_at' => $reasons === [] ? null : ($booking->flagged_at ?? now()),
            'flag_reasons' => $reasons === [] ? null : $reasons,
        ]);
    }

    private function cancelledPaymentStatus(Booking $booking, bool $feeRetained): string
    {
        if ($booking->payment_status === Booking::PAYMENT_NOT_REQUIRED) {
            return Booking::PAYMENT_NOT_REQUIRED;
        }

        $realStripe = $booking->stripe_payment_intent_id !== null;

        if ($feeRetained) {
            return $realStripe ? Booking::PAYMENT_CAPTURED : Booking::PAYMENT_CAPTURED_STUB;
        }

        return $realStripe ? Booking::PAYMENT_RELEASED : Booking::PAYMENT_RELEASED_STUB;
    }

    private function assertGigIsBookable(Gig $gig): void
    {
        if (! $gig->isPublished()) {
            throw ValidationException::withMessages([
                'gig_id' => 'This gig isn\'t available for booking right now.',
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
