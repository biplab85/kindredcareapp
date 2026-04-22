<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caregiver_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('bio')->nullable();
            $table->string('address')->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('hourly_rate', 5, 2)->default(25.00);
            $table->unsignedSmallInteger('travel_radius_km')->default(10);
            $table->json('languages')->nullable();
            $table->json('interests')->nullable();
            $table->json('personality_tags')->nullable();
            $table->json('availability')->nullable();
            $table->string('photo_path')->nullable();
            $table->string('photo_status')->default('none');
            $table->boolean('onboarding_complete')->default(false);
            $table->timestamps();

            $table->index(['latitude', 'longitude']);
        });

        Schema::create('caregiver_service', function (Blueprint $table) {
            $table->foreignId('caregiver_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_category_id')->constrained()->cascadeOnDelete();
            $table->primary(['caregiver_profile_id', 'service_category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caregiver_service');
        Schema::dropIfExists('caregiver_profiles');
    }
};
