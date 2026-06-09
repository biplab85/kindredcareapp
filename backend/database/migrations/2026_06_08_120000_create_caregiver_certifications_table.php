<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Promote caregiver certifications from a JSON column on caregiver_profiles
 * to a proper relational table so each cert can carry its own document,
 * admin review status, expiry, and audit trail. The JSON shape couldn't
 * support per-cert verification, signed-URL document preview, or "show me
 * every pending cert review" queries.
 *
 * Backfill: existing JSON entries are migrated to rows with
 * status='self_reported' (no document on file). Caregivers can re-attach
 * the originals via /profile/edit later if they want them verified.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caregiver_certifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caregiver_profile_id')
                ->constrained('caregiver_profiles')
                ->cascadeOnDelete();

            $table->string('name', 100);
            $table->string('issuer', 200)->nullable();
            $table->smallInteger('year')->nullable();

            // Private-disk path to the uploaded PDF/image. Null when the
            // cert is self-reported (no document on file).
            $table->string('document_path')->nullable();

            // self_reported / pending_review / verified / rejected
            // Phase 2: 'expired' once the expiry cron is wired.
            $table->string('status', 20)->default('self_reported')->index();

            // Expiry — column lands now so the Phase 2 cron has somewhere
            // to read from. No logic enforces it yet.
            $table->date('expires_at')->nullable();

            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason', 500)->nullable();

            $table->timestamps();

            $table->index(['caregiver_profile_id', 'status']);
        });

        // Backfill existing JSON entries → rows. Hand-rolled SQL because
        // the JSON shape is loose (name + optional issuer + optional year).
        // Reads from the soon-to-be-dropped column, so this MUST run before
        // the dropColumn step below.
        if (Schema::hasColumn('caregiver_profiles', 'certifications')) {
            $rows = DB::table('caregiver_profiles')
                ->whereNotNull('certifications')
                ->where('certifications', '!=', '[]')
                ->get(['id', 'certifications']);

            $now = now();
            foreach ($rows as $row) {
                $entries = json_decode((string) $row->certifications, true);
                if (! is_array($entries)) {
                    continue;
                }
                foreach ($entries as $entry) {
                    if (! is_array($entry) || empty($entry['name'])) {
                        continue;
                    }
                    DB::table('caregiver_certifications')->insert([
                        'caregiver_profile_id' => $row->id,
                        'name' => mb_substr((string) $entry['name'], 0, 100),
                        'issuer' => isset($entry['issuer']) ? mb_substr((string) $entry['issuer'], 0, 200) : null,
                        'year' => isset($entry['year']) && is_numeric($entry['year'])
                            ? (int) $entry['year']
                            : null,
                        'status' => 'self_reported',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            Schema::table('caregiver_profiles', function (Blueprint $table) {
                $table->dropColumn('certifications');
            });
        }
    }

    public function down(): void
    {
        Schema::table('caregiver_profiles', function (Blueprint $table) {
            $table->json('certifications')->nullable();
        });

        // Best-effort restore: collapse the table back into the JSON column.
        // Documents and admin-review state are lost — there's nowhere on the
        // JSON shape to put them.
        DB::table('caregiver_certifications')
            ->orderBy('caregiver_profile_id')
            ->orderBy('id')
            ->get(['caregiver_profile_id', 'name', 'issuer', 'year'])
            ->groupBy('caregiver_profile_id')
            ->each(function ($entries, $profileId) {
                DB::table('caregiver_profiles')
                    ->where('id', $profileId)
                    ->update([
                        'certifications' => json_encode($entries->map(fn ($e) => [
                            'name' => $e->name,
                            'issuer' => $e->issuer,
                            'year' => $e->year,
                        ])->values()->all()),
                    ]);
            });

        Schema::dropIfExists('caregiver_certifications');
    }
};
