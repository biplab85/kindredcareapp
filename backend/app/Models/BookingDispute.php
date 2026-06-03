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
 * @property string $reason_code
 * @property string $description
 * @property array<int, string>|null $evidence_paths
 * @property string $status
 * @property int|null $resolved_by
 * @property Carbon|null $resolved_at
 * @property string|null $resolution_code
 * @property int|null $resolution_refund_cents
 * @property string|null $resolution_note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Booking $booking
 * @property-read User $reporter
 * @property-read User|null $resolver
 */
class BookingDispute extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_UNDER_REVIEW = 'under_review';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_DISMISSED = 'dismissed';

    public const OPEN_STATUSES = [self::STATUS_OPEN, self::STATUS_UNDER_REVIEW];

    public const RESOLUTION_FULL_REFUND = 'full_refund';

    public const RESOLUTION_PARTIAL_REFUND = 'partial_refund';

    public const RESOLUTION_RELEASE_TO_CAREGIVER = 'release_to_caregiver';

    public const RESOLUTION_NO_ACTION = 'no_action';

    /** Reason codes are open-ended — admin dashboards group them as needed. */
    public const REASON_CODES = [
        'no_show',
        'late_arrival',
        'early_leave',
        'scope_creep',
        'property_damage',
        'theft',
        'safety',
        'quality',
        'fraud',
        'other',
    ];

    protected $fillable = [
        'booking_id',
        'reporter_user_id',
        'reason_code',
        'description',
        'evidence_paths',
        'status',
        'resolved_by',
        'resolved_at',
        'resolution_code',
        'resolution_refund_cents',
        'resolution_note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FKs cast to int — see Booking::casts() for context.
            'booking_id' => 'int',
            'reporter_user_id' => 'int',
            'resolved_by' => 'int',
            'evidence_paths' => 'array',
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
     * @return BelongsTo<User, $this>
     */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    /**
     * @param  Builder<BookingDispute>  $query
     * @return Builder<BookingDispute>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }
}
