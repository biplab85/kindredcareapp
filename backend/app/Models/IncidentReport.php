<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $booking_id
 * @property int $reporter_user_id
 * @property string $type
 * @property string $severity
 * @property string $description
 * @property array<int, string>|null $evidence_paths
 * @property string $status
 * @property int|null $assigned_to
 * @property Carbon|null $assigned_at
 * @property int|null $resolved_by
 * @property Carbon|null $resolved_at
 * @property string|null $resolution_note
 * @property-read Booking $booking
 * @property-read User $reporter
 */
class IncidentReport extends Model
{
    public const TYPE_SAFETY = 'safety';

    public const TYPE_ABUSE = 'abuse';

    public const TYPE_PROPERTY_DAMAGE = 'property_damage';

    public const TYPE_NEGLECT = 'neglect';

    public const TYPE_SCOPE_VIOLATION = 'scope_violation';

    public const TYPE_OTHER = 'other';

    public const TYPES = [
        self::TYPE_SAFETY,
        self::TYPE_ABUSE,
        self::TYPE_PROPERTY_DAMAGE,
        self::TYPE_NEGLECT,
        self::TYPE_SCOPE_VIOLATION,
        self::TYPE_OTHER,
    ];

    public const SEVERITY_LOW = 'low';

    public const SEVERITY_MEDIUM = 'medium';

    public const SEVERITY_HIGH = 'high';

    public const SEVERITY_CRITICAL = 'critical';

    public const SEVERITIES = [
        self::SEVERITY_LOW,
        self::SEVERITY_MEDIUM,
        self::SEVERITY_HIGH,
        self::SEVERITY_CRITICAL,
    ];

    public const STATUS_OPEN = 'open';

    public const STATUS_INVESTIGATING = 'investigating';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_DISMISSED = 'dismissed';

    public const OPEN_STATUSES = [self::STATUS_OPEN, self::STATUS_INVESTIGATING];

    protected $fillable = [
        'booking_id',
        'reporter_user_id',
        'type',
        'severity',
        'description',
        'evidence_paths',
        'status',
        'assigned_to',
        'assigned_at',
        'resolved_by',
        'resolved_at',
        'resolution_note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'evidence_paths' => 'array',
            'assigned_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Booking, $this>
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }

    /**
     * @param  Builder<IncidentReport>  $query
     * @return Builder<IncidentReport>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }
}
