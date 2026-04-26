<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Phase 15.D — interim biometric data retention bound. Until Veriff
 * integration lands and we stop touching ID photos / selfies entirely,
 * this command sweeps anything under verifications/ older than 30 days
 * to cap exposure window. See docs/BIOMETRIC_DATA_POLICY.md.
 */
class PurgeStaleVerificationFiles extends Command
{
    protected $signature = 'verifications:purge-stale {--days=30 : Files older than this many days are deleted}';

    protected $description = 'Delete verification documents older than the retention window. Bounds biometric data exposure during the MVP stub channel.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoff = Carbon::now()->subDays($days);

        $disk = Storage::disk('private');

        if (! $disk->exists('verifications')) {
            $this->info('No verifications/ directory present — nothing to purge.');

            return self::SUCCESS;
        }

        $files = $disk->allFiles('verifications');
        $deleted = 0;

        foreach ($files as $path) {
            $modified = Carbon::createFromTimestamp($disk->lastModified($path));
            if ($modified->lessThan($cutoff)) {
                $disk->delete($path);
                $deleted++;
            }
        }

        $this->info(sprintf(
            'Purged %d verification file%s older than %d days.',
            $deleted,
            $deleted === 1 ? '' : 's',
            $days,
        ));

        return self::SUCCESS;
    }
}
