<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PIPEDA requires recording explicit, granular consent that can be
 * proven later. Each row is an append-only consent grant or revocation
 * for one (user, kind, policy_version) tuple. Latest row by created_at
 * wins when checking current state.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_consents', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Kind of consent. Kept open-ended in case Phase 15+ adds more
            // (e.g. third-party data sharing, research use). Current values:
            //   - terms_of_service
            //   - privacy_policy
            //   - biometric_collection (Veriff ID + selfie)
            //   - background_check (Certn CPIC + AML)
            //   - marketing_email
            //   - marketing_sms
            $table->string('kind', 64);

            // Whether this row records a grant or a revocation. Lets us
            // distinguish "never opted in" from "opted in then changed mind"
            // without losing the audit trail.
            $table->boolean('granted');

            // Snapshot of the policy version the user agreed to. When we
            // publish a new ToS, existing rows lock in the old version so
            // we can prompt re-consent only on changes.
            $table->string('policy_version', 16)->nullable();

            // Audit metadata — IP + user-agent at time of grant. Empty
            // for system-initiated grants (e.g. backfill migration).
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent', 255)->nullable();

            // Append-only: only created_at, no updated_at.
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'kind']);
            $table->index('kind');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_consents');
    }
};
