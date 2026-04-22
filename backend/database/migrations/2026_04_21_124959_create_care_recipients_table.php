<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_profile_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedTinyInteger('age')->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->string('language')->nullable();
            $table->json('interests')->nullable();
            $table->text('accessibility_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_recipients');
    }
};
