<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Family-side positive confirmation that a visit happened as described.
 * When set, BookingService::confirmVisit also pulls payout_at forward to
 * now() so the caregiver gets paid immediately instead of waiting on the
 * 24-hour auto-release. Silence still works (no dispute = success), this
 * just adds a fast-path lever for engaged families.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('family_confirmed_at')->nullable()->after('payout_transferred_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('family_confirmed_at');
        });
    }
};
