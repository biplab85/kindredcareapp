<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Photo moderation is being relaxed for MVP (see ProfileController docblock).
 * Promote any existing `pending_review` rows to `approved` so historic
 * uploads stop being hidden behind a gate that's no longer staffed.
 *
 * Rejected photos are deliberately left alone — they were stopped for a
 * specific reason, not just sitting in queue.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('caregiver_profiles')
            ->where('photo_status', 'pending_review')
            ->update(['photo_status' => 'approved']);
    }

    public function down(): void
    {
        // Intentionally irreversible — we can't tell which rows we promoted
        // here vs which were always 'approved'. If the moderation gate is
        // re-tightened later, the new flow will write 'pending_review' fresh.
    }
};
