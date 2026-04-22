<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('date_of_birth')->nullable()->after('phone_verified_at');
            $table->string('gender')->nullable()->after('date_of_birth');
        });

        Schema::table('caregiver_profiles', function (Blueprint $table) {
            $table->unsignedTinyInteger('years_of_experience')->default(0)->after('travel_radius_km');
            $table->json('certifications')->nullable()->after('personality_tags');
            $table->json('references')->nullable()->after('certifications');
            $table->string('emergency_contact_name')->nullable()->after('references');
            $table->string('emergency_contact_phone')->nullable()->after('emergency_contact_name');
            $table->string('emergency_contact_relationship')->nullable()->after('emergency_contact_phone');
        });

        Schema::table('caregiver_service', function (Blueprint $table) {
            $table->unsignedTinyInteger('years_experience')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['date_of_birth', 'gender']);
        });

        Schema::table('caregiver_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'years_of_experience',
                'certifications',
                'references',
                'emergency_contact_name',
                'emergency_contact_phone',
                'emergency_contact_relationship',
            ]);
        });

        Schema::table('caregiver_service', function (Blueprint $table) {
            $table->dropColumn('years_experience');
        });
    }
};
