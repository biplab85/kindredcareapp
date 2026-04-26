<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Pre-visit safety confirmation (risks.md §10.2 pre-visit checklist).
            // Populated when the caregiver taps "I feel safe proceeding" before
            // the Start Visit GPS capture.
            $table->dateTime('safety_acknowledged_at')->nullable()->after('caregiver_notes');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('safety_acknowledged_at');
        });
    }
};
