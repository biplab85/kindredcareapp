<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fiverr-pivot migration. Legacy `gigs` was a family service request;
 * under the corrected direction it's a caregiver's productized service
 * listing. Visit specifics (date/time, address, recurrence) move to
 * `bookings`, which already carries them.
 *
 * Dev-only migration: idempotent against partial state. Wipes booking +
 * gig rows so dropping family-direction columns works without violating
 * NOT NULL constraints.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('bookings')->delete();
        DB::table('gigs')->delete();
        Schema::enableForeignKeyConstraints();

        // Phase 1: drop legacy family-direction columns + indexes (only
        // the ones that still exist). Each block guarded so a rerun is safe.
        if (Schema::hasColumn('gigs', 'latitude')) {
            Schema::table('gigs', function (Blueprint $table) {
                $table->dropIndex(['latitude', 'longitude']);
            });
        }
        if (Schema::hasColumn('gigs', 'scheduled_start')) {
            Schema::table('gigs', function (Blueprint $table) {
                $table->dropIndex(['scheduled_start']);
            });
        }
        // The legacy `status` enum had a single-column index too.
        $legacyStatusIndex = collect(DB::select("SHOW INDEX FROM gigs WHERE Key_name = 'gigs_status_index'"))
            ->isNotEmpty();
        if ($legacyStatusIndex) {
            Schema::table('gigs', function (Blueprint $table) {
                $table->dropIndex(['status']);
            });
        }

        if (Schema::hasColumn('gigs', 'family_profile_id')) {
            Schema::table('gigs', function (Blueprint $table) {
                $table->dropForeign(['family_profile_id']);
                $table->dropColumn('family_profile_id');
            });
        }
        if (Schema::hasColumn('gigs', 'care_recipient_id')) {
            Schema::table('gigs', function (Blueprint $table) {
                $table->dropForeign(['care_recipient_id']);
                $table->dropColumn('care_recipient_id');
            });
        }

        $columnsToDrop = array_filter([
            Schema::hasColumn('gigs', 'location_address') ? 'location_address' : null,
            Schema::hasColumn('gigs', 'latitude') ? 'latitude' : null,
            Schema::hasColumn('gigs', 'longitude') ? 'longitude' : null,
            Schema::hasColumn('gigs', 'scheduled_start') ? 'scheduled_start' : null,
            Schema::hasColumn('gigs', 'scheduled_end') ? 'scheduled_end' : null,
            Schema::hasColumn('gigs', 'is_recurring') ? 'is_recurring' : null,
            Schema::hasColumn('gigs', 'recurrence_pattern') ? 'recurrence_pattern' : null,
            Schema::hasColumn('gigs', 'preferences') ? 'preferences' : null,
            Schema::hasColumn('gigs', 'posting_mode') ? 'posting_mode' : null,
        ]);
        if ($columnsToDrop !== []) {
            Schema::table('gigs', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }

        // Legacy `status` was an ENUM; replacing with a plain string so we
        // don't fight Doctrine over enum modifications.
        if (Schema::hasColumn('gigs', 'status')) {
            // Detect whether it's still the legacy enum vs already a string.
            $col = collect(DB::select("SHOW COLUMNS FROM gigs LIKE 'status'"))->first();
            $isLegacyEnum = $col && str_starts_with(strtolower($col->Type ?? ''), 'enum(');
            if ($isLegacyEnum) {
                Schema::table('gigs', function (Blueprint $table) {
                    $table->dropColumn('status');
                });
            }
        }

        // Phase 2: add caregiver-direction columns + FKs. Each guarded.
        Schema::table('gigs', function (Blueprint $table) {
            if (! Schema::hasColumn('gigs', 'caregiver_profile_id')) {
                $table->foreignId('caregiver_profile_id')
                    ->after('id')
                    ->constrained()
                    ->cascadeOnDelete();
            }
            if (! Schema::hasColumn('gigs', 'service_category_id')) {
                $table->foreignId('service_category_id')
                    ->after('caregiver_profile_id')
                    ->constrained();
            }
            if (! Schema::hasColumn('gigs', 'title')) {
                $table->string('title')->after('service_category_id');
            }
            if (! Schema::hasColumn('gigs', 'hourly_rate_cents')) {
                $table->unsignedInteger('hourly_rate_cents')->after('title');
            }
            if (! Schema::hasColumn('gigs', 'tasks_included')) {
                $table->json('tasks_included')->nullable()->after('description');
            }
            if (! Schema::hasColumn('gigs', 'status')) {
                $table->string('status', 16)->default('draft')->after('photo_path');
            }
            if (! Schema::hasColumn('gigs', 'published_at')) {
                $table->dateTime('published_at')->nullable()->after('status');
            }
        });

        // Indexes (idempotent — guard each).
        $idx = fn (string $name) => collect(DB::select('SHOW INDEX FROM gigs WHERE Key_name = ?', [$name]))->isNotEmpty();
        Schema::table('gigs', function (Blueprint $table) use ($idx) {
            if (! $idx('gigs_status_index')) {
                $table->index('status');
            }
        });
    }

    public function down(): void
    {
        // No-op rollback — pivot is one-way for dev. Restoring the legacy
        // shape here would require recreating relations that have been
        // dropped from models and controllers.
    }
};
