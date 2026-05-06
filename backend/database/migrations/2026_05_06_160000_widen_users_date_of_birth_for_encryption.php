<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 15.B added the `EncryptedDate` cast to users.date_of_birth, but
 * the underlying column was still MySQL DATE — which can't hold the
 * ~250-char Crypt::encryptString blob the cast emits. Every caregiver
 * onboarding submit was 500-ing with "Incorrect date value: 'eyJ...'".
 *
 * Widening to TEXT (nullable) so the encrypted payload fits. The cast
 * round-trips back to a Carbon instance on read so application code is
 * unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('date_of_birth')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Best-effort revert. Existing encrypted blobs won't fit a DATE
        // column, so we null them out before the type change.
        Schema::table('users', function (Blueprint $table) {
            $table->text('date_of_birth')->nullable()->change();
        });
        DB::table('users')->update(['date_of_birth' => null]);
        Schema::table('users', function (Blueprint $table) {
            $table->date('date_of_birth')->nullable()->change();
        });
    }
};
