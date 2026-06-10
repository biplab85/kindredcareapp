<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Dev-only bookings seeder — populates the /bookings tabs for caregiver1.
 *
 *  HOW THE TABS ARE DECIDED  (see BookingController::expandStatusFilter)
 *  ───────────────────────────────────────────────────────────────────
 *  The tab is chosen ONLY by the booking `status` column (not the date):
 *
 *    UPCOMING  → status: pending_caregiver, confirmed
 *    ACTIVE    → status: in_progress
 *    PAST      → status: completed, cancelled_by_family,
 *                        cancelled_by_caregiver, declined, expired, no_show
 *
 *  So to put a row in a tab, you only need to set the right `status`.
 *  The dates below are just realistic touches (future = upcoming, etc.).
 *
 *  RUN IT:   php artisan db:seed --class=DevBookingsSeeder
 *  (safe to re-run — it appends a fresh set each time)
 */
class DevBookingsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Who the bookings belong to (the caregiver who sees them).
        $cg = User::where('email', 'caregiver1@kindredcare.ca')->first();
        if (! $cg) {
            $this->command->warn('caregiver1@kindredcare.ca not found — nothing seeded.');

            return;
        }

        // 2. A gig (its rate/category drive the card) + a family (the booker).
        $gig = Gig::where('caregiver_profile_id', $cg->caregiverProfile?->id)->first() ?? Gig::first();
        $family = FamilyProfile::first();
        if (! $gig || ! $family) {
            $this->command->warn('No gig or family profile available — nothing seeded.');

            return;
        }

        // 3. Money math — same rule the real booking flow uses (7.5% fee).
        $rate = $gig->hourly_rate_cents ?: 2500;
        $duration = 120; // minutes (2 hours)
        $subtotal = (int) ($rate * ($duration / 60));
        $fee = intdiv($subtotal * Booking::PLATFORM_FEE_BPS, 10000);
        $payout = $subtotal - $fee;
        $now = Carbon::now();

        // Fields shared by every row.
        $base = [
            'gig_id' => $gig->id,
            'caregiver_user_id' => $cg->id,
            'family_profile_id' => $family->id,
            'care_recipient_id' => null,
            'match_rank' => 1,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => $rate,
            'duration_minutes' => $duration,
            'subtotal_cents' => $subtotal,
            'platform_fee_cents' => $fee,
            'caregiver_payout_cents' => $payout,
            'address_full' => '128 Simcoe St N, Oshawa, ON L1G 4S6',
            'address_neighbourhood' => 'Oshawa',
        ];

        // Small helper: a row = base + status + dates + any extras.
        $make = fn (string $status, Carbon $start, array $extra = []) => array_merge($base, [
            'status' => $status,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addMinutes($duration),
            'response_deadline_at' => $now->copy()->addHours(4),
        ], $extra);

        $rows = [
            /* ── UPCOMING (pending_caregiver / confirmed) ──────────────── */
            // pending offer — live response window → shows the countdown +
            // the Accept / Decline buttons (only a caregiver sees these).
            $make(Booking::STATUS_PENDING_CAREGIVER, $now->copy()->addDay()->setTime(9, 0)),
            $make(Booking::STATUS_PENDING_CAREGIVER, $now->copy()->addDays(3)->setTime(15, 30)),
            // confirmed visit
            $make(Booking::STATUS_CONFIRMED, $now->copy()->addDays(6)->setTime(11, 0), [
                'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
                'responded_at' => $now->copy()->subDay(),
            ]),

            /* ── ACTIVE (in_progress) ──────────────────────────────────── */
            $make(Booking::STATUS_IN_PROGRESS, $now->copy()->subMinutes(40), [
                'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
                'responded_at' => $now->copy()->subDay(),
                'check_in_at' => $now->copy()->subMinutes(35),
                'safety_acknowledged_at' => $now->copy()->subMinutes(38),
            ]),

            /* ── PAST (completed / declined / cancelled) ───────────────── */
            $make(Booking::STATUS_COMPLETED, $now->copy()->subDays(7)->setTime(10, 0), [
                'payment_status' => Booking::PAYMENT_RELEASED_STUB,
                'responded_at' => $now->copy()->subDays(8),
                'check_in_at' => $now->copy()->subDays(7)->setTime(10, 1),
                'check_out_at' => $now->copy()->subDays(7)->setTime(12, 0),
                'family_confirmed_at' => $now->copy()->subDays(6),
            ]),
            $make(Booking::STATUS_DECLINED, $now->copy()->subDays(9)->setTime(13, 0), [
                'payment_status' => Booking::PAYMENT_NOT_REQUIRED,
                'responded_at' => $now->copy()->subDays(10),
            ]),
            $make(Booking::STATUS_CANCELLED_CAREGIVER, $now->copy()->subDays(11)->setTime(16, 0), [
                'payment_status' => Booking::PAYMENT_REFUNDED_STUB,
                'cancelled_at' => $now->copy()->subDays(11),
                'cancelled_by' => Booking::CANCELLED_BY_CAREGIVER,
                'cancellation_reason' => 'Schedule conflict.',
            ]),
        ];

        foreach ($rows as $row) {
            Booking::create($row);
        }

        $this->command->info('Seeded '.count($rows)." bookings for caregiver_user_id={$cg->id} (gig {$gig->id}).");
    }
}
