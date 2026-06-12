<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Gig;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample completed (captured) + one refunded booking spread across the last
 * five months so the admin Revenue report's Breakdown, trend chart, and
 * totals populate with real GMV / commission / refunds / net.
 *
 * Revenue counts bookings by check_out_at where payment_status is captured
 * (GMV + commission) or refunded (refunds) — see RevenueController.
 *
 * Guarded: only seeds when no completed+captured booking exists yet, so
 * re-running never duplicates and never disturbs genuine bookings.
 */
class RevenueSeeder extends Seeder
{
    public function run(): void
    {
        $already = Booking::where('status', Booking::STATUS_COMPLETED)
            ->where('payment_status', Booking::PAYMENT_CAPTURED_STUB)
            ->exists();
        if ($already) {
            return;
        }

        $family = FamilyProfile::first();
        if (! $family) {
            $this->command->warn('No family profile — run TestUsersSeeder first. Nothing seeded.');

            return;
        }

        // One gig per service category for color variety in the trend chart.
        $gigs = Gig::with('caregiverProfile')
            ->whereNotNull('service_category_id')
            ->get()
            ->unique('service_category_id')
            ->values();

        if ($gigs->isEmpty()) {
            $this->command->warn('No gigs available — run TestUsersSeeder first. Nothing seeded.');

            return;
        }

        $duration = 120; // minutes
        $now = Carbon::now();
        $created = 0;
        $refundsMade = 0;

        $make = function (Gig $gig, Carbon $checkOut, string $paymentStatus) use ($family, $duration) {
            $rate = $gig->hourly_rate_cents ?: 2500;
            $subtotal = (int) ($rate * ($duration / 60));
            $fee = intdiv($subtotal * Booking::PLATFORM_FEE_BPS, 10000);
            $payout = $subtotal - $fee;
            $start = $checkOut->copy()->subMinutes($duration);
            $caregiverUserId = $gig->caregiverProfile?->user_id;
            if ($caregiverUserId === null) {
                return;
            }

            Booking::create([
                'gig_id' => $gig->id,
                'caregiver_user_id' => $caregiverUserId,
                'family_profile_id' => $family->id,
                'care_recipient_id' => null,
                'match_rank' => 1,
                'status' => Booking::STATUS_COMPLETED,
                'payment_status' => $paymentStatus,
                'hourly_rate_cents' => $rate,
                'duration_minutes' => $duration,
                'subtotal_cents' => $subtotal,
                'platform_fee_cents' => $fee,
                'caregiver_payout_cents' => $payout,
                'address_full' => '128 Simcoe St N, Oshawa, ON L1G 4S6',
                'address_neighbourhood' => 'Oshawa',
                'scheduled_start' => $start,
                'scheduled_end' => $checkOut,
                'response_deadline_at' => $start->copy()->subDays(3),
                'responded_at' => $start->copy()->subDays(2),
                'check_in_at' => $start->copy()->addMinute(),
                'check_out_at' => $checkOut,
                'family_confirmed_at' => $checkOut->copy()->addDay(),
            ]);
        };

        // 5 months back → this month. 2–3 visits per month, rotating gigs so
        // categories vary. check_out lands mid- and late-month.
        $gigCount = $gigs->count();
        $rot = 0;

        for ($monthsAgo = 4; $monthsAgo >= 0; $monthsAgo--) {
            $base = $now->copy()->subMonths($monthsAgo);
            $visitsThisMonth = 2 + ($monthsAgo % 2); // 2 or 3

            for ($v = 0; $v < $visitsThisMonth; $v++) {
                $gig = $gigs[$rot % $gigCount];
                $rot++;
                $day = 8 + $v * 7; // 8th, 15th, 22nd
                $checkOut = $base->copy()->setDay(min($day, 27))->setTime(14, 0);
                // Keep everything in the past relative to "now".
                if ($checkOut->greaterThan($now)) {
                    $checkOut = $now->copy()->subDays(2)->setTime(14, 0);
                }
                $make($gig, $checkOut, Booking::PAYMENT_CAPTURED_STUB);
                $created++;
            }
        }

        // One refunded visit (two months ago) so the Refunds tile + a refund
        // line in the breakdown have data.
        $refundGig = $gigs[0];
        $refundCheckout = $now->copy()->subMonths(2)->setDay(18)->setTime(11, 0);
        $make($refundGig, $refundCheckout, Booking::PAYMENT_REFUNDED_STUB);
        $refundsMade++;

        $this->command->info("Seeded {$created} completed (captured) + {$refundsMade} refunded booking(s).");
    }
}
