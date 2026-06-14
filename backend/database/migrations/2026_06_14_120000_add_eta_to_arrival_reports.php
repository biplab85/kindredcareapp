<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Caregiver-side response columns. The caregiver lands on /bookings/{id}
 * from the arrival-ping notification and either commits to an ETA or
 * checks in immediately. acknowledged_by lets us tell apart admin
 * acknowledgements (via the resolution flow) from caregiver "I'm coming"
 * ones — useful for the audit trail and for the family-facing copy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('arrival_reports', function (Blueprint $table) {
            $table->timestamp('eta_at')->nullable()->after('acknowledged_at');
            $table->foreignId('acknowledged_by')->nullable()->after('eta_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('arrival_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('acknowledged_by');
            $table->dropColumn('eta_at');
        });
    }
};
