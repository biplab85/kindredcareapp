<?php

use App\Models\Gig;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Stripe Connect is now required to publish gigs (see
 * CaregiverProfile::canPublishGigs). Any gigs that were published before
 * this rule landed for a caregiver whose `payouts_enabled` flag is false
 * get downgraded to `draft` so families can't book them — otherwise the
 * payout would have nowhere to route to.
 *
 * `draft` (not `paused`) is the right destination because `paused`
 * implies the caregiver intentionally took the gig offline, which isn't
 * what happened here. They never had a payout account in the first place.
 */
return new class extends Migration
{
    public function up(): void
    {
        $affectedGigs = DB::table('gigs')
            ->join('caregiver_profiles', 'gigs.caregiver_profile_id', '=', 'caregiver_profiles.id')
            ->where('gigs.status', Gig::STATUS_PUBLISHED)
            ->where('caregiver_profiles.payouts_enabled', false)
            ->pluck('gigs.id');

        if ($affectedGigs->isEmpty()) {
            return;
        }

        DB::table('gigs')
            ->whereIn('id', $affectedGigs)
            ->update([
                'status' => Gig::STATUS_DRAFT,
                'published_at' => null,
            ]);
    }

    public function down(): void
    {
        // Intentionally irreversible — we can't tell which gigs we
        // downgraded here vs which were drafts to begin with.
    }
};
