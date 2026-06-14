<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Family-side arrival reports. Separate from PanicButton (real-time
 * safety escalation) and from BookingDispute (post-visit money
 * channel) — this is the medium-severity middle path for when the
 * family observes the caregiver isn't actually there.
 *
 * Two trigger states (enforced server-side):
 *   - reason: not_yet_arrived          — booking confirmed, no check-in, past scheduled_start
 *   - reason: not_at_site_despite_checkin — booking in_progress, family disputes presence
 *
 * Status moves: open → acknowledged → resolved_* (admin-driven).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arrival_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason_code', 64);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arrival_reports');
    }
};
