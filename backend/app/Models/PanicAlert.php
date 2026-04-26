<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $booking_id
 * @property int $caregiver_user_id
 * @property Carbon $triggered_at
 * @property float|null $gps_lat
 * @property float|null $gps_lng
 * @property bool $silent
 * @property string $status
 * @property int|null $acknowledged_by
 * @property Carbon|null $acknowledged_at
 * @property int|null $resolved_by
 * @property Carbon|null $resolved_at
 * @property string|null $resolution_note
 * @property-read Booking $booking
 * @property-read User $caregiver
 */
class PanicAlert extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_ACKNOWLEDGED = 'acknowledged';

    public const STATUS_RESOLVED = 'resolved';

    public const OPEN_STATUSES = [self::STATUS_ACTIVE, self::STATUS_ACKNOWLEDGED];

    protected $fillable = [
        'booking_id',
        'caregiver_user_id',
        'triggered_at',
        'gps_lat',
        'gps_lng',
        'silent',
        'status',
        'acknowledged_by',
        'acknowledged_at',
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
            'triggered_at' => 'datetime',
            'gps_lat' => 'float',
            'gps_lng' => 'float',
            'silent' => 'boolean',
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
    public function caregiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caregiver_user_id');
    }

    /**
     * @param  Builder<PanicAlert>  $query
     * @return Builder<PanicAlert>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }
}
