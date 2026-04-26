<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // When the 24-hour dispute window closes and the caregiver
            // payout becomes eligible to release. Written on check-out.
            // ReleasePayouts compares against now(). Dispute-opened resets
            // this to null (or we key off payment_status — both work).
            $table->dateTime('payout_at')->nullable()->after('check_out_distance_m');

            // Timestamped once Stripe's Transfer has been created. Doubles
            // as a dedupe guard for the scheduler.
            $table->dateTime('payout_transferred_at')->nullable();

            // Stripe Transfer id (`tr_...`). Populated for real-Stripe
            // bookings; stays null on the stub channel.
            $table->string('stripe_transfer_id')->nullable();

            $table->index('payout_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['payout_at']);
            $table->dropColumn(['payout_at', 'payout_transferred_at', 'stripe_transfer_id']);
        });
    }
};
