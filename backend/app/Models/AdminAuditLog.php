<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only ledger of admin actions. Every state-changing decision an admin
 * makes (suspend, reactivate, refund, resolve panic, approve verification…)
 * lands here so the team can answer "who did this, when, and why?".
 *
 * Action vocabulary uses dotted namespaces:
 *   user.suspended, user.reactivated
 *   verification.approved, verification.rejected
 *   panic.acknowledged, panic.resolved
 *   incident.assigned, incident.resolved, incident.dismissed
 *   booking.refunded, booking.dispute_resolved
 *
 * Target types are short slugs (`user`, `panic_alert`, `booking`) rather than
 * model class names so the log stays readable across refactors.
 */
class AdminAuditLog extends Model
{
    protected $table = 'admin_audit_log';

    public $timestamps = false;

    protected $fillable = [
        'admin_user_id',
        'action',
        'target_type',
        'target_id',
        'metadata',
        'reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /* Target slugs — kept here so callers don't sprinkle string literals. */
    public const TARGET_USER = 'user';

    public const TARGET_VERIFICATION_RECORD = 'verification_record';

    public const TARGET_PANIC_ALERT = 'panic_alert';

    public const TARGET_INCIDENT_REPORT = 'incident_report';

    public const TARGET_BOOKING = 'booking';

    /**
     * @return BelongsTo<User, $this>
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
