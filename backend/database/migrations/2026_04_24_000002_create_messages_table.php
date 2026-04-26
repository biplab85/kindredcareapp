<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();

            // Persisted body is the *redacted* version — what the recipient
            // sees and what admins moderate. The raw body is never stored,
            // and the list of what was caught lives in `redactions` so the
            // moderation team can spot patterns.
            $table->text('body');

            // Array of {kind, original, replacement} entries. Empty array =
            // clean message. Examples of `kind`: phone, email, postal_code,
            // off_platform.
            $table->json('redactions')->nullable();

            // Hidden = admin moderation soft-delete. Recipient sees a
            // placeholder card; sender sees their own original.
            $table->dateTime('hidden_at')->nullable();
            $table->foreignId('hidden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('hidden_reason', 255)->nullable();

            $table->dateTime('read_at')->nullable();

            $table->timestamps();

            $table->index(['booking_id', 'created_at']);
            $table->index('sender_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
