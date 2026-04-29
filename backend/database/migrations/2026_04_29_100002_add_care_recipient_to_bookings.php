<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Under the Fiverr pivot, the family picks a chosen gig and books it for
 * a specific senior. The senior link lived on the legacy `gigs` table
 * (`care_recipient_id`); now that gigs are caregiver-owned listings, the
 * senior link belongs on the booking.
 *
 * `notes_from_family` lets the family pass context to the caregiver at
 * booking time — replaces the free-form description the legacy gig form
 * collected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('care_recipient_id')
                ->nullable()
                ->after('family_profile_id')
                ->constrained()
                ->nullOnDelete();
            $table->text('notes_from_family')->nullable()->after('care_recipient_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['care_recipient_id']);
            $table->dropColumn(['care_recipient_id', 'notes_from_family']);
        });
    }
};
