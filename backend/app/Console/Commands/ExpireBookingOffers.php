<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Console\Command;

/**
 * Runs every minute. For any offer whose response deadline has passed,
 * closes it and cascades to the next-ranked caregiver.
 */
class ExpireBookingOffers extends Command
{
    protected $signature = 'bookings:expire-offers';

    protected $description = 'Expire pending booking offers whose response window has elapsed and cascade to the next caregiver.';

    public function handle(BookingService $service): int
    {
        $candidates = Booking::query()
            ->pending()
            ->where('response_deadline_at', '<', now())
            ->get();

        if ($candidates->isEmpty()) {
            return self::SUCCESS;
        }

        $this->info("Expiring {$candidates->count()} stale offer(s).");

        foreach ($candidates as $booking) {
            try {
                $service->expireOffer($booking);
            } catch (\Throwable $e) {
                report($e);
                $this->error("Failed to expire booking {$booking->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
