<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('caregiver_profiles', function (Blueprint $table) {
            // Stripe Connect Express account handle. Created lazily the first
            // time a caregiver hits the onboarding endpoint so unused rows
            // stay null.
            $table->string('stripe_connect_account_id')->nullable()->after('onboarding_complete');

            // Mirror of `payouts_enabled` + `details_submitted` on the Stripe
            // side. ReleasePayouts refuses to transfer unless this is true.
            $table->boolean('payouts_enabled')->default(false);

            // Timestamped when Stripe reports details_submitted=true — used
            // by the earnings page to display "onboarding complete" copy
            // and to surface "Continue setup" vs "Manage" CTAs on the UI.
            $table->dateTime('connect_onboarded_at')->nullable();

            $table->unique('stripe_connect_account_id');
        });
    }

    public function down(): void
    {
        Schema::table('caregiver_profiles', function (Blueprint $table) {
            $table->dropUnique(['stripe_connect_account_id']);
            $table->dropColumn(['stripe_connect_account_id', 'payouts_enabled', 'connect_onboarded_at']);
        });
    }
};
