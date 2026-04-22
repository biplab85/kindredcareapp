<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('gig_id')->constrained()->cascadeOnDelete();
            $table->foreignId('caregiver_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('family_profile_id')->constrained()->cascadeOnDelete();

            // Position from the original Phase 6 ranked list. Useful for
            // auditing the cascade and for the family-side "you booked the
            // #2 match" copy.
            $table->unsignedSmallInteger('match_rank')->default(1);

            // Remaining caregiver_user_ids in rank order, popped on
            // decline/expire to drive the auto-fallback.
            $table->json('fallback_queue')->nullable();

            // pending_caregiver | confirmed | in_progress | completed |
            // declined | expired | cancelled_by_family | cancelled_by_caregiver | no_show
            $table->string('status', 32)->default('pending_caregiver');

            // Stub channel until Phase 9 swaps in real Stripe.
            // not_required | authorized_stub | captured_stub | released_stub | refunded_stub
            $table->string('payment_status', 32)->default('not_required');

            // Frozen pricing — caregiver rate at booking time, total minutes,
            // and the cents breakdown the family will see on the receipt.
            // Cents everywhere so Phase 9 doesn't have to migrate decimals.
            $table->unsignedInteger('hourly_rate_cents');
            $table->unsignedInteger('duration_minutes');
            $table->unsignedInteger('subtotal_cents');
            $table->unsignedInteger('platform_fee_cents');
            $table->unsignedInteger('caregiver_payout_cents');

            $table->dateTime('scheduled_start');
            $table->dateTime('scheduled_end');

            // Address is revealed in two stages: neighbourhood always visible,
            // street-level only after the booking is confirmed.
            $table->string('address_full');
            $table->string('address_neighbourhood');

            $table->dateTime('response_deadline_at');
            $table->dateTime('responded_at')->nullable();

            $table->dateTime('cancelled_at')->nullable();
            $table->string('cancelled_by', 16)->nullable(); // family | caregiver | system
            $table->string('cancellation_reason', 255)->nullable();

            // Phase 9 will populate this; nullable for the stub flow.
            $table->string('stripe_payment_intent_id')->nullable();

            $table->timestamps();

            $table->index('gig_id');
            $table->index('caregiver_user_id');
            $table->index('status');
            $table->index('scheduled_start');
            $table->index(['caregiver_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
