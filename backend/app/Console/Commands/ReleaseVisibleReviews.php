<?php

namespace App\Console\Commands;

use App\Services\ReviewService;
use Illuminate\Console\Command;

/**
 * Daily sweep. Any review whose 7-day grace window has elapsed and hasn't
 * already been surfaced (either by mutual-rating or by admin) becomes
 * visible on its own. Matches the mvp-requirements §4.10 rule: "Reviews
 * become visible on the profile after both parties have rated, OR after
 * 7 days — whichever comes first."
 */
class ReleaseVisibleReviews extends Command
{
    protected $signature = 'reviews:release-visible';

    protected $description = 'Surface reviews whose 7-day grace window has elapsed without mutual-rating.';

    public function handle(ReviewService $service): int
    {
        $released = $service->releaseTimeBasedVisibility();

        if ($released > 0) {
            $this->info("Surfaced {$released} time-released review(s).");
        }

        return self::SUCCESS;
    }
}
