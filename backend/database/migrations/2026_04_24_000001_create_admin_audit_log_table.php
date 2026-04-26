<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_log', function (Blueprint $table) {
            $table->id();

            // Who took the action.
            $table->foreignId('admin_user_id')->constrained('users')->cascadeOnDelete();

            // What action — namespaced (`user.suspended`, `panic.resolved`).
            $table->string('action', 64);

            // Polymorphic target. target_type is a short slug, not a model
            // class — keeps the log readable and decoupled from refactors.
            $table->string('target_type', 40)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();

            // Free-form context (gps coords, prior status, etc.).
            $table->json('metadata')->nullable();

            // Admin-provided rationale, when one was required by the action.
            $table->text('reason')->nullable();

            // Audit logs are immutable — only a creation timestamp.
            $table->timestamp('created_at')->useCurrent();

            $table->index(['admin_user_id', 'created_at']);
            $table->index(['target_type', 'target_id']);
            $table->index('action');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_log');
    }
};
