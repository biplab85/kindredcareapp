<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_reports', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete();

            // Type: safety (physical harm/threat), abuse (elder abuse suspicion),
            // property_damage, neglect, scope_violation, other.
            $table->string('type', 32);
            // Severity: low | medium | high | critical. Critical routes
            // straight to on-call.
            $table->string('severity', 16)->default('medium');

            $table->text('description');
            $table->json('evidence_paths')->nullable();

            // open → investigating → resolved | dismissed
            $table->string('status', 24)->default('open');

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('assigned_at')->nullable();

            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->text('resolution_note')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index(['severity', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_reports');
    }
};
