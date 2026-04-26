<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\User;

/**
 * Single chokepoint for writing admin audit-log rows. Controllers hand it the
 * acting admin, an action slug, and optional target/metadata/reason — the
 * service handles the persistence so callers don't drift apart on field names.
 */
class AdminAuditLogger
{
    /**
     * Record an admin action. Returns the persisted row in case the caller
     * wants to surface it (e.g. echo back the log id in a response).
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function record(
        User $admin,
        string $action,
        ?string $targetType = null,
        ?int $targetId = null,
        ?array $metadata = null,
        ?string $reason = null,
    ): AdminAuditLog {
        return AdminAuditLog::create([
            'admin_user_id' => $admin->id,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'metadata' => $metadata,
            'reason' => $reason,
        ]);
    }
}
