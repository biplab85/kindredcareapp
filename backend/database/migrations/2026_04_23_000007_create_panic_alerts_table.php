<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('panic_alerts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('caregiver_user_id')->constrained('users')->cascadeOnDelete();

            $table->dateTime('triggered_at');

            // GPS snapshot at trigger time. Latitude/longitude can be null
            // if the caregiver denied location permission — we still capture
            // the alert, just without coords. decimal matches EVV columns.
            $table->decimal('gps_lat', 10, 7)->nullable();
            $table->decimal('gps_lng', 10, 7)->nullable();

            // Silent mode = no visible indication to the senior/family.
            // Same trigger semantics; UI just hides the confirmation toast.
            $table->boolean('silent')->default(false);

            // active → acknowledged → resolved
            $table->string('status', 24)->default('active');

            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('acknowledged_at')->nullable();

            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->text('resolution_note')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index(['status', 'triggered_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('panic_alerts');
    }
};
