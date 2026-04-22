<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verification_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('check_type');
            $table->string('status')->default('not_started');
            $table->string('provider')->default('manual');
            $table->string('provider_reference_id')->nullable();
            $table->json('document_paths')->nullable();
            $table->text('admin_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'check_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_records');
    }
};
