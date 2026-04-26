<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Notifications\ShiftReminder;
use Illuminate\Console\Command;

/**
 * Runs every 5 minutes. For confirmed bookings, fires the caregiver-facing
 * ShiftReminder notification at two points:
 *
 *   - T-24h:  sometime between 23h50m and 24h10m before scheduled_start.
 *   - T-1h:   sometime between 50min and 1h10m before scheduled_start.
 *
 * Sent flags on the booking (reminder_24h_sent_at / reminder_1h_sent_at)
 * keep this idempotent — the scheduler is crash-safe and the window is
 * wider than the run interval so a missed tick just catches up next time.
 */
class SendShiftReminders extends Command
{
    protected $signature = 'bookings:send-shift-reminders';

    protected $description = 'Notify caregivers at T-24h and T-1h before confirmed bookings.';

    /** Tolerance window around each reminder anchor. */
    private const WINDOW_MINUTES = 10;

    public function handle(): int
    {
        $now = now();
        $count = 0;

        // T-24h window
        $startLow = $now->copy()->addHours(24)->subMinutes(self::WINDOW_MINUTES);
        $startHigh = $now->copy()->addHours(24)->addMinutes(self::WINDOW_MINUTES);

        $due24h = Booking::query()
            ->where('status', Booking::STATUS_CONFIRMED)
            ->whereNull('reminder_24h_sent_at')
            ->whereBetween('scheduled_start', [$startLow, $startHigh])
            ->with('caregiver')
            ->get();

        foreach ($due24h as $booking) {
            $booking->caregiver->notify(new ShiftReminder($booking, ShiftReminder::WINDOW_24H));
            $booking->update(['reminder_24h_sent_at' => now()]);
            $count++;
        }

        // T-1h window
        $startLow = $now->copy()->addHour()->subMinutes(self::WINDOW_MINUTES);
        $startHigh = $now->copy()->addHour()->addMinutes(self::WINDOW_MINUTES);

        $due1h = Booking::query()
            ->where('status', Booking::STATUS_CONFIRMED)
            ->whereNull('reminder_1h_sent_at')
            ->whereBetween('scheduled_start', [$startLow, $startHigh])
            ->with('caregiver')
            ->get();

        foreach ($due1h as $booking) {
            $booking->caregiver->notify(new ShiftReminder($booking, ShiftReminder::WINDOW_1H));
            $booking->update(['reminder_1h_sent_at' => now()]);
            $count++;
        }

        if ($count > 0) {
            $this->info("Sent {$count} shift reminder(s).");
        }

        return self::SUCCESS;
    }
}
