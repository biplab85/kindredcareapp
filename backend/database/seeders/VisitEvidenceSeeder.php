<?php

namespace Database\Seeders;

use App\Models\Booking;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Populate a booking's visit evidence (GPS check-in/out, tasks, caregiver
 * notes) and mark it completed so the post-visit cards render:
 *   - admin booking-detail "Visit evidence" panel
 *   - family/caregiver "Visit log", "Your turn" (review), and gig/caregiver cards
 *
 * Targets bookings #13 and #8 (referenced in review); falls back to the first
 * booking without a check-in. Reviews are intentionally left empty so the
 * "Your turn" rating prompt appears for both parties.
 *
 * Guarded per booking: skips any that already have a check-in, so it never
 * clobbers a genuine visit and never duplicates.
 */
class VisitEvidenceSeeder extends Seeder
{
    public function run(): void
    {
        $ids = [13, 8];
        $targets = Booking::with('gig.serviceCategory')
            ->whereIn('id', $ids)
            ->get();

        if ($targets->isEmpty()) {
            $fallback = Booking::with('gig.serviceCategory')
                ->whereNull('check_in_at')
                ->orderBy('id')
                ->first();
            if ($fallback) {
                $targets = collect([$fallback]);
            }
        }

        if ($targets->isEmpty()) {
            $this->command->warn('No booking available — run DevBookingsSeeder first. Nothing seeded.');

            return;
        }

        $fallbackTasks = [
            'Pre-visit check-in',
            'Spent time together / activity',
            'Light snack & hydration',
            'Wellness note for the family',
        ];

        $count = 0;
        foreach ($targets as $booking) {
            if ($booking->check_in_at !== null) {
                continue;
            }

            $start = $booking->scheduled_start
                ? Carbon::parse($booking->scheduled_start)
                : Carbon::now()->subDays(3)->setTime(14, 0);
            $checkIn = $start->copy()->addMinute();
            $checkOut = $start->copy()->addMinutes($booking->duration_minutes ?: 120);

            $catTasks = $booking->gig?->serviceCategory?->default_tasks;
            $tasks = is_array($catTasks) && count($catTasks) > 0
                ? array_slice($catTasks, 0, 4)
                : $fallbackTasks;

            $booking->update([
                'status' => Booking::STATUS_COMPLETED,
                'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
                'responded_at' => $start->copy()->subDay(),
                'check_in_at' => $checkIn,
                'check_in_lat' => 43.89710,
                'check_in_lng' => -78.86580,
                'check_out_at' => $checkOut,
                'check_out_lat' => 43.89725,
                'check_out_lng' => -78.86541,
                'tasks_completed' => $tasks,
                'caregiver_notes' => 'Lovely visit — good spirits throughout, calm and chatty. Everything on the list got done and the family was sent a quick update on the way out.',
                // Leave family_confirmed_at null so the family's confirm lever
                // and both parties' review prompts stay live.
            ]);
            $count++;
        }

        $this->command->info("Seeded visit evidence on {$count} booking(s).");
    }
}
