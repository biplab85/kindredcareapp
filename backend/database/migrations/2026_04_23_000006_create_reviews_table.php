<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rater_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ratee_user_id')->constrained('users')->cascadeOnDelete();

            $table->unsignedTinyInteger('stars'); // 1..5
            $table->text('body')->nullable();

            $table->dateTime('submitted_at');
            // Null until visibility rule met (both parties rated OR 7 days
            // since check_out_at — whichever comes first).
            $table->dateTime('visible_at')->nullable();

            // Moderation. Both parties can flag; admin resolves (Phase 14).
            $table->dateTime('flagged_at')->nullable();
            $table->foreignId('flagged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('flag_reason', 64)->nullable();

            // Admin resolution — if hidden_at is set the review is suppressed
            // from profiles and Trust Score aggregates.
            $table->dateTime('hidden_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();

            $table->timestamps();

            // One review per direction per booking.
            $table->unique(['booking_id', 'rater_user_id']);
            $table->index('ratee_user_id');
            $table->index('visible_at');
            $table->index('flagged_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
