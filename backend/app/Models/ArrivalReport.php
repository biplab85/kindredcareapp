<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $booking_id
 * @property int $reporter_user_id
 * @property string $reason_code
 * @property string|null $description
 * @property string $status
 * @property int|null $resolved_by
 * @property Carbon|null $acknowledged_at
 * @property Carbon|null $resolved_at
 * @property string|null $admin_notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Booking $booking
 * @property-read User $reporter
 */
class ArrivalReport extends Model
{
    /** Booking is confirmed, past scheduled_start, no check-in. */
    public const REASON_NOT_YET_ARRIVED = 'not_yet_arrived';

    /** Booking is in_progress (caregiver checked in) but family disputes presence. */
    public const REASON_NOT_AT_SITE_DESPITE_CHECKIN = 'not_at_site_despite_checkin';

    public const REASON_CODES = [
        self::REASON_NOT_YET_ARRIVED,
        self::REASON_NOT_AT_SITE_DESPITE_CHECKIN,
    ];

    public const STATUS_OPEN = 'open';

    public const STATUS_ACKNOWLEDGED = 'acknowledged';

    public const STATUS_RESOLVED_ARRIVED = 'resolved_arrived';

    public const STATUS_RESOLVED_NO_SHOW = 'resolved_no_show';

    public const STATUS_RESOLVED_FALSE_REPORT = 'resolved_false_report';

    public const OPEN_STATUSES = [self::STATUS_OPEN, self::STATUS_ACKNOWLEDGED];

    protected $fillable = [
        'booking_id',
        'reporter_user_id',
        'reason_code',
        'description',
        'status',
        'resolved_by',
        'acknowledged_at',
        'resolved_at',
        'admin_notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'booking_id' => 'int',
            'reporter_user_id' => 'int',
            'resolved_by' => 'int',
            'acknowledged_at' => 'datetime',
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
}
