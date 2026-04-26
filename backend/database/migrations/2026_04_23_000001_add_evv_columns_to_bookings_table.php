<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Check-in. GPS coords captured on visit start; distance_m is the
            // meters-from-gig at capture time, used for anomaly flagging so we
            // only compute haversine once per transition.
            $table->dateTime('check_in_at')->nullable();
            $table->decimal('check_in_lat', 10, 7)->nullable();
            $table->decimal('check_in_lng', 10, 7)->nullable();
            $table->unsignedInteger('check_in_distance_m')->nullable();

            // Check-out. Same trio; the duration is derived (check_out_at -
            // check_in_at) so we don't store it redundantly.
            $table->dateTime('check_out_at')->nullable();
            $table->decimal('check_out_lat', 10, 7)->nullable();
            $table->decimal('check_out_lng', 10, 7)->nullable();
            $table->unsignedInteger('check_out_distance_m')->nullable();

            // Tasks: string keys from service_category.default_tasks that the
            // caregiver ticked off. Notes: freeform text visible to family.
            $table->json('tasks_completed')->nullable();
            $table->text('caregiver_notes')->nullable();

            // Shift reminders: one row per (booking, reminder-kind), tracked as
            // simple timestamps rather than a join table — at MVP volume this
            // is cheaper and easier to reason about.
            $table->dateTime('reminder_24h_sent_at')->nullable();
            $table->dateTime('reminder_1h_sent_at')->nullable();

            // Anomaly flagging. Set on check-out (or check-in for far-away
            // taps). Reasons is a JSON array of short codes:
            //   "check_in_far", "check_out_far", "short_duration".
            $table->dateTime('flagged_at')->nullable();
            $table->json('flag_reasons')->nullable();

            $table->index('check_in_at');
            $table->index('flagged_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['check_in_at']);
            $table->dropIndex(['flagged_at']);
            $table->dropColumn([
                'check_in_at', 'check_in_lat', 'check_in_lng', 'check_in_distance_m',
                'check_out_at', 'check_out_lat', 'check_out_lng', 'check_out_distance_m',
                'tasks_completed', 'caregiver_notes',
                'reminder_24h_sent_at', 'reminder_1h_sent_at',
                'flagged_at', 'flag_reasons',
            ]);
        });
    }
};
