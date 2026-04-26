<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_disputes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            // Typically the family's user_id, but caregivers can also file
            // (e.g. wage theft, unsafe conditions per risks.md §2.7).
            $table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete();

            // Short code for the dispute reason. Open-ended on purpose —
            // admin resolution drives policy; a rigid enum would force a
            // migration every time we learn about a new failure mode.
            //   no_show | late_arrival | early_leave | scope_creep |
            //   property_damage | theft | safety | quality | fraud | other
            $table->string('reason_code', 32);

            // Freeform complaint text. 2KB upper bound matches the visit-
            // note field so admin review has consistent payload limits.
            $table->text('description');

            // Paths under storage/app/private/disputes/{dispute_id}/ —
            // JSON array of paths to keep the row narrow. Photos or
            // screenshots the reporter attaches at filing time.
            $table->json('evidence_paths')->nullable();

            // open → under_review → resolved / dismissed.
            $table->string('status', 24)->default('open');

            // Admin resolution trio, populated together on close.
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->string('resolution_code', 32)->nullable(); // full_refund | partial_refund | release_to_caregiver | no_action
            $table->integer('resolution_refund_cents')->nullable();
            $table->text('resolution_note')->nullable();

            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_disputes');
    }
};
