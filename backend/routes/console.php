<?php

use App\Console\Commands\ExpireBookingOffers;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep stale booking offers every minute. Keeps the cascade moving
// without depending on a caregiver actively declining.
Schedule::command(ExpireBookingOffers::class)->everyMinute()->withoutOverlapping();
