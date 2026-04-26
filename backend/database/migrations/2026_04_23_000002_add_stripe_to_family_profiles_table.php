<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('family_profiles', function (Blueprint $table) {
            // Stripe Customer handle. Lazily created the first time the
            // family attaches a payment method, so most rows stay null.
            $table->string('stripe_customer_id')->nullable()->after('city');
            // Preferred default payment method — a `pm_...` identifier
            // surfaced via Stripe Elements' SetupIntent confirmation.
            // Source of truth for the booking-authorization step.
            $table->string('default_payment_method_id')->nullable()->after('stripe_customer_id');

            $table->unique('stripe_customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('family_profiles', function (Blueprint $table) {
            $table->dropUnique(['stripe_customer_id']);
            $table->dropColumn(['stripe_customer_id', 'default_payment_method_id']);
        });
    }
};
