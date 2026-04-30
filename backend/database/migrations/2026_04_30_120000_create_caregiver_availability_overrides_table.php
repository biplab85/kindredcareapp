<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-date "off" overrides on top of the weekly availability template.
 *
 * Caregiver marks a specific date (e.g. Eid, vacation, doctor's
 * appointment) as unavailable even when the weekly pattern says they
 * normally work. Existence of a row = off; deletion = back to weekly
 * default. Custom hours per date can layer on later (out of scope here).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caregiver_availability_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caregiver_profile_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('note', 100)->nullable();
            $table->timestamps();

            // Explicit short name — Laravel's auto-generated one
            // (caregiver_availability_overrides_caregiver_profile_id_date_unique)
            // exceeds MySQL's 64-char identifier cap.
            $table->unique(['caregiver_profile_id', 'date'], 'cao_caregiver_date_unique');
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caregiver_availability_overrides');
    }
};
