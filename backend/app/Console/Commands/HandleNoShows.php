<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Console\Command;

/**
 * Runs every minute. Any confirmed booking whose scheduled_start was more
 * than NO_SHOW_THRESHOLD_MINUTES ago and still has no check_in_at is
 * transitioned to `no_show`: the Stripe authorization is released (family
 * isn't charged), the gig re-opens so the family can re-match, and both
 * parties are notified.
 *
 * The underlying state-machine lives in BookingService::markNoShow so the
 * same path is callable from admin UIs or from tests without going through
 * the scheduler.
 */
class HandleNoShows extends Command
{
    protected $signature = 'bookings:handle-no-shows';

    protected $description = 'Release authorization and close bookings where the caregiver never checked in.';

    public function handle(BookingService $service): int
    {
        $threshold = now()->subMinutes(Booking::NO_SHOW_THRESHOLD_MINUTES);

        $candidates = Booking::query()
            ->where('status', Booking::STATUS_CONFIRMED)
            ->whereNull('check_in_at')
            ->where('scheduled_start', '<', $threshold)
            ->get();

        if ($candidates->isEmpty()) {
            return self::SUCCESS;
        }

        $this->info("Flagging {$candidates->count()} no-show booking(s).");

        foreach ($candidates as $booking) {
            try {
                $service->markNoShow($booking);
            } catch (\Throwable $e) {
                report($e);
                $this->error("Failed to no-show booking {$booking->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
