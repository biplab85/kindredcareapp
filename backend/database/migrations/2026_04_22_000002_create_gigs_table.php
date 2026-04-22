<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gigs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('care_recipient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('service_category_id')->constrained();

            $table->string('description', 500);

            $table->string('location_address');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);

            $table->dateTime('scheduled_start');
            $table->dateTime('scheduled_end');
            $table->boolean('is_recurring')->default(false);
            $table->json('recurrence_pattern')->nullable();

            $table->json('preferences')->nullable();

            $table->string('photo_path')->nullable();

            $table->enum('status', ['open', 'matched', 'booked', 'completed', 'cancelled'])
                ->default('open');

            $table->timestamps();

            $table->index(['latitude', 'longitude']);
            $table->index('status');
            $table->index('scheduled_start');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gigs');
    }
};
