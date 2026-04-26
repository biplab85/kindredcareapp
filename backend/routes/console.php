<?php

use App\Console\Commands\ExpireBookingOffers;
use App\Console\Commands\HandleNoShows;
use App\Console\Commands\PurgeStaleVerificationFiles;
use App\Console\Commands\ReleasePayouts;
use App\Console\Commands\ReleaseVisibleReviews;
use App\Console\Commands\SendShiftReminders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep stale booking offers every minute. Keeps the cascade moving
// without depending on a caregiver actively declining.
Schedule::command(ExpireBookingOffers::class)->everyMinute()->withoutOverlapping();

// Nudge caregivers at T-24h and T-1h before a confirmed visit. 5-minute
// cadence plus a ±10-minute anchor window means a missed tick still lands
// the reminder on the next run.
Schedule::command(SendShiftReminders::class)->everyFiveMinutes()->withoutOverlapping();

// Close stale confirmed bookings where the caregiver never showed up.
// Every-minute cadence matches expire-offers so no-show and offer-expiry
// share the same operational rhythm.
Schedule::command(HandleNoShows::class)->everyMinute()->withoutOverlapping();

// Release caregiver payouts for completed visits whose 24-hour dispute
// hold has elapsed. Five-minute cadence is plenty — the deadline is
// hour-scale, not second-scale.
Schedule::command(ReleasePayouts::class)->everyFiveMinutes()->withoutOverlapping();

// Surface reviews past their 7-day grace window once per day.
Schedule::command(ReleaseVisibleReviews::class)->dailyAt('02:00')->withoutOverlapping();

// Phase 15.D — bound biometric data exposure. Sweep verification documents
// older than 30 days every night during the off-peak window. Becomes a
// no-op once Veriff integration is live and we stop touching ID photos
// directly. See docs/BIOMETRIC_DATA_POLICY.md for context.
Schedule::command(PurgeStaleVerificationFiles::class)->dailyAt('03:00')->withoutOverlapping();
